// comandos/perfil.js
// PERFIL – adoptado a claim.js (KEY @s.whatsapp.net)

import fs from 'fs/promises'
import path from 'path'

const USERS_FILE = path.join(process.cwd(), 'database', 'waifu.json')
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')

// MISMA que tu claim.js
const normalizeJid = jid => {
  if (!jid) return null
  const num = String(jid).split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

const formatDate = ts =>
  ts
    ? new Date(ts).toLocaleString('es-PA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Nunca'

async function loadJSON(file, fallback) {
  try {
    const d = JSON.parse(await fs.readFile(file, 'utf8'))
    return d ?? fallback
  } catch {
    return fallback
  }
}

export default {
  name: 'perfil',
  aliases: ['me', 'profile'],
  groupOnly: true,
  cooldown: 4,

  async execute(sock, msg, ctx) {
    const rawJid = msg.key.participant || msg.key.remoteJid
    const userJid = normalizeJid(rawJid)

    if (!userJid) {
      return ctx.reply('❌ No pude identificar tu número (WhatsApp LID).')
    }

    const users = await loadJSON(USERS_FILE, {})
    const inv = await loadJSON(INVENTORY_FILE, {})

    const user = users[userJid]
    if (!user) {
      return ctx.reply('❌ No tienes perfil aún.\nUsa *.claim* para crear tu perfil 🎁')
    }

    const waifus = Array.isArray(inv[userJid]) ? inv[userJid] : []
    const totalWaifus = waifus.length
    const totalValor = waifus.reduce((s, w) => s + (w.price || 0), 0)

    let avatar = null
    try { avatar = await sock.profilePictureUrl(userJid, 'image') } catch {}

    const caption =
`👤 *PERFIL DE USUARIO*

━━━━━━━━━━━━━━━━━━
⭐ *Monedas* » ${user.points ?? 0}
📅 *Último claim* » ${formatDate(user.lastClaim)}

🎴 *Waifus* » ${totalWaifus}
💰 *Valor total* » ${totalValor}

━━━━━━━━━━━━━━━━━━
🎁 Usa *.claim* para ganar monedas
🎴 Usa *.rw* para comprar waifus
📦 Usa *.inventario* para ver tu colección`

    const payload = avatar
      ? { image: { url: avatar }, caption }
      : { text: caption }

    await sock.sendMessage(ctx.jid, payload, { quoted: msg })
  }
}
