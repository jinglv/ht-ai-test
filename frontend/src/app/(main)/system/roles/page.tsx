'use client'

import { useState, useEffect } from 'react'
import { listRoles, createRole, updateRole, deleteRole } from '@/lib/api'

interface Role {
  id: number
  name: string
  code: string
  description?: string
  data_scope?: string
  is_builtin: boolean
  permissions: any[]
}

export default function RolesPage() {
  const [items, setItems] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', description: '', data_scope: 'SELF' })

  const loadRoles = async () => {
    setLoading(true)
    try {
      const res = await listRoles({ page: 1, page_size: 50 })
      setItems(res.data.items)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRole) {
        await updateRole(editingRole.id, formData)
      } else {
        await createRole(formData)
      }
      setShowForm(false)
      setEditingRole(null)
      setFormData({ name: '', code: '', description: '', data_scope: 'SELF' })
      loadRoles()
    } catch {
      alert(editingRole ? '更新角色失败' : '创建角色失败')
    }
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setFormData({ name: role.name, code: role.code, description: role.description || '', data_scope: role.data_scope || 'SELF' })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该角色?')) return
    try {
      await deleteRole(id)
      loadRoles()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#23344D]">角色管理</h1>
        <button
          onClick={() => { setEditingRole(null); setFormData({ name: '', code: '', description: '', data_scope: 'SELF' }); setShowForm(true) }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white text-sm font-medium hover:from-[#2362B0] hover:to-[#2A76C9] transition-all shadow-md"
        >
          新建角色
        </button>
      </div>

      {/* 角色列表 */}
      <div className="bg-white rounded-xl border border-[#D7E2F0] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-[#0E2A3E] via-[#1A4966] to-[#235A7D]">
              <th className="px-4 py-3 text-left text-sm font-medium text-white">角色名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">编码</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">数据范围</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white">描述</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-white">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D7E2F0]">
            {items.map(role => (
              <tr key={role.id} className="hover:bg-[#F8FAFD] transition-colors">
                <td className="px-4 py-3 text-sm text-[#23344D] font-medium">{role.name}</td>
                <td className="px-4 py-3 text-sm text-[#8A99B0]">{role.code}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    role.data_scope === 'ALL' ? 'bg-red-100 text-red-700' :
                    role.data_scope === 'PROJECT' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {role.data_scope || 'SELF'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#8A99B0]">{role.description || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(role)} className="text-[#2A76C9] text-sm hover:underline mr-3">编辑</button>
                  <button onClick={() => handleDelete(role.id)} className="text-[#E54C4C] text-sm hover:underline" disabled={role.is_builtin}>删除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8A99B0] text-sm">暂无角色</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-[#D7E2F0] p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold text-[#23344D] mb-4">{editingRole ? '编辑角色' : '新建角色'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">角色名称 *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#23344D] mb-1">角色编码 *</label>
                  <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" required disabled={!!editingRole} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">数据范围</label>
                <select value={formData.data_scope} onChange={e => setFormData({ ...formData, data_scope: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30">
                  <option value="SELF">仅本人 (SELF)</option>
                  <option value="PROJECT">本项目 (PROJECT)</option>
                  <option value="ALL">全部 (ALL)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1">描述</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#D7E2F0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white text-sm font-medium hover:from-[#2362B0] hover:to-[#2A76C9] transition-all">
                  {editingRole ? '保存' : '创建'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingRole(null) }} className="px-4 py-2 rounded-lg border border-[#D7E2F0] text-[#23344D] text-sm font-medium hover:bg-[#F8FAFD] transition-colors">
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

