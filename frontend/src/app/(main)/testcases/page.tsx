'use client'

import { useState, useEffect } from 'react'
import { listModules, listTestcases, createTestcase, updateTestcase, deleteTestcases, listProjects } from '@/lib/api'

interface Module {
  id: number
  name: string
  project_id: number
  parent_id: number | null
  children?: Module[]
}

interface Testcase {
  id: number
  code: string
  title: string
  priority: string
  status: string
  case_type: string
  is_ai_generated: boolean
  module_id?: number | null
  module_name?: string
  creator_name?: string
  precondition?: string
  steps?: any[]
  expected_result?: string
  created_at: string
}

export default function TestcasesPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [testcases, setTestcases] = useState<Testcase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingCase, setEditingCase] = useState<Testcase | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    priority: 'P2',
    case_type: 'functional',
    status: 'draft',
    precondition: '',
    steps: '',
    expected_result: '',
    module_id: null as number | null,
  })

  // Load projects
  useEffect(() => {
    loadProjects()
  }, [])

  // Load modules when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadModules(selectedProjectId)
    } else {
      setModules([])
      setSelectedModuleId(null)
    }
  }, [selectedProjectId])

  // Load testcases when filters change
  useEffect(() => {
    if (selectedProjectId) {
      loadTestcases()
    }
  }, [selectedProjectId, selectedModuleId, page, keyword])

  const loadProjects = async () => {
    try {
      const res = await listProjects({ page: 1, page_size: 100 })
      setProjects(res.data.items)
      if (res.data.items.length > 0 && !selectedProjectId) {
        setSelectedProjectId(res.data.items[0].id)
      }
    } catch (err) {
      console.error('加载项目失败', err)
    }
  }

  const loadModules = async (projectId: number) => {
    try {
      const res = await listModules(projectId)
      const data = res.data
      setModules(data)
      // Auto-expand first level
      const rootIds = new Set<number>(data.filter((m: any) => !m.parent_id).map((m: any) => m.id))
      setExpandedModules(rootIds)
    } catch (err) {
      console.error('加载模块失败', err)
    }
  }

  const loadTestcases = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const params: any = {
        project_id: selectedProjectId,
        page,
        page_size: pageSize,
      }
      if (selectedModuleId) params.module_id = selectedModuleId
      if (keyword) params.keyword = keyword
      const res = await listTestcases(params)
      setTestcases(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      console.error('加载用例失败', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleModule = (moduleId: number) => {
    const next = new Set(expandedModules)
    if (next.has(moduleId)) {
      next.delete(moduleId)
    } else {
      next.add(moduleId)
    }
    setExpandedModules(next)
  }

  const selectModule = (moduleId: number | null) => {
    setSelectedModuleId(moduleId)
    setPage(1)
  }

  const buildModuleTree = (modules: Module[]): Module[] => {
    const map = new Map<number, Module>()
    const roots: Module[] = []
    modules.forEach(m => {
      map.set(m.id, { ...m, children: [] })
    })
    modules.forEach(m => {
      const node = map.get(m.id)!
      if (m.parent_id && map.has(m.parent_id)) {
        map.get(m.parent_id)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  const renderModuleNode = (node: Module, level = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedModules.has(node.id)
    const isSelected = selectedModuleId === node.id

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm ${
            isSelected
              ? 'bg-[#2A76C9]/10 text-[#2A76C9] font-medium'
              : 'text-[#23344D] hover:bg-[#F0F4FA]'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleModule(node.id) }}
              className="mr-1 text-[#8A99B0] hover:text-[#23344D] w-4 h-4 flex items-center justify-center"
            >
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4l8 6-8 6V4z" />
              </svg>
            </button>
          )}
          {!hasChildren && <span className="w-4 mr-1" />}
          <span onClick={() => selectModule(node.id)} className="flex-1 truncate">
            {node.name}
          </span>
        </div>
        {hasChildren && isExpanded && node.children!.map(child => renderModuleNode(child, level + 1))}
      </div>
    )
  }

  const handleCreate = () => {
    setEditingCase(null)
    setFormData({
      title: '',
      priority: 'P2',
      case_type: 'functional',
      status: 'draft',
      precondition: '',
      steps: '',
      expected_result: '',
      module_id: selectedModuleId,
    })
    setShowModal(true)
  }

  const handleEdit = (tc: Testcase) => {
    setEditingCase(tc)
    setFormData({
      title: tc.title,
      priority: tc.priority,
      case_type: tc.case_type,
      status: tc.status,
      precondition: tc.precondition || '',
      steps: JSON.stringify(tc.steps || []),
      expected_result: tc.expected_result || '',
      module_id: (tc as any).module_id || null,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        project_id: selectedProjectId,
        steps: formData.steps ? JSON.parse(formData.steps) : [],
      }
      if (editingCase) {
        await updateTestcase(editingCase.id, payload)
      } else {
        await createTestcase(payload)
      }
      setShowModal(false)
      loadTestcases()
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败，请重试')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该用例？')) return
    try {
      await deleteTestcases([id])
      setTestcases(prev => prev.filter(t => t.id !== id))
      setTotal(prev => prev - 1)
    } catch (err) {
      console.error('删除失败', err)
      alert('删除失败')
    }
  }

  const handleAIGenerate = () => {
    alert('AI 生成用例功能即将上线，敬请期待！')
  }

  const moduleTree = buildModuleTree(modules)
  const priorityColors: Record<string, string> = {
    P0: 'bg-red-100 text-red-700',
    P1: 'bg-orange-100 text-orange-700',
    P2: 'bg-blue-100 text-blue-700',
    P3: 'bg-gray-100 text-gray-700',
  }
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    deprecated: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* ========== 左：模块树 ========== */}
      <div className="w-64 bg-white rounded-xl border border-[#D7E2F0] shadow-sm flex flex-col">
        <div className="p-4 border-b border-[#D7E2F0]">
          <h3 className="font-bold text-[#23344D] text-sm">项目模块</h3>
          {selectedProjectId && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className="mt-2 w-full text-sm border border-[#D7E2F0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#2A76C9]"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div
            className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer text-sm mb-1 ${
              selectedModuleId === null
                ? 'bg-[#2A76C9]/10 text-[#2A76C9] font-medium'
                : 'text-[#23344D] hover:bg-[#F0F4FA]'
            }`}
            onClick={() => selectModule(null)}
          >
            <span className="flex-1">全部用例</span>
            <span className="text-xs text-[#8A99B0]">{total}</span>
          </div>
          {moduleTree.map(node => renderModuleNode(node))}
        </div>
      </div>

      {/* ========== 右：用例表格 ========== */}
      <div className="flex-1 bg-white rounded-xl border border-[#D7E2F0] shadow-sm flex flex-col">
        {/* 工具栏 */}
        <div className="p-4 border-b border-[#D7E2F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="搜索用例..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
              className="text-sm border border-[#D7E2F0] rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-[#2A76C9]"
            />
            {selectedModuleId && (
              <span className="text-xs text-[#8A99B0] bg-[#F0F4FA] px-2 py-1 rounded">
                已选模块
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAIGenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white text-sm rounded-lg hover:opacity-90 transition-opacity shadow-sm"
            >
              <span>✨</span>
              <span>AI 生成用例</span>
            </button>
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 bg-[#2A76C9] text-white text-sm rounded-lg hover:bg-[#1E5FA0] transition-colors shadow-sm"
            >
              + 新建用例
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFD] sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">编号</th>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">标题</th>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">模块</th>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">优先级</th>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">状态</th>
                <th className="text-left px-4 py-3 text-[#8A99B0] font-medium">创建人</th>
                <th className="text-right px-4 py-3 text-[#8A99B0] font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FA]">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#8A99B0]">加载中...</td></tr>
              ) : testcases.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#8A99B0]">暂无用例数据</td></tr>
              ) : (
                testcases.map(tc => (
                  <tr key={tc.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#8A99B0]">{tc.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#23344D] font-medium">{tc.title}</span>
                        {tc.is_ai_generated && <span className="text-xs bg-[#D4B86A]/20 text-[#B8983A] px-1.5 py-0.5 rounded">AI</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#8A99B0]">{tc.module_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[tc.priority] || 'bg-gray-100'}`}>
                        {tc.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[tc.status] || 'bg-gray-100'}`}>
                        {tc.status === 'draft' ? '草稿' : tc.status === 'active' ? '启用' : tc.status === 'deprecated' ? '废弃' : tc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8A99B0]">{tc.creator_name || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(tc)} className="text-[#2A76C9] hover:underline text-xs mr-3">编辑</button>
                      <button onClick={() => handleDelete(tc.id)} className="text-red-500 hover:underline text-xs">删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="p-4 border-t border-[#D7E2F0] flex items-center justify-between">
          <span className="text-sm text-[#8A99B0]">
            共 {total} 条，第 {page} 页
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border border-[#D7E2F0] rounded-lg disabled:opacity-50 hover:bg-[#F8FAFD]"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= total}
              className="px-3 py-1 text-sm border border-[#D7E2F0] rounded-lg disabled:opacity-50 hover:bg-[#F8FAFD]"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* ========== 新建/编辑弹窗 ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-[#D7E2F0]">
              <h2 className="text-lg font-bold text-[#23344D]">{editingCase ? '编辑用例' : '新建用例'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">用例标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#2A76C9]"
                  placeholder="请输入用例标题"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">优先级</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2"
                  >
                    <option value="P0">P0 - 最高</option>
                    <option value="P1">P1 - 高</option>
                    <option value="P2">P2 - 中</option>
                    <option value="P3">P3 - 低</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2"
                  >
                    <option value="draft">草稿</option>
                    <option value="active">启用</option>
                    <option value="deprecated">废弃</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">前置条件</label>
                <textarea
                  value={formData.precondition}
                  onChange={(e) => setFormData({ ...formData, precondition: e.target.value })}
                  className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2 h-16 resize-none focus:outline-none focus:border-[#2A76C9]"
                  placeholder="前置条件..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">测试步骤（JSON 数组）</label>
                <textarea
                  value={formData.steps}
                  onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2 h-20 resize-none font-mono focus:outline-none focus:border-[#2A76C9]"
                  placeholder='[{"step": "步骤1", "expected": "预期1"}]'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">预期结果</label>
                <textarea
                  value={formData.expected_result}
                  onChange={(e) => setFormData({ ...formData, expected_result: e.target.value })}
                  className="w-full text-sm border border-[#D7E2F0] rounded-lg px-3 py-2 h-16 resize-none focus:outline-none focus:border-[#2A76C9]"
                  placeholder="预期结果..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#D7E2F0] flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-[#D7E2F0] rounded-lg hover:bg-[#F8FAFD] text-[#23344D]"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-[#2A76C9] text-white rounded-lg hover:bg-[#1E5FA0]"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
