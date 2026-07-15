// app/session/[id]/SessionClient.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, Mic, Square, RotateCw, FileText, Activity } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { getSocket } from '@/lib/socket'

import 'xterm/css/xterm.css'

export default function SessionClient() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const serverId = params.id as string
  const sessionName = searchParams.get('name') || 'unknown'

  const { getServer } = useAppStore()
  const server = getServer(serverId)

  // ===== State =====
  const [isMounted, setIsMounted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [isInputEnabled, setIsInputEnabled] = useState(false)
  const [isTerminalReady, setIsTerminalReady] = useState(false)

  // ===== Refs =====
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const socketRef = useRef<any>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const termSizeRef = useRef({ cols: 120, rows: 40 })

  // ===== 虚拟按键配置 =====
  const virtualKeys = [
    { label: '▲', key: '\x1b[A' },
    { label: '▼', key: '\x1b[B' },
    { label: '⏎', key: '\r' },
    { label: '↹', key: '\t' },
    { label: '✕', key: '\x03' },
    { label: '␣', key: ' ' },
  ]

  // ===== 发送尺寸 =====
  const sendResize = useCallback(() => {
    if (!socketRef.current) return
    const { cols, rows } = termSizeRef.current
    socketRef.current.emit('terminal-resize', {
      serverId,
      sessionName,
      cols,
      rows,
    })
  }, [serverId, sessionName])

  // ===== 发送虚拟按键 =====
  const sendVirtualKey = useCallback((key: string) => {
    if (!isInputEnabled || !socketRef.current) return
    sendResize()
    socketRef.current.emit('terminal-input', {
      serverId,
      sessionName,
      input: key,
    })
  }, [isInputEnabled, serverId, sessionName, sendResize])

  // ===== 发送命令 =====
  const sendCommand = useCallback(() => {
    if (!inputValue.trim() || !isInputEnabled || !socketRef.current) return
    sendResize()
    socketRef.current.emit('terminal-input', {
      serverId,
      sessionName,
      input: inputValue.trim() + '\r',
    })
    setInputValue('')
  }, [inputValue, isInputEnabled, serverId, sessionName, sendResize])

  // ===== 发送 Ctrl+C =====
  const sendCtrlC = useCallback(() => {
    if (!isInputEnabled || !socketRef.current) return
    socketRef.current.emit('terminal-input', {
      serverId,
      sessionName,
      input: '\x03',
    })
  }, [isInputEnabled, serverId, sessionName])

  // ===== 快捷指令 =====
  const quickCommands = [
    { label: '⏹ 停止', icon: Square, action: sendCtrlC },
    { label: '🔄 重启', icon: RotateCw, action: () => alert('重启功能开发中...') },
    { label: '📋 日志', icon: FileText, action: () => alert('日志功能开发中...') },
    { label: '📊 状态', icon: Activity, action: () => alert('状态功能开发中...') },
  ]

  // ===== 物理键盘处理 =====
  const handleKey = useCallback((e: { key: string; domEvent: KeyboardEvent }) => {
    const { key, domEvent } = e
    if (!isInputEnabled || !socketRef.current || !xtermRef.current) return

    switch (domEvent.key) {
      case 'ArrowUp':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x1b[A' })
        break
      case 'ArrowDown':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x1b[B' })
        break
      case 'ArrowRight':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x1b[C' })
        break
      case 'ArrowLeft':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x1b[D' })
        break
      case 'Tab':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\t' })
        break
      case 'Enter':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\r' })
        break
      case 'Backspace':
        domEvent.preventDefault()
        socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x7f' })
        break
      default:
        if (domEvent.ctrlKey && domEvent.key === 'c') {
          socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x03' })
        } else if (domEvent.ctrlKey && domEvent.key === 'd') {
          socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x04' })
        } else if (domEvent.ctrlKey && domEvent.key === 'z') {
          socketRef.current.emit('terminal-input', { serverId, sessionName, input: '\x1a' })
        } else if (key && key.length === 1) {
          socketRef.current.emit('terminal-input', { serverId, sessionName, input: key })
        }
        break
    }
  }, [isInputEnabled, serverId, sessionName])

  // ============================================================
  // 1. 客户端挂载
  // ============================================================
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // ============================================================
  // 2. 初始化 xterm.js
  // ============================================================
  useEffect(() => {
    if (!isMounted) return
    if (!terminalContainerRef.current) return
    if (xtermRef.current) return

    const initTerminal = async () => {
      try {
        const { Terminal } = await import('xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')

        const container = terminalContainerRef.current
        if (!container) return

        const containerHeight = container.clientHeight || 600
        const fontSize = 14
        const lineHeight = 1.2
        const rowHeight = fontSize * lineHeight
        const rows = Math.floor(containerHeight / rowHeight) - 1
        const cols = 120

        const term = new Terminal({
          theme: {
            background: '#1a1a2e',
            foreground: '#e0e0e0',
            cursor: '#00ff88',
            selectionBackground: 'rgba(0, 100, 200, 0.2)',
            black: '#1a1a2e',
            red: '#ff6b6b',
            green: '#00ff88',
            yellow: '#ffd93d',
            blue: '#6bcbff',
            magenta: '#d986ff',
            cyan: '#00d4ff',
            white: '#e0e0e0',
          },
          fontSize,
          fontFamily: 'Consolas, "Courier New", monospace',
          cursorBlink: true,
          cursorStyle: 'underline',
          scrollback: 2000,
          allowProposedApi: true,
          convertEol: true,
          cols,
          rows,
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(webLinksAddon)

        term.open(container)

        setTimeout(() => {
          try {
            fitAddon.fit()
            term.resize(cols, term.rows)
            termSizeRef.current = { cols: term.cols, rows: term.rows }
            console.log(`📐 终端尺寸: ${term.cols}x${term.rows}`)
          } catch (e) {
            console.warn('fit 失败:', e)
          }
        }, 100)

        xtermRef.current = term
        fitAddonRef.current = fitAddon
        setIsTerminalReady(true)

        // 注册键盘监听
        term.onKey(handleKey)

        term.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════════════════╗\x1b[0m')
        term.writeln('\x1b[1;36m║   🤖 AgentBoss 终端已启动（宽屏模式）                          ║\x1b[0m')
        term.writeln('\x1b[1;36m╚════════════════════════════════════════════════════════════════════╝\x1b[0m')
        term.writeln('')
        term.writeln(`\x1b[33m📡 连接到: ${sessionName}\x1b[0m`)
        term.writeln('\x1b[33m⏳ 等待 WebSocket 连接...\x1b[0m')

        const handleResize = () => {
          if (!terminalContainerRef.current) return
          const newHeight = terminalContainerRef.current.clientHeight
          const newRows = Math.floor(newHeight / rowHeight) - 1
          if (newRows > 5) {
            try {
              term.resize(cols, newRows)
              termSizeRef.current = { cols: term.cols, rows: term.rows }
            } catch (e) {}
          }
        }

        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
          try { term.dispose() } catch (e) {}
          xtermRef.current = null
          fitAddonRef.current = null
          setIsTerminalReady(false)
        }
      } catch (error) {
        console.error('xterm 初始化失败:', error)
      }
    }

    initTerminal()
  }, [isMounted, sessionName, handleKey])
    // ============================================================
  // 3. 终端就绪后发送初始尺寸
  // ============================================================
  useEffect(() => {
    if (!isTerminalReady || !socketRef.current) return

    // 延迟一下确保一切就绪
    const timer = setTimeout(() => {
      sendResize()
      console.log('📐 初始尺寸已发送')
    }, 300)

    return () => clearTimeout(timer)
  }, [isTerminalReady, sendResize])

  // ============================================================
  // 4. 连接 WebSocket
  // ============================================================
  useEffect(() => {
    if (!server || !isTerminalReady || !xtermRef.current) return

    const socket = getSocket()
    socketRef.current = socket

    // 获取 token
    const token = localStorage.getItem('agentboss_token')

    // 发送认证
    socket.emit('auth', { token })

    // 请求进入会话（带上 token 供服务端二次校验）
    socket.emit('attach-session', {
      serverId,
      sessionName,
      token,
      serverConfig: {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
      },
    })

    let isCancelled = false

    // ---- 事件监听 ----
    const handleOutput = (data: any) => {
      if (data.sessionName !== sessionName) return
      if (!xtermRef.current) return

      try {
        if (data.isReady) {
          setIsConnected(true)
          setIsLoading(false)
          setIsInputEnabled(true)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          xtermRef.current.writeln('\r\n\x1b[32m✅ 已连接到终端\x1b[0m')
          // 连接成功后发送尺寸
          sendResize()
        } else if (data.output) {
          xtermRef.current.write(data.output)
        }
      } catch (e) {
        console.warn('写入终端失败:', e)
      }
    }

    const handleStatus = (data: any) => {
      if (data.sessionName !== sessionName) return
      if (data.status === 'connected') {
        setIsConnected(true)
        setIsLoading(false)
        setIsInputEnabled(true)
      } else if (data.status === 'disconnected') {
        setIsConnected(false)
        setIsInputEnabled(false)
      }
    }

    const handleError = (data: any) => {
      if (xtermRef.current) {
        try {
          xtermRef.current.writeln(`\r\n\x1b[31m❌ 错误: ${data.message}\x1b[0m`)
        } catch (e) {}
      }
      if (!isCancelled) setIsLoading(false)
    }

    socket.on('terminal-output', handleOutput)
    socket.on('terminal-status', handleStatus)
    socket.on('error', handleError)

    // 超时处理
    const timeoutId = setTimeout(() => {
      if (!isCancelled && xtermRef.current) {
        try {
          xtermRef.current.writeln('\r\n\x1b[33m⚠️ 连接超时，请检查服务器配置\x1b[0m')
        } catch (e) {}
        setIsLoading(false)
      }
    }, 15000)
    timeoutRef.current = timeoutId

    // ---- 清理 ----
    return () => {
      isCancelled = true
      clearTimeout(timeoutId)
      timeoutRef.current = null
      socket.off('terminal-output', handleOutput)
      socket.off('terminal-status', handleStatus)
      socket.off('error', handleError)
      socket.emit('detach-session', { serverId, sessionName })
    }
  }, [server, serverId, sessionName, isTerminalReady])
  // 注意：不要加 isLoading/sendResize 到依赖数组！
  // isLoading 在 effect 内部被修改会触发重跑，导致重复 attach-session

  // ============================================================
  // 5. 触摸滚动手势
  // ============================================================
  useEffect(() => {
    const container = terminalContainerRef.current
    if (!container) return

    const touchState = { startY: 0, startX: 0, lastY: 0 }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      touchState.startY = touchState.lastY = e.touches[0].clientY
      touchState.startX = e.touches[0].clientX
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const dy = touchState.lastY - e.touches[0].clientY
      const dx = Math.abs(e.touches[0].clientX - touchState.startX)
      const totalDy = touchState.startY - e.touches[0].clientY

      // 纵向滑动 > 8px 且幅度大于横向 → 视为滚动手势
      if (Math.abs(totalDy) > 8 && Math.abs(totalDy) > dx) {
        e.preventDefault()
        e.stopPropagation()

        // 直接改 viewport 的 scrollTop，让 xterm 自己的滚动链处理
        const viewport = container.querySelector('.xterm-viewport') as HTMLElement
        if (viewport) {
          viewport.scrollTop += dy * 1.5  // 手指上滑 → scrollTop 增加 → xterm 向上翻历史
        }
        touchState.lastY = e.touches[0].clientY
      }
    }

    // 使用 capture 模式，在 xterm 之前拦截事件
    container.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })

    return () => {
      container.removeEventListener('touchstart', onTouchStart, { capture: true })
      container.removeEventListener('touchmove', onTouchMove, { capture: true })
    }
  }, [])

  // ============================================================
  // 6. 滚动指示器 — 检查是否有 scrollback 内容
  // ============================================================
  // 使用节流定时检查 xterm 的 yd遣 来判断是否已滚动到顶部/底部
  const scrollCheckRef = useRef<number>(0)

  useEffect(() => {
    if (!isTerminalReady) return
    const id = setInterval(() => {
      const term = xtermRef.current
      if (!term) return
      const ydisp = (term as any).buffer?.active?.ydisp
      const baseY = (term as any).buffer?.active?.baseY
      scrollCheckRef.current = ydisp ?? 0
      // 如果 ydisp > 0 表示用户已经往上滚动（有历史内容）
      // 这里暂不展示 UI，保留 for 将来扩展
    }, 500)
    return () => clearInterval(id)
  }, [isTerminalReady])

  // ============================================================
  // 7. 渲染
  // ============================================================
  if (!isMounted) return null

  if (!server) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="text-gray-400">服务器不存在</p>
          <button onClick={() => router.push('/')} className="mt-4 text-blue-500">
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* 顶部导航 */}
      <div className="bg-gray-900 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium text-white truncate">{sessionName}</h1>
          <p className="text-xs text-gray-400 truncate">{server.name} · {server.host}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isConnected
                ? 'bg-green-500/20 text-green-400'
                : isLoading
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isConnected ? '● 已连接' : isLoading ? '◉ 连接中...' : '○ 已断开'}
          </span>
        </div>
      </div>

      {/* 虚拟按键栏 */}
      <div className="bg-gray-900 px-2 py-2 flex gap-1.5 flex-shrink-0 overflow-x-auto border-b border-gray-700">
        {virtualKeys.map((vk) => (
          <button
            key={vk.label}
            onClick={() => sendVirtualKey(vk.key)}
            disabled={!isConnected}
            className="flex-1 min-w-[48px] px-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono rounded-lg transition-colors active:scale-95 text-center whitespace-nowrap"
          >
            {vk.label}
          </button>
        ))}
      </div>

      {/* 终端区域 */}
      <div
        ref={terminalContainerRef}
        className="terminal-container flex-1 bg-[#1a1a2e]"
        style={{
          minHeight: '200px',
          width: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
        }}
      />

      {/* 快捷指令按钮 */}
      <div className="bg-gray-900 px-3 py-1.5 flex gap-2 flex-shrink-0 overflow-x-auto border-t border-gray-800">
        {quickCommands.map((cmd) => (
          <button
            key={cmd.label}
            onClick={cmd.action}
            disabled={!isConnected}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <cmd.icon className="w-3.5 h-3.5" />
            {cmd.label}
          </button>
        ))}
      </div>

      {/* 底部输入框 */}
      <div className="bg-gray-900 border-t border-gray-800 p-3 flex-shrink-0 safe-area-bottom">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendCommand()
            }}
            placeholder={isInputEnabled ? '输入命令或自然语言...' : '等待连接...'}
            disabled={!isInputEnabled}
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
          />
          <button
            onClick={sendCommand}
            disabled={!isInputEnabled || !inputValue.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
          <button className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}