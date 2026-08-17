'use client'
/* eslint-disable react-hooks/set-state-in-effect -- 各 Tab 的接口请求由筛选条件 effect 驱动 */

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  addSuiteCases, createSuite, createTestcase, deleteRequirement, generateTestcases,
  deleteSuite, deleteTestcases, getExecutionStats, getRequirement, getSuite, listExecutions,
  listModules, listProjects, listRequirements, listSuites, listTestcases, removeSuiteCase,
  sortSuiteCases, updateSuite, updateTestcase, uploadRequirement,
} from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Tab = 'cases' | 'suites' | 'requirements' | 'executions'
interface Project { id: number; name: string }
interface Module { id: number; name: string; parent_id?: number | null; children?: Module[] }
interface Testcase {
  id: number; code: string; project_id: number; module_id?: number | null; module_name?: string
  title: string; priority: string; status: string; case_type: string; is_ai_generated: boolean
  creator_name?: string; precondition?: string; steps?: Record<string, unknown>[]; expected_result?: string
}
interface Suite { id: number; project_id: number; project_name?: string; name: string; description?: string; case_count?: number; cases?: Testcase[]; created_at?: string }
interface Requirement { id: number; project_id: number; project_name?: string; title: string; file_type: string; content_preview?: string | null; content?: string | null; created_at?: string | null }
interface Execution { id: number; testcase_id: number; testcase_code?: string; testcase_title?: string; project_name?: string; result: string; remark?: string; defect_link?: string; executed_by_name?: string; executed_at?: string }
interface Stats { total: number; passed: number; failed: number; blocked: number; skipped: number; pass_rate: number; groups: Array<{ name?: string; label?: string; date?: string; passed?: number; failed?: number; count?: number }> }

const PAGE_SIZE = 10
const fieldStyle = { width: '100%', border: '1px solid var(--light-qing)', borderRadius: 8, padding: '9px 12px', background: '#fff' }
const tabLabels: Array<[Tab, string]> = [['cases', '用例列表'], ['suites', '测试套件'], ['requirements', '需求文档'], ['executions', '执行记录']]
const priorityClass: Record<string, string> = { P0: 'danger', P1: 'warning', P2: 'info', P3: 'plain' }
const statusLabel: Record<string, string> = { draft: '草稿', active: '启用', deprecated: '废弃', archived: '归档' }
const resultLabel: Record<string, string> = { passed: '通过', failed: '失败', blocked: '阻塞', skipped: '跳过' }
const resultClass: Record<string, string> = { passed: 'success', failed: 'danger', blocked: 'warning', skipped: 'plain' }

export default function TestcasesPage() {
  const [tab, setTab] = useState<Tab>('cases')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const readTab = () => {
      const value = new URLSearchParams(window.location.search).get('tab') as Tab | null
      if (value && tabLabels.some(([key]) => key === value)) setTab(value)
    }
    readTab(); window.addEventListener('popstate', readTab)
    return () => window.removeEventListener('popstate', readTab)
  }, [])
  useEffect(() => {
    listProjects({ page: 1, page_size: 100 }).then(res => {
      const rows = res.data.items as unknown as Project[]
      setProjects(rows)
      if (rows[0]) setProjectId(current => current || rows[0].id)
    }).catch(() => setError('项目加载失败，请稍后重试。'))
  }, [])

  const changeTab = (next: Tab) => {
    const url = new URL(window.location.href); url.searchParams.set('tab', next)
    window.history.pushState({}, '', url); setTab(next); setError('')
  }

  return <div className="page-wrap">
    <TabBar
      tabs={tabLabels.map(([key, label]) => ({ key, label }))}
      activeKey={tab}
      onTabChange={key => changeTab(key as Tab)}
    />
    {error && <div className="tag warning" role="alert" style={{ alignSelf: 'flex-start' }}>{error}</div>}
    {tab === 'cases' && <CasesTab projects={projects} projectId={projectId} onProject={setProjectId} onError={setError} />}
    {tab === 'suites' && <SuitesTab projects={projects} projectId={projectId} onProject={setProjectId} onError={setError} />}
    {tab === 'requirements' && <RequirementsTab projects={projects} projectId={projectId} onProject={setProjectId} onError={setError} />}
    {tab === 'executions' && <ExecutionsTab projects={projects} projectId={projectId} onProject={setProjectId} onError={setError} />}
  </div>
}

function CasesTab({ projects, projectId, onProject, onError }: TabProps) {
  const [modules, setModules] = useState<Module[]>([])
  const [moduleId, setModuleId] = useState<number | null>(null)
  const [items, setItems] = useState<Testcase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Testcase | null>(null)
  const [modal, setModal] = useState<'case' | 'ai' | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiTask, setAiTask] = useState<{ task_id: number; status: string } | null>(null)
  const [form, setForm] = useState({ title: '', module_id: '', priority: 'P2', case_type: 'functional', status: 'draft', precondition: '', steps: '[]', expected_result: '' })

  useEffect(() => {
    if (!projectId) return
    setModuleId(null)
    listModules(projectId).then(res => setModules(res.data as Module[])).catch(() => onError('模块加载失败。'))
  }, [onError, projectId])
  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await listTestcases({ project_id: projectId, module_id: moduleId || undefined, keyword: keyword || undefined, priority: priority || undefined, status: status || undefined, page, page_size: PAGE_SIZE })
      setItems(res.data.items as unknown as Testcase[]); setTotal(res.data.total)
    } catch { onError('用例加载失败，请稍后重试。') } finally { setLoading(false) }
  }, [keyword, moduleId, onError, page, priority, projectId, status])
  useEffect(() => { void load() }, [load])

  const moduleRows = useMemo(() => flattenModules(modules), [modules])
  const openCase = (item?: Testcase) => {
    setEditing(item || null)
    setForm(item ? {
      title: item.title, module_id: item.module_id ? String(item.module_id) : '', priority: item.priority,
      case_type: item.case_type, status: item.status, precondition: item.precondition || '',
      steps: JSON.stringify(item.steps || [], null, 2), expected_result: item.expected_result || '',
    } : { title: '', module_id: moduleId ? String(moduleId) : '', priority: 'P2', case_type: 'functional', status: 'draft', precondition: '', steps: '[]', expected_result: '' })
    setModal('case')
  }
  const save = async () => {
    if (!projectId || !form.title.trim()) return onError('请填写用例标题。')
    try {
      const payload = { ...form, project_id: projectId, module_id: form.module_id ? Number(form.module_id) : null, steps: JSON.parse(form.steps) }
      if (editing) await updateTestcase(editing.id, payload); else await createTestcase(payload)
      setModal(null); await load()
    } catch { onError('保存失败；测试步骤必须是有效 JSON 数组。') }
  }
  const remove = async (id: number) => {
    if (!confirm('确定删除该用例？')) return
    try { await deleteTestcases([id]); await load() } catch { onError('用例删除失败。') }
  }
  const startAi = async () => {
    if (!projectId || !aiPrompt.trim()) return onError('请先填写生成要求。')
    try {
      const res = await generateTestcases({ project_id: projectId, module_id: moduleId || undefined, prompt: aiPrompt })
      setAiTask(res.data)
    } catch { onError('AI 占位任务创建失败。') }
  }

  return <>
    <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
      <aside className="tree-card">
        <div className="card-head"><div className="card-title"><div className="card-title-bar" />所属模块</div></div>
        <div style={{ padding: 12 }}><ProjectSelect projects={projects} value={projectId} onChange={id => { onProject(id); setPage(1) }} /></div>
        <div style={{ padding: '0 8px 8px' }}>
          <button className={`tree-node ${moduleId === null ? 'active' : ''}`} style={{ width: 'calc(100% - 8px)' }} onClick={() => { setModuleId(null); setPage(1) }}><span className="material-symbols-outlined">home</span>全部用例</button>
          {moduleRows.map(item => <button key={item.id} className={`tree-node ${moduleId === item.id ? 'active' : ''}`} style={{ width: 'calc(100% - 8px)', paddingLeft: 14 + item.depth * 20 }} onClick={() => { setModuleId(item.id); setPage(1) }}><span className="material-symbols-outlined" style={{ fontSize: 17 }}>description</span>{item.name}</button>)}
        </div>
      </aside>
      <section className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="card-head">
          <div className="card-title"><div className="card-title-bar" />测试用例</div>
          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Search value={keyword} onChange={value => { setKeyword(value); setPage(1) }} placeholder="搜索用例标题" />
            <select className="btn btn-outline" value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}><option value="">全部优先级</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select>
            <select className="btn btn-outline" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">全部状态</option><option value="draft">草稿</option><option value="active">启用</option><option value="deprecated">废弃</option><option value="archived">归档</option></select>
            <button className="btn btn-outline" onClick={() => openCase()}><span className="material-symbols-outlined">add</span>新建用例</button>
            <button className="btn btn-primary" onClick={() => { setAiTask(null); setModal('ai') }}><span className="material-symbols-outlined" style={{ color: 'var(--jin)' }}>stars</span>AI 生成</button>
          </div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}><table className="data-table"><thead><tr><th>编号 / 标题</th><th>模块</th><th>优先级</th><th>类型</th><th>状态</th><th>来源</th><th>操作</th></tr></thead><tbody>
          {loading ? <Empty col={7} text="加载中…" /> : items.length === 0 ? <Empty col={7} text="暂无用例，点击“新建用例”开始。" /> : items.map(item => <tr key={item.id}>
            <td><span className="code-tag">{item.code}</span><div style={{ fontWeight: 500, marginTop: 4 }}>{item.title}</div></td><td>{item.module_name || '-'}</td>
            <td><span className={`tag ${priorityClass[item.priority] || 'plain'}`}>{item.priority}</span></td><td>{caseTypeLabel(item.case_type)}</td><td><span className={`tag ${item.status === 'active' ? 'success' : 'plain'}`}>{statusLabel[item.status] || item.status}</span></td>
            <td>{item.is_ai_generated ? <span style={{ color: '#A8842F' }}>✦ AI</span> : '人工'}</td><td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}><button className="op-link" onClick={() => openCase(item)}>编辑</button><button className="op-link danger" onClick={() => void remove(item.id)}>删除</button></td>
          </tr>)}
        </tbody></table></div>
        <Pager page={page} total={total} onPage={setPage} />
      </section>
    </div>
    {modal === 'case' && <Modal title={`${editing ? '编辑' : '新建'}用例`} onClose={() => setModal(null)} onSave={() => void save()}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="用例标题" wide><input style={fieldStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="所属模块"><select style={fieldStyle} value={form.module_id} onChange={e => setForm({ ...form, module_id: e.target.value })}><option value="">未分类</option>{moduleRows.map(item => <option key={item.id} value={item.id}>{'　'.repeat(item.depth)}{item.name}</option>)}</select></Field>
        <Field label="优先级"><select style={fieldStyle} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></Field>
        <Field label="类型"><select style={fieldStyle} value={form.case_type} onChange={e => setForm({ ...form, case_type: e.target.value })}><option value="functional">功能</option><option value="security">安全</option><option value="performance">性能</option><option value="ui">UI</option></select></Field>
        <Field label="状态"><select style={fieldStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="draft">草稿</option><option value="active">启用</option><option value="deprecated">废弃</option><option value="archived">归档</option></select></Field>
        <Field label="前置条件" wide><textarea style={{ ...fieldStyle, minHeight: 64 }} value={form.precondition} onChange={e => setForm({ ...form, precondition: e.target.value })} /></Field>
        <Field label="测试步骤（JSON 数组）" wide><textarea style={{ ...fieldStyle, minHeight: 110, fontFamily: 'monospace' }} value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} /></Field>
        <Field label="预期结果" wide><textarea style={{ ...fieldStyle, minHeight: 64 }} value={form.expected_result} onChange={e => setForm({ ...form, expected_result: e.target.value })} /></Field>
      </div>
    </Modal>}
    {modal === 'ai' && <Modal title="AI 智能生成用例（模拟能力）" onClose={() => setModal(null)} onSave={aiTask ? undefined : () => void startAi()} saveText="创建生成任务">
      {aiTask ? <div style={{ padding: 24, textAlign: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: 42, color: 'var(--jin)' }}>hourglass_top</span><h3>生成任务 #{aiTask.task_id} 已创建</h3><p style={{ color: 'var(--text-gray)', marginTop: 8 }}>当前后端返回占位任务，状态：{aiTask.status}。页面不会展示或保存模拟结果。</p></div> :
        <><div className="tag warning" style={{ marginBottom: 16 }}>当前为后端占位任务，仅演示“生成中”流程，不代表真实 AI 结果。</div><Field label="生成要求"><textarea style={{ ...fieldStyle, minHeight: 130 }} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="描述业务场景、覆盖范围与边界条件" /></Field></>}
    </Modal>}
  </>
}

function SuitesTab({ projects, projectId, onProject, onError }: TabProps) {
  const [items, setItems] = useState<Suite[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Suite | null>(null)
  const [cases, setCases] = useState<Testcase[]>([])
  const [dragId, setDragId] = useState<number | null>(null)
  const [modal, setModal] = useState<'suite' | 'add' | null>(null)
  const [editing, setEditing] = useState<Suite | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [candidates, setCandidates] = useState<Testcase[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const load = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await listSuites({ project_id: projectId, page, page_size: PAGE_SIZE })
      setItems(res.data.items as unknown as Suite[]); setTotal(res.data.total)
    } catch { onError('测试套件加载失败。') }
  }, [onError, page, projectId])
  useEffect(() => { void load() }, [load])

  const selectSuite = async (suite: Suite) => {
    setSelected(suite)
    try { const res = await getSuite(suite.id); setCases(((res.data as { cases?: Testcase[] }).cases || [])) } catch { onError('套件用例加载失败。') }
  }
  const saveSuite = async () => {
    if (!projectId || !form.name.trim()) return
    try {
      if (editing) await updateSuite(editing.id, form); else await createSuite({ ...form, project_id: projectId })
      setModal(null); await load()
    } catch { onError('套件保存失败。') }
  }
  const removeSuite = async (id: number) => {
    if (!confirm('确定删除该套件？')) return
    try { await deleteSuite(id); if (selected?.id === id) { setSelected(null); setCases([]) }; await load() } catch { onError('套件删除失败。') }
  }
  const openAdd = async () => {
    if (!projectId || !selected) return
    try {
      const res = await listTestcases({ project_id: projectId, page: 1, page_size: 100 })
      const available = res.data.items as unknown as Testcase[]
      setCandidates(available.filter(item => !cases.some(existing => existing.id === item.id))); setChecked(new Set()); setModal('add')
    } catch { onError('可添加用例加载失败。') }
  }
  const addCases = async () => {
    if (!selected || checked.size === 0) return
    try { await addSuiteCases(selected.id, [...checked]); setModal(null); await selectSuite(selected); await load() } catch { onError('添加用例失败。') }
  }
  const removeCase = async (id: number) => {
    if (!selected) return
    try { await removeSuiteCase(selected.id, id); await selectSuite(selected); await load() } catch { onError('移除用例失败。') }
  }
  const drop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return
    const next = [...cases]; const from = next.findIndex(item => item.id === dragId); const to = next.findIndex(item => item.id === targetId)
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setCases(next); setDragId(null)
  }
  const saveSort = async () => {
    if (!selected) return
    try { await sortSuiteCases(selected.id, cases.map((item, index) => ({ testcase_id: item.id, sort: index + 1 }))) } catch { onError('排序保存失败。') }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
    <section className="card">
      <div className="card-head"><div className="card-title"><div className="card-title-bar" />测试套件列表</div><div className="flex gap-3"><ProjectSelect projects={projects} value={projectId} onChange={id => { onProject(id); setPage(1); setSelected(null); setCases([]) }} /><button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '' }); setModal('suite') }}><span className="material-symbols-outlined">add</span>新建套件</button></div></div>
      <div style={{ overflow: 'auto' }}><table className="data-table"><thead><tr><th>套件名称</th><th>用例数</th><th>描述</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
        {items.length === 0 ? <Empty col={5} text="暂无套件。" /> : items.map(item => <tr key={item.id} style={{ background: selected?.id === item.id ? 'rgba(42,118,201,.06)' : undefined }}><td><b>{item.name}</b></td><td style={{ textAlign: 'center' }}><span className="tag info">{item.case_count || 0}</span></td><td>{item.description || '-'}</td><td className="date-cell">{item.created_at?.slice(0, 10) || '-'}</td><td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}><button className="op-link" onClick={() => void selectSuite(item)}>管理用例</button><button className="op-link" onClick={() => { setEditing(item); setForm({ name: item.name, description: item.description || '' }); setModal('suite') }}>编辑</button><button className="op-link danger" onClick={() => void removeSuite(item.id)}>删除</button></td></tr>)}
      </tbody></table></div><Pager page={page} total={total} onPage={setPage} />
    </section>
    <section className="card">
      <div className="card-head"><div className="card-title"><div className="card-title-bar" />套件用例排序 · {selected?.name || '请先选择套件'}</div><div className="flex gap-2"><button className="btn btn-outline" disabled={!selected} onClick={() => void openAdd()}>添加用例</button><button className="btn btn-primary" disabled={!selected} onClick={() => void saveSort()}>保存排序</button></div></div>
      {!selected ? <EmptyPanel text="从上方列表选择一个套件后管理用例。" /> : cases.length === 0 ? <EmptyPanel text="该套件暂无用例，点击“添加用例”。" /> : cases.map((item, index) => <div key={item.id} draggable onDragStart={() => setDragId(item.id)} onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={() => drop(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #F0F4FA', cursor: 'grab' }}><span className="material-symbols-outlined" style={{ color: 'var(--text-gray)' }}>drag_indicator</span><span className="tag info">{index + 1}</span><span className="code-tag">{item.code}</span><span style={{ flex: 1 }}>{item.title}</span><span className={`tag ${priorityClass[item.priority] || 'plain'}`}>{item.priority}</span><button className="op-link danger" onClick={() => void removeCase(item.id)}>移除</button></div>)}
    </section>
    {modal === 'suite' && <Modal title={`${editing ? '编辑' : '新建'}套件`} onClose={() => setModal(null)} onSave={() => void saveSuite()}><div style={{ display: 'grid', gap: 16 }}><Field label="套件名称"><input style={fieldStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="描述"><textarea style={{ ...fieldStyle, minHeight: 90 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field></div></Modal>}
    {modal === 'add' && <Modal title={`添加用例 · ${selected?.name}`} onClose={() => setModal(null)} onSave={() => void addCases()} saveText={`添加所选（${checked.size}）`}><div style={{ maxHeight: 380, overflow: 'auto' }}>{candidates.length === 0 ? <EmptyPanel text="没有可添加的用例。" /> : candidates.map(item => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #F0F4FA' }}><input type="checkbox" checked={checked.has(item.id)} onChange={e => setChecked(current => { const next = new Set(current); if (e.target.checked) next.add(item.id); else next.delete(item.id); return next })} /><span className="code-tag">{item.code}</span><span>{item.title}</span></label>)}</div></Modal>}
  </div>
}

function RequirementsTab({ projects, projectId, onProject, onError }: TabProps) {
  const [items, setItems] = useState<Requirement[]>([])
  const [selected, setSelected] = useState<Requirement | null>(null)
  const [keyword, setKeyword] = useState('')
  const [fileType, setFileType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const load = useCallback(async () => {
    if (!projectId) return
    try { const res = await listRequirements({ project_id: projectId, keyword: keyword || undefined, file_type: fileType || undefined, page, page_size: PAGE_SIZE }); setItems(res.data.items as Requirement[]); setTotal(res.data.total) } catch { onError('需求文档加载失败。') }
  }, [fileType, keyword, onError, page, projectId])
  useEffect(() => { void load() }, [load])
  const view = async (item: Requirement) => {
    try { setSelected((await getRequirement(item.id)).data as Requirement) } catch { onError('需求详情加载失败。') }
  }
  const uploadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !projectId) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const docs = Array.isArray(parsed) ? parsed : [parsed]
      for (const raw of docs) {
        if (!raw || typeof raw !== 'object') throw new Error()
        const doc = raw as Record<string, unknown>
        if (typeof doc.title !== 'string' || typeof doc.content !== 'string') throw new Error()
        await uploadRequirement({ project_id: projectId, title: doc.title, content: doc.content, file_type: typeof doc.file_type === 'string' ? doc.file_type : 'text', file_size: file.size })
      }
      event.target.value = ''; await load()
    } catch { onError('上传失败。JSON 需包含 title、content，可选 file_type；也支持对象数组。') }
  }
  const remove = async (id: number) => {
    if (!confirm('确定删除该需求文档？')) return
    try { await deleteRequirement(id); if (selected?.id === id) setSelected(null); await load() } catch { onError('需求文档删除失败。') }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
    <section className="card">
      <div className="card-head"><div className="card-title"><div className="card-title-bar" />需求文档列表</div><div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}><ProjectSelect projects={projects} value={projectId} onChange={id => { onProject(id); setPage(1) }} /><Search value={keyword} onChange={value => { setKeyword(value); setPage(1) }} placeholder="搜索文档标题/全文" /><select className="btn btn-outline" value={fileType} onChange={e => setFileType(e.target.value)}><option value="">全部类型</option><option value="markdown">Markdown</option><option value="word">Word</option><option value="pdf">PDF</option><option value="text">文本</option></select><label className="btn btn-primary" style={{ cursor: 'pointer' }}><span className="material-symbols-outlined">upload</span>上传 JSON<input type="file" accept=".json,application/json" hidden onChange={e => void uploadJson(e)} /></label></div></div>
      <div style={{ overflow: 'auto' }}><table className="data-table"><thead><tr><th>文档标题</th><th>类型</th><th>内容摘要</th><th>上传时间</th><th>操作</th></tr></thead><tbody>
        {items.length === 0 ? <Empty col={5} text="暂无需求文档。" /> : items.map(item => <tr key={item.id}><td><b>{item.title}</b></td><td><span className="tag info">{item.file_type}</span></td><td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.content_preview || '-'}</td><td className="date-cell">{item.created_at?.slice(0, 10) || '-'}</td><td style={{ textAlign: 'center' }}><button className="op-link" onClick={() => void view(item)}>查看</button><button className="op-link muted" disabled title="后端暂无 AI 需求分析接口">AI 分析（未接入）</button><button className="op-link danger" onClick={() => void remove(item.id)}>删除</button></td></tr>)}
      </tbody></table></div><Pager page={page} total={total} onPage={setPage} />
    </section>
    <section className="card"><div className="card-head"><div className="card-title"><div className="card-title-bar" />文档内容预览 · {selected?.title || '未选择'}</div></div>
      {selected ? <pre style={{ margin: 20, padding: 18, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', borderRadius: 8, background: '#F0F4FA', color: '#3A4B66', lineHeight: 1.7 }}>{selected.content || selected.content_preview || '文档没有可预览内容。'}</pre> : <EmptyPanel text="点击文档“查看”以预览内容。AI 分析暂无后端接口。" />}
    </section>
  </div>
}

function ExecutionsTab({ projects, projectId, onProject, onError }: TabProps) {
  const [items, setItems] = useState<Execution[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, pass_rate: 0, groups: [] })
  const [trend, setTrend] = useState<Stats['groups']>([])
  const [result, setResult] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (!projectId) return
    Promise.all([
      listExecutions({ project_id: projectId, result: result || undefined, page, page_size: PAGE_SIZE }),
      getExecutionStats({ project_id: projectId, group_by: 'result' }),
      getExecutionStats({ project_id: projectId, group_by: 'date' }),
    ]).then(([list, summary, dates]) => {
      setItems(list.data.items as unknown as Execution[]); setTotal(list.data.total)
      setStats(summary.data as unknown as Stats)
      setTrend(((dates.data as { groups?: Stats['groups'] }).groups || []))
    }).catch(() => onError('执行记录或统计加载失败。'))
  }, [onError, page, projectId, result])
  const passedPct = stats.total ? stats.passed / stats.total * 100 : 0
  const failedPct = stats.total ? stats.failed / stats.total * 100 : 0
  const blockedPct = stats.total ? stats.blocked / stats.total * 100 : 0
  const maxTrend = Math.max(1, ...trend.map(group => (group.passed || 0) + (group.failed || 0)))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
    <div className="stat-grid">
      <Stat icon="play_circle" color="blue" value={stats.total} label="总执行次数" /><Stat icon="check_circle" color="green" value={`${Number(stats.pass_rate || 0).toFixed(1)}%`} label="通过率" /><Stat icon="cancel" color="orange" value={stats.failed} label="失败" /><Stat icon="block" color="gold" value={stats.blocked + stats.skipped} label="阻塞 / 跳过" />
    </div>
    <section className="card"><div className="card-head"><div className="card-title"><div className="card-title-bar" />执行记录</div><div className="flex gap-3"><ProjectSelect projects={projects} value={projectId} onChange={id => { onProject(id); setPage(1) }} /><select className="btn btn-outline" value={result} onChange={e => { setResult(e.target.value); setPage(1) }}><option value="">全部结果</option><option value="passed">通过</option><option value="failed">失败</option><option value="blocked">阻塞</option><option value="skipped">跳过</option></select><button className="btn btn-outline" disabled title="后端暂无导出接口">导出（未接入）</button></div></div>
      <div style={{ overflow: 'auto' }}><table className="data-table"><thead><tr><th>用例编号</th><th>用例标题</th><th>结果</th><th>执行人</th><th>执行时间</th><th>备注</th><th>缺陷关联</th></tr></thead><tbody>
        {items.length === 0 ? <Empty col={7} text="暂无执行记录。" /> : items.map(item => <tr key={item.id}><td><span className="code-tag">{item.testcase_code || item.testcase_id}</span></td><td>{item.testcase_title || '-'}</td><td><span className={`tag ${resultClass[item.result] || 'plain'}`}>{resultLabel[item.result] || item.result}</span></td><td>{item.executed_by_name || '-'}</td><td className="date-cell">{item.executed_at?.replace('T', ' ').slice(0, 16) || '-'}</td><td>{item.remark || '-'}</td><td>{item.defect_link ? <a className="op-link" href={item.defect_link} target="_blank" rel="noreferrer">查看缺陷</a> : '-'}</td></tr>)}
      </tbody></table></div><Pager page={page} total={total} onPage={setPage} />
    </section>
    <section className="card"><div className="card-head"><div className="card-title"><div className="card-title-bar" />执行结果分布</div></div><div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'minmax(240px, .8fr) minmax(360px, 1.4fr)', gap: 32 }}>
      <div style={{ display: 'grid', placeItems: 'center' }}><div style={{ width: 180, height: 180, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(#36B37E 0 ${passedPct}%, #E54C4C ${passedPct}% ${passedPct + failedPct}%, #FF8C38 ${passedPct + failedPct}% ${passedPct + failedPct + blockedPct}%, #C5CFDD 0)` }}><div style={{ width: 120, height: 120, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><strong style={{ fontSize: 28 }}>{Number(stats.pass_rate || 0).toFixed(1)}%</strong><div style={{ color: 'var(--text-gray)', fontSize: 12 }}>通过率</div></div></div></div><div style={{ marginTop: 14, fontSize: 12, color: '#566680' }}>通过 {stats.passed}　失败 {stats.failed}　阻塞 {stats.blocked}　跳过 {stats.skipped}</div></div>
      <div><div style={{ color: 'var(--text-gray)', fontSize: 13, marginBottom: 12 }}>按日执行趋势</div><div style={{ height: 210, display: 'flex', alignItems: 'flex-end', gap: 18, borderBottom: '1px solid #D7E2F0', padding: '12px 12px 0' }}>{trend.length === 0 ? <EmptyPanel text="暂无趋势数据。" /> : trend.map((group, index) => <div key={`${group.date || group.name}-${index}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, position: 'relative', paddingBottom: 28 }}><div title={`通过 ${group.passed || 0}`} style={{ width: 18, height: `${(group.passed || 0) / maxTrend * 100}%`, background: 'linear-gradient(#5A96E5,#2A76C9)', borderRadius: '4px 4px 0 0' }} /><div title={`失败 ${group.failed || 0}`} style={{ width: 18, height: `${(group.failed || 0) / maxTrend * 100}%`, background: 'linear-gradient(#F06A6A,#E54C4C)', borderRadius: '4px 4px 0 0' }} /><span style={{ position: 'absolute', bottom: 6, fontSize: 11, color: 'var(--text-gray)' }}>{(group.date || group.name || group.label || '').slice(-5)}</span></div>)}</div></div>
    </div></section>
  </div>
}

interface TabProps { projects: Project[]; projectId: number | null; onProject: (id: number) => void; onError: (message: string) => void }
function flattenModules(nodes: Module[], depth = 0): Array<Module & { depth: number }> { return nodes.flatMap(node => [{ ...node, depth }, ...flattenModules(node.children || [], depth + 1)]) }
function caseTypeLabel(value: string) { return ({ functional: '功能', security: '安全', performance: '性能', ui: 'UI' } as Record<string, string>)[value] || value }
function ProjectSelect({ projects, value, onChange }: { projects: Project[]; value: number | null; onChange: (id: number) => void }) { return <select className="btn btn-outline" value={value || ''} onChange={e => onChange(Number(e.target.value))}><option value="" disabled>选择项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select> }
function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <div className="search-box"><span className="material-symbols-outlined">search</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div> }
function Empty({ col, text }: { col: number; text: string }) { return <tr><td colSpan={col} style={{ textAlign: 'center', padding: 40, color: 'var(--text-gray)' }}>{text}</td></tr> }
function EmptyPanel({ text }: { text: string }) { return <div style={{ padding: 38, textAlign: 'center', color: 'var(--text-gray)', flex: 1 }}>{text}</div> }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label style={{ gridColumn: wide ? '1 / -1' : undefined, fontSize: 13, color: 'var(--text-gray)' }}>{label}<div style={{ marginTop: 6 }}>{children}</div></label> }
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); return <div className="pagination-wrapper"><div className="page-info">共 {total} 条，第 {page} / {pages} 页</div><div className="pagination"><button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button><button className="page-btn active">{page}</button><button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button></div></div> }
function Modal({ title, onClose, onSave, saveText = '保存', children }: { title: string; onClose: () => void; onSave?: () => void; saveText?: string; children: React.ReactNode }) { return <div className="modal-mask show"><div className="modal"><div className="modal-head"><div className="modal-title"><div className="modal-title-bar" />{title}</div><button className="op-link" onClick={onClose}>关闭</button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="btn btn-outline" onClick={onClose}>取消</button>{onSave && <button className="btn btn-primary" onClick={onSave}>{saveText}</button>}</div></div></div> }
function Stat({ icon, color, value, label }: { icon: string; color: string; value: string | number; label: string }) { return <div className="stat-card"><div className={`stat-icon ${color}`}><span className="material-symbols-outlined">{icon}</span></div><div><div className="stat-val">{value}</div><div className="stat-label">{label}</div></div></div> }
