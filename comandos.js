import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import logger from './logger/logger.js'

/* ===================== CONFIG ===================== */
const PREFIXES = ['-', '#', '@', '*', '!', '.', '/']
const ALLOW_NO_PREFIX = false
const DEFAULT_COOLDOWN = 3
const HOT_RELOAD = true
const COMMANDS_DIR = path.join(process.cwd(), 'comandos')

export const OWNERS = new Set([
  '50765339275',
  '50763180555'
])

/* ===================== ANTI-SPAM GLOBAL ===================== */
export const antiSpamEnabled = new Set()
export const antiStickerEnabled = new Set()
export const antiLinkEnabled = new Set()

const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me\/)/i

/* ===================== MAPAS ===================== */
const commands = new Map()
const aliases = new Map()
const cooldowns = new Map()

let watcher = null
let initialized = false

/* ===================== HELPERS ===================== */
const now = () => Date.now()
const normalize = s => String(s || '').trim().toLowerCase()

export const jidToNum = jid => {
  if (!jid || typeof jid !== 'string') return ''
  return jid.split('@')[0].replace(/\D/g, '')
}

export const isGroupJid = jid => jid?.endsWith('@g.us')

const extractText = msg => {
  if (!msg?.message) return ''
  const m = msg.message
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  ).trim()
}

/* ===================== PARSER ===================== */
const parseCommand = raw => {
  const text = String(raw || '').trim()
  if (!text) return null

  const prefix = PREFIXES.find(p => text.startsWith(p))
  if (!prefix && !ALLOW_NO_PREFIX) return null

  const body = prefix ? text.slice(prefix.length).trim() : text
  if (!body) return null

  const parts = body.split(/\s+/)
  return {
    prefix: prefix || '',
    cmdName: normalize(parts.shift()),
    args: parts,
    rawBody: body
  }
}

/* ===================== PERMISOS ===================== */
export const isOwner = msg => {
  const num = jidToNum(msg?.key?.participant || msg?.key?.remoteJid)
  return OWNERS.has(num)
}

/* ===================== COOLDOWN ===================== */
const checkCooldown = (userNum, cmdName, seconds) => {
  if (seconds <= 0) return 0
  const key = `${userNum}:${cmdName}`
  const last = cooldowns.get(key) || 0
  const diff = seconds * 1000 - (now() - last)
  if (diff > 0) return Math.ceil(diff / 1000)
  cooldowns.set(key, now())
  return 0
}

/* ===================== ANTI-SPAM MEJORADO ===================== */
const COUNTRY_RULES = {
  '91': [10],        // Panamá
  '51': [9],         // Perú
  '92': [10],        // Colombia
  '90': [10],        // México
  '234': [9],         // España
  '90': [10],        // Turquía
  '234': [10],       // Nigeria
  '1': [9],        // Tanzania
  '255': [10]         // Pakistán
}

const SUSPICIOUS_PREFIXES = ['000', '111', '999', '888', '777']

export const isSpamNumber = num => {
  if (!num || num.length < 7) return true
  if (SUSPICIOUS_PREFIXES.some(p => num.startsWith(p))) return true

  const country = Object.keys(COUNTRY_RULES)
    .sort((a, b) => b.length - a.length)
    .find(c => num.startsWith(c))

  if (!country) return true

  const localLength = num.length - country.length
  if (!COUNTRY_RULES[country].includes(localLength)) return true

  return false
}

/* ===================== REGISTRO ===================== */
const unloadAll = () => {
  commands.clear()
  aliases.clear()
}

const registerCommand = mod => {
  const cmd = mod.default ?? mod
  if (!cmd?.name || typeof cmd.execute !== 'function') return false

  const name = normalize(cmd.name)
  if (commands.has(name)) return false

  commands.set(name, cmd)

  if (Array.isArray(cmd.aliases)) {
    for (const a of cmd.aliases) {
      const al = normalize(a)
      if (!aliases.has(al)) aliases.set(al, name)
    }
  }
  return true
}

/* ===================== CARGA RECURSIVA ===================== */
const loadCommandsRecursive = async dir => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      count += await loadCommandsRecursive(fullPath)
      continue
    }

    if (!entry.name.endsWith('.js')) continue

    try {
      const mod = await import(`${fullPath}?t=${now()}`)
      if (registerCommand(mod)) count++
    } catch (err) {
      logger.error(
        { file: fullPath, err: err.message || err },
        'Error cargando comando'
      )
    }
  }

  return count
}

/* ===================== LOAD ===================== */
const loadAllCommands = async () => {
  unloadAll()
  const count = await loadCommandsRecursive(COMMANDS_DIR)
  logger.info(`Comandos cargados: ${count}`)
}

/* ===================== INIT ===================== */
export const initCommands = async () => {
  if (initialized) return
  initialized = true

  await loadAllCommands()

  if (HOT_RELOAD && !watcher) {
    watcher = chokidar.watch(`${COMMANDS_DIR}/**/*.js`, {
      ignoreInitial: true,
      persistent: true
    })

    watcher.on('all', async (event, filePath) => {
      logger.info(`Hot reload: ${event} → ${filePath}`)
      await loadAllCommands()
    })

    watcher.on('error', err =>
      logger.error(err, 'Error en watcher hot reload')
    )
  }
}

/* ===================== ANTI-STICKER ===================== */
export const antiStickerHandler = async (sock, msg) => {
  const isSticker =
    msg.message?.stickerMessage ||
    msg.message?.imageMessage?.mimetype === 'image/webp'

  if (!isSticker || !isGroupJid(msg.key.remoteJid)) return
  if (!antiStickerEnabled.has(msg.key.remoteJid)) return

  const senderNum = jidToNum(msg.key.participant)
  if (OWNERS.has(senderNum)) return

  await sock.sendMessage(msg.key.remoteJid, {
    delete: msg.key
  }).catch(() => {})
}

/* ===================== ANTI-LINK ===================== */
export const antiLinkHandler = async (sock, msg) => {
  if (!isGroupJid(msg.key.remoteJid)) return
  if (!antiLinkEnabled.has(msg.key.remoteJid)) return

  const senderNum = jidToNum(msg.key.participant)
  if (OWNERS.has(senderNum)) return

  const text = extractText(msg)
  if (!text || !linkRegex.test(text)) return

  await sock.sendMessage(msg.key.remoteJid, {
    delete: msg.key
  }).catch(() => {})
}

/* ===================== HANDLER PRINCIPAL ===================== */
export default async function handleCommands(sock, msg) {
  const text = extractText(msg)
  if (!text) return

  /* ===== HOOK GLOBAL (onMessage sin prefijo) ===== */
  for (const cmd of commands.values()) {
    if (typeof cmd.onMessage === 'function') {
      try {
        await cmd.onMessage(sock, msg, {
          jid: msg.key.remoteJid,
          senderJid: msg.key.participant || msg.key.remoteJid,
          senderNum: jidToNum(msg.key.participant || msg.key.remoteJid),
          isGroup: isGroupJid(msg.key.remoteJid),
          isOwner: isOwner(msg),
          text
        })
      } catch (e) {
        logger.error(
          { err: e?.message || e, cmd: cmd.name },
          'Error en onMessage hook'
        )
      }
    }
  }

  /* ===== PARSER ===== */
  const parsed = parseCommand(text)
  if (!parsed) return

  let cmdName = parsed.cmdName
  if (aliases.has(cmdName)) cmdName = aliases.get(cmdName)

  const cmd = commands.get(cmdName)
  if (!cmd) return

  const jid = msg.key.remoteJid
  const senderJid = msg.key.participant || jid
  const senderNum = jidToNum(senderJid)
  const isGrp = isGroupJid(jid)
  const owner = isOwner(msg)

  if (cmd.groupOnly && !isGrp) return
  if (cmd.privateOnly && isGrp) return
  if (cmd.ownerOnly && !owner) return

  const cd = Number(cmd.cooldown ?? DEFAULT_COOLDOWN)
  if (cd > 0 && !owner) {
    const wait = checkCooldown(senderNum, cmdName, cd)
    if (wait > 0) return
  }

  const ctx = {
    jid,
    senderJid,
    senderNum,
    isGroup: isGrp,
    isOwner: owner,
    command: cmdName,
    args: parsed.args,
    fullArgs: parsed.rawBody,
    prefix: parsed.prefix,
    reply: c =>
      sock.sendMessage(
        jid,
        typeof c === 'string' ? { text: c } : c,
        { quoted: msg }
      )
  }

  try {
    await cmd.execute(sock, msg, ctx)
  } catch (err) {
    logger.error(
      { err: err.message || err, cmd: cmdName },
      'Error ejecutando comando'
    )
  }
}
