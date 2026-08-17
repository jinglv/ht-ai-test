'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Crumb {
  label: string
  icon?: string
  active?: boolean
}

interface BrandHeaderProps {
  title?: string
  breadcrumbs?: Crumb[]
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  userName?: string
  onLogout?: () => Promise<void>
}

const TESTCASE_TAB_LABELS: Record<string, string> = {
  suites: '测试套件',
  requirements: '需求文档',
  executions: '执行记录',
}

function buildCrumbs(pathname: string, tab: string | null): Crumb[] {
  if (pathname.startsWith('/dashboard')) {
    return [{ label: '首页', icon: 'home', active: true }]
  }
  if (pathname.startsWith('/projects')) {
    return [{ label: '项目管理', icon: 'account_tree', active: true }]
  }
  if (pathname.startsWith('/ai-chat')) {
    return [{ label: 'AI对话分析', icon: 'psychology', active: true }]
  }
  if (pathname.startsWith('/profile')) {
    return [{ label: '个人中心', icon: 'account_circle', active: true }]
  }
  if (pathname.startsWith('/testcases')) {
    const child = tab ? TESTCASE_TAB_LABELS[tab] : undefined
    if (child) {
      return [
        { label: '用例管理', icon: 'fact_check' },
        { label: child, icon: 'chevron_right', active: true },
      ]
    }
    return [{ label: '用例管理', icon: 'fact_check', active: true }]
  }
  if (pathname.startsWith('/system/users')) {
    return [
      { label: '系统管理', icon: 'admin_panel_settings' },
      { label: '用户管理', icon: 'chevron_right', active: true },
    ]
  }
  if (pathname.startsWith('/system/roles')) {
    return [
      { label: '系统管理', icon: 'admin_panel_settings' },
      { label: '角色管理', icon: 'chevron_right', active: true },
    ]
  }
  if (pathname.startsWith('/system/permissions')) {
    return [
      { label: '系统管理', icon: 'admin_panel_settings' },
      { label: '权限管理', icon: 'chevron_right', active: true },
    ]
  }
  return [{ label: '河图智弈', icon: 'home', active: true }]
}

export default function BrandHeader({
  breadcrumbs,
  onToggleSidebar,
  sidebarCollapsed,
  userName,
  onLogout,
}: BrandHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const crumbs = breadcrumbs?.length
    ? breadcrumbs
    : buildCrumbs(pathname, searchParams.get('tab'))

  const handleLogout = async () => {
    await onLogout?.()
    router.replace('/login')
  }

  return (
    <header className="app-header">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="header-brand flex items-center gap-3">
          <div className="brand-logo">
            <Image src="/logo.png" alt="河图智弈" width={34} height={34} priority />
          </div>
          <span className="brand-name">河图智弈</span>
        </Link>
        {onToggleSidebar && (
          <>
            <button
              onClick={onToggleSidebar}
              className="header-btn"
              title={sidebarCollapsed ? '展开菜单' : '收起菜单'}
              aria-label={sidebarCollapsed ? '展开菜单' : '收起菜单'}
              aria-expanded={!sidebarCollapsed}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="crumb-sep"></div>
          </>
        )}
        {crumbs.map((crumb, idx) => (
          <div key={`${crumb.label}-${idx}`} className={`crumb-item ${crumb.active ? 'active' : ''}`}>
            {crumb.icon && (
              <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.75 }}>
                {crumb.icon}
              </span>
            )}
            <span>{crumb.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className="header-btn" title="通知">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="header-btn" title="设置">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <button className="header-btn" title="退出登录" onClick={handleLogout}>
          <span className="material-symbols-outlined">logout</span>
        </button>
        <div className="header-divider"></div>
        <Link href="/profile" className="flex items-center gap-3" title="个人中心">
          <div className="text-right leading-tight">
            <div className="user-name">{userName || '管理员'}</div>
            <div className="user-role">系统总调度</div>
          </div>
          <div className="user-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
        </Link>
      </div>
    </header>
  )
}
