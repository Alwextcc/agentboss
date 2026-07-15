# AgentBoss

> 你的 AI Agent 移动驾驶舱 — 在手机上通过 Web 终端管理服务器的 tmux 会话

一个基于 **Next.js** 的 **PWA 移动端 SSH 终端管理器**，让你用手机浏览器就能连接到服务器上的 tmux 会话，支持完整的终端交互。

---

## 截图

<p align="center">
  <img src="AB_4.png" width="280" alt="AgentBoss 截图" />
  <img src="AB_2.svg" width="280" alt="AgentBoss Logo" />
</p>

---

## 功能

- 📱 **移动端优先** — PWA 支持，添加到主屏幕后像原生 App 一样运行
- 🔐 **一次性授权码认证** — 终端生成、手机扫码式绑定，安全便捷
- 🖥 **tmux 会话管理** — 查看、创建、连接服务器上的 tmux 会话
- ⌨ **完整终端交互** — 物理键盘 + 虚拟按键 + 快捷指令
- 🌐 **局域网访问** — 手机通过 WiFi 连接电脑，无需公网 IP
- 📶 **WebSocket 实时通信** — 低延迟的 SSH 终端流式传输
- 🎨 **深色主题** — 针对移动触摸优化的 xterm.js 终端
- 🏗 **连接池复用** — 同一服务器 SSH 连接自动复用

---

## 快速开始

### 前提条件

- Node.js 18+
- 一台公网服务器（Linux）
- 一个域名（配置好 DNS 解析到服务器 IP）

### 安装

```bash
# 克隆项目
git clone <your-repo-url>
cd agentboss

# 安装依赖
npm install
```

### 启动

需要同时启动两个服务：

```bash
# 方式一：分别启动
npm run dev      # Next.js 前端 → http://localhost:3000
npm run ws       # WebSocket 后端 → http://localhost:3001

# 方式二：同时启动（推荐）
npx concurrently -n "next,ws" "npm run dev" "npm run ws"
```

### 部署

1. 将代码推送至 Git 仓库
2. 在公网服务器上克隆并安装依赖
3. 配置反向代理（如 Nginx）将域名指向 3000 端口，将 `/ws` 路径转发到 3001 端口
4. 配置 SSL 证书（HTTPS 是 PWA 的必要条件）
5. 使用 `npm run build && npm start` 启动生产模式

> 生产环境建议使用 `pm2` 或 `systemd` 管理进程，确保持续运行。

### 在手机上使用

1. 部署完成后，手机浏览器打开 `https://你的域名`
2. 在服务器终端执行以下命令生成授权码：
   ```bash
   npm run auth
   ```
3. 手机输入授权码，绑定设备
4. 添加到主屏幕（Safari: 分享 → 添加到主屏幕 / Chrome: 菜单 → 添加到主屏幕）

---

## 项目结构

```
agentboss/
├── app/                    # Next.js App Router 页面
│   ├── auth/               # 授权码登录页
│   ├── server/[id]/        # 服务器详情页（tmux 会话列表）
│   ├── session/[id]/       # 终端页面（xterm.js）
│   ├── api/auth/verify/    # 授权码验证 API
│   └── components/         # PWA 组件
├── lib/
│   ├── socket.ts           # Socket.IO 客户端单例
│   └── storage.ts          # localStorage 持久化
├── stores/
│   └── appStore.ts         # Zustand 状态管理
├── ws_server/
│   └── index.js            # WebSocket 服务器（SSH 网关）
├── scripts/
│   └── generate-auth.js    # 授权码生成
├── public/
│   ├── manifest.json       # PWA 配置
│   ├── sw.js               # Service Worker
│   └── icons/              # 各平台图标
└── next.config.ts          # Next.js 配置
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand (persist) |
| 终端 | xterm.js + FitAddon + WebLinksAddon |
| 实时通信 | Socket.IO（WebSocket） |
| SSH 连接 | ssh2 |
| 认证 | JWT + 一次性授权码 |
| PWA | Service Worker + Web Manifest |

---

## 启动命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Next.js 开发服务器（端口 3000） |
| `npm run ws` | 启动 WebSocket 后端（端口 3001） |
| `npm run auth` | 生成一次性授权码（有效 5 分钟） |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产版本 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | `agentboss-secret-key` | JWT 签名密钥 |
| `WS_PORT` | `3001` | WebSocket 服务端口 |

---

## 常见问题

### 图标不显示

- iOS 需要先**删除旧的 PWA 图标**，重新添加到主屏幕
- Safari 会缓存 manifest，彻底关闭 Safari 再重试

### 生产环境建议

- 使用 `pm2` 管理 `npm start` 和 `npm run ws` 两个进程
- Nginx 反向代理时注意 WebSocket 的 `Upgrade` 头转发
- 必须配置 HTTPS（Let's Encrypt 免费证书）

---

## License

MIT
