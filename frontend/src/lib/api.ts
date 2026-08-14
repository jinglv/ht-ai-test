/**
 * API 请求客户端
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9529/api/v1'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('hetu_token')
}

function saveToken(token: string) {
  localStorage.setItem('hetu_token', token)
}

function clearToken() {
  localStorage.removeItem('hetu_token')
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`)
    ;(error as any).status = res.status
    throw error
  }

  return res.json()
}

// =================================== Auth ===================================

export function getCaptcha() {
  return request<{ captcha_id: string; image: string; expires_in: number }>(
    '/auth/captcha'
  )
}

export function login(
  username: string,
  password: string,
  captchaId: string,
  captchaCode: string,
  remember = false
) {
  return request<{ token: string; token_type: string; expires_in: number; user: any }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode,
        remember,
      }),
    }
  )
}

export function logout() {
  clearToken()
  return Promise.resolve()
}

export function getCurrentUser() {
  return request<any>('/auth/me')
}

// =================================== Projects ===================================

export function listProjects(params?: { page?: number; page_size?: number; keyword?: string }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  if (params?.keyword) qs.set('keyword', params.keyword)
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<{ items: any[]; total: number; page: number; page_size: number }>(
    `/projects${suffix}`
  )
}

export function createProject(data: { code: string; name: string; description?: string; start_date?: string; end_date?: string; owner_id?: number }) {
  return request<any>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateProject(id: number, data: Record<string, any>) {
  return request<any>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteProject(id: number) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' })
}

// =================================== Test Cases ===================================

export function listTestcases(params?: { page?: number; page_size?: number; project_id?: number; module_id?: number; status?: string; keyword?: string; priority?: string; case_type?: string; is_ai_generated?: boolean; creator_id?: number; ordering?: string }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  if (params?.project_id) qs.set('project_id', String(params.project_id))
  if (params?.module_id) qs.set('module_id', String(params.module_id))
  if (params?.keyword) qs.set('keyword', params.keyword)
  if (params?.priority) qs.set('priority', params.priority)
  if (params?.case_type) qs.set('case_type', params.case_type)
  if (params?.is_ai_generated !== undefined) qs.set('is_ai_generated', String(params.is_ai_generated))
  if (params?.creator_id) qs.set('creator_id', String(params.creator_id))
  if (params?.ordering) qs.set('ordering', params.ordering)
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<{ items: any[]; total: number }>(`/testcases${suffix}`)
}

export function createTestcase(data: Record<string, any>) {
  return request<any>('/testcases', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTestcase(id: number, data: Record<string, any>) {
  return request<any>(`/testcases/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTestcases(ids: number[]) {
  return request<any>('/testcases/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) })
}

// =================================== AI ===================================

export function listConversations(params?: { page?: number; page_size?: number; keyword?: string }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  if (params?.keyword) qs.set('keyword', params.keyword)
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<{ items: any[]; total: number }>(`/ai/conversations${suffix}`)
}

export function getConversationMessages(conversationId: number, params?: { limit?: number; before_id?: number }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.before_id) qs.set('before_id', String(params.before_id))
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<any[]>(`/ai/conversations/${conversationId}/messages${suffix}`)
}

export function createConversation(title?: string) {
  return request<any>('/ai/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function renameConversation(conversationId: number, title: string) {
  return request<any>(`/ai/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function deleteConversation(conversationId: number) {
  return request<void>(`/ai/conversations/${conversationId}`, { method: 'DELETE' })
}

export function aiChatStream(body: { message: string; conversation_id?: number; project_id?: number }) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

// =================================== Users ===================================

export function listUsers(params?: { page?: number; page_size?: number; keyword?: string }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  if (params?.keyword) qs.set('keyword', params.keyword)
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<{ items: any[]; total: number }>(`/users${suffix}`)
}

export function createUser(data: {
  username: string
  password: string
  real_name: string
  email?: string
  phone?: string
  is_active?: boolean
  is_super?: boolean
  role_ids?: number[]
}) {
  return request<any>('/users', { method: 'POST', body: JSON.stringify(data) })
}

export function updateUser(id: number, data: Record<string, any>) {
  return request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteUser(id: number) {
  return request<void>(`/users/${id}`, { method: 'DELETE' })
}

export function updateUserStatus(id: number, is_active: boolean) {
  return request<any>(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active }) })
}

export function updateUserRoles(id: number, role_ids: number[]) {
  return request<any>(`/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ role_ids }) })
}

// =================================== Roles ===================================

export function listRoles(params?: { page?: number; page_size?: number }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const suffix = qs.toString() ? `?${qs}` : ''
  return request<{ items: any[]; total: number }>(`/roles${suffix}`)
}

export function createRole(data: { name: string; code: string; description?: string; data_scope?: string; permission_ids?: number[] }) {
  return request<any>('/roles', { method: 'POST', body: JSON.stringify(data) })
}

export function updateRole(id: number, data: Record<string, any>) {
  return request<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteRole(id: number) {
  return request<void>(`/roles/${id}`, { method: 'DELETE' })
}

// =================================== Permissions ===================================

export function listPermissions() {
  return request<any[]>('/permissions')
}

export function getPermissionTree() {
  return request<any[]>('/permissions/tree')
}

// =================================== Modules ===================================

export function listModules(projectId: number) {
  return request<any[]>(`/projects/${projectId}/modules`)
}

// =================================== Members ===================================

export function listMembers(projectId: number) {
  return request<any[]>(`/projects/${projectId}/members`)
}

export function addMember(projectId: number, data: { user_id: number; project_role: string }) {
  return request<any>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) })
}

export function removeMember(projectId: number, memberId: number) {
  return request<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })
}
