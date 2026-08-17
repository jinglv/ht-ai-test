'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Scope = 'self' | 'project' | 'all'
type Permission = { id: number; name: string; code: string; type: 'menu' | 'action' | 'data'; children?: Permission[] }
type Role = { id: number; name: string; code: string; description?: string | null; data_scope: Scope; is_builtin: boolean; user_count?: number; permissions?: Permission[] }
type RoleApi = typeof api & {
  getRole?: (id: number) => Promise<{ data: Role }>
  updateRolePermissions: (id: number, permissionIds: number[]) => Promise<unknown>
}

const roleApi = api as RoleApi
const blank = { name: '', code: '', description: '', data_scope: 'self' as Scope }
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #D7E2F0', borderRadius: 8, color: '#23344D', background: '#FFF' }
const scopeMeta: Record<Scope, { label: string; className: string }> = {
  all: { label: '全部 ALL', className: 'info' },
  project: { label: '本项目 PROJECT', className: 'success' },
  self: { label: '仅本人 SELF', className: 'warning' },
}

const flatten = (nodes: Permission[]): Permission[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])])

function PermissionNodes({ nodes, selected, onToggle }: { nodes: Permission[]; selected: number[]; onToggle: (node: Permission) => void }) {
  return nodes.map((node) => (
    <div key={node.id}>
      <label className="tree-node-perm">
        <input type="checkbox" checked={selected.includes(node.id)} onChange={() => onToggle(node)} />
        <span className="label">{node.name}</span>
        <span className="code-tag">{node.code}</span>
      </label>
      {!!node.children?.length && <div className="tree-children-perm"><PermissionNodes nodes={node.children} selected={selected} onToggle={onToggle} /></div>}
    </div>
  ))
}

export default function RolesPage() {
  const [activeTab, setActiveTab] = useState('角色列表')
  const [roles, setRoles] = useState<Role[]>([])
  const [permissionTree, setPermissionTree] = useState<Permission[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [current, setCurrent] = useState<Role | null>(null)
  const [modal, setModal] = useState<'form' | 'auth' | null>(null)
  const [form, setForm] = useState(blank)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listRoles({ page, page_size: 10 })
      setRoles(res.data.items as Role[])
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { void Promise.resolve().then(loadRoles) }, [loadRoles])
  useEffect(() => { void api.getPermissionTree().then((res) => setPermissionTree(res.data as Permission[])) }, [])

  const shownRoles = useMemo(() => roles.filter((role) => (
    (!search || `${role.name}${role.code}`.toLowerCase().includes(search.toLowerCase())) &&
    (!scope || role.data_scope === scope)
  )), [roles, scope, search])

  const openForm = (role?: Role) => {
    setActiveTab('角色列表')
    setCurrent(role || null)
    setForm(role ? { name: role.name, code: role.code, description: role.description || '', data_scope: role.data_scope } : blank)
    setModal('form')
  }

  const saveRole = async () => {
    if (!form.name || !form.code) return alert('请填写角色名称和编码')
    if (current) await api.updateRole(current.id, { name: form.name, description: form.description, data_scope: form.data_scope })
    else await api.createRole(form)
    setModal(null)
    await loadRoles()
  }

  const openAuth = async (role: Role) => {
    setActiveTab('权限分配')
    setCurrent(role)
    const detail = roleApi.getRole ? (await roleApi.getRole(role.id)).data : role
    setSelectedIds(detail.permissions?.map((permission) => permission.id) || [])
    setForm({ name: role.name, code: role.code, description: role.description || '', data_scope: role.data_scope })
    setModal('auth')
  }

  const togglePermission = (node: Permission) => {
    const ids = flatten([node]).map((permission) => permission.id)
    setSelectedIds((value) => value.includes(node.id) ? value.filter((id) => !ids.includes(id)) : Array.from(new Set([...value, ...ids])))
  }

  const saveAuthorization = async () => {
    if (!current) return
    await roleApi.updateRolePermissions(current.id, selectedIds)
    if (!current.is_builtin && form.data_scope !== current.data_scope) {
      await api.updateRole(current.id, { data_scope: form.data_scope })
    }
    setModal(null)
    setActiveTab('角色列表')
    await loadRoles()
  }

  const removeRole = async (role: Role) => {
    if (role.is_builtin || !confirm(`确定删除角色“${role.name}”？`)) return
    await api.deleteRole(role.id)
    await loadRoles()
  }

  const pages = Math.max(1, Math.ceil(total / 10))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TabBar
        tabs={['角色列表', '权限分配', '数据权限'].map(label => ({ key: label, label }))}
        activeKey={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="page-wrap" style={{ minHeight: 0 }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div className="card-title"><div className="card-title-bar" />角色列表</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="search-box"><span className="material-symbols-outlined">search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索角色名称" /></div>
              <select className="btn btn-outline" value={scope} onChange={(e) => setScope(e.target.value)}><option value="">全部数据权限</option><option value="all">全部 ALL</option><option value="project">本项目 PROJECT</option><option value="self">仅本人 SELF</option></select>
              <button className="btn btn-primary" onClick={() => openForm()}><span className="material-symbols-outlined">add</span>新增角色</button>
            </div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="data-table">
              <thead><tr><th>角色名称</th><th>角色编码</th><th>数据权限范围</th><th>描述</th><th>用户数</th><th>是否内置</th><th>操作</th></tr></thead>
              <tbody>
                {shownRoles.map((role) => (
                  <tr key={role.id}>
                    <td><b>{role.name}</b></td><td><span className="code-tag">{role.code}</span></td>
                    <td style={{ textAlign: 'center' }}><span className={`tag ${scopeMeta[role.data_scope]?.className || 'plain'}`}>{scopeMeta[role.data_scope]?.label || role.data_scope || '—'}</span></td>
                    <td>{role.description || '—'}</td><td style={{ textAlign: 'center' }}>{role.user_count ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className="tag plain">{role.is_builtin ? '内置' : '否'}</span></td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="op-link" onClick={() => void openAuth(role)}>授权</button>
                      <button className="op-link" onClick={() => openForm(role)}>编辑</button>
                      <button className={`op-link ${role.is_builtin ? 'muted' : 'danger'}`} disabled={role.is_builtin} onClick={() => void removeRole(role)}>删除</button>
                    </td>
                  </tr>
                ))}
                {!loading && shownRoles.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8A99B0' }}>暂无角色数据</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pagination-wrapper"><span className="page-info">共 {total} 条记录，第 {page} / {pages} 页</span><div className="pagination"><button className="page-btn" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>‹</button><button className="page-btn active">{page}</button><button className="page-btn" disabled={page === pages} onClick={() => setPage((v) => v + 1)}>›</button></div></div>
        </div>
      </div>

      {modal && (
        <div className="modal-mask show" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: modal === 'auth' ? 680 : 520 }}>
            <div className="modal-head"><div className="modal-title"><div className="modal-title-bar" />{modal === 'auth' ? `为角色分配权限 · ${current?.name}` : current ? '编辑角色' : '新增角色'}</div><button onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {modal === 'form' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <label>角色名称<input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <label>角色编码<input style={inputStyle} disabled={!!current} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                  <label>数据权限<select style={inputStyle} disabled={!!current?.is_builtin} value={form.data_scope} onChange={(e) => setForm({ ...form, data_scope: e.target.value as Scope })}><option value="self">仅本人 SELF</option><option value="project">本项目 PROJECT</option><option value="all">全部 ALL</option></select></label>
                  <label>描述<textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                </div>
              ) : (
                <>
                  {(['menu', 'action'] as const).map((type) => {
                    const nodes = permissionTree.filter((node) => node.type === type)
                    return <div className="tree-section" key={type}><div className="tree-section-head"><span className="material-symbols-outlined">{type === 'menu' ? 'view_list' : 'bolt'}</span>{type === 'menu' ? '菜单权限' : '操作权限'}<span className="tag plain" style={{ marginLeft: 'auto' }}>{flatten(nodes).filter((node) => selectedIds.includes(node.id)).length} / {flatten(nodes).length}</span></div><div className="tree-section-body"><PermissionNodes nodes={nodes} selected={selectedIds} onToggle={togglePermission} /></div></div>
                  })}
                  <div className="tree-section"><div className="tree-section-head"><span className="material-symbols-outlined">shield</span>数据权限</div><div className="tree-section-body">{(['self', 'project', 'all'] as Scope[]).map((item) => <label className="tree-node-perm" key={item}><input type="radio" name="data_scope" disabled={!!current?.is_builtin} checked={form.data_scope === item} onChange={() => setForm({ ...form, data_scope: item })} /><span className="sub-label">{scopeMeta[item].label}</span></label>)}</div></div>
                </>
              )}
            </div>
            <div className="modal-foot"><button className="btn btn-outline" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" onClick={() => void (modal === 'auth' ? saveAuthorization() : saveRole())}>确定{modal === 'auth' ? '授权' : ''}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
