// comandos/serbot.js — CREACIÓN DE SUBBOTS (FIXED 2026 – con backoff y stderr al grupo)

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.resolve(__dirname, '..', '..')
const SUBBOT_AUTH_DIR = path.join(ROOT, 'auth', 'subbot')
const PAIR_FILE = path.join(ROOT, 'pair.js')
const SUBBOT_FILE = path.join(ROOT, 'subbot.js')

const ALLOWED_GROUP = '120363425071262553@g.us'

async function isGroupAdmin(sock, jid, msg) {
  try {
    const meta = await sock.groupMetadata(jid)
    const participant = msg.key.participant
    return meta.participants.some(p => p.id === participant && (p.admin === 'admin' || p.admin === 'superadmin'))
  } catch {
    return false
  }
}

export default {
  name: 'serbot',
  aliases: ['subbot', 'vincular', 'pair'],
  groupOnly: true,
  cooldown: 30, // anti-spam/rate-limit

  async execute(sock, msg, ctx) {
    const { args, reply, jid } = ctx

    if (jid !== ALLOWED_GROUP) {
      return reply('❌ Solo en grupo autorizado: https://chat.whatsapp.com/FtCSdIVCGQB5SBqLYEmhhw')
    }

    if (!await isGroupAdmin(sock, jid, msg)) {
      return reply('❌ Solo admins.')
    }

    if (!args[0]) {
      return reply('📌 Ej: .serbot 50712345678')
    }

    const number = args[0].replace(/[^0-9]/g, '')
    if (number.length < 8 || number.length > 15) {
      return reply('❌ Número inválido (8-15 dígitos, sin +)')
    }

    const authPath = path.join(SUBBOT_AUTH_DIR, number)
    if (fs.existsSync(authPath)) {
      return reply(`⚠️ +${number} ya vinculado.`)
    }

    const initMsg = await reply(`🔗 Generando código para +${number}... ⏳ 10-30s`)

    const child = spawn('node', [PAIR_FILE, number], { stdio: ['ignore', 'pipe', 'pipe'] })

    let buffer = ''
    let pairingSent = false
    let readySent = false

    const timeout = setTimeout(() => {
      if (!pairingSent && !readySent) {
        child.kill()
        reply('⏰ Timeout. Espera 1-2 min y reintenta (posible rate-limit).', initMsg.key)
      }
    }, 60000) // 1min max

    child.stdout.on('data', async data => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const out = line.trim()
        if (!out) continue

        if (out.startsWith('PAIR:')) {
          pairingSent = true
          const [, num, code] = out.split(':')
          await sock.sendMessage(jid, { text: `🔐 Vincula Sub-Bot\nNúmero: +${num}\nCódigo: *${code}*\n⏱ ~90s válido\nWA → Ajustes → Dispositivos → Vincular con tel.` }, { quoted: msg })
        } else if (out.startsWith('READY:')) {
          readySent = true
          clearTimeout(timeout)
          await sock.sendMessage(jid, { text: `✅ +${number} vinculado.\n🤖 Lanzando...` }, { quoted: msg })
          spawn('node', [SUBBOT_FILE, number], { detached: true, stdio: 'ignore' }).unref()
        } else if (out.startsWith('ERROR:')) {
          clearTimeout(timeout)
          await reply(`❌ Fallo: ${out.replace('ERROR:', '').trim()}`, initMsg.key)
        } else if (out.startsWith('RATE_LIMIT:')) {
          clearTimeout(timeout)
          await reply(`⚠️ Rate-limit detectado. Espera y reintenta.`, initMsg.key)
        }
      }
    })

    child.stderr.on('data', async data => {
      const err = data.toString().trim()
      console.error(`[serbot ${number}] STDERR: ${err}`)
      if (err.includes('Connection Closed') || err.includes('429')) {
        clearTimeout(timeout)
        await reply(`⚠️ Error: ${err.slice(0, 150)}... (posible rate-limit o conexión fallida). Reintenta en 5min.`, initMsg.key)
      }
    })

    child.on('exit', code => {
      clearTimeout(timeout)
      if (!pairingSent && !readySent && code !== 0) {
        reply('❌ Fallo al generar código. Revisa logs o número.')
      }
    })
  }
}