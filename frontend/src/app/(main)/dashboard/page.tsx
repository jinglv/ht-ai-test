'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getExecutionStats, listProjects, listTestcases, listUsers } from '@/lib/api'

interface Project {
  id: number
  code: string
  name: string
  owner_name?: string
  status: 'planning' | 'in_progress' | 'completed' | 'archived'
}

const STATUS_LABELS = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const STATUS_CLASSES = {
  planning: 'warning',
  in_progress: 'running',
  completed: 'success',
  archived: 'plain',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    projects: 0,
    testcases: 0,
    passRate: 0,
    members: 0,
  })
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [runningProjects, setRunningProjects] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const [projectsResult, testcasesResult, usersResult, executionsResult] =
        await Promise.allSettled([
          listProjects({ page: 1, page_size: 100 }),
          listTestcases({ page: 1, page_size: 1 }),
          listUsers({ page: 1, page_size: 1 }),
          getExecutionStats({ group_by: 'result' }),
        ])

      if (!active) return

      const projects =
        projectsResult.status === 'fulfilled'
          ? (projectsResult.value.data.items as unknown as Project[])
          : []

      setRecentProjects(projects.slice(0, 5))
      setRunningProjects(projects.filter((project: Project) => project.status === 'in_progress').length)
      setStats({
        projects:
          projectsResult.status === 'fulfilled' ? projectsResult.value.data.total : 0,
        testcases:
          testcasesResult.status === 'fulfilled' ? testcasesResult.value.data.total : 0,
        members: usersResult.status === 'fulfilled' ? usersResult.value.data.total : 0,
        passRate:
          executionsResult.status === 'fulfilled'
            ? Number(executionsResult.value.data.pass_rate) || 0
            : 0,
      })
      setLoadError(
        [projectsResult, testcasesResult, usersResult, executionsResult].some(
          result => result.status === 'rejected'
        )
      )
      setLoading(false)
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="page-wrap">
      <div className="welcome anim d1">
        <h1>
          欢迎回来，<span className="jin">{user?.real_name || '管理员'}</span>
        </h1>
        <div className="sub">
          今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} · 循河图数理，以智弈控测。
          当前有 <span className="jin">{loading ? '—' : runningProjects}</span> 个进行中的测试项目。
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card anim d2">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">account_tree</span>
          </div>
          <div>
            <div className="stat-val">{loading ? '—' : stats.projects.toLocaleString()}</div>
            <div className="stat-label">测试项目总数</div>
          </div>
        </div>
        <div className="stat-card anim d3">
          <div className="stat-icon gold">
            <span className="material-symbols-outlined">fact_check</span>
          </div>
          <div>
            <div className="stat-val">{loading ? '—' : stats.testcases.toLocaleString()}</div>
            <div className="stat-label">测试用例总数</div>
          </div>
        </div>
        <div className="stat-card anim d4">
          <div className="stat-icon green">
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div>
            <div className="stat-val">{loading ? '—' : `${stats.passRate}%`}</div>
            <div className="stat-label">平均用例通过率</div>
          </div>
        </div>
        <div className="stat-card anim d5">
          <div className="stat-icon orange">
            <span className="material-symbols-outlined">group</span>
          </div>
          <div>
            <div className="stat-val">{loading ? '—' : stats.members.toLocaleString()}</div>
            <div className="stat-label">平台成员数</div>
          </div>
        </div>
      </div>

      {loadError && (
        <div role="status" style={{ color: 'var(--warning)', fontSize: 13 }}>
          部分统计数据暂时无法加载，请稍后刷新。
        </div>
      )}

      <div className="card anim d4">
        <div className="card-head">
          <div className="card-title">
            <div className="card-title-bar"></div>
            <span>快捷入口</span>
          </div>
        </div>
        <div className="quick-grid">
          <Link href="/projects" className="quick-item">
            <div className="qi-icon">
              <span className="material-symbols-outlined">add_circle</span>
            </div>
            <div className="qi-label">新建项目</div>
            <div className="qi-desc">创建测试项目</div>
          </Link>
          <Link href="/testcases" className="quick-item">
            <div className="qi-icon">
              <span className="material-symbols-outlined">note_add</span>
            </div>
            <div className="qi-label">录入用例</div>
            <div className="qi-desc">新增测试用例</div>
          </Link>
          <Link href="/ai-chat" className="quick-item">
            <div className="qi-icon">
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <div className="qi-label">AI 对话分析</div>
            <div className="qi-desc">智能数据洞察</div>
          </Link>
          <Link href="/system/users" className="quick-item">
            <div className="qi-icon">
              <span className="material-symbols-outlined">manage_accounts</span>
            </div>
            <div className="qi-label">用户管理</div>
            <div className="qi-desc">成员与权限</div>
          </Link>
        </div>
      </div>

      <div className="two-col">
        <div className="card anim d5">
          <div className="card-head">
            <div className="card-title">
              <div className="card-title-bar"></div>
              <span>最近项目</span>
            </div>
            <Link href="/projects" className="op-link" style={{ fontSize: 13 }}>
              查看全部 ›
            </Link>
          </div>
          <div>
            {loading ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-gray)' }}>
                正在加载项目…
              </div>
            ) : recentProjects.length ? (
              recentProjects.map(project => (
              <div key={project.id} className="list-row">
                <div>
                  <div className="list-name">{project.name}</div>
                  <div className="list-meta">
                    {project.code} · 负责人 {project.owner_name || '未设置'}
                  </div>
                </div>
                <span className={`tag ${STATUS_CLASSES[project.status]}`}>
                  {STATUS_LABELS[project.status]}
                </span>
              </div>
              ))
            ) : (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-gray)' }}>
                暂无项目，前往项目管理创建第一个项目。
              </div>
            )}
          </div>
        </div>

        <div className="card anim d6">
          <div className="card-head">
            <div className="card-title">
              <div className="card-title-bar"></div>
              <span>待办事项</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-gray)' }}>共 0 条</span>
          </div>
          <div style={{ padding: '42px 24px', textAlign: 'center', color: 'var(--text-gray)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, marginBottom: 8 }}>
              task_alt
            </span>
            <div style={{ color: 'var(--dark-qing)', fontWeight: 500 }}>暂无待办事项</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>待办接口接入后将在这里展示</div>
          </div>
        </div>
      </div>
    </div>
  )
}
