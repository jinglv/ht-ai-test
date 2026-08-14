'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { getCaptcha } from '@/lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  useEffect(() => {
    refreshCaptcha()
  }, [])

  const refreshCaptcha = async () => {
    try {
      const res = await getCaptcha()
      setCaptchaId(res.data.captcha_id)
      setCaptchaImage(res.data.image)
      setCaptchaCode('')
    } catch {
      setError('获取验证码失败')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password, captchaId, captchaCode)
      router.push('/dashboard')
    } catch {
      setError('登录失败，请检查用户名密码和验证码')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 左 56% 品牌区 */}
      <div className="hidden lg:flex lg:w-[56%] relative bg-gradient-to-br from-[#0E2A3E] via-[#1A4966] to-[#235A7D] overflow-hidden">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 border border-[#D4B86A]/30 rounded-full" />
          <div className="absolute bottom-32 right-32 w-96 h-96 border border-[#2A76C9]/20 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 border border-[#D4B86A]/20 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          {/* 旋转鎏金光环 LOGO */}
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2A76C9]/30 to-transparent animate-pulse" />
            <div className="absolute inset-2 rounded-full border-2 border-[#D4B86A]/40 animate-spin" style={{ animationDuration: '20s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center shadow-2xl">
                <span className="text-white text-3xl font-bold">河图</span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 tracking-wide">
            河图智弈
          </h1>
          <p className="text-white/70 text-lg mb-8">
            企业级 AI 驱动的测试管理平台
          </p>

          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#2A76C9]/30 flex items-center justify-center text-[#D4B86A]">01</div>
              <span>智能需求分析与用例生成</span>
            </div>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#2A76C9]/30 flex items-center justify-center text-[#D4B86A]">02</div>
              <span>全流程测试项目管理</span>
            </div>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#2A76C9]/30 flex items-center justify-center text-[#D4B86A]">03</div>
              <span>对话式 AI 数据分析</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右 44% 登录卡片 */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFD] p-6">
        <div className="w-full max-w-[440px]">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center text-white text-xl font-bold shadow-lg mb-3">
              河图
            </div>
            <h1 className="text-2xl font-bold text-[#23344D]">河图智弈</h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-[#D7E2F0] p-8">
            <h2 className="text-2xl font-bold text-[#23344D] mb-1">账号登录</h2>
            <p className="text-[#8A99B0] text-sm mb-6">请输入您的账号信息</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1.5">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#D7E2F0] text-[#23344D] placeholder-[#8A99B0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30 focus:border-[#2A76C9] transition-all"
                  placeholder="请输入用户名"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1.5">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#D7E2F0] text-[#23344D] placeholder-[#8A99B0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30 focus:border-[#2A76C9] transition-all"
                  placeholder="请输入密码"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#23344D] mb-1.5">
                  验证码
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={captchaCode}
                    onChange={e => setCaptchaCode(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[#D7E2F0] text-[#23344D] placeholder-[#8A99B0] focus:outline-none focus:ring-2 focus:ring-[#2A76C9]/30 focus:border-[#2A76C9] transition-all"
                    placeholder="请输入验证码"
                    required
                  />
                  <div
                    className="w-28 h-10 rounded-lg border border-[#D7E2F0] cursor-pointer flex items-center justify-center bg-[#F8FAFD] hover:bg-[#F0F4F9] transition-colors select-none"
                    onClick={refreshCaptcha}
                  >
                    <span className="text-[#23344D] font-mono font-bold tracking-widest text-sm">
                      {captchaImage}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#2A76C9] to-[#3D88E0] text-white font-medium hover:from-[#2362B0] hover:to-[#2A76C9] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? '登录中...' : '登 录'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[#8A99B0]">
              默认账号: admin / hetu@2026
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
