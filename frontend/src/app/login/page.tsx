'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getCaptcha, login } from '@/lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)

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

  useEffect(() => {
    let active = true
    getCaptcha().then((res) => {
      if (active) {
        setCaptchaId(res.data.captcha_id)
        setCaptchaImage(res.data.image)
      }
    }).catch(() => { if (active) setError('获取验证码失败') })
    return () => { active = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await login(username, password, captchaId, captchaCode, remember)
      localStorage.setItem('hetu_token', res.data.token)
      window.location.assign('/dashboard')
    } catch {
      setError('登录失败，请检查用户名密码和验证码')
      void refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex h-full w-full">
      {/* ==================== 左 56% 品牌区 ==================== */}
      <section className="brand-panel hidden md:flex w-[56%] h-full flex-col items-center justify-center relative overflow-hidden">
        {/* 透视网格 */}
        <div className="brand-grid"></div>
        {/* 河图点阵 */}
        <div className="hetu-dots"></div>
        {/* 极光光球 */}
        <div className="aurora a1"></div>
        <div className="aurora a2"></div>
        <div className="aurora a3"></div>
        {/* 科技流线 */}
        <div className="stream-line" style={{ top: '20%', animation: 'move-stream 6s linear infinite' }}></div>
        <div className="stream-line" style={{ top: '48%', animation: 'move-stream 6s linear infinite 2s' }}></div>
        <div className="stream-line" style={{ top: '76%', animation: 'move-stream 6s linear infinite 4s' }}></div>
        {/* 山水流线 */}
        <div className="brand-wave"></div>

        {/* 品牌内容 */}
        <div className="z-10 flex flex-col items-center text-center px-8">
          {/* Logo：旋转鎏金光环 + 呼吸动画白盘 */}
          <div className="logo-stage mb-8 anim d1">
            <div className="logo-aura"></div>
            <div className="brand-logo-ring">
              <Image src="/logo.png" alt="河图智弈" width={124} height={124} priority />
            </div>
          </div>

          <h1 className="text-[46px] font-black leading-none text-white tracking-[0.18em] mb-5 anim d2 font-brand">
            河图智弈
          </h1>
          <div className="diamond-rule mb-5 anim d3">
            <span className="diamond"></span>
          </div>
          <p className="text-[16px] tracking-[0.24em] font-semibold mb-2 gold-text anim d3">
            AI 智能体驱动 · 企业级自动化测试平台
          </p>
          <p className="text-[13px] tracking-[0.18em] anim d4" style={{ color: 'rgba(255,255,255,0.55)' }}>
            循河图数理 · 以智弈控测
          </p>

          {/* 特性卡片 */}
          <div className="flex flex-col gap-3.5 mt-11">
            <div className="feat-item anim d5">
              <div className="feat-ic"><span className="material-symbols-outlined">smart_toy</span></div>
              <div className="text-left">
                <div className="feat-tt">AI 智能体调度</div>
                <div className="feat-ds">多智能体协同，自动编排测试任务</div>
              </div>
            </div>
            <div className="feat-item anim d6">
              <div className="feat-ic"><span className="material-symbols-outlined">bolt</span></div>
              <div className="text-left">
                <div className="feat-tt">用例智能生成</div>
                <div className="feat-ds">依据需求文档，秒级产出测试用例</div>
              </div>
            </div>
            <div className="feat-item anim d7">
              <div className="feat-ic"><span className="material-symbols-outlined">insights</span></div>
              <div className="text-left">
                <div className="feat-tt">数据洞察分析</div>
                <div className="feat-ds">通过率、缺陷分布，一键可视化</div>
              </div>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="absolute bottom-8 left-0 w-full text-center z-10">
          <span className="text-[12px] font-medium tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            &copy; 2026 河图智弈 · AI 智能体测试管理平台
          </span>
        </div>
      </section>

      {/* ==================== 右 44% 登录区 ==================== */}
      <section className="form-side w-full md:w-[44%] h-full flex items-center justify-center p-6 relative overflow-hidden">
        <div className="w-full max-w-[440px] rounded-2xl login-card p-11 sm:p-12 z-10 anim d2">
          {/* 移动端 mini logo */}
          <div className="md:hidden flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-white border border-[#D7E2F0] shadow-md overflow-hidden flex items-center justify-center p-2">
              <Image src="/logo.png" alt="河图智弈" width={56} height={56} className="w-full h-full object-contain rounded-full" />
            </div>
          </div>

          {/* 表单标题 */}
          <div className="mb-9">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-[4px] h-7 rounded-full" style={{ background: 'linear-gradient(180deg, var(--jin), #B8934A)' }}></div>
              <h2 className="text-[26px] font-brand font-bold text-[#23344D] tracking-wide">系统登录</h2>
            </div>
            <p className="text-[13px] text-[#8A99B0] tracking-wide pl-[16px]">欢迎回来，请登录您的测试平台账号</p>
            <div className="h-[1px] w-full mt-5" style={{ background: 'linear-gradient(90deg, rgba(212,184,106,0.5), transparent)' }}></div>
          </div>

          {/* 登录表单 */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="field">
              <span className="material-symbols-outlined">person</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入登录账号"
                required
              />
            </div>

            <div className="field">
              <span className="material-symbols-outlined">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入登录密码"
                style={{ paddingRight: 44 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 flex items-center text-[#8A99B0] hover:text-[#2A76C9] transition-colors"
              >
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <div className="field flex-1">
                <span className="material-symbols-outlined">verified_user</span>
                <input
                  type="text"
                  value={captchaCode}
                  onChange={e => setCaptchaCode(e.target.value)}
                  placeholder="验证码"
                  required
                />
              </div>
              <div className="captcha-box" onClick={refreshCaptcha} id="captchaBox">
                {captchaImage.startsWith('data:image/') ? (
                  <Image src={captchaImage} alt="验证码" width={132} height={48} unoptimized className="h-full w-full object-contain" />
                ) : (
                  <span>{captchaImage || '点击刷新'}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[13px] pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D7E2F0] text-[#2A76C9] focus:ring-[#2A76C9] focus:ring-offset-0"
                />
                <span className="text-[#8A99B0] group-hover:text-[#23344D] transition-colors">记住登录状态</span>
              </label>
              <a href="#" className="text-[#2A76C9] hover:text-[#2362B0] font-medium transition-colors">
                忘记密码？
              </a>
            </div>

            <button type="submit" disabled={loading} className="btn-login">
              {loading ? '登录中...' : '登 录'}
            </button>
            {error && <p role="alert" className="text-center text-[13px] text-[#E54C4C]">{error}</p>}
          </form>

          {/* 页脚版权 */}
          <div className="mt-10 text-center">
            <p className="text-[12px] text-[#8A99B0] tracking-wide">&copy; 2026 河图智弈 测试管理平台 · 版权所有</p>
          </div>
        </div>
      </section>
    </main>
  )
}
