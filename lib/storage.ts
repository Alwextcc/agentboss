// lib/storage.ts
import { v4 as uuidv4 } from 'uuid'

export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface Preferences {
  theme: 'light' | 'dark'
  terminalFontSize: number
  autoScroll: boolean
}

const STORAGE_KEYS = {
  SERVERS: 'agentboss_servers',
  PREFERENCES: 'agentboss_preferences',
}

// 服务器管理
export function getServers(): ServerConfig[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEYS.SERVERS)
  return data ? JSON.parse(data) : []
}

export function saveServers(servers: ServerConfig[]): void {
  localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers))
}

export function addServer(server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): ServerConfig {
  const servers = getServers()
  const newServer: ServerConfig = {
    ...server,
    id: uuidv4(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  servers.push(newServer)
  saveServers(servers)
  return newServer
}

export function updateServer(id: string, updates: Partial<ServerConfig>): ServerConfig | null {
  const servers = getServers()
  const index = servers.findIndex(s => s.id === id)
  if (index === -1) return null
  servers[index] = { ...servers[index], ...updates, updatedAt: Date.now() }
  saveServers(servers)
  return servers[index]
}

export function deleteServer(id: string): boolean {
  const servers = getServers()
  const filtered = servers.filter(s => s.id !== id)
  if (filtered.length === servers.length) return false
  saveServers(filtered)
  return true
}

export function getServer(id: string): ServerConfig | null {
  const servers = getServers()
  return servers.find(s => s.id === id) || null
}

// 偏好设置
export function getPreferences(): Preferences {
  if (typeof window === 'undefined') {
    return { theme: 'dark', terminalFontSize: 14, autoScroll: true }
  }
  const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
  const defaults: Preferences = {
    theme: 'dark',
    terminalFontSize: 14,
    autoScroll: true,
  }
  return data ? { ...defaults, ...JSON.parse(data) } : defaults
}

export function savePreferences(prefs: Partial<Preferences>): void {
  const current = getPreferences()
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ ...current, ...prefs }))
}