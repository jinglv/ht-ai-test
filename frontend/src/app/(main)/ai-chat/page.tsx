'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { listConversations, createConversation, deleteConversation, renameConversation, getConversationMessages, aiChatStream } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  chart_config?: any
  data_table?: any
  skill_used?: string
  token_input?: number
  token_output?: number
  latency_ms?: number
  created_at: string
}

interface Conversation {
  id: number
  title: string
  last_message_at: string
  created_at: string
}

const QUICK_PROMPTS = [
  '统计本月各项目的用例通过率',
  '分析测试用例覆盖率',
  '生成P0级用例清单',
  '查询最近7天的执行趋势',
  '总结缺陷分布情况',
  '对比不同模块的测试进度',
]

export default function AiChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load conversations list
  useEffect(() => {
    loadConversations()
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    } else {
      setMessages([])
    }
  }, [activeConvId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await listConversations({ page: 1, page_size: 50 })
      setConversations(res.data.items)
    } catch (err) {
      console.error('加载会话失败', err)
    }
  }

  const loadMessages = async (convId: number) => {
    setLoading(true)
    try {
      const data = await getConversationMessages(convId, { limit: 100 })
      setMessages(data.data)
    } catch (err) {
      console.error('加载消息失败', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNewConversation = async () => {
    try {
      const res = await createConversation('新对话')
      const newConv = res.data
      setConversations(prev => [newConv, ...prev])
      setActiveConvId(newConv.id)
    } catch (err) {
      console.error('创建会话失败', err)
    }
  }

  const handleDeleteConversation = async (convId: number) => {
    if (!confirm('确定删除该会话？')) return
    try {
      await deleteConversation(convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (activeConvId === convId) {
        setActiveConvId(null)
        setMessages([])
      }
    } catch (err) {
      console.error('删除会话失败', err)
    }
  }

  const handleRenameConversation = async (convId: number, currentTitle: string) => {
    const newTitle = prompt('新会话名称', currentTitle)
    if (!newTitle || newTitle === currentTitle) return
    try {
      await renameConversation(convId, newTitle)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle } : c))
    } catch (err) {
      console.error('重命名失败', err)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return

    const message = input.trim()
    setInput('')
    setSending(true)

    // Add user message to UI immediately
    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    // Create placeholder for AI response
    const aiMsgId = Date.now() + 1
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, aiMsg])

    abortControllerRef.current = new AbortController()

    try {
      const projectId = 1 // Default project; in real app, get from context
      const response = await aiChatStream({
        message,
        conversation_id: activeConvId || undefined,
        project_id: projectId,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let conversationId = activeConvId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim()
            continue
          }
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            if (!dataStr) continue

            try {
              const eventData = JSON.parse(dataStr)

              // Handle conversation event
              if (eventData.conversation_id && !conversationId) {
                conversationId = eventData.conversation_id
                setActiveConvId(eventData.conversation_id)
                // Add to conversations list
                setConversations(prev => [{
                  id: eventData.conversation_id,
                  title: eventData.title || message.slice(0, 30),
                  last_message_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                }, ...prev])
              }

              // Handle delta (text streaming)
              if (eventData.content) {
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMsgId
                    ? { ...msg, content: msg.content + eventData.content }
                    : msg
                ))
              }

              // Handle done event
              if (eventData.conversation_id) {
                // Update token info if available
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMsgId
                    ? {
                        ...msg,
                        token_input: eventData.token_input,
                        token_output: eventData.token_output,
                        latency_ms: eventData.latency_ms,
                      }
                    : msg
                ))
              }
            } catch {
              // Ignore parse errors for incomplete SSE chunks
            }
          }
        }
      }
    } catch (err) {
      console.error('发送消息失败', err)
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId
          ? { ...msg, content: msg.content + '\n\n[发送失败，请重试]' }
          : msg
      ))
    } finally {
      setSending(false)
      abortControllerRef.current = null
      // Reload conversations to update titles
      loadConversations()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}小时前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}天前`
    return d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* ========== 左：会话列表 ========== */}
      <div className="w-72 bg-white rounded-xl border border-[#D7E2F0] shadow-sm flex flex-col">
        <div className="p-4 border-b border-[#D7E2F0]">
          <button
            onClick={handleNewConversation}
            className="w-full px-4 py-2 bg-[#2A76C9] text-white text-sm rounded-lg hover:bg-[#1E5FA0] transition-colors shadow-sm"
          >
            + 新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#8A99B0]">暂无会话</div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeConvId === conv.id
                      ? 'bg-[#2A76C9]/10 text-[#2A76C9]'
                      : 'text-[#23344D] hover:bg-[#F0F4FA]'
                  }`}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <span className="flex-1 truncate">{conv.title || '新对话'}</span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameConversation(conv.id, conv.title) }}
                      className="text-xs text-[#8A99B0] hover:text-[#2A76C9]"
                    >
                      重命名
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id) }}
                      className="text-xs text-[#8A99B0] hover:text-red-500"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========== 右：对话区 ========== */}
      <div className="flex-1 bg-white rounded-xl border border-[#D7E2F0] shadow-sm flex flex-col">
        {!activeConvId ? (
          /* 欢迎页 */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center text-white text-3xl shadow-lg mb-6">
              🤖
            </div>
            <h2 className="text-xl font-bold text-[#23344D] mb-2">AI 智能测试分析</h2>
            <p className="text-[#8A99B0] text-sm mb-8 text-center max-w-md">
              基于自然语言的测试数据分析助手，可查询用例状态、分析执行趋势、生成测试报告
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-left px-4 py-3 bg-[#F8FAFD] border border-[#D7E2F0] rounded-lg text-sm text-[#23344D] hover:border-[#2A76C9] hover:bg-[#2A76C9]/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="text-center py-12 text-[#8A99B0]">加载中...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-[#8A99B0]">
                  <p className="mb-4">开始新的对话吧</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="px-3 py-1.5 bg-[#F8FAFD] border border-[#D7E2F0] rounded-full text-xs text-[#23344D] hover:border-[#2A76C9] transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center text-white text-sm flex-shrink-0">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-[#2A76C9] text-white'
                          : 'bg-[#F8FAFD] border border-[#D7E2F0] text-[#23344D]'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === 'assistant' && (msg.token_input || msg.token_output) && (
                        <div className="mt-2 pt-2 border-t border-[#D7E2F0]/50 text-xs text-[#8A99B0] flex gap-3">
                          {msg.token_input && <span>输入: {msg.token_input} tokens</span>}
                          {msg.token_output && <span>输出: {msg.token_output} tokens</span>}
                          {msg.latency_ms && <span>耗时: {msg.latency_ms}ms</span>}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#23344D] flex items-center justify-center text-white text-sm flex-shrink-0">
                        {user?.real_name?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2A76C9] to-[#3D88E0] flex items-center justify-center text-white text-sm flex-shrink-0">
                    AI
                  </div>
                  <div className="bg-[#F8FAFD] border border-[#D7E2F0] rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#2A76C9] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[#2A76C9] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[#2A76C9] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="p-4 border-t border-[#D7E2F0]">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入问题，例如：统计本月各项目的用例通过率..."
                  className="flex-1 text-sm border border-[#D7E2F0] rounded-lg px-4 py-2.5 resize-none focus:outline-none focus:border-[#2A76C9] h-12"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="px-6 py-2 bg-[#2A76C9] text-white text-sm rounded-lg hover:bg-[#1E5FA0] transition-colors disabled:opacity-50 shadow-sm"
                >
                  发送
                </button>
              </div>
              <p className="text-xs text-[#8A99B0] mt-2">Enter 发送，Shift+Enter 换行</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
