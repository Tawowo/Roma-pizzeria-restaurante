export type AdminRole = 'monica' | 'andre' | 'roberto'
export interface AdminSession { role: AdminRole; nom: string; id: string }

export function getSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  const s = sessionStorage.getItem('roma_admin')
  return s ? JSON.parse(s) : null
}
export function setSession(s: AdminSession) {
  sessionStorage.setItem('roma_admin', JSON.stringify(s))
}
export function clearSession() {
  sessionStorage.removeItem('roma_admin')
}
