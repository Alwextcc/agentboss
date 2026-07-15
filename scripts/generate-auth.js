// scripts/generate-auth.js
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function generateAuthCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'AB-'
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const code = generateAuthCode()
const expiresAt = Date.now() + 5 * 60 * 1000

const data = {
  code,
  expiresAt,
  used: false,
  createdAt: new Date().toISOString()
}

const authFile = path.join(__dirname, '../.auth-code.json')
fs.writeFileSync(authFile, JSON.stringify(data, null, 2))

console.log('========================================')
console.log('  AgentBoss 授权码')
console.log('========================================')
console.log('')
console.log(`  授权码: ${code}`)
console.log(`  有效期: 5 分钟`)
console.log('')
console.log('  请在 AgentBoss 中输入此授权码')
console.log('========================================')