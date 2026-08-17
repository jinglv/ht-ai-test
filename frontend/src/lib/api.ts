/**
 * API 请求客户端
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9529/api/v1'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface CurrentUser {
  id: number
  username: string
  real_name: string
  email?: string | null
  phone?: string | null
  avatar?: string | null
  is_super: boolean
  roles: { id: number; code: string; name: string }[]
  permissions: string[]
}

export interface ProjectModule {
  id: number
  project_id: number
  parent_id?: number | null
  name: string
  sort: number
  testcase_count: number
  children: ProjectModule[]
}

export interface Project {
  id: number
  code: string
  name: string
  owner_id: number
  owner_name?: string
  status: string
  start_date?: string
  end_date?: string
  description?: string
  member_count?: number
  testcase_count?: number
  created_at?: string
}

export interface User {
  id: number
  username: string
  real_name: string
  email?: string | null
  phone?: string | null
  avatar?: string | null
  is_active: boolean
  is_super?: boolean
  roles?: { id: number; code: string; name: string }[]
  created_at?: string | null
}

export interface Role {
  id: number
  name: string
  code: string
  description?: string | null
  data_scope: string
  is_builtin: boolean
  permissions?: Permission[]
  user_count?: number
  created_at?: string | null
}

export interface Permission {
  id: number
  name: string
  code: string
  type: 'menu' | 'action' | 'data'
  parent_id?: number | null
  path?: string | null
  icon?: string | null
  sort?: number
  children?: Permission[]
}

export interface Testcase {
  id: number
  code: string
  project_id: number
  module_id?: number | null
  module_name?: string
  title: string
  priority: string
  status: string
  case_type: string
  is_ai_generated: boolean
  creator_name?: string
  precondition?: string
  steps?: Record<string, unknown>[]
  expected_result?: string
}

export interface TestSuite {
  id: number
  project_id: number
  project_name?: string
  name: string
  description?: string
  case_count?: number
  cases?: Testcase[]
  created_at?: string
}

export interface TestExecution {
  id: number
  testcase_id: number
  testcase_code?: string
  testcase_title?: string
  project_name?: string
  result: string
  remark?: string
  defect_link?: string
  executed_by_name?: string
  executed_at?: string
}

export interface ProjectMember {
  id: number
  project_id: number
  user_id: number
  username: string
  real_name: string
  avatar?: string | null
  project_role: string
  created_at?: string | null
}

export interface RequirementDocument {
  id: number
  project_id: number
  title: string
  file_type: string
  file_url?: string | null
  file_size?: number | null
  content?: string | null
  content_preview?: string | null
  uploaded_by_id: number
  created_at?: string | null
}

export interface AIGenerateTask {
  task_id: number
  status: string
  generated_count?: number
  saved_count?: number
  result_preview?: { title: string; priority: string }[]
  error_message?: string | null
}

export interface AIConversation {
  id: number
  title: string
  last_message_at: string
  created_at: string
}

export interface AIMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  chart_config?: unknown
  data_table?: unknown
  skill_used?: string
  token_input?: number
  token_output?: number
  latency_ms?: number
  created_at: string
}

type QueryValue = string | number | boolean | null | undefined

function withQuery(endpoint: string, params?: object) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]: [string, QueryValue]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  return query.size ? `${endpoint}?${query}` : endpoint
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('hetu_token')
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
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
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
  return request<{ token: string; token_type: string; expires_in: number; user: CurrentUser }>(
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
  return request<CurrentUser>('/auth/me')
}

export function updateProfile(data: {
  real_name?: string
  email?: string
  phone?: string
  avatar?: string
}) {
  return request<CurrentUser>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function changePassword(old_password: string, new_password: string) {
  return request<void>('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ old_password, new_password }),
  })
}

// =================================== Projects ===================================

export function listProjects(params?: { page?: number; page_size?: number; keyword?: string; status?: string }) {
  return request<Paginated<Project>>(withQuery('/projects', params))
}

export function createProject(data: { code: string; name: string; description?: string; start_date?: string; end_date?: string; owner_id?: number }) {
  return request<{ id: number; code: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getProject(id: number) {
  return request<Project>(`/projects/${id}`)
}

export function getProjectOverview(id: number) {
  return request<Record<string, unknown>>(`/projects/${id}/overview`)
}

export function updateProject(id: number, data: Record<string, unknown>) {
  return request<{ id: number }>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteProject(id: number) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' })
}

export function archiveProject(id: number) {
  return request<{ id: number; status: string }>(`/projects/${id}/archive`, { method: 'PATCH' })
}

// =================================== Test Cases ===================================

export function listTestcases(params?: { page?: number; page_size?: number; project_id?: number; module_id?: number; status?: string; keyword?: string; priority?: string; case_type?: string; is_ai_generated?: boolean; creator_id?: number; ordering?: string }) {
  return request<Paginated<Testcase>>(withQuery('/testcases', params))
}

export function createTestcase(data: Record<string, unknown>) {
  return request<{ id: number; code: string }>('/testcases', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTestcase(id: number, data: Record<string, unknown>) {
  return request<{ id: number }>(`/testcases/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTestcases(ids: number[]) {
  return request<{ deleted: number }>('/testcases/batch?action=delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

// =================================== AI ===================================

export function listConversations(params?: { page?: number; page_size?: number; keyword?: string }) {
  return request<Paginated<AIConversation>>(withQuery('/ai/conversations', params))
}

export function getConversationMessages(conversationId: number, params?: { limit?: number; before_id?: number }) {
  return request<AIMessage[]>(
    withQuery(`/ai/conversations/${conversationId}/messages`, params)
  )
}

export function renameConversation(conversationId: number, title: string) {
  return request<{ id: number; title: string }>(`/ai/conversations/${conversationId}`, {
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
  return request<Paginated<User>>(withQuery('/users', params))
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
  return request<{ id: number; username: string }>('/users', { method: 'POST', body: JSON.stringify(data) })
}

export function updateUser(id: number, data: Record<string, unknown>) {
  return request<{ id: number }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteUser(id: number) {
  return request<void>(`/users/${id}`, { method: 'DELETE' })
}

export function updateUserStatus(id: number, is_active: boolean) {
  return request<{ id: number; is_active: boolean }>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  })
}

export function updateUserRoles(id: number, role_ids: number[]) {
  return request<{ id: number }>(`/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ role_ids }) })
}

export function resetUserPassword(id: number, new_password: string) {
  return request<void>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password }),
  })
}

// =================================== Roles ===================================

export function listRoles(params?: { page?: number; page_size?: number; keyword?: string }) {
  return request<Paginated<Role>>(withQuery('/roles', params))
}

export function createRole(data: { name: string; code: string; description?: string; data_scope?: string; permission_ids?: number[] }) {
  return request<{ id: number }>('/roles', { method: 'POST', body: JSON.stringify(data) })
}

export function updateRole(id: number, data: Record<string, unknown>) {
  return request<{ id: number }>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function getRole(id: number) {
  return request<Role>(`/roles/${id}`)
}

export function deleteRole(id: number) {
  return request<void>(`/roles/${id}`, { method: 'DELETE' })
}

export function updateRolePermissions(id: number, permission_ids: number[]) {
  return request<{ id: number }>(`/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permission_ids }),
  })
}

// =================================== Permissions ===================================

export function listPermissions(params?: {
  page?: number
  page_size?: number
  type?: 'menu' | 'action' | 'data'
  keyword?: string
}) {
  return request<Paginated<Permission>>(withQuery('/permissions', params))
}

export function getPermissionTree() {
  return request<Permission[]>('/permissions/tree')
}

// =================================== Modules ===================================

export function listModules(projectId: number) {
  return request<ProjectModule[]>(`/projects/${projectId}/modules`)
}

export function createModule(projectId: number, data: { name: string; parent_id?: number | null }) {
  return request<{ id: number }>(`/projects/${projectId}/modules`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateModule(
  projectId: number,
  moduleId: number,
  data: { name?: string; parent_id?: number | null }
) {
  return request<{ id: number }>(`/projects/${projectId}/modules/${moduleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteModule(projectId: number, moduleId: number) {
  return request<void>(`/projects/${projectId}/modules/${moduleId}`, { method: 'DELETE' })
}

// =================================== Members ===================================

export function listMembers(projectId: number) {
  return request<ProjectMember[]>(`/projects/${projectId}/members`)
}

export function addMember(projectId: number, data: { user_id: number; project_role: string }) {
  return request<{ id: number }>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMember(projectId: number, memberId: number, data: { project_role: string }) {
  return request<{ id: number }>(`/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function removeMember(projectId: number, memberId: number) {
  return request<void>(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })
}

// =================================== Test Suites ===================================

export function listSuites(params?: { project_id?: number; page?: number; page_size?: number }) {
  return request<Paginated<TestSuite>>(withQuery('/testsuites', params))
}

export function getSuite(id: number) {
  return request<TestSuite>(`/testsuites/${id}`)
}

export function createSuite(data: { project_id: number; name: string; description?: string }) {
  return request<{ id: number }>('/testsuites', { method: 'POST', body: JSON.stringify(data) })
}

export function updateSuite(id: number, data: { name?: string; description?: string }) {
  return request<{ id: number }>(`/testsuites/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteSuite(id: number) {
  return request<void>(`/testsuites/${id}`, { method: 'DELETE' })
}

export function addSuiteCases(id: number, testcase_ids: number[]) {
  return request<{ added: number }>(`/testsuites/${id}/cases`, {
    method: 'POST',
    body: JSON.stringify({ testcase_ids }),
  })
}

export function removeSuiteCase(id: number, testcaseId: number) {
  return request<void>(`/testsuites/${id}/cases/${testcaseId}`, { method: 'DELETE' })
}

export function sortSuiteCases(id: number, items: { testcase_id: number; sort: number }[]) {
  return request<void>(`/testsuites/${id}/cases/sort`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
}

// =================================== Requirements ===================================

export function listRequirements(params?: {
  project_id?: number
  keyword?: string
  file_type?: string
  page?: number
  page_size?: number
}) {
  return request<Paginated<RequirementDocument>>(withQuery('/requirements', params))
}

export function getRequirement(id: number) {
  return request<RequirementDocument>(`/requirements/${id}`)
}

export function uploadRequirement(data: {
  project_id: number
  title: string
  file_type: string
  content?: string
  file_url?: string
  file_size?: number
}) {
  return request<{ id: number }>('/requirements/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteRequirement(id: number) {
  return request<void>(`/requirements/${id}`, { method: 'DELETE' })
}

// =================================== Executions ===================================

export function listExecutions(params?: {
  project_id?: number
  testcase_id?: number
  suite_id?: number
  result?: string
  page?: number
  page_size?: number
}) {
  return request<Paginated<TestExecution>>(withQuery('/test-executions', params))
}

export function getExecutionStats(params?: {
  project_id?: number
  group_by?: 'result' | 'date' | 'module' | 'executor'
}) {
  return request<Record<string, unknown>>(withQuery('/test-executions/stats', params))
}

// =================================== AI Case Generation ===================================

export function generateTestcases(data: {
  project_id: number
  module_id?: number
  source_doc_id?: number
  prompt: string
}) {
  return request<AIGenerateTask>('/testcases/ai-generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getGenerateTask(taskId: number) {
  return request<AIGenerateTask>(`/testcases/ai-generate/${taskId}`)
}

export function saveGeneratedTestcases(taskId: number, case_ids: number[], status = 'draft') {
  return request<{ saved: number }>(`/testcases/ai-generate/${taskId}/save`, {
    method: 'POST',
    body: JSON.stringify({ case_ids, status }),
  })
}

export function cancelGenerateTask(taskId: number) {
  return request<void>(`/testcases/ai-generate/${taskId}/cancel`, { method: 'POST' })
}
