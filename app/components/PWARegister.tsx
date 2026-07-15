// app/components/PWARegister.tsx
'use client'

import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker 注册成功:', registration.scope)
        })
        .catch((error) => {
          console.error('❌ Service Worker 注册失败:', error)
        })
    }
  }, [])

  return null
}