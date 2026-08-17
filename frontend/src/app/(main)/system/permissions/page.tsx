'use client'

import { useEffect, useMemo, useState } from 'react'
import { getPermissionTree } from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Permission = {
  id: number
  name: string
  code: string
  type: 'menu' | 'action' | 'data'
  parent_id?: number | null
  path?: string | null
  icon?: string | null
  children?: Permission[]
}

const typeMeta = {
  menu: { label: '菜单权限', className: 'plain', icon: 'folder' },
  action: { label: '操作权限', className: 'info', icon: 'bolt' },
  data: { label: '数据权限', className: 'warning', icon: 'shield' },
}

const flatten = (nodes: Permission[]): Permission[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])])

function TreeNodes({ nodes, selected, onSelect, depth = 0 }: { nodes: Permission[]; selected: Permission | null; onSelect: (node: Permission) => void; depth?: number }) {
  return nodes.map((node) => (
    <div key={node.id}>
      <button className={`tnode ${selected?.id === node.id ? 'active' : ''}`} style={{ width: '100%', paddingLeft: 10 + depth * 16 }} onClick={() => onSelect(node)}>
        <span className="material-symbols-outlined">{node.icon || (node.children?.length ? 'folder' : typeMeta[node.type]?.icon || 'key')}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        {node.type === 'action' && <span className="code-tag" style={{ marginLeft: 'auto' }}>{node.code}</span>}
      </button>
      {!!node.children?.length && <TreeNodes nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} />}
    </div>
  ))
}

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState('权限列表')
  const [items, setItems] = useState<Permission[]>([])
  const [selected, setSelected] = useState<Permission | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getPermissionTree()
      .then((res) => setItems(res.data as Permission[]))
      .finally(() => setLoading(false))
  }, [])

  const all = useMemo(() => flatten(items), [items])
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const tabType = activeTab === '操作权限明细' ? 'action' : activeTab === '数据权限范围' ? 'data' : null
    if (!keyword && !tabType) return items
    return all.filter((node) => (!tabType || node.type === tabType) && (!keyword || `${node.name}${node.code}`.toLowerCase().includes(keyword)))
  }, [activeTab, all, items, search])
  const parent = selected?.parent_id ? all.find((node) => node.id === selected.parent_id) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TabBar
        tabs={['权限列表', '操作权限明细', '数据权限范围'].map(label => ({ key: label, label }))}
        activeKey={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="dual" style={{ padding: 20, gap: 16 }}>
        <div className="card tree-card-wide">
          <div className="card-head"><div className="card-title"><div className="card-title-bar" />权限点树</div></div>
          <div className="card-body">
            <div className="search-box" style={{ marginBottom: 12 }}><span className="material-symbols-outlined">search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索权限名称/编码" /></div>
            {loading && <div style={{ padding: 30, textAlign: 'center', color: '#8A99B0' }}>加载中...</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#8A99B0' }}>暂无权限数据</div>}
            {!loading && !search && activeTab === '权限列表' ? (
              (['menu', 'action', 'data'] as const).map((type) => {
                const nodes = items.filter((node) => node.type === type)
                if (!nodes.length) return null
                return <div className="tree-section" key={type}><div className="tree-section-head"><span className="material-symbols-outlined">{typeMeta[type].icon}</span>{typeMeta[type].label}<span className="tag plain" style={{ marginLeft: 'auto' }}>{flatten(nodes).length}</span></div><div className="tree-section-body" style={{ padding: 8 }}><TreeNodes nodes={nodes} selected={selected} onSelect={setSelected} /></div></div>
              })
            ) : <TreeNodes nodes={filtered} selected={selected} onSelect={setSelected} />}
          </div>
        </div>

        <div className="card detail-card">
          <div className="card-head"><div className="card-title"><div className="card-title-bar" />权限详情</div></div>
          <div className="card-body">
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}><b style={{ fontSize: 18 }}>{selected.name}</b><span className="code-tag">{selected.code}</span><span className={`tag ${typeMeta[selected.type]?.className || 'plain'}`}>{typeMeta[selected.type]?.label || selected.type}</span></div>
                <div className="field-row"><div className="field"><div className="field-label">权限名称</div><div className="field-value">{selected.name || '—'}</div></div><div className="field"><div className="field-label">权限编码</div><div className="field-value"><span className="code-tag">{selected.code || '—'}</span></div></div></div>
                <div className="field-row"><div className="field"><div className="field-label">权限类型</div><div className="field-value">{typeMeta[selected.type]?.label || selected.type || '—'}</div></div><div className="field"><div className="field-label">父级权限</div><div className="field-value">{parent?.name || '—'}</div></div></div>
                <div className="field-row"><div className="field"><div className="field-label">路由路径</div><div className="field-value">{selected.path || '—'}</div></div><div className="field"><div className="field-label">图标</div><div className="field-value">{selected.icon || '—'}</div></div></div>
                <div className="field"><div className="field-label">子权限</div><div className="field-value muted">{selected.children?.length ? selected.children.map((node) => node.name).join(' / ') : '—'}</div></div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: '#8A99B0' }}><span className="material-symbols-outlined" style={{ fontSize: 48, color: '#D7E2F0' }}>verified_user</span><p>请在左侧选择一个权限点查看详情</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
