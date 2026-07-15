'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        console.log('✅ 用户接受安装')
      } else {
        console.log('❌ 用户拒绝安装')
      }
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 p-4 animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xl">AB</span>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm">安装 AgentBoss</h3>
          <p className="text-gray-400 text-xs mt-0.5">添加到主屏幕，获得原生 App 体验</p>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          <Download className="w-4 h-4" />
          安装
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
        >
          稍后
        </button>
      </div>
    </div>
  )
}