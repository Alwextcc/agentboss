// lib/socket.ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  // 获取当前页面的 host（手机访问时是电脑的 IP）
  const host = window.location.hostname
  const wsUrl = `http://${host}:3001`

  if (!socket) {
    console.log('🔌 创建 WebSocket 连接:', wsUrl)
    socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('✅ WebSocket 已连接')
    })

    socket.on('disconnect', (reason) => {
      console.log(`⚠️ WebSocket 已断开: ${reason}`)
    })

    socket.on('connect_error', (err) => {
      console.error('❌ WebSocket 连接错误:', err.message)
    })
  }

  // 如果 socket 已断开，尝试重新连接
  if (!socket.connected) {
    console.log('🔄 WebSocket 重新连接...')
    socket.connect()
  }

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}