// app/server/[id]/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/appStore'
import { ArrowLeft, Terminal, Plus, RefreshCw, XCircle } from 'lucide-react'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Socket } from 'socket.io-client'

interface TmuxSession {
  name: string
  windows: number
  status: 'active' | 'inactive'
}

export default function ServerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const serverId = params.id as string
  const { getServer } = useAppStore()
  
  // ===== 添加 socketRef =====
  const socketRef = useRef<Socket | null>(null)
  
  const [isMounted, setIsMounted] = useState(false)
  const [server, setServer] = useState<any>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  // 加载会话列表
  const loadSessions = async () => {
    if (!server) return
    setIsLoading(true)
    setIsConnected(false)

    try {
      const socket = getSocket()
      socketRef.current = socket
      
      const token = localStorage.getItem('agentboss_token')
      
      if (!token) {
        router.push('/auth')
        return
      }

      // ===== 关键改动：等待 auth 成功后再发 list-sessions =====
      let isResolved = false

      // 监听 auth 响应
      const handleAuthResponse = (data: any) => {
        if (data.success) {
          console.log('✅ 认证成功，发送 list-sessions')
          // 认证成功后发送 list-sessions
          socket.emit('list-sessions', {
            serverId,
            token,
            serverConfig: {
              host: server.host,
              port: server.port,
              username: server.username,
              password: server.password,
            }
          })
        } else {
          console.error('❌ 认证失败:', data.message)
          setIsLoading(false)
          setIsConnected(false)
          socket.off('auth-response', handleAuthResponse)
        }
      }

      // 监听会话列表
      const handleSessionList = (data: any) => {
        if (data.serverId === serverId) {
          setSessions(data.sessions || [])
          setIsConnected(true)
          setIsLoading(false)
          socket.off('auth-response', handleAuthResponse)
        }
      }
      
      const handleError = (data: any) => {
        if (data.serverId === serverId || !data.serverId) {
          console.error('获取会话失败:', data.message)
          setIsConnected(false)
          setIsLoading(false)
          socket.off('auth-response', handleAuthResponse)
        }
      }

      const handleConnectError = (err: any) => {
        console.error('WebSocket 连接错误:', err.message)
        setIsLoading(false)
        setIsConnected(false)
        socket.off('auth-response', handleAuthResponse)
      }

      // 注册事件监听
      socket.on('auth-response', handleAuthResponse)
      socket.on('session-list', handleSessionList)
      socket.on('error', handleError)
      socket.on('connect_error', handleConnectError)

      // 发送 auth 事件
      socket.emit('auth', { token })

      // 超时处理（10秒）
      setTimeout(() => {
        if (!isResolved) {
          console.warn('⏰ 认证超时')
          setIsLoading(false)
          setIsConnected(false)
          socket.off('auth-response', handleAuthResponse)
          socket.off('session-list', handleSessionList)
          socket.off('error', handleError)
          socket.off('connect_error', handleConnectError)
        }
      }, 10000)

      // 清理函数
      return () => {
        socket.off('auth-response', handleAuthResponse)
        socket.off('session-list', handleSessionList)
        socket.off('error', handleError)
        socket.off('connect_error', handleConnectError)
      }
      
    } catch (error) {
      console.error('连接失败:', error)
      setIsLoading(false)
      setIsConnected(false)
    }
  }

  // 客户端挂载
  useEffect(() => {
    setIsMounted(true)
    return () => {
      // 注意：不要 disconnect() 单例 socket，否则其他页面也会断连
      socketRef.current = null
    }
  }, [])

  // 加载服务器数据
  useEffect(() => {
    if (!isMounted) return
    
    const s = getServer(serverId)
    if (s) {
      setServer(s)
      loadSessions()
    } else {
      router.push('/')
    }
  }, [isMounted, serverId])

  // 未挂载时返回空
  if (!isMounted) {
    return null
  }

  // 服务器不存在
  if (!server) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">服务器不存在</p>
          <button 
            onClick={() => router.push('/')} 
            className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  // 渲染主要内容
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button
          onClick={() => router.push('/')}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{server.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {server.username}@{server.host}:{server.port}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
            isConnected 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {isConnected ? '● 已连接' : '○ 未连接'}
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">总会话</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">
            {sessions.filter(s => s.status === 'active').length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">运行中</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-600">
            {sessions.reduce((acc, s) => acc + (s.windows || 0), 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">窗口数</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={loadSessions}
          disabled={isLoading}
          className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
        <button
          onClick={() => alert('创建新 tmux 会话功能开发中...')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建会话
        </button>
      </div>

      {/* 会话列表 */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-500 dark:text-gray-400">加载会话列表中...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Terminal className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">没有 tmux 会话</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">点击上方「新建会话」创建</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.name}
              onClick={() => router.push(`/session/${serverId}?name=${session.name}`)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {session.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      session.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {session.status === 'active' ? '● 运行中' : '○ 已停止'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {session.windows} 个窗口
                  </p>
                </div>
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}