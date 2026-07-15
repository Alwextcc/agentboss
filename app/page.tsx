'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/appStore'
import { Plus, Server, Trash2, Edit, Wifi, WifiOff, ChevronRight } from 'lucide-react'
import PWARegister from '@/app/components/PWARegister'
import PWAInstallPrompt from '@/app/components/PWAInstallPrompt'

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)  // 初始为 true
  
  useEffect(() => {
    try {
      const token = localStorage.getItem('agentboss_token')
      console.log('🔍 检查认证 token:', token ? '存在' : '不存在')
      
      if (!token) {
        console.log('🚀 没有 token，跳转到 /auth')
        router.push('/auth')
      } else {
        console.log('✅ 有 token，设置认证状态')
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('认证检查失败:', error)
      router.push('/auth')
    } finally {
      // 确保 loading 状态一定会被关闭
      console.log('🔄 关闭 loading 状态')
      setIsLoading(false)
    }
  }, [router])

  // 只有认证通过后才使用 store
  const { servers, loadServers, deleteServer, selectServer, selectedServerId } = useAppStore()
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      console.log('📡 加载服务器列表')
      loadServers()
    }
  }, [isAuthenticated, loadServers])

  // 加载中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  // 未认证（等待跳转）
  if (!isAuthenticated) {
    return null
  }

  // ==================== 主界面 ====================
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20">
      <PWARegister />
      <PWAInstallPrompt />
      
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AgentBoss</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            你的 AI Agent 移动驾驶舱
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{servers.length} 台服务器</span>
        </div>
      </div>

      {/* 服务器列表 */}
      <div className="space-y-3">
        {servers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">还没有添加服务器</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">点击下方按钮添加第一台服务器</p>
          </div>
        ) : (
          servers.map((server) => (
            <div
              key={server.id}
              onClick={() => {
                selectServer(server.id)
                router.push(`/server/${server.id}`)
              }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {server.name}
                    </h3>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      在线
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {server.username}@{server.host}:{server.port}
                  </p>
                  {server.tags && server.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {server.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`确定要删除服务器「${server.name}」吗？`)) {
                        deleteServer(server.id)
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加服务器按钮 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          添加服务器
        </button>
      </div>

      {/* 添加服务器表单 */}
      {showAddForm && (
        <AddServerForm onClose={() => setShowAddForm(false)} />
      )}
    </main>
  )
}

// ==================== 添加服务器表单 ====================
function AddServerForm({ onClose }: { onClose: () => void }) {
  const { addServer } = useAppStore()
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    password: '',
    tags: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const tags = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      addServer({
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password || undefined,
        tags: tags.length > 0 ? tags : undefined,
      })
      onClose()
    } catch (error) {
      console.error('添加服务器失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">添加服务器</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              服务器名称 *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：开发服务器"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              IP 地址或域名 *
            </label>
            <input
              type="text"
              required
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              placeholder="例如：192.168.1.100"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                端口
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              密码
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="SSH 密码（可选）"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              标签
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="用逗号分隔，例如：生产,AI"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '添加中...' : '添加服务器'}
          </button>
        </form>
      </div>
    </div>
  )
}