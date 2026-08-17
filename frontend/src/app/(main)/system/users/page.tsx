'use client'

import { useCallback, useEffect, useState } from 'react'
import * as api from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Role = { id: number; name: string; code: string }
type User = {
  id: number
  username: string
  real_name: string
  email?: string | null
  phone?: string | null
  is_active: boolean
  roles?: Role[]
  created_at?: string | null
}

type UserApi = typeof api & {
  resetUserPassword: (id: number, password: string) => Promise<unknown>
}

const userApi = api as UserApi
const emptyForm = { username: '', password: '', real_name: '', email: '', phone: '', is_active: true, role_ids: [] as number[] }
const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid #D7E2F0', borderRadius: 8, color: '#23344D' }

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState('用户列表')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'edit' | 'roles' | 'password' | null>(null)
  const [current, setCurrent] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newPassword, setNewPassword] = useState('')
  const pageSize = 10

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listUsers({ page, page_size: pageSize, keyword: search || undefined })
      const items = (res.data.items as User[]).filter((user) => status === '' || String(user.is_active) === status)
      setUsers(items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { void Promise.resolve().then(loadUsers) }, [loadUsers])
  useEffect(() => {
    void api.listRoles({ page_size: 100 }).then((res) => setRoles(res.data.items as Role[]))
  }, [])

  const openEdit = (user?: User) => {
    setCurrent(user || null)
    setForm(user ? {
      username: user.username,
      password: '',
      real_name: user.real_name,
      email: user.email || '',
      phone: user.phone || '',
      is_active: user.is_active,
      role_ids: user.roles?.map((role) => role.id) || [],
    } : emptyForm)
    setModal('edit')
  }

  const saveUser = async () => {
    if (!form.username || !form.real_name || (!current && form.password.length < 6)) return alert('请完整填写必填项，初始密码至少 6 位')
    if (current) {
      await api.updateUser(current.id, {
        real_name: form.real_name, email: form.email || null, phone: form.phone || null, is_active: form.is_active,
      })
      await api.updateUserRoles(current.id, form.role_ids)
    } else {
      await api.createUser(form)
    }
    setModal(null)
    await loadUsers()
  }

  const toggleStatus = async (user: User) => {
    await api.updateUserStatus(user.id, !user.is_active)
    await loadUsers()
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`确定删除用户“${user.real_name}”？`)) return
    await api.deleteUser(user.id)
    await loadUsers()
  }

  const openRoles = (user: User) => {
    setCurrent(user)
    setForm({ ...emptyForm, role_ids: user.roles?.map((role) => role.id) || [] })
    setModal('roles')
  }

  const saveRoles = async () => {
    if (!current) return
    await api.updateUserRoles(current.id, form.role_ids)
    setModal(null)
    await loadUsers()
  }

  const resetPassword = async () => {
    if (!current || newPassword.length < 6) return alert('新密码至少 6 位')
    await userApi.resetUserPassword(current.id, newPassword)
    setModal(null)
    setNewPassword('')
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TabBar
        tabs={['用户列表', '角色分配', '账号设置'].map(label => ({ key: label, label }))}
        activeKey={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="page-wrap" style={{ minHeight: 0 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="card-head">
            <div className="card-title"><div className="card-title-bar" />用户列表</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="search-box"><span className="material-symbols-outlined">search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索用户名/姓名" /></div>
              <select className="btn btn-outline" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">所有状态</option><option value="true">启用</option><option value="false">禁用</option>
              </select>
              <button className="btn btn-primary" onClick={() => openEdit()}><span className="material-symbols-outlined">add</span>新增用户</button>
            </div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="data-table">
              <thead><tr><th>用户名</th><th>姓名</th><th>邮箱</th><th>所属角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td><td>{user.real_name || '—'}</td><td>{user.email || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{user.roles?.length ? user.roles.map((role) => <span className="tag info" key={role.id}>{role.name}</span>) : '—'}</td>
                    <td style={{ textAlign: 'center' }}><button className={`tag ${user.is_active ? 'success' : 'plain'}`} onClick={() => void toggleStatus(user)}>{user.is_active ? '启用' : '禁用'}</button></td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '—'}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button className="op-link" onClick={() => openEdit(user)}>编辑</button>
                      <button className="op-link" onClick={() => openRoles(user)}>分配角色</button>
                      <button className="op-link" onClick={() => { setCurrent(user); setModal('password') }}>重置密码</button>
                      <button className="op-link danger" onClick={() => void deleteUser(user)}>删除</button>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8A99B0' }}>暂无用户数据</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pagination-wrapper">
            <span className="page-info">共 {total} 条记录，第 {page} / {pages} 页</span>
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>
              <button className="page-btn active">{page}</button>
              <button className="page-btn" disabled={page === pages} onClick={() => setPage((value) => value + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-mask show" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-head"><div className="modal-title"><div className="modal-title-bar" />{modal === 'edit' ? (current ? '编辑用户' : '新增用户') : modal === 'roles' ? `分配角色 · ${current?.real_name}` : `重置密码 · ${current?.real_name}`}</div><button onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {modal === 'edit' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label>用户名<input style={inputStyle} disabled={!!current} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
                  {!current && <label>初始密码<input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>}
                  <label>姓名<input style={inputStyle} value={form.real_name} onChange={(e) => setForm({ ...form, real_name: e.target.value })} /></label>
                  <label>邮箱<input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                  <label>手机<input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                  <label>状态<select style={inputStyle} value={String(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">启用</option><option value="false">禁用</option></select></label>
                </div>
              )}
              {modal === 'roles' && (
                <div className="tree-section">{roles.map((role) => <label key={role.id} className="tree-node-perm"><input type="checkbox" checked={form.role_ids.includes(role.id)} onChange={() => setForm({ ...form, role_ids: form.role_ids.includes(role.id) ? form.role_ids.filter((id) => id !== role.id) : [...form.role_ids, role.id] })} />{role.name}<span className="code-tag">{role.code}</span></label>)}</div>
              )}
              {modal === 'password' && <label>新密码<input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 6 位" /></label>}
            </div>
            <div className="modal-foot"><button className="btn btn-outline" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary" onClick={() => void (modal === 'edit' ? saveUser() : modal === 'roles' ? saveRoles() : resetPassword())}>确认</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
