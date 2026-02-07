// comandos/menu.js — ELITE PRO++ 2026
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/* ───────────── CONFIG ELITE ───────────── */
const CONFIG = Object.freeze({
  BOT_NAME: 'Massi-Bot Elite',
  OWNER_PHONE: '+50765339275',
  FOOTER: '✦ Massi-Bot • Jafet OFC ✦',
  LOCALE: 'es-PA',
  COUNTRY: '🇵🇦 Panamá',

  COMMANDS_DIR: path.join(process.cwd(), 'comandos'),
  ASSETS_DIR: path.join(process.cwd(), 'assets'),
  MENU_IMAGE: 'bienvenida.jpg',

  PREFIX_ICON: '➤',
  SUB_ICON: '▸',
  DIVIDER: '━━━━━━━━━━━━━━━━━━',

  // ⚙️ Config avanzada
  MENU_COOLDOWN: 4,          // segundos por usuario
  MAX_CMDS_PER_SECTION: 30,  // anti overflow
  SHOW_TOTAL_CMDS: true,
  CACHE_TTL: 60_000,         // 1 min cache
})

/* ───────────── MENÚS ───────────── */
const MENU_MAP = {
  1: ['Juegos'],
  2: ['Usuarios'],
  3: ['Suscriptores-streaming'],
  4: ['admin'],
  5: ['Owner'],
  6: ['dox-fake'],
}

/* ───────────── CACHE + BLINDAJE ───────────── */
const cache = new Map()
const cooldown = new Map()

/* ───────────── UTILIDADES ───────────── */
const format = s =>
  s.replace(/[-_/]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

function now() {
  return Date.now()
}

function getDateTime() {
  const d = new Date()
  return {
    fecha: new Intl.DateTimeFormat(CONFIG.LOCALE, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d),
    hora: new Intl.DateTimeFormat(CONFIG.LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d),
  }
}

async function loadImage() {
  try {
    return await fs.readFile(path.join(CONFIG.ASSETS_DIR, CONFIG.MENU_IMAGE))
  } catch {
    return null
  }
}

/* ───────────── LECTOR DE COMANDOS (CACHEADO) ───────────── */
async function readCategory(folder) {
  const key = `cat:${folder}`
  const cached = cache.get(key)

  if (cached && now() - cached.time < CONFIG.CACHE_TTL) {
    return cached.data
  }

  const base = path.join(CONFIG.COMMANDS_DIR, folder)
  const result = {}

  try {
    const entries = await fs.readdir(base, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(base, entry.name)
        const files = await fs.readdir(sub)

        const cmds = files
          .filter(f => f.endsWith('.js') && f !== 'index.js')
          .map(f => f.replace('.js', ''))
          .slice(0, CONFIG.MAX_CMDS_PER_SECTION)
          .sort()

        if (cmds.length) {
          result[`${folder}/${entry.name}`] = cmds
        }
      }

      if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'index.js') {
        result[folder] ??= []
        result[folder].push(entry.name.replace('.js', ''))
      }
    }
  } catch {}

  cache.set(key, { time: now(), data: result })
  return result
}

/* ───────────── DISEÑO ───────────── */
function header({ fecha, hora }) {
  return [
    `✨ *${CONFIG.BOT_NAME}*`,
    `_${CONFIG.FOOTER}_`,
    '',
    `📍 *País:* ${CONFIG.COUNTRY}`,
    `🕒 *Hora:* ${hora}`,
    `📅 *Fecha:* ${fecha}`,
    `👑 *Owner:* wa.me/${CONFIG.OWNER_PHONE.replace('+', '')}`,
    '',
    CONFIG.DIVIDER,
  ].join('\n')
}

function mainMenu({ fecha, hora }) {
  const out = [header({ fecha, hora })]

  out.push('📂 *MENÚ PRINCIPAL*\n')

  for (const [num, folders] of Object.entries(MENU_MAP)) {
    out.push(
      `${num}️⃣  ${CONFIG.PREFIX_ICON} ${folders.map(format).join(' ✦ ')}`
    )
  }

  out.push(
    '',
    CONFIG.DIVIDER,
    `👉 Usa *menu 1*, *menu 2*, etc.`,
  )

  return out.join('\n')
}

function sectionMenu({ num, fecha, hora, data }) {
  const out = [header({ fecha, hora })]
  out.push(`📋 *MENÚ ${num}*\n`)

  let total = 0
  let empty = true

  for (const [cat, cmds] of Object.entries(data)) {
    if (!cmds.length) continue
    empty = false
    total += cmds.length

    out.push(`◆ *${format(cat)}* (${cmds.length})`)
    out.push(
      cmds.map(c => `  ${CONFIG.SUB_ICON} ${CONFIG.PREFIX_ICON} ${c}`).join('\n')
    )
    out.push('')
  }

  if (empty) out.push('_Sin comandos disponibles_')

  if (CONFIG.SHOW_TOTAL_CMDS) {
    out.push(`📊 *Total comandos:* ${total}`)
  }

  out.push(CONFIG.DIVIDER, '⬅️ Usa *menu* para volver')

  return out.join('\n').slice(0, 3900) // anti crash WA
}

/* ───────────── COMANDO ───────────── */
export default {
  name: 'menu',
  aliases: ['m', 'help', 'comandos', 'ayuda', 'cmd', 'menú'],

  async execute(sock, msg, ctx) {
    const jid = ctx.sender || ctx.jid
    const last = cooldown.get(jid) || 0

    if (now() - last < CONFIG.MENU_COOLDOWN * 1000) {
      return
    }
    cooldown.set(jid, now())

    const page = Number(ctx.args[0])
    const { fecha, hora } = getDateTime()
    const image = await loadImage()

    let caption

    if (!page || !MENU_MAP[page]) {
      caption = mainMenu({ fecha, hora })
    } else {
      const data = {}
      for (const folder of MENU_MAP[page]) {
        Object.assign(data, await readCategory(folder))
      }
      caption = sectionMenu({ num: page, fecha, hora, data })
    }

    await sock.sendMessage(
      ctx.jid,
      image ? { image, caption } : { text: caption },
      { quoted: msg }
    )
  },
}
