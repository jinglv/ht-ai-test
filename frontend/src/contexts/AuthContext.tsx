'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '@/lib/api'

interface User {
  id: number
  username: string
  real_name: string
  email?: string | null
  avatar?: string | null
  is_super: boolean
  roles: { id: number; name: string; code: string }[]
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string, captchaId: string, captchaCode: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('hetu_token')
      if (stored) {
        setToken(stored)
        try {
          const res = await getCurrentUser()
          setUser(res.data)
        } catch {
          localStorage.removeItem('hetu_token')
          setToken(null)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = async (username: string, password: string, captchaId: string, captchaCode: string) => {
    const res = await apiLogin(username, password, captchaId, captchaCode)
    const { token: t, user: u } = res.data
    localStorage.setItem('hetu_token', t)
    setToken(t)
    setUser(u)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
