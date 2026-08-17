'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  key: string
  label: string
  icon: string
  href: string
  children?: { key: string; label: string; icon: string; href: string }[]
}

const MENU_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '首页', icon: 'home', href: '/dashboard' },
  { key: 'projects', label: '项目管理', icon: 'account_tree', href: '/projects' },
  { key: 'testcases', label: '用例管理', icon: 'fact_check', href: '/testcases' },
  { key: 'ai-chat', label: 'AI对话分析', icon: 'psychology', href: '/ai-chat' },
  {
    key: 'system',
    label: '系统管理',
    icon: 'admin_panel_settings',
    href: '#',
    children: [
      { key: 'users', label: '用户管理', icon: 'person', href: '/system/users' },
      { key: 'roles', label: '角色管理', icon: 'shield_person', href: '/system/roles' },
      { key: 'permissions', label: '权限管理', icon: 'verified_user', href: '/system/permissions' },
    ],
  },
]

interface AppSidebarProps {
  collapsed?: boolean
  items?: NavItem[]
}

export default function AppSidebar({ collapsed = false, items }: AppSidebarProps) {
  const pathname = usePathname()
  const menuItems = items || MENU_ITEMS
  const [systemOpen, setSystemOpen] = useState(false)
  const systemExpanded = pathname.startsWith('/system') || systemOpen

  const isActive = (href: string) => {
    if (href === '#') return false
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const isChildActive = (children?: { href: string }[]) => {
    if (!children) return false
    return children.some(child => isActive(child.href))
  }

  return (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <nav>
        {menuItems.map(item => {
          if (item.children) {
            const childActive = isChildActive(item.children)
            return (
              <div key={item.key}>
                <button
                  type="button"
                  className={`nav-group ${childActive ? 'active' : ''}`}
                  onClick={() => setSystemOpen(open => !open)}
                  aria-expanded={systemExpanded}
                  title={collapsed ? item.label : undefined}
                  style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
                    {!collapsed && <span className="label">{item.label}</span>}
                  </div>
                  {!collapsed && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{systemExpanded ? 'expand_less' : 'expand_more'}</span>}
                </button>
                {!collapsed && systemExpanded && (
                  <div className="nav-sub">
                    {item.children.map(child => (
                      <Link
                        key={child.key}
                        href={child.href}
                        className={`nav-item ${isActive(child.href) ? 'active' : ''}`}
                      >
                        <span className="material-symbols-outlined">{child.icon}</span>
                        <span className="label">{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {!collapsed && <span className="label">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
