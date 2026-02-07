// RW FINAL — SOLO COMPRA / TIENDA (NO PELEA)
// Compra waifus libres, clona stats completos y guarda inventario único

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'

/* ===================== RUTAS ===================== */
const WAIFUS_FILE    = path.join(process.cwd(), 'database', 'waifus.json')
const USERS_FILE     = path.join(process.cwd(), 'database', 'waifu.json')
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')

/* ===================== HELPERS ===================== */
const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const normalizeJid = jid => {
  if (!jid) return null
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

async function loadJSON(file, def) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    return data ?? def
  } catch {
    return def
  }
}

async function saveJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

/* ===================== CONFIG ===================== */
const RARITY_MULT = {
  R: 1,
  SR: 1.4,
  SSR: 2.2
}

/* ===================== COMANDO ===================== */
export default {
  name: 'rw',
  aliases: ['waifu'],
  groupOnly: true,
  cooldown: 5,

  async execute(sock, msg, ctx) {
    const rawJid  = msg.key.participant || msg.key.remoteJid
    const userJid = normalizeJid(rawJid)

    const waifus = await loadJSON(WAIFUS_FILE, [])
    const users  = await loadJSON(USERS_FILE, {})
    const inv    = await loadJSON(INVENTORY_FILE, {})

    if (!waifus.length) {
      return ctx.reply('❌ Lista de waifus vacía')
    }

    // asegurar perfil
    if (!users[userJid]) users[userJid] = { points: 0, lastRw: 0 }
    if (!inv[userJid]) inv[userJid] = []

    // anti spam extra
    if (Date.now() - users[userJid].lastRw < 5_000) {
      return ctx.reply('⏳ Espera un poco antes de volver a usar RW')
    }
    users[userJid].lastRw = Date.now()

    // 🎲 waifu random
    const w = rand(waifus)

    // 🔎 verificar si ya tiene dueño (por nombre)
    for (const uid in inv) {
      if (inv[uid].some(x => x.name === w.name)) {
        const ownerNum = uid.split('@')[0]
        return ctx.reply(
          `❌ *WAIFU NO DISPONIBLE*\n\n` +
          `✿ Nombre » ${w.name}\n` +
          `👤 Dueño » @${ownerNum}\n\n` +
          `🔥 Ya fue comprada`,
          { mentions: [uid] }
        )
      }
    }

    // 💰 precio según rareza
    const base = randInt(50, 120)
    const precio = Math.floor(base * (RARITY_MULT[w.rarity] || 1))

    if (users[userJid].points < precio) {
      return ctx.reply(
        `❌ No tienes puntos suficientes\n\n` +
        `🏷️ Precio » ${precio}\n` +
        `💰 Tus puntos » ${users[userJid].points}`
      )
    }

    // 💸 descontar puntos
    users[userJid].points -= precio
    await saveJSON(USERS_FILE, users)

    // 📦 CLONAR WAIFU (ÚNICA)
    const item = {
      id: crypto.randomUUID(),

      name: w.name,
      gender: w.gender,
      source: w.source,
      image: w.image,

      rarity: w.rarity,
      element: w.element,

      stats: structuredClone(w.stats),
      arma: { ...w.arma },

      hp: w.stats.hp,
      maxHp: w.stats.maxHp,

      price: precio,
      boughtAt: Date.now(),

      flags: {
        favorite: false,
        locked: false,
        bound: true
      }
    }

    inv[userJid].push(item)
    await saveJSON(INVENTORY_FILE, inv)

    // 🖼️ MENSAJE
    const caption =
`🛒 *COMPRA DE WAIFU*

✿ Nombre » ${item.name}
🎖 Rareza » ${item.rarity}
⚔️ Arma » ${item.arma.tipo}
❤️ HP » ${item.hp}/${item.maxHp}
🔮 Magia » ${item.stats.magia}
🏷️ Precio » ${precio}

💰 Puntos restantes » ${users[userJid].points}`

    try {
      const img = await axios.get(item.image, {
        responseType: 'arraybuffer',
        timeout: 7000
      })

      await sock.sendMessage(
        ctx.jid,
        { image: Buffer.from(img.data), caption },
        { quoted: msg }
      )
    } catch {
      await ctx.reply(caption + '\n\n⚠️ Imagen no disponible')
    }

    await ctx.reply(
      `✅ *Compra exitosa*\n` +
      `📦 Guardada en tu inventario\n` +
      `🧾 Total waifus » *${inv[userJid].length}*`
    )
  }
}
