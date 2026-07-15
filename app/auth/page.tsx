// app/auth/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [authCode, setAuthCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 检查是否已认证
    const token = localStorage.getItem('agentboss_token')
    if (token) {
      router.push('/')
    }
  }, [router])

  const handleAuth = async () => {
    if (!authCode.trim()) {
      setError('请输入授权码')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // 调用 API 验证授权码
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim() })
      })

      const data = await res.json()

      if (data.success) {
        localStorage.setItem('agentboss_token', data.token)
        localStorage.setItem('agentboss_authenticated', 'true')
        router.push('/')
      } else {
        setError(data.message || '授权码无效，请重试')
      }
    } catch (err) {
      setError('认证失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-2xl font-bold text-white">AgentBoss</h1>
          <p className="text-gray-400 text-sm mt-1">输入授权码绑定此设备</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">授权码</label>
            <input
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="AB-X7K9M-2P5Q8"
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleAuth}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {isLoading ? '验证中...' : '绑定设备'}
          </button>

          <p className="text-gray-500 text-xs text-center mt-4">
            在服务器终端执行 <code className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">npm run auth</code> 生成授权码
          </p>
        </div>
      </div>
    </div>
  )
}