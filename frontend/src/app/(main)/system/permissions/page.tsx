'use client'

import { useState, useEffect } from 'react'
import { listPermissions } from '@/lib/api'

interface Permission {
  id: number
  name: string
  code: string
  type: string
  parent_id?: number
  children?: Permission[]
}

export default function PermissionsPage() {
  const [items, setItems] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  const loadPermissions = async () => {
    setLoading(true)
    try {
      const res = await listPermissions()
      setItems(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  // 构建树形结构
  const buildTree = (parentId: number | null = null): Permission[] => {
    return items.filter(item => item.parent_id === parentId).map(item => ({
      ...item,
      children: buildTree(item.id),
    }))
  }

  const tree = buildTree()

  const renderNode = (node: Permission, level = 0) => (
    <div key={node.id}>
      <div className="flex items-center py-2 px-3 hover:bg-[#F8FAFD] rounded-lg" style={{ paddingLeft: 12 + level * 24 }}>
        <span className="text-sm font-medium text-[#23344D]">{node.name}</span>
        <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#8A99B0]">{node.code}</span>
        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2A76C9]/10 text-[#2A76C9]">
          {node.type === 'menu' ? '菜单' : node.type === 'action' ? '操作' : '数据'}
        </span>
      </div>
      {node.children?.map(child => renderNode(child, level + 1))}
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#23344D]">权限管理</h1>

      <div className="bg-white rounded-xl border border-[#D7E2F0] p-6 shadow-sm">
        {loading ? (
          <div className="text-center text-[#8A99B0] py-8">加载中...</div>
        ) : (
          <div className="space-y-1">
            {tree.map(node => renderNode(node))}
            {tree.length === 0 && (
              <div className="text-center text-[#8A99B0] py-8">暂无权限数据</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

