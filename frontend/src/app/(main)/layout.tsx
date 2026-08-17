'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'

const PUBLIC_PATHS = ['/login']

export default function RootLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, router, user])

  // 公开页面直接渲染
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return <>{children}</>
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFD]">
        <div className="text-[#23344D]">加载中...</div>
      </div>
    )
  }

  // 未登录重定向（客户端路由守卫）
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFD]">
        <div className="text-[#23344D]">正在跳转登录...</div>
      </div>
    )
  }

  // 已登录，渲染主布局
  return <AppLayout>{children}</AppLayout>
}
