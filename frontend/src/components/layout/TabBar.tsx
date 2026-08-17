'use client'

interface Tab {
  key: string
  label: string
  icon?: string
}

interface TabBarProps {
  tabs: Tab[]
  activeKey?: string
  onTabChange?: (key: string) => void
}

export default function TabBar({ tabs, activeKey, onTabChange }: TabBarProps) {
  return (
    <div className="tabs-row" role="tablist">
      {tabs.map(tab => (
        <button
          type="button"
          role="tab"
          aria-selected={activeKey === tab.key}
          key={tab.key}
          className={`tab ${activeKey === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange?.(tab.key)}
        >
          {tab.icon && <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6, verticalAlign: 'text-bottom' }}>{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
