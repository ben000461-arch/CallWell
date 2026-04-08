#!/usr/bin/env node
// CallWell Key Generator
// Usage:
//   node keygen.js --name "Sunrise Memory Care" --days 30
//   node keygen.js --name "Loma Linda" --permanent
//   node keygen.js --list

const fs = require('fs')
const path = require('path')

const HTML_FILE = path.join(__dirname, 'index.html')
const args = process.argv.slice(2)

function parseArgs() {
  const out = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name') out.name = args[++i]
    if (args[i] === '--days') out.days = parseInt(args[++i])
    if (args[i] === '--permanent') out.permanent = true
    if (args[i] === '--list') out.list = true
    if (args[i] === '--revoke') out.revoke = args[++i]
  }
  return out
}

function genKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
  return `WELL-${seg()}-${seg()}-${seg()}`
}

function getExpiry(days) {
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function readFile() {
  return fs.readFileSync(HTML_FILE, 'utf8')
}

function writeFile(content) {
  fs.writeFileSync(HTML_FILE, content, 'utf8')
}

function getKeysBlock(content) {
  const match = content.match(/keys:\s*\{([\s\S]*?)\n\s*\}(\s*\/\/ Add more)/)
  return match ? match[1] : null
}

function addKey(content, key, name, expiry, plan) {
  const line = `    '${key}': { name: '${name}', expiry: ${expiry ? `'${expiry}'` : 'null'}, plan: '${plan}' },`
  const marker = '    // Add more keys here — this is your master key registry'
  if (!content.includes(marker)) {
    console.error('Could not find keys section in HTML file.')
    process.exit(1)
  }
  return content.replace(marker, `${line}\n${marker}`)
}

function revokeKey(content, key) {
  const lines = content.split('\n')
  const filtered = lines.filter(l => !l.includes(`'${key}':`))
  return filtered.join('\n')
}

function listKeys(content) {
  const matches = [...content.matchAll(/'(WELL-[A-Z0-9-]+)':\s*\{([^}]+)\}/g)]
  if (matches.length === 0) { console.log('No keys found.'); return }
  console.log('\n══════════════════════════════════════════')
  console.log('  CallWell Active Keys')
  console.log('══════════════════════════════════════════')
  matches.forEach(m => {
    const key = m[1]
    const body = m[2]
    const nameMatch = body.match(/name:\s*'([^']+)'/)
    const expiryMatch = body.match(/expiry:\s*(?:'([^']+)'|null)/)
    const planMatch = body.match(/plan:\s*'([^']+)'/)
    const name = nameMatch ? nameMatch[1] : 'Unknown'
    const expiry = expiryMatch ? (expiryMatch[1] || 'No expiry') : '?'
    const plan = planMatch ? planMatch[1] : '?'
    const isExpired = expiryMatch && expiryMatch[1] && new Date(expiryMatch[1]) < new Date()
    console.log(`\n  Key:     ${key}`)
    console.log(`  Facility: ${name}`)
    console.log(`  Plan:    ${plan}`)
    console.log(`  Expiry:  ${expiry}${isExpired ? ' ⚠ EXPIRED' : ''}`)
  })
  console.log('\n══════════════════════════════════════════\n')
}

// ── MAIN ──────────────────────────────────────────────
const opts = parseArgs()

if (!fs.existsSync(HTML_FILE)) {
  console.error(`\n  ✗ Cannot find index.html\n  Make sure keygen.js is in the same folder.\n`)
  process.exit(1)
}

const content = readFile()

if (opts.list) {
  listKeys(content)
  process.exit(0)
}

if (opts.revoke) {
  const updated = revokeKey(content, opts.revoke)
  writeFile(updated)
  console.log(`\n  ✓ Key revoked: ${opts.revoke}\n`)
  process.exit(0)
}

if (!opts.name) {
  console.log(`
  CallWell Key Generator
  ──────────────────────
  Usage:
    node keygen.js --name "Facility Name" --days 30
    node keygen.js --name "Facility Name" --permanent
    node keygen.js --list
    node keygen.js --revoke WELL-XXXX-XXXX-XXXX
  `)
  process.exit(0)
}

const key = genKey()
const expiry = opts.permanent ? null : getExpiry(opts.days || 30)
const plan = opts.permanent ? 'paid' : 'pilot'
const updated = addKey(content, key, opts.name, expiry, plan)
writeFile(updated)

console.log(`
══════════════════════════════════════════
  CallWell Key Generated
══════════════════════════════════════════

  Key:      ${key}
  Facility: ${opts.name}
  Plan:     ${plan}
  Expiry:   ${expiry || 'No expiry — permanent'}

  ✓ Added to index.html
  ✓ Deploy the file to make it live

══════════════════════════════════════════
`)
