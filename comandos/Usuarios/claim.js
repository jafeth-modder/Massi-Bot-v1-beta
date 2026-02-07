// comandos/claim.js
// CLAIM FINAL – estable, diario y consistente con rw/perfil

import fs from 'fs/promises'
import path from 'path'

/* ===================== RUTA ===================== */
const USERS_FILE = path.join(process.cwd(), 'database', 'waifu.json')

/* ===================== CONFIG ===================== */
const PUNTOS_DIARIOS = 3
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 horas

/* ===================== HELPERS ===================== */

// 🔐 normaliza TODO a @s.whatsapp.net (MISMA FUNCIÓN QUE rw.js / perfil.js)
const normalizeJid = jid => {
  if (!jid) return null
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

async function loadObjectJSON(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    return typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

async function saveJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

function timeLeft(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

function formatFecha(ts) {
  if (!ts) return 'Nunca'
  const d = new Date(ts)
  return d.toLocaleString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/* ===================== COMANDO ===================== */
export default {
  name: 'claim',
  aliases: ['daily'],
  groupOnly: true,
  cooldown: 3,

  async execute(sock, msg, ctx) {
    // 🔥 JID ÚNICO Y CORRECTO
    const rawJid  = msg.key.participant || msg.key.remoteJid
    const userJid = normalizeJid(rawJid)

    const users = await loadObjectJSON(USERS_FILE)
    const now = Date.now()

    // crear perfil si no existe
    if (!users[userJid]) {
      users[userJid] = { points: 0, lastClaim: 0 }
    }

    const diff = now - (users[userJid].lastClaim || 0)

    // cooldown
    if (diff < COOLDOWN_MS) {
      return ctx.reply(
        `⏳ Ya reclamaste hoy.\n` +
        `Vuelve en *${timeLeft(COOLDOWN_MS - diff)}*\n\n` +
        `⭐ Puntos actuales: ${users[userJid].points}\n` +
        `📅 Último claim: ${formatFecha(users[userJid].lastClaim)}`
      )
    }

    // 🎁 dar puntos (NUNCA depende de waifus)
    users[userJid].points += PUNTOS_DIARIOS
    users[userJid].lastClaim = now
    await saveJSON(USERS_FILE, users)

    await ctx.reply(
      `🎁 *CLAIM DIARIO*\n\n` +
      `➕ +${PUNTOS_DIARIOS} puntos ⭐\n` +
      `💰 Total: *${users[userJid].points}* puntos\n\n` +
      `✨ Vuelve mañana para reclamar otra vez`
    )
  }
}
