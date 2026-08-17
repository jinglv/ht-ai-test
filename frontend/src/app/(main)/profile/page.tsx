'use client'

import { useEffect, useState } from 'react'
import * as api from '@/lib/api'
import TabBar from '@/components/layout/TabBar'

type Role = { id: number; name: string; code: string; data_scope?: string; description?: string | null }
type Profile = {
  id: number
  username: string
  real_name: string
  email?: string | null
  phone?: string | null
  avatar?: string | null
  is_active?: boolean
  created_at?: string | null
  roles?: Role[]
}
type ProfileApi = typeof api & {
  updateProfile: (data: { real_name: string; email: string | null; phone: string | null }) => Promise<{ data: Profile }>
  changePassword: (oldPassword: string, newPassword: string) => Promise<unknown>
}

const profileApi = api as ProfileApi
const inputStyle = { height: 44, border: '1px solid #D7E2F0', borderRadius: 8, padding: '0 14px', fontSize: 14, color: '#23344D', background: '#FFF' }
const scopeLabel: Record<string, string> = { all: 'ALL 全部', project: 'PROJECT 本项目', self: 'SELF 仅本人', ALL: 'ALL 全部', PROJECT: 'PROJECT 本项目', SELF: 'SELF 仅本人' }

export default function ProfilePage() {
  const [tab, setTab] = useState('个人信息')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ real_name: '', email: '', phone: '' })
  const [password, setPassword] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.getCurrentUser().then((res) => {
      const data = res.data as Profile
      setProfile(data)
      setForm({ real_name: data.real_name || '', email: data.email || '', phone: data.phone || '' })
    }).finally(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    const res = await profileApi.updateProfile({ real_name: form.real_name, email: form.email || null, phone: form.phone || null })
    setProfile((value) => value ? { ...value, ...res.data } : res.data)
    setMessage('个人信息已保存')
  }

  const savePassword = async () => {
    if (password.new_password.length < 6) return setMessage('新密码至少 6 位')
    if (password.new_password !== password.confirm_password) return setMessage('两次输入的新密码不一致')
    await profileApi.changePassword(password.old_password, password.new_password)
    setPassword({ old_password: '', new_password: '', confirm_password: '' })
    setMessage('密码修改成功')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8A99B0' }}>加载中...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TabBar
        tabs={['个人信息', '修改密码', '我的角色'].map(label => ({ key: label, label }))}
        activeKey={tab}
        onTabChange={key => { setTab(key); setMessage('') }}
      />
      <div style={{ padding: 20, display: 'flex', gap: 16, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div className="card" style={{ width: 300, flexShrink: 0, alignSelf: 'flex-start' }}>
          <div style={{ height: 84, background: 'linear-gradient(135deg,#0E2A3E 0%,#1A4966 50%,#235A7D 100%)', borderBottom: '2px solid #D4B86A' }} />
          <div style={{ padding: '0 20px 20px', textAlign: 'center', marginTop: -44 }}>
            <div
              role={profile?.avatar ? 'img' : undefined}
              aria-label={profile?.avatar ? '用户头像' : undefined}
              style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid #D4B86A', background: profile?.avatar ? `center / cover no-repeat url("${profile.avatar}")` : 'linear-gradient(135deg,#2A76C9,#5A96E5)', color: '#FFF', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {!profile?.avatar && <span className="material-symbols-outlined" style={{ fontSize: 46 }}>person</span>}
            </div>
            <div className="font-brand" style={{ fontSize: 20, fontWeight: 700, color: '#23344D' }}>{profile?.real_name || '—'}</div>
            <div className="code-tag" style={{ marginTop: 6 }}>账号 · {profile?.username || '—'}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              {profile?.roles?.length ? profile.roles.map((role) => <span className="tag info" key={role.id}>{role.name}</span>) : <span style={{ color: '#8A99B0', fontSize: 13 }}>暂未分配角色</span>}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #E8EDF5', color: '#8A99B0', fontSize: 12 }}>创建时间：{profile?.created_at ? new Date(profile.created_at).toLocaleString('zh-CN') : '—'}</div>
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="card-head">
            <div className="card-title"><div className="card-title-bar" />{tab}</div>
            {tab === '个人信息' && <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-outline" onClick={() => setForm({ real_name: profile?.real_name || '', email: profile?.email || '', phone: profile?.phone || '' })}>重置</button><button className="btn btn-primary" onClick={() => void saveProfile()}><span className="material-symbols-outlined">save</span>保存</button></div>}
          </div>
          <div style={{ padding: 24 }}>
            {message && <div className={`tag ${message.includes('成功') || message.includes('保存') ? 'success' : 'warning'}`} style={{ marginBottom: 18 }}>{message}</div>}
            {tab === '个人信息' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>用户名<div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#F4F7FB', color: '#8A99B0' }}><span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>lock</span>{profile?.username || '—'}</div></label>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>姓名<input style={inputStyle} value={form.real_name} onChange={(e) => setForm({ ...form, real_name: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>邮箱<input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>手机<input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>状态<div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#F4F7FB' }}>{profile?.is_active === undefined ? '—' : <span className={`tag ${profile.is_active ? 'success' : 'plain'}`}>{profile.is_active ? '启用' : '禁用'}</span>}</div></label>
                <label style={{ display: 'grid', gap: 6, color: '#8A99B0', fontSize: 13 }}>创建时间<div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#F4F7FB' }}>{profile?.created_at ? new Date(profile.created_at).toLocaleString('zh-CN') : '—'}</div></label>
              </div>
            )}
            {tab === '修改密码' && (
              <div style={{ display: 'grid', gap: 18, maxWidth: 520 }}>
                <label style={{ display: 'grid', gap: 6 }}>当前密码<input style={inputStyle} type="password" value={password.old_password} onChange={(e) => setPassword({ ...password, old_password: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: 6 }}>新密码<input style={inputStyle} type="password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} /></label>
                <label style={{ display: 'grid', gap: 6 }}>确认新密码<input style={inputStyle} type="password" value={password.confirm_password} onChange={(e) => setPassword({ ...password, confirm_password: e.target.value })} /></label>
                <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => void savePassword()}>确认修改</button>
              </div>
            )}
            {tab === '我的角色' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {profile?.roles?.length ? profile.roles.map((role) => (
                  <div className="tree-section" key={role.id} style={{ marginBottom: 0 }}>
                    <div className="tree-section-head"><span className="material-symbols-outlined">shield_person</span>{role.name}<span className="code-tag">{role.code}</span>{role.data_scope && <span className="tag info" style={{ marginLeft: 'auto' }}>{scopeLabel[role.data_scope] || role.data_scope}</span>}</div>
                    <div className="tree-section-body" style={{ color: '#566680', fontSize: 14 }}>{role.description || '—'}</div>
                  </div>
                )) : <div style={{ padding: 50, textAlign: 'center', color: '#8A99B0' }}>暂未分配角色</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
