'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const MENU_ITEMS = [
  { key: 'dashboard', label: '首页', icon: '🏠', href: '/dashboard' },
  { key: 'projects', label: '项目管理', icon: '📁', href: '/projects' },
  { key: 'testcases', label: '用例管理', icon: '📋', href: '/testcases' },
  { key: 'ai-chat', label: 'AI 对话分析', icon: '🤖', href: '/ai-chat' },
  { key: 'users', label: '用户管理', icon: '👤', href: '/system/users' },
  { key: 'roles', label: '角色管理', icon: '🔐', href: '/system/roles' },
  { key: 'permissions', label: '权限管理', icon: '🔑', href: '/system/permissions' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('')
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const currentMenu = MENU_ITEMS.find(item => pathname.startsWith(item.href))
  const tabs = currentMenu ? [currentMenu] : []

  return (
    <div className="min-h-screen flex bg-[#F8FAFD]">
      {/* ========== 侧边栏 ========== */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen transition-all duration-300
          bg-gradient-to-b from-[#0E2A3E] via-[#1A4966] to-[#235A7D]
          border-r border-[#D7E2F0]/20
          ${collapsed ? 'w-16' : 'w-55'}
        `}
        style={{ width: collapsed ? 64 : 220 }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center text-white font-bold text-sm shadow-lg">
            河
          </div>
          {!collapsed && (
            <span className="ml-3 text-white font-bold text-lg tracking-wider">
              河图智弈
            </span>
          )}
        </div>

        {/* 菜单 */}
        <nav className="mt-4 px-2 space-y-1">
          {MENU_ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-white/15 text-white shadow-inner'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <span className="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="ml-2 truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ========== 主内容区 ========== */}
      <div
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ marginLeft: collapsed ? 64 : 220 }}
      >
        {/* ========== 顶栏 ========== */}
        <header className="h-14 bg-gradient-to-r from-[#0E2A3E] via-[#1A4966] to-[#235A7D] flex items-center justify-between px-6 shadow-md sticky top-0 z-30">
          <div className="flex items-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="ml-4 text-white/90 text-sm font-medium">
              {currentMenu?.label || '河图智弈'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-white/80 text-sm">
              {user?.real_name || user?.username}
            </span>
            <button
              onClick={logout}
              className="text-white/70 hover:text-white text-sm px-3 py-1 rounded-md hover:bg-white/10 transition-colors"
            >
              退出
            </button>
          </div>
        </header>

        {/* ========== Tab 二级页签 ========== */}
        {tabs.length > 0 && (
          <div className="bg-white border-b border-[#D7E2F0] px-6">
            <div className="flex gap-1">
              {tabs.map(tab => (
                <div
                  key={tab.key}
                  className="px-4 py-2.5 text-sm font-medium text-[#23344D] border-b-2 border-[#2A76C9]"
                >
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== 主体区 ========== */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
