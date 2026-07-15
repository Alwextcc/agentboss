// stores/appStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ServerConfig, getServers, saveServers, addServer, deleteServer, updateServer, getPreferences, savePreferences, Preferences } from '@/lib/storage'

interface AppState {
  // 服务器
  servers: ServerConfig[]
  selectedServerId: string | null
  
  // 偏好
  preferences: Preferences
  
  // 加载状态
  isLoading: boolean
  
  // Actions
  loadServers: () => void
  getServer: (id: string) => ServerConfig | null  // ← 添加这行
  addServer: (server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  deleteServer: (id: string) => void
  updateServer: (id: string, updates: Partial<ServerConfig>) => void
  selectServer: (id: string | null) => void
  
  // 偏好
  updatePreferences: (prefs: Partial<Preferences>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      servers: [],
      selectedServerId: null,
      preferences: { theme: 'dark', terminalFontSize: 14, autoScroll: true },
      isLoading: false,

      // Actions
      loadServers: () => {
        set({ servers: getServers(), isLoading: false })
      },

      // ← 添加这个方法
      getServer: (id: string) => {
        const state = get()
        return state.servers.find(s => s.id === id) || null
      },

      addServer: (server) => {
        const newServer = addServer(server)
        set((state) => ({
          servers: [...state.servers, newServer]
        }))
      },

      deleteServer: (id) => {
        const success = deleteServer(id)
        if (success) {
          set((state) => ({
            servers: state.servers.filter(s => s.id !== id),
            selectedServerId: state.selectedServerId === id ? null : state.selectedServerId
          }))
        }
      },

      updateServer: (id, updates) => {
        const updated = updateServer(id, updates)
        if (updated) {
          set((state) => ({
            servers: state.servers.map(s => s.id === id ? updated : s)
          }))
        }
      },

      selectServer: (id) => {
        set({ selectedServerId: id })
      },

      updatePreferences: (prefs) => {
        savePreferences(prefs)
        set((state) => ({
          preferences: { ...state.preferences, ...prefs }
        }))
      },
    }),
    {
      name: 'agentboss-store',
    }
  )
)