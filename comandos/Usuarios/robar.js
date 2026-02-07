// comandos/fun/robar.js
// ROBAR FINAL: robar waifu ofreciendo mayor precio (puja)

import fs from 'fs/promises'
import path from 'path'

/* ===================== RUTAS ===================== */
const USERS_FILE     = path.join(process.cwd(), 'database', 'waifu.json')
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')

/* ===================== HELPERS ===================== */

// 🔐 normaliza TODO a @s.whatsapp.net
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
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

/* ===================== COMANDO ===================== */
export default {
  name: 'robar',
  aliases: ['steal'],
  groupOnly: true,
  cooldown: 10,

  async execute(sock, msg, ctx) {
    // ladrón
    const rawThief = msg.key.participant || msg.key.remoteJid
    const thiefJid = normalizeJid(rawThief)

    // víctima (mention obligatorio)
    const mentioned =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mentioned) {
      return ctx.reply(
        '❌ Uso correcto:\n' +
        '*.robar @usuario índice precio*'
      )
    }

    const victimJid = normalizeJid(mentioned)

    if (victimJid === thiefJid) {
      return ctx.reply('❌ No puedes robarte a ti mismo')
    }

    // args: índice y oferta
    const index  = parseInt(ctx.args[0])
    const oferta = parseInt(ctx.args[1])

    if (!index || !oferta || oferta <= 0) {
      return ctx.reply(
        '❌ Uso correcto:\n' +
        '*.robar @usuario índice precio*'
      )
    }

    const users = await loadObjectJSON(USERS_FILE)
    const inv   = await loadObjectJSON(INVENTORY_FILE)

    if (!inv[victimJid] || !inv[victimJid][index - 1]) {
      return ctx.reply('❌ Esa waifu no existe en su inventario')
    }

    // asegurar perfiles
    if (!users[thiefJid])  users[thiefJid]  = { points: 0, lastClaim: 0 }
    if (!users[victimJid]) users[victimJid] = { points: 0, lastClaim: 0 }
    if (!inv[thiefJid])    inv[thiefJid]    = []

    const waifu = inv[victimJid][index - 1]

    // validar oferta
    if (oferta <= waifu.price) {
      return ctx.reply(
        `❌ La oferta debe ser MAYOR al precio actual\n` +
        `💰 Precio actual: ${waifu.price}`
      )
    }

    if (users[thiefJid].points < oferta) {
      return ctx.reply(
        `❌ No tienes puntos suficientes\n` +
        `💰 Tus puntos: ${users[thiefJid].points}\n` +
        `🏷️ Oferta: ${oferta}`
      )
    }

    // 💸 transferencia de puntos
    users[thiefJid].points  -= oferta
    users[victimJid].points += oferta

    // 🔁 mover waifu
    inv[victimJid].splice(index - 1, 1)

    inv[thiefJid].push({
      ...waifu,
      price: oferta,
      stolenFrom: victimJid,
      stolenAt: Date.now()
    })

    await saveJSON(USERS_FILE, users)
    await saveJSON(INVENTORY_FILE, inv)

    const victimNum = victimJid.split('@')[0]

    await ctx.reply(
      `🔥 *ROBO EXITOSO*\n\n` +
      `💎 Waifu » ${waifu.name}\n` +
      `💰 Precio pagado » ${oferta}\n` +
      `👤 Robada a » @${victimNum}\n\n` +
      `📉 Tus puntos » ${users[thiefJid].points}`,
      { mentions: [victimJid] }
    )
  }
}
