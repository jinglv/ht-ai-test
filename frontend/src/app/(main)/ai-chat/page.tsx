'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aiChatStream,
  deleteConversation,
  getConversationMessages,
  listConversations,
  renameConversation,
} from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type JsonRecord = Record<string, unknown>

interface Message {
  id: number | string
  role: 'user' | 'assistant'
  content: string
  chart_config?: JsonRecord
  data_table?: JsonRecord
  token_input?: number
  token_output?: number
  latency_ms?: number
  created_at: string
}

interface Conversation {
  id: number
  title: string
  last_message_at?: string
  created_at?: string
}

interface ChartPoint {
  label: string
  value: number
}

const QUICK_PROMPTS = ['通过率趋势', '缺陷分布图', '用例增长曲线', '项目健康度']

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined
}

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}天前`
  return date.toLocaleDateString('zh-CN')
}

function getChartPoints(config?: JsonRecord): { title: string; points: ChartPoint[] } | null {
  if (!config) return null
  const title = typeof config.title === 'string' ? config.title : '数据分析'
  let points: ChartPoint[] = []

  if (Array.isArray(config.data)) {
    points = config.data.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const row = item as JsonRecord
      const label = row.name ?? row.label ?? row.category
      const value = Number(row.value ?? row.count)
      return typeof label === 'string' && Number.isFinite(value) ? [{ label, value }] : []
    })
  } else {
    const labels = Array.isArray(config.labels)
      ? config.labels
      : Array.isArray(config.categories)
        ? config.categories
        : []
    const datasets = Array.isArray(config.datasets)
      ? config.datasets
      : Array.isArray(config.series)
        ? config.series
        : []
    const firstDataset = datasets[0]
    const values =
      firstDataset && typeof firstDataset === 'object' && Array.isArray((firstDataset as JsonRecord).data)
        ? ((firstDataset as JsonRecord).data as unknown[])
        : []
    points = labels.flatMap((label, index) => {
      const value = Number(values[index])
      return typeof label === 'string' && Number.isFinite(value) ? [{ label, value }] : []
    })
  }

  return points.length ? { title, points } : null
}

function ChartView({ config }: { config?: JsonRecord }) {
  const chart = getChartPoints(config)
  if (!chart) return null
  const max = Math.max(...chart.points.map(point => Math.max(point.value, 0)), 1)

  return (
    <div style={{ marginTop: 12, border: '1px solid #E8EDF5', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--jin)' }} />
        <strong style={{ fontSize: 13 }}>{chart.title}</strong>
      </div>
      <div style={{ height: 160, display: 'flex', alignItems: 'stretch', gap: 12, overflowX: 'auto' }}>
        {chart.points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            style={{ minWidth: 48, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <span style={{ fontSize: 11, color: 'var(--primary-blue)', fontWeight: 600 }}>
              {point.value}
            </span>
            <div style={{ flex: 1, width: '70%', display: 'flex', alignItems: 'flex-end', margin: '6px 0' }}>
              <span
                style={{
                  display: 'block',
                  width: '100%',
                  height: `${Math.max(4, (Math.max(point.value, 0) / max) * 100)}%`,
                  borderRadius: '5px 5px 2px 2px',
                  background:
                    index === 1
                      ? 'linear-gradient(180deg, #D4B86A, #E8C87A)'
                      : 'linear-gradient(180deg, #2A76C9, #5A96E5)',
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-gray)', whiteSpace: 'nowrap' }}>
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableView({ table }: { table?: JsonRecord }) {
  if (!table) return null
  const rowsValue = Array.isArray(table.rows) ? table.rows : Array.isArray(table.data) ? table.data : []
  const rows = rowsValue.filter(
    (row): row is JsonRecord => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  )
  if (!rows.length) return null

  const configuredColumns = Array.isArray(table.columns) ? table.columns : []
  const columns = configuredColumns.length
    ? configuredColumns.flatMap(column => {
        if (typeof column === 'string') return [{ key: column, label: column }]
        if (!column || typeof column !== 'object') return []
        const value = column as JsonRecord
        const key = value.key ?? value.dataIndex ?? value.field
        const label = value.title ?? value.label ?? key
        return typeof key === 'string' && typeof label === 'string' ? [{ key, label }] : []
      })
    : Object.keys(rows[0]).map(key => ({ key, label: key }))

  if (!columns.length) return null
  return (
    <div style={{ marginTop: 12, maxWidth: '100%', overflowX: 'auto', borderRadius: 8 }}>
      <table className="data-table">
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map(column => <td key={column.key}>{String(row[column.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AiChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const messageSequenceRef = useRef(0)

  const loadConversations = useCallback(async () => {
    try {
      const response = await listConversations({ page: 1, page_size: 50 })
      setConversations(response.data.items)
    } catch {
      setError('会话列表加载失败，请稍后重试。')
    }
  }, [])

  useEffect(() => {
    let active = true
    listConversations({ page: 1, page_size: 50 })
      .then(response => {
        if (active) setConversations(response.data.items)
      })
      .catch(() => {
        if (active) setError('会话列表加载失败，请稍后重试。')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!activeConvId) return
    if (sending) return

    let active = true
    getConversationMessages(activeConvId, { limit: 100 })
      .then(response => {
        if (active) {
          setMessages(response.data.map(message => ({
            ...message,
            chart_config: asRecord(message.chart_config),
            data_table: asRecord(message.data_table),
          })))
        }
      })
      .catch(() => {
        if (active) setError('消息记录加载失败，请稍后重试。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeConvId, sending])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => {
    void readerRef.current?.cancel()
  }, [])

  const handleNewConversation = () => {
    if (sending) void readerRef.current?.cancel()
    setActiveConvId(null)
    setMessages([])
    setInput('')
    setError('')
  }

  const selectConversation = (conversationId: number) => {
    if (conversationId === activeConvId) return
    setLoading(true)
    setActiveConvId(conversationId)
  }

  const handleDeleteConversation = async (conversationId: number) => {
    if (!window.confirm('确定删除该会话？')) return
    try {
      await deleteConversation(conversationId)
      setConversations(current => current.filter(item => item.id !== conversationId))
      if (activeConvId === conversationId) handleNewConversation()
    } catch {
      setError('删除会话失败，请稍后重试。')
    }
  }

  const handleRenameConversation = async (conversation: Conversation) => {
    const title = window.prompt('新会话名称', conversation.title || '新对话')?.trim()
    if (!title || title === conversation.title) return
    try {
      await renameConversation(conversation.id, title)
      setConversations(current =>
        current.map(item => (item.id === conversation.id ? { ...item, title } : item))
      )
    } catch {
      setError('重命名失败，请稍后重试。')
    }
  }

  const updateAssistant = (messageId: string, patch: Partial<Message>) => {
    setMessages(current =>
      current.map(message => (message.id === messageId ? { ...message, ...patch } : message))
    )
  }

  const appendAssistantText = (messageId: string, content: string) => {
    setMessages(current =>
      current.map(message =>
        message.id === messageId ? { ...message, content: message.content + content } : message
      )
    )
  }

  const handleSend = async (prompt?: string) => {
    const content = (prompt ?? input).trim()
    if (!content || sending) return
    const sequence = ++messageSequenceRef.current

    const userMessage: Message = {
      id: `user-${sequence}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    const assistantId = `assistant-${sequence}`
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }

    setInput('')
    setError('')
    setSending(true)
    setMessages(current => [...current, userMessage, assistantMessage])

    try {
      const response = await aiChatStream({
        message: content,
        conversation_id: activeConvId || undefined,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('响应流不可用')
      readerRef.current = reader

      const decoder = new TextDecoder()
      let buffer = ''
      let conversationId = activeConvId

      const processEvent = (block: string) => {
        const lines = block.split(/\r?\n/)
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message'
        const rawData = lines
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n')
        if (!rawData) return
        const data = JSON.parse(rawData) as JsonRecord

        if (event === 'conversation') {
          const newId = Number(data.conversation_id)
          if (Number.isFinite(newId) && !conversationId) {
            conversationId = newId
            setActiveConvId(newId)
          }
        } else if (event === 'delta' && typeof data.content === 'string') {
          appendAssistantText(assistantId, data.content)
        } else if (event === 'table') {
          updateAssistant(assistantId, {
            data_table:
              data.data_table && typeof data.data_table === 'object'
                ? (data.data_table as JsonRecord)
                : data,
          })
        } else if (event === 'chart') {
          updateAssistant(assistantId, {
            chart_config:
              data.chart_config && typeof data.chart_config === 'object'
                ? (data.chart_config as JsonRecord)
                : data,
          })
        } else if (event === 'done') {
          updateAssistant(assistantId, {
            token_input: Number(data.token_input) || undefined,
            token_output: Number(data.token_output) || undefined,
            latency_ms: Number(data.latency_ms) || undefined,
          })
        } else if (event === 'error') {
          throw new Error(typeof data.message === 'string' ? data.message : 'AI 分析失败')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() || ''
        blocks.forEach(processEvent)
      }
      if (buffer.trim()) processEvent(buffer)
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : '发送失败'
      appendAssistantText(assistantId, `\n\n[${message}]`)
    } finally {
      readerRef.current = null
      setSending(false)
      await loadConversations()
    }
  }

  const handleStop = async () => {
    await readerRef.current?.cancel()
    readerRef.current = null
    setSending(false)
  }

  return (
    <div className="page-wrap" style={{ flexDirection: 'row', gap: 0, padding: 0, overflow: 'hidden' }}>
      <aside
        className="tree-card"
        style={{ width: 260, margin: 20, marginRight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8EDF5' }}>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleNewConversation}>
            <span className="material-symbols-outlined">add</span>
            新建对话
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length ? conversations.map(conversation => (
            <div
              key={conversation.id}
              className={`conv-item ${activeConvId === conversation.id ? 'active' : ''}`}
              onClick={() => selectConversation(conversation.id)}
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') selectConversation(conversation.id)
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--dark-qing)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conversation.title || '新对话'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 4 }}>
                    {formatTime(conversation.last_message_at || conversation.created_at)}
                  </div>
                </div>
                <button
                  title="重命名"
                  aria-label={`重命名 ${conversation.title}`}
                  onClick={event => {
                    event.stopPropagation()
                    void handleRenameConversation(conversation)
                  }}
                  style={{ cursor: 'pointer', color: 'var(--text-gray)', padding: 3 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                </button>
                <button
                  title="删除"
                  aria-label={`删除 ${conversation.title}`}
                  onClick={event => {
                    event.stopPropagation()
                    void handleDeleteConversation(conversation.id)
                  }}
                  style={{ cursor: 'pointer', color: 'var(--text-gray)', padding: 3 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          )) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-gray)' }}>暂无历史会话</div>
          )}
        </div>
      </aside>

      <section style={{ minWidth: 0, flex: 1, margin: '20px 20px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-gray)' }}>正在加载消息…</div>
          ) : messages.length === 0 ? (
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div className="ai-avatar" style={{ width: 64, height: 64, marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>psychology</span>
              </div>
              <h2 className="font-brand" style={{ fontSize: 22, marginBottom: 8 }}>AI 智能测试分析</h2>
              <p style={{ maxWidth: 480, color: 'var(--text-gray)', lineHeight: 1.7 }}>
                用自然语言查询测试数据、分析执行趋势与项目健康度。
              </p>
            </div>
          ) : messages.map(message => (
            <div
              key={message.id}
              style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', gap: 10, marginBottom: 24 }}
            >
              {message.role === 'assistant' && (
                <div className="ai-avatar"><span className="material-symbols-outlined" style={{ fontSize: 17 }}>psychology</span></div>
              )}
              <div style={{ maxWidth: '82%', minWidth: 0 }}>
                <div
                  style={{
                    padding: '11px 15px',
                    borderRadius: 12,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                    ...(message.role === 'user'
                      ? { color: '#FFF', background: 'linear-gradient(135deg, #2A76C9, #3D88E0)', borderBottomRightRadius: 3 }
                      : { color: 'var(--dark-qing)' }),
                  }}
                >
                  {message.content || (sending && message.role === 'assistant' ? (
                    <span style={{ display: 'flex', gap: 6, padding: '5px 0' }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : '')}
                </div>
                {message.role === 'assistant' && <ChartView config={message.chart_config} />}
                {message.role === 'assistant' && <TableView table={message.data_table} />}
                {message.role === 'assistant' && (message.token_input || message.token_output || message.latency_ms) ? (
                  <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-gray)', display: 'flex', gap: 12 }}>
                    {message.token_input ? <span>输入 {message.token_input} tokens</span> : null}
                    {message.token_output ? <span>输出 {message.token_output} tokens</span> : null}
                    {message.latency_ms ? <span>耗时 {message.latency_ms}ms</span> : null}
                  </div>
                ) : null}
              </div>
              {message.role === 'user' && (
                <div className="ai-avatar" style={{ background: 'var(--dark-qing)', color: '#FFF' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.real_name?.[0] || '我'}</span>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: 20, borderTop: '1px solid #E8EDF5', background: '#FFF' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => void handleSend(prompt)}
                disabled={sending}
                style={{ padding: '6px 12px', border: '1px solid #E8EDF5', borderRadius: 8, color: 'var(--dark-qing)', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}
              >
                {prompt}
              </button>
            ))}
          </div>
          {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: '1px solid var(--light-qing)', borderRadius: 24, padding: '6px 6px 6px 16px' }}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
              disabled={sending}
              rows={1}
              placeholder="输入你的问题…"
              aria-label="对话内容"
              style={{ flex: 1, minHeight: 36, maxHeight: 120, resize: 'vertical', border: 0, outline: 0, font: 'inherit', padding: '8px 0', color: 'var(--dark-qing)' }}
            />
            <button
              disabled
              title="后端暂不支持附件上传"
              aria-label="附件上传暂不可用"
              style={{ padding: 8, color: 'var(--text-gray)', cursor: 'not-allowed', opacity: 0.5 }}
            >
              <span className="material-symbols-outlined">attachment</span>
            </button>
            {sending ? (
              <button
                onClick={() => void handleStop()}
                title="停止生成"
                aria-label="停止生成"
                style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#FFF', background: 'var(--danger)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">stop</span>
              </button>
            ) : (
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                title="发送"
                aria-label="发送消息"
                style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#FFF', background: 'linear-gradient(135deg, #2A76C9, #3D88E0)', cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.45 }}
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            )}
          </div>
          <div style={{ marginTop: 7, paddingLeft: 8, fontSize: 11, color: 'var(--text-gray)' }}>
            Enter 发送，Shift + Enter 换行
          </div>
        </div>
      </section>
    </div>
  )
}
