// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken' // 找不到模块“jsonwebtoken”或其相应的类型声明。

const JWT_SECRET = process.env.JWT_SECRET || 'agentboss-secret-key'
const AUTH_FILE = path.join(process.cwd(), '.auth-code.json')

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    // 读取授权码文件
    let authData
    try {
      const content = fs.readFileSync(AUTH_FILE, 'utf-8')
      authData = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { success: false, message: '授权码不存在，请先生成' },
        { status: 400 }
      )
    }

    // 验证授权码
    if (authData.used) {
      return NextResponse.json(
        { success: false, message: '授权码已被使用' },
        { status: 400 }
      )
    }

    if (Date.now() > authData.expiresAt) {
      return NextResponse.json(
        { success: false, message: '授权码已过期，请重新生成' },
        { status: 400 }
      )
    }

    if (code !== authData.code) {
      return NextResponse.json(
        { success: false, message: '授权码错误' },
        { status: 400 }
      )
    }

    // 标记为已使用
    authData.used = true
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2))

    // 生成 JWT
    const token = jwt.sign(
      { authenticated: true, deviceId: request.headers.get('user-agent') || 'unknown' },
      JWT_SECRET,
      { expiresIn: '365d' }
    )

    return NextResponse.json({ success: true, token })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '认证失败' },
      { status: 500 }
    )
  }
}