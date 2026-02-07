// subbot.js — SUBBOT ESTABLE (FIXED 2026 – backoff y no pinning)

import makeWASocket, {
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion // opcional
} from '@whiskeysockets/baileys'

import pino from 'pino'
import NodeCache from 'node-cache'
import fs from 'fs'
import path from 'path'

import logger from './logger/logger.js'
import handleCommands, {
  initCommands,
  antiStickerHandler,
  antiLinkHandler
} from './comandos.js'

import { botTalkHandler } from './botTalkHandler.js'
import { bienvenidaEventHandler } from './handlers/bienvenidaHandler.js'
import grupoHandler from './comandos/admin/grupo.js'

const number = process.argv[2]

if (!number || !/^[0-9]{8,15}$/.test(number)) {
  console.error('❌ Subbot sin número válido')
  process.exit(1)
}

const AUTH_DIR = path.join('./auth/subbot', number)
const GROUP_ONLY_COMMANDS = true
const DEDUPE_TTL_MS = 90_000
let reconnectAttempts = 0
const MAX_RECONNECTS = 5

const msgRetryCounterCache = new NodeCache({ stdTTL: 3600 })
const groupMetadataCache = new NodeCache({ stdTTL: 7200 })

const isGroupJid = jid => jid?.endsWith?.('@g.us')
const hasPrefix = t => ['.', '!', '/', '-'].some(p => t?.startsWith(p))

const pickText = msg =>
  msg?.message?.conversation ||
  msg?.message?.extendedTextMessage?.text ||
  msg?.message?.imageMessage?.caption ||
  msg?.message?.videoMessage?.caption ||
  msg?.message?.documentMessage?.caption ||
  ''

const isValidIncomingMessage = msg =>
  msg?.message &&
  !msg.key?.fromMe &&
  msg.key?.remoteJid &&
  msg.key.remoteJid !== 'status@broadcast'

const dedupe = new Map()
const isDuplicate = msg => {
  const id = msg?.key?.id
  if (!id) return false
  const now = Date.now()
  dedupe.forEach((v, k) => now - v > DEDUPE_TTL_MS && dedupe.delete(k))
  if (dedupe.has(id)) return true
  dedupe.set(id, now)
  return false
}

async function startSubBot() {
  try {
    await initCommands()

    if (!fs.existsSync(AUTH_DIR)) {
      console.error(`❌ Auth no encontrado para ${number}`)
      process.exit(1)
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

    if (!state.creds.registered) {
      console.log(`⏳ ${number} no vinculado`)
      process.exit(1)
    }

    // Opcional: const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'), // moderno
      printQRInTerminal: false,
      // version, // descomenta si usas fetch
      msgRetryCounterCache,
      defaultQueryTimeoutMs: 60000,
      shouldSyncHistoryMessage: () => false // optimiza reconn
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', update => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        reconnectAttempts = 0
        const self = sock.user?.id?.split('@')[0]
        console.log(`🤖 Conectado: +${self}`)
        logger.info(`✅ ${number} listo`)
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        console.log(`⚠️ Desconectado ${number}: ${reason || 'unknown'}`)

        if (reason === DisconnectReason.loggedOut) {
          logger.warn(`🚫 Logout permanente ${number}`)
          process.exit(1)
        }

        if (reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++
          const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts), 60000)
          console.log(`🔄 Reconectando en ${delay/1000}s (${reconnectAttempts}/${MAX_RECONNECTS})`)
          setTimeout(startSubBot, delay)
        } else {
          logger.error(`❌ Max reconn para ${number}`)
          process.exit(1)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!sock.user || !sock.authState?.creds?.signedIdentityKey) return

      for (const msg of messages) {
        if (!isValidIncomingMessage(msg) || isDuplicate(msg)) continue

        const jid = msg.key.remoteJid
        const text = pickText(msg)

        await antiStickerHandler(sock, msg).catch(() => {})
        await antiLinkHandler(sock, msg).catch(() => {})
        await botTalkHandler(sock, msg).catch(() => {})

        if (isGroupJid(jid) && GROUP_ONLY_COMMANDS && !hasPrefix(text)) continue

        await handleCommands(sock, msg).catch(e => logger.error(e, `handleCommands ${number}`))
      }
    })

    sock.ev.on('group-participants.update', async update => {
      await bienvenidaEventHandler(sock, update).catch(() => {})
      await grupoHandler?.eventHandler?.(sock, update).catch(() => {})
    })

  } catch (err) {
    logger.error(err, `❌ Crítico ${number}`)
    if (reconnectAttempts < MAX_RECONNECTS) {
      reconnectAttempts++
      setTimeout(startSubBot, 10000 * reconnectAttempts)
    } else {
      process.exit(1)
    }
  }
}

startSubBot()