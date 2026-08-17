'use client'

import { Suspense, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AppSidebar from './AppSidebar'
import BrandHeader from './BrandHeader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, logout } = useAuth()

  return (
    <>
      <Suspense fallback={<header className="app-header" />}>
        <BrandHeader
          onToggleSidebar={() => setSidebarCollapsed(value => !value)}
          sidebarCollapsed={sidebarCollapsed}
          userName={user?.real_name}
          onLogout={logout}
        />
      </Suspense>

      <div className="app-body">
        <AppSidebar collapsed={sidebarCollapsed} />

        <main className="app-main">
          {children}
        </main>
      </div>
    </>
  )
}
