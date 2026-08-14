'use client'

import { useState, useEffect } from 'react'
import { listUsers, createUser, updateUser, deleteUser, updateUserStatus } from '@/lib/api'

interface User {
  id: number
  username: string
  real_name: string
  email?: string
  phone?: string
  is_active: boolean
  is_super: boolean
  roles: any[]
  created_at: string
}

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    email: '',
    phone: '',
    is_active: true,
    is_super: false,
    role_ids: [] as number[],
  })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await listUsers({ page: 1, page_size: 50, keyword: keyword || undefined })
      setItems(res.data.items)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData)
      } else {
        await createUser(formData)
      }
      setShowForm(false)
      setEditingUser(null)
      setFormData({ username: '', password: '', real_name: '', email: '', phone: '', is_active: true, is_super: false, role_ids: [] })
      loadUsers()
    } catch {
      alert(editingUser ? '更新用户失败' : '创建用户失败')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    const roleIds = user.roles?.map((r: any) => r.id) || []
    setFormData({
      username: user.username,
      password: '',
      real_name: user.real_name,
      email: user.email || '',
      phone: user.phone || '',
      is_active: user.is_active,
      is_super: user.is_super,
      role_ids: roleIds,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该用户?')) return
    try {
      await deleteUser(id)
      loadUsers()
    } catch {
      alert('删除失败')
    }
  }

  const toggleStatus = async (id: number, is_active: boolean) => {
    try {
      await updateUserStatus(id, !is_active)
      loadUsers()
    } catch {
      alert('操作失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#23344D]">用户管理</h1>
        <button
          onClick={() => { setEditingUser(null); setFormData({ username: '', password: '', real_name: '', email: '', phone: '', is_active: true, is_super: false, role_ids: [] }); setShowForm(true) }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white text-sm font-medium hover:from-[#2362B0] hover:to-[#2A76C9] transition-all shadow-md"
        >
          新建用户
        </button>
      </div>

      {/* 搜索 */}
      <div className="bg-white rounded-xl border border-[#D7E2F0] p-4 shadow-sm">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadUsers()}
          className="w-full px-4 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30 focus:border-[#2A76C9]"
          placeholder="搜索用户名/姓名..."
        />
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl border border-[#D7E2F0] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-[#0E2A3E] via-[#1A4966] to-[#235A7D]">
              <th className="px-4 py-3 text-left text-sm font-medium text-white">用户名</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">姓名</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">邮箱</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">状态</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-white">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D7E2F0]">
            {items.map(user => (
              <tr key={user.id} className="hover:bg-[#F8FAFD] transition-colors">
                <td className="px-4 py-3 text-sm text-[#23344D] font-medium">{user.username}</td>
                <td className="px-4 py-3 text-sm text-[#23344D]">{user.real_name}</td>
                <td className="px-4 py-3 text-sm text-[#8A99B0]">{user.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? '启用' : '禁用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(user)} className="text-[#2A76C9] text-sm hover:underline mr-3">编辑</button>
                  <button onClick={() => toggleStatus(user.id, user.is_active)} className="text-[#FF8C38] text-sm hover:underline mr-3">
                    {user.is_active ? '禁用' : '启用'}
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="text-[#E54C4C] text-sm hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8A99B0] text-sm">暂无用户</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-[#D7E2F0] p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold text-[#23344D] mb-4">{editingUser ? '编辑用户' : '新建用户'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">用户名 *</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" required disabled={!!editingUser} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">姓名 *</label>
                  <input type="text" value={formData.real_name} onChange={e => setFormData({ ...formData, real_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" required />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-[#23344D] mb-1">密码 *</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" required minLength={6} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">邮箱</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white text-sm font-medium hover:from-[#2362B0] hover:to-[#2A76C9] transition-all">
                  {editingUser ? '保存' : '创建'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingUser(null) }} className="px-4 py-2 rounded-lg border border-[#D7E2F0] text-[#23344D] text-sm font-medium hover:bg-[#F8FAFD] transition-colors">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

