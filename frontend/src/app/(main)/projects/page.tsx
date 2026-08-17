'use client'
/* eslint-disable react-hooks/set-state-in-effect -- 接口请求由筛选条件 effect 驱动 */

import { useCallback, useEffect, useState } from 'react'
import {
  addMember, createModule, createProject, deleteModule, listMembers, listModules,
  listProjects, listUsers, removeMember, updateMember, updateModule, updateProject,
} from '@/lib/api'
import type { Project, ProjectMember, ProjectModule, User } from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Tab = 'projects' | 'modules' | 'members'
type Module = ProjectModule & { children?: Module[] }
type Member = ProjectMember

const PAGE_SIZE = 10
const statusMap: Record<string, [string, string]> = {
  planning: ['规划中', 'warning'], in_progress: ['进行中', 'running'],
  completed: ['已完成', 'success'], archived: ['已归档', 'plain'],
}
const roleMap: Record<string, string> = { owner: '负责人', tester: '测试成员', viewer: '只读成员' }
const fieldStyle = { width: '100%', border: '1px solid var(--light-qing)', borderRadius: 8, padding: '9px 12px', background: '#fff' }

export default function ProjectsPage() {
  const [tab, setTab] = useState<Tab>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'project' | 'module' | 'member' | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [projectForm, setProjectForm] = useState({ code: '', name: '', owner_id: '', status: 'planning', start_date: '', end_date: '', description: '' })
  const [moduleForm, setModuleForm] = useState({ name: '', parent_id: '' })
  const [memberForm, setMemberForm] = useState({ user_id: '', project_role: 'tester' })

  const selectedProject = projects.find(item => item.id === selectedId)
  const loadProjects = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await listProjects({ page, page_size: PAGE_SIZE, keyword: keyword || undefined, status: status || undefined })
      const rows = res.data.items as unknown as Project[]
      setProjects(rows); setTotal(res.data.total)
      if (rows[0]) setSelectedId(current => current || rows[0].id)
    } catch { setError('项目加载失败，请稍后重试。') } finally { setLoading(false) }
  }, [keyword, page, status])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => {
    if (!selectedId || tab === 'projects') return
    const load = async () => {
      setLoading(true); setError('')
      try {
        if (tab === 'modules') setModules((await listModules(selectedId)).data as Module[])
        else {
          const [memberRes, userRes] = await Promise.all([listMembers(selectedId), listUsers({ page: 1, page_size: 100 })])
          setMembers(memberRes.data); setUsers(userRes.data.items)
        }
      } catch { setError(`${tab === 'modules' ? '模块' : '成员'}加载失败，请稍后重试。`) } finally { setLoading(false) }
    }
    void load()
  }, [selectedId, tab])

  const chooseProject = (id: number, nextTab: Tab) => { setSelectedId(id); setTab(nextTab) }
  const openProject = (project?: Project) => {
    setEditingProject(project || null)
    setProjectForm(project ? {
      code: project.code, name: project.name, owner_id: String(project.owner_id), status: project.status,
      start_date: project.start_date || '', end_date: project.end_date || '', description: project.description || '',
    } : { code: '', name: '', owner_id: '', status: 'planning', start_date: '', end_date: '', description: '' })
    setModal('project')
  }
  const saveProject = async () => {
    if (!projectForm.name.trim() || !projectForm.owner_id || (!editingProject && !projectForm.code.trim())) return setError('请填写项目编号、名称和负责人。')
    const payload = { ...projectForm, owner_id: Number(projectForm.owner_id), start_date: projectForm.start_date || undefined, end_date: projectForm.end_date || undefined }
    try {
      if (editingProject) await updateProject(editingProject.id, payload)
      else await createProject(payload)
      setModal(null); await loadProjects()
    } catch { setError('项目保存失败，请检查表单。') }
  }
  const saveModule = async () => {
    if (!selectedId || !moduleForm.name.trim()) return
    const payload = { name: moduleForm.name, parent_id: moduleForm.parent_id ? Number(moduleForm.parent_id) : null }
    try {
      if (editingModule) await updateModule(selectedId, editingModule.id, payload)
      else await createModule(selectedId, payload)
      setModal(null); setModules((await listModules(selectedId)).data)
    } catch { setError('模块保存失败，请检查名称或父模块。') }
  }
  const removeModule = async (id: number) => {
    if (!selectedId || !confirm('确定删除该模块？包含用例时后端可能拒绝删除。')) return
    try { await deleteModule(selectedId, id); setModules((await listModules(selectedId)).data) } catch { setError('模块删除失败，可能仍包含子模块或用例。') }
  }
  const saveMember = async () => {
    if (!selectedId || !memberForm.user_id) return
    try {
      await addMember(selectedId, { user_id: Number(memberForm.user_id), project_role: memberForm.project_role })
      setModal(null); setMembers((await listMembers(selectedId)).data)
    } catch { setError('成员添加失败，该用户可能已在项目中。') }
  }
  const changeRole = async (member: Member, role: string) => {
    if (!selectedId) return
    try { await updateMember(selectedId, member.id, { project_role: role }); setMembers((await listMembers(selectedId)).data) } catch { setError('成员角色更新失败。') }
  }
  const removeProjectMember = async (id: number) => {
    if (!selectedId || !confirm('确定移除该成员？')) return
    try { await removeMember(selectedId, id); setMembers((await listMembers(selectedId)).data) } catch { setError('成员移除失败。') }
  }
  const flatModules = (nodes: Module[], depth = 0): Array<Module & { depth: number }> =>
    nodes.flatMap(node => [{ ...node, depth }, ...flatModules(node.children || [], depth + 1)])
  const moduleRows = flatModules(modules)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="page-wrap">
      <TabBar
        tabs={[
          { key: 'projects', label: '项目列表' },
          { key: 'modules', label: '模块管理' },
          { key: 'members', label: '成员管理' },
        ]}
        activeKey={tab}
        onTabChange={key => setTab(key as Tab)}
      />
      {error && <div className="tag warning" role="alert" style={{ alignSelf: 'flex-start' }}>{error}</div>}

      {tab === 'projects' ? (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div className="card-title"><div className="card-title-bar" />测试项目</div>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div className="search-box"><span className="material-symbols-outlined">search</span><input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} placeholder="搜索项目名称/编号" /></div>
              <select className="btn btn-outline" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                <option value="">所有状态</option><option value="planning">规划中</option><option value="in_progress">进行中</option><option value="completed">已完成</option><option value="archived">已归档</option>
              </select>
              <button className="btn btn-primary" onClick={() => openProject()}><span className="material-symbols-outlined">add</span>新建项目</button>
            </div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="data-table"><thead><tr><th>项目名称</th><th>项目编号</th><th>负责人</th><th>状态</th><th>起止时间</th><th>成员</th><th>操作</th></tr></thead>
              <tbody>{loading ? <Empty col={7} text="加载中…" /> : projects.length === 0 ? <Empty col={7} text="暂无项目，点击“新建项目”开始。" /> : projects.map(project => {
                const state = statusMap[project.status] || [project.status, 'plain']
                return <tr key={project.id}>
                  <td><b style={{ fontWeight: 500 }}>{project.name}</b></td><td><span className="code-tag">{project.code}</span></td>
                  <td><div className="owner-cell"><span className="avatar">{project.owner_name?.[0] || '?'}</span>{project.owner_name || '-'}</div></td>
                  <td><span className={`tag ${state[1]}`}>{state[0]}</span></td><td className="date-cell">{project.start_date || '-'} ~ {project.end_date || '-'}</td>
                  <td>{project.member_count || 0} 人</td><td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="op-link" onClick={() => openProject(project)}>编辑</button>
                    <button className="op-link" onClick={() => chooseProject(project.id, 'modules')}>模块</button>
                    <button className="op-link" onClick={() => chooseProject(project.id, 'members')}>成员</button>
                  </td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} total={total} onPage={setPage} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          <aside className="tree-card">
            <div className="card-head"><div className="card-title"><div className="card-title-bar" />选择项目</div></div>
            <div style={{ padding: 8 }}>{projects.map(project => <button key={project.id} className={`tree-node ${selectedId === project.id ? 'active' : ''}`} style={{ width: 'calc(100% - 8px)' }} onClick={() => setSelectedId(project.id)}><span className="material-symbols-outlined">folder</span>{project.name}</button>)}</div>
          </aside>
          <section className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-head">
              <div className="card-title"><div className="card-title-bar" />{tab === 'modules' ? '模块管理' : '成员管理'} · {selectedProject?.name || '请先选择项目'}</div>
              <button disabled={!selectedId} className="btn btn-primary" onClick={() => { if (tab === 'modules') { setEditingModule(null); setModuleForm({ name: '', parent_id: '' }); setModal('module') } else setModal('member') }}><span className="material-symbols-outlined">add</span>{tab === 'modules' ? '新建模块' : '添加成员'}</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {tab === 'modules' ? <table className="data-table"><thead><tr><th>模块名称</th><th>上级模块</th><th>用例数</th><th>操作</th></tr></thead><tbody>
                {loading ? <Empty col={4} text="加载中…" /> : moduleRows.length === 0 ? <Empty col={4} text="该项目暂无模块。" /> : moduleRows.map(item => <tr key={item.id}>
                  <td style={{ paddingLeft: 16 + item.depth * 28 }}><span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: 'middle', color: 'var(--primary-blue)' }}>{item.children?.length ? 'folder' : 'description'}</span> {item.name}</td>
                  <td>{moduleRows.find(parent => parent.id === item.parent_id)?.name || '-'}</td><td style={{ textAlign: 'center' }}>{item.testcase_count || 0}</td>
                  <td style={{ textAlign: 'center' }}><button className="op-link" onClick={() => { setEditingModule(item); setModuleForm({ name: item.name, parent_id: item.parent_id ? String(item.parent_id) : '' }); setModal('module') }}>编辑</button><button className="op-link danger" onClick={() => void removeModule(item.id)}>删除</button></td>
                </tr>)}
              </tbody></table> : <table className="data-table"><thead><tr><th>成员</th><th>用户名</th><th>项目角色</th><th>加入时间</th><th>操作</th></tr></thead><tbody>
                {loading ? <Empty col={5} text="加载中…" /> : members.length === 0 ? <Empty col={5} text="该项目暂无成员。" /> : members.map(member => <tr key={member.id}>
                  <td><div className="owner-cell"><span className="avatar">{member.real_name?.[0] || '?'}</span>{member.real_name}</div></td><td>{member.username}</td>
                  <td><select style={fieldStyle} value={member.project_role} onChange={e => void changeRole(member, e.target.value)}><option value="owner">负责人</option><option value="tester">测试成员</option><option value="viewer">只读成员</option></select></td>
                  <td className="date-cell">{member.created_at?.slice(0, 10) || '-'}</td><td style={{ textAlign: 'center' }}><button className="op-link danger" disabled={member.project_role === 'owner'} title={member.project_role === 'owner' ? '负责人不能直接移除' : ''} onClick={() => void removeProjectMember(member.id)}>移除</button></td>
                </tr>)}
              </tbody></table>}
            </div>
          </section>
        </div>
      )}

      {modal && <div className="modal-mask show"><div className="modal">
        <div className="modal-head"><div className="modal-title"><div className="modal-title-bar" />{modal === 'project' ? `${editingProject ? '编辑' : '新建'}项目` : modal === 'module' ? `${editingModule ? '编辑' : '新建'}模块` : '添加成员'}</div><button className="op-link" onClick={() => setModal(null)}>关闭</button></div>
        <div className="modal-body">
          {modal === 'project' ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="项目编号"><input style={fieldStyle} disabled={!!editingProject} value={projectForm.code} onChange={e => setProjectForm({ ...projectForm, code: e.target.value })} /></Field>
            <Field label="项目名称"><input style={fieldStyle} value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} /></Field>
            <Field label="负责人 ID"><input type="number" min="1" style={fieldStyle} value={projectForm.owner_id} onChange={e => setProjectForm({ ...projectForm, owner_id: e.target.value })} /></Field>
            <Field label="状态"><select style={fieldStyle} value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}><option value="planning">规划中</option><option value="in_progress">进行中</option><option value="completed">已完成</option><option value="archived">已归档</option></select></Field>
            <Field label="开始日期"><input type="date" style={fieldStyle} value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} /></Field>
            <Field label="结束日期"><input type="date" style={fieldStyle} value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} /></Field>
            <Field label="项目描述" wide><textarea style={{ ...fieldStyle, minHeight: 90 }} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} /></Field>
          </div> : modal === 'module' ? <div style={{ display: 'grid', gap: 16 }}>
            <Field label="模块名称"><input style={fieldStyle} value={moduleForm.name} onChange={e => setModuleForm({ ...moduleForm, name: e.target.value })} /></Field>
            <Field label="上级模块"><select style={fieldStyle} value={moduleForm.parent_id} onChange={e => setModuleForm({ ...moduleForm, parent_id: e.target.value })}><option value="">无（根模块）</option>{moduleRows.filter(item => item.id !== editingModule?.id).map(item => <option key={item.id} value={item.id}>{'　'.repeat(item.depth)}{item.name}</option>)}</select></Field>
          </div> : <div style={{ display: 'grid', gap: 16 }}>
            <Field label="选择用户"><select style={fieldStyle} value={memberForm.user_id} onChange={e => setMemberForm({ ...memberForm, user_id: e.target.value })}><option value="">请选择</option>{users.filter(user => !members.some(member => member.user_id === user.id)).map(user => <option key={user.id} value={user.id}>{user.real_name}（{user.username}）</option>)}</select></Field>
            <Field label="项目角色"><select style={fieldStyle} value={memberForm.project_role} onChange={e => setMemberForm({ ...memberForm, project_role: e.target.value })}>{Object.entries(roleMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          </div>}
        </div>
        <div className="modal-foot"><button className="btn btn-outline" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" onClick={() => void (modal === 'project' ? saveProject() : modal === 'module' ? saveModule() : saveMember())}>保存</button></div>
      </div></div>}
    </div>
  )
}

function Empty({ col, text }: { col: number; text: string }) { return <tr><td colSpan={col} style={{ textAlign: 'center', padding: 40, color: 'var(--text-gray)' }}>{text}</td></tr> }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label style={{ gridColumn: wide ? '1 / -1' : undefined, fontSize: 13, color: 'var(--text-gray)' }}>{label}<div style={{ marginTop: 6 }}>{children}</div></label> }
function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return <div className="pagination-wrapper"><div className="page-info">共 {total} 条，第 {page} / {pages} 页</div><div className="pagination"><button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>{Array.from({ length: pages }, (_, i) => i + 1).filter(n => pages <= 7 || Math.abs(n - page) <= 2 || n === 1 || n === pages).map(n => <button key={n} className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => onPage(n)}>{n}</button>)}<button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button></div></div>
}
