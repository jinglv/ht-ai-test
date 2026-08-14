'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { listProjects } from '@/lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    projects: 0,
    testcases: 0,
    passRate: 0,
    members: 0,
  })
  const [recentProjects, setRecentProjects] = useState<any[]>([])

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await listProjects({ page: 1, page_size: 5 })
      setStats(prev => ({
        ...prev,
        projects: res.data.total,
      }))
      setRecentProjects(res.data.items)
    } catch {
      // ignore
    }
  }

  const statCards = [
    { label: '项目总数', value: stats.projects, icon: '📁', color: 'from-[#2A76C9] to-[#3D88E0]' },
    { label: '用例总数', value: stats.testcases, icon: '📋', color: 'from-[#36B37E] to-[#47D498]' },
    { label: '通过率', value: `${stats.passRate}%`, icon: '✅', color: 'from-[#D4B86A] to-[#E5C97A]' },
    { label: '成员数', value: stats.members, icon: '👥', color: 'from-[#23344D] to-[#3A4F6B]' },
  ]

  return (
    <div className="space-y-6">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-[#0E2A3E] via-[#1A4966] to-[#235A7D] rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">欢迎使用河图智弈</h1>
        <p className="text-white/70">
          AI 驱动的测试管理平台，让测试更智能、更高效
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-[#D7E2F0] p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#8A99B0] mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-[#23344D]">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-xl shadow-md`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl border border-[#D7E2F0] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#23344D] mb-4">快捷入口</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '新建项目', href: '/projects', icon: '📁', color: 'bg-[#2A76C9]' },
            { label: '新建用例', href: '/testcases', icon: '📋', color: 'bg-[#36B37E]' },
            { label: 'AI 对话', href: '/ai-chat', icon: '🤖', color: 'bg-[#D4B86A]' },
            { label: '测试套件', href: '/testcases', icon: '📦', color: 'bg-[#23344D]' },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className={`flex flex-col items-center justify-center p-4 rounded-xl ${item.color} text-white hover:opacity-90 transition-opacity shadow-md`}
            >
              <span className="text-2xl mb-2">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 最近项目 */}
      <div className="bg-white rounded-xl border border-[#D7E2F0] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#23344D] mb-4">最近项目</h2>
        {recentProjects.length === 0 ? (
          <p className="text-[#8A99B0] text-sm">暂无项目，点击上方快捷入口创建</p>
        ) : (
          <div className="space-y-3">
            {recentProjects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-[#D7E2F0] hover:bg-[#F8FAFD] transition-colors"
              >
                <div>
                  <p className="font-medium text-[#23344D]">{project.name}</p>
                  <p className="text-xs text-[#8A99B0]">{project.code}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  project.status === '进行中' ? 'bg-green-100 text-green-700' :
                  project.status === '规划中' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {project.status || '未知'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
