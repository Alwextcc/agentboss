// ws_server/index.js
const { Server } = require('socket.io')
const http = require('http')
const { Client } = require('ssh2')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

// ==================== 配置 ====================
const JWT_SECRET = process.env.JWT_SECRET || 'agentboss-secret-key'
const AUTH_FILE = path.join(__dirname, '../.auth-code.json')
const PORT = process.env.WS_PORT || 3001

// ==================== 日志 ====================
const log = {
  info: (...args) => console.log(`[${new Date().toLocaleTimeString()}] ℹ️`, ...args),
  error: (...args) => console.error(`[${new Date().toLocaleTimeString()}] ❌`, ...args),
  success: (...args) => console.log(`[${new Date().toLocaleTimeString()}] ✅`, ...args),
  warn: (...args) => console.warn(`[${new Date().toLocaleTimeString()}] ⚠️`, ...args),
}

// ==================== HTTP 服务器 ====================
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('AgentBoss WebSocket Server Running')
})

// ==================== Socket.IO 服务器 ====================
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

// ==================== SSH 连接池 ====================
const sshPool = new Map()

async function getSSHConnection(serverId, config) {
  if (sshPool.has(serverId)) {
    const existing = sshPool.get(serverId)
    if (existing.client && !existing.client.destroyed) {
      log.info(`复用 SSH 连接: ${config.host}`)
      return existing.client
    }
    sshPool.delete(serverId)
  }

  log.info(`建立 SSH 连接: ${config.username}@${config.host}:${config.port}`)

  return new Promise((resolve, reject) => {
    const client = new Client()
    client.on('ready', () => {
      log.success(`SSH 连接成功: ${config.host}`)
      sshPool.set(serverId, { client, lastUsed: Date.now() })
      resolve(client)
    })
    client.on('error', (err) => {
      log.error(`SSH 连接失败: ${config.host}`, err.message)
      reject(err)
    })
    client.on('close', () => {
      log.warn(`SSH 连接关闭: ${config.host}`)
      if (sshPool.has(serverId)) sshPool.delete(serverId)
    })
    const connectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 10000,
    }
    if (config.password) connectConfig.password = config.password
    else if (config.privateKey) connectConfig.privateKey = config.privateKey
    client.connect(connectConfig)
  })
}

async function execCommand(client, command) {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) { reject(err); return }
      let stdout = '',
        stderr = ''
      stream.on('data', (data) => { stdout += data.toString() })
      stream.stderr.on('data', (data) => { stderr += data.toString() })
      stream.on('close', (code) => { resolve({ stdout, stderr, code }) })
      stream.on('error', (err) => { reject(err) })
    })
  })
}

async function getTmuxSessions(client) {
  try {
    const result = await execCommand(client, 'tmux list-sessions 2>/dev/null || echo "NO_TMUX"')
    if (result.stdout.includes('NO_TMUX') || result.code !== 0) {
      return { sessions: [], error: null }
    }
    const lines = result.stdout.split('\n').filter(line => line.trim())
    const sessions = lines.map(line => {
      const match = line.match(/^([^:]+):\s*(\d+)\s*windows/)
      return match ? { name: match[1], windows: parseInt(match[2]) || 0, status: 'active' } : null
    }).filter(s => s !== null)
    return { sessions, error: null }
  } catch (error) {
    return { sessions: [], error: error.message }
  }
}

// ==================== JWT 相关函数 ====================
function verifyToken(token) {
  if (!token) return false
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded.authenticated === true
  } catch (error) {
    return false
  }
}

// ==================== 授权码相关函数 ====================
function getAuthCode() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
    if (!data.used && Date.now() < data.expiresAt) {
      return data.code
    }
    return null
  } catch (error) {
    return null
  }
}

function markAuthCodeUsed() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
    data.used = true
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    log.warn('标记授权码失败:', error.message)
  }
}

// ==================== Socket.IO 事件 ====================
io.on('connection', (socket) => {
  log.info(`客户端连接: ${socket.id}`)

  // ===== 新增：直接认证事件 =====
  socket.on('auth', (data) => {
    const token = data?.token || socket.handshake.auth?.token
    
    if (token && verifyToken(token)) {
      socket.isAuthenticated = true
      socket.authToken = token
      log.success(`✅ 认证成功: ${socket.id}`)
      socket.emit('auth-response', { success: true })
    } else {
      socket.isAuthenticated = false
      log.warn(`⚠️ 认证失败: ${socket.id}`)
      socket.emit('auth-response', { success: false, message: '无效的 token' })
    }
  })

  // ---------- 获取会话列表 ----------
  socket.on('list-sessions', async (data) => {
    console.log('🔍 收到 list-sessions 请求')

    // 优先使用 socket 上保存的认证状态
    if (!socket.isAuthenticated) {
      // 尝试从 data 中获取 token 验证
      const token = data?.token || socket.handshake.auth?.token
      if (token && verifyToken(token)) {
        socket.isAuthenticated = true
        socket.authToken = token
      } else {
        socket.emit('error', { message: '未认证，请重新授权' })
        return
      }
    }

    const { serverId, serverConfig } = data

    if (!serverId || !serverConfig) {
      socket.emit('error', { message: '缺少参数' })
      return
    }

    log.info(`获取会话列表: ${serverConfig.host}`)

    try {
      const client = await getSSHConnection(serverId, serverConfig)
      const result = await getTmuxSessions(client)
      socket.emit('session-list', {
        serverId,
        sessions: result.sessions,
        error: result.error,
      })
    } catch (error) {
      log.error(`获取会话列表失败: ${serverConfig.host}`, error.message)
      socket.emit('error', {
        serverId,
        message: `连接失败: ${error.message}`,
      })
    }
  })

  // ---------- 进入终端 ----------
  socket.on('attach-session', async (data) => {
    const { serverId, sessionName, serverConfig, token } = data

    if (!verifyToken(token)) {
      socket.emit('error', { message: '未认证，请重新授权' })
      return
    }

    log.info(`attach-session: ${sessionName} on ${serverConfig.host}`)
    socket.emit('terminal-status', { sessionName, status: 'connecting' })

    try {
      const client = await getSSHConnection(serverId, serverConfig)

      // 检查会话是否存在
      const checkResult = await execCommand(client,
        `tmux has-session -t "${sessionName}" 2>/dev/null && echo "EXISTS" || echo "NOT_EXISTS"`
      )

      if (checkResult.stdout.trim() === 'NOT_EXISTS') {
        log.warn(`会话不存在: ${sessionName}，创建中...`)
        await execCommand(client, `tmux new -s "${sessionName}" -d`)
      }

      // 使用 shell 分配终端
      client.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          log.error(`Shell 创建失败: ${sessionName}`, err.message)
          socket.emit('error', { message: `连接失败: ${err.message}` })
          return
        }

        log.success(`终端已连接: ${sessionName}`)
        socket.stream = stream
        socket.sessionName = sessionName

        // 设置大窗口
        stream.setWindow(40, 120, 0, 0)

        // 配置终端环境（在 attach tmux 之前完成）
        stream.write('stty cols 120 rows 40 -echo 2>/dev/null\r')
        stream.write('export TERM=xterm-256color\r')

        // 确保 tmux 使用正确的终端类型和 true color
        stream.write(
          `tmux set-option -g default-terminal "xterm-256color" 2>/dev/null; ` +
          `tmux set-option -ga terminal-overrides ",xterm-256color:Tc" 2>/dev/null; ` +
          `tmux set-option -g window-size manual 2>/dev/null\r`
        )

        socket.emit('terminal-status', { sessionName, status: 'connected' })
        socket.emit('terminal-output', { sessionName, output: '\r\n', isReady: true })

        // 等配置命令执行完再 attach tmux
        setTimeout(() => {
          stream.write(`tmux attach -t "${sessionName}"\r`)
        }, 150)

        // 监听输出
        stream.on('data', (data) => {
          socket.emit('terminal-output', { sessionName, output: data.toString() })
        })
        stream.stderr.on('data', (data) => {
          socket.emit('terminal-output', { sessionName, output: data.toString() })
        })
        stream.on('close', () => {
          log.info(`终端关闭: ${sessionName}`)
          socket.emit('terminal-status', { sessionName, status: 'disconnected' })
          socket.stream = null
          socket.sessionName = null
        })
        stream.on('error', (err) => {
          log.error(`终端错误: ${sessionName}`, err.message)
          socket.emit('error', { message: `终端错误: ${err.message}` })
        })
      })
    } catch (error) {
      log.error(`终端连接失败: ${sessionName}`, error.message)
      socket.emit('error', { message: `连接失败: ${error.message}` })
      socket.emit('terminal-status', { sessionName, status: 'disconnected' })
    }
  })

  // ---------- 终端输入 ----------
  socket.on('terminal-input', (data) => {
    const { sessionName, input } = data
    if (socket.stream && socket.sessionName === sessionName) {
      try {
        socket.stream.write(input)
      } catch (error) {
        socket.emit('error', { message: `写入失败: ${error.message}` })
      }
    } else {
      socket.emit('error', { message: '终端未连接' })
    }
  })

  // ---------- 终端尺寸调整 ----------
  socket.on('terminal-resize', (data) => {
    const { sessionName, cols, rows } = data

    if (socket.stream && socket.sessionName === sessionName) {
      try {
        socket.stream.setWindow(rows, cols, 0, 0)
        log.info(`📐 终端尺寸已调整: ${cols}x${rows}`)
      } catch (error) {
        log.error('调整尺寸失败:', error.message)
      }
    }
  })

  // ---------- 分离终端 ----------
  socket.on('detach-session', (data) => {
    const { sessionName } = data
    if (socket.stream && socket.sessionName === sessionName) {
      try {
        socket.stream.write('\x02d')
        setTimeout(() => {
          if (socket.stream) {
            socket.stream.end()
            socket.stream = null
            socket.sessionName = null
          }
        }, 200)
        log.info(`分离终端: ${sessionName}`)
        socket.emit('terminal-status', { sessionName, status: 'disconnected' })
      } catch (error) {
        log.error(`分离失败: ${sessionName}`, error.message)
      }
    }
  })

  // ---------- 断开连接 ----------
  socket.on('disconnect', () => {
    log.info(`客户端断开: ${socket.id}`)
    if (socket.stream) {
      try { socket.stream.end() } catch (e) {}
      socket.stream = null
      socket.sessionName = null
    }
  })
})

// ==================== 启动服务器 ====================
httpServer.listen(PORT, '0.0.0.0', () => {
  log.success(`🚀 AgentBoss WebSocket 服务器启动: http://localhost:${PORT}`)
  log.info(`📐 默认终端尺寸: 120x40`)
})

process.on('SIGINT', () => {
  log.warn('正在关闭服务器...')
  io.close(() => {
    log.info('已关闭')
    process.exit(0)
  })
})