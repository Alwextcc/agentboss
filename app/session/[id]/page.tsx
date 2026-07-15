// app/session/[id]/page.tsx
'use client'

import dynamic from 'next/dynamic'

// 动态导入终端组件，禁用 SSR
const SessionClient = dynamic(
  () => import('./SessionClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-screen bg-black items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400">正在加载终端...</p>
        </div>
      </div>
    )
  }
)

export default function SessionPage() {
  return <SessionClient />
}