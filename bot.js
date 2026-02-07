// bot.js – FINAL ULTRA 2026 (ESTABLE + LISTO PARA SUBBOTS)

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
  DisconnectReason
} from '@whiskeysockets/baileys'

import 'dotenv/config'
import pino from 'pino'
import NodeCache from 'node-cache'

import logger from './logger/logger.js'
import handleCommands, {
  initCommands,
  antiStickerHandler,
  antiLinkHandler,
  OWNERS,
  antiSpamEnabled,
  isSpamNumber
} from './comandos.js'

import { botTalkHandler } from './botTalkHandler.js'
import { bienvenidaEventHandler } from './handlers/bienvenidaHandler.js'
import grupoHandler from './comandos/admin/grupo.js'

/* ===================== CONFIGURACIÓN PRINCIPAL ===================== */
const GROUP_ONLY_COMMANDS = true
const DEDUPE_TTL_MS = 90_000
const AUTH_DIR = './auth_info_multi'

const WHITELIST_PREFIXES = ['507']

/* ===================== CACHES ===================== */
const msgRetryCounterCache = new NodeCache({ stdTTL: 3600 })
const groupMetadataCache = new NodeCache({ stdTTL: 7200 })

/* ===================== HELPERS ===================== */
const isGroupJid = jid => jid?.endsWith?.('@g.us')
const normalizeJid = jid => jid?.split(':')[0]

const hasPrefix = text =>
  ['-', '*', '!', '.', '/'].some(p => text?.startsWith?.(p))

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

const jidToNum = jid =>
  jid?.split('@')[0]?.replace(/[^0-9]/g, '') || ''

/* ====== FIX SENDER KEY ====== */
const canSendToGroup = (sock, jid) => {
  if (!jid.endsWith('@g.us')) return true
  const creds = sock?.authState?.creds
  return !!(creds?.signedIdentityKey && creds?.signedPreKey)
}

/* ===================== ESTADO ===================== */
let sock
let readyToSend = false
const dedupe = new Map()

const isDuplicate = msg => {
  const id = msg?.key?.id
  if (!id) return false
  const now = Date.now()
  for (const [k, v] of dedupe.entries())
    if (now - v > DEDUPE_TTL_MS) dedupe.delete(k)
  if (dedupe.has(id)) return true
  dedupe.set(id, now)
  return false
}

/* ===================== INICIO ===================== */
const startBot = async () => {
  try {
    readyToSend = false
    await initCommands()

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestWaWebVersion()

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: true,
      msgRetryCounterCache,
      defaultQueryTimeoutMs: 60000,

      // 🔒 CACHE SOLO LECTURA (FIX ADMIN)
      cachedGroupMetadata: async jid => {
        if (!isGroupJid(jid)) return undefined
        return groupMetadataCache.get(jid) || undefined
      }
    })

    sock.ev.on('creds.update', saveCreds)

    /* ====== CONEXIÓN ====== */
    sock.ev.on('connection.update', update => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        readyToSend = true
        console.log('✅ Bot principal conectado →', sock.user?.id)
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        if (reason !== DisconnectReason.loggedOut) {
          setTimeout(startBot, 5000)
        } else {
          console.log('🚫 Sesión cerrada → borra auth_info_multi')
          process.exit(1)
        }
      }
    })

    /* ========= MENSAJES ========= */
    sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!readyToSend || !sock.user) return
      if (!sock.authState?.creds?.signedIdentityKey) return

      for (const msg of messages) {
        if (!isValidIncomingMessage(msg) || isDuplicate(msg)) continue

        const jid = msg.key.remoteJid
        if (isGroupJid(jid) && !canSendToGroup(sock, jid)) continue

        /* ===== ANTI-SPAM ===== */
        if (antiSpamEnabled.has(jid)) {
          const participant = normalizeJid(msg.key.participant)
          const num = jidToNum(participant)

          if (
            num &&
            isSpamNumber(num) &&
            !WHITELIST_PREFIXES.some(p => num.startsWith(p))
          ) {
            await sock.sendMessage(jid, { delete: msg.key }).catch(() => {})
            await sock.groupParticipantsUpdate(jid, [participant], 'remove')
              .catch(() => {})
            continue
          }
        }

        await antiStickerHandler(sock, msg).catch(() => {})
        await antiLinkHandler(sock, msg).catch(() => {})
        await botTalkHandler(sock, msg).catch(() => {})

        const text = pickText(msg)
        if (isGroupJid(jid) && GROUP_ONLY_COMMANDS && !hasPrefix(text)) continue

        await handleCommands(sock, msg).catch(err =>
          logger.error(err, 'handleCommands')
        )
      }
    })

    /* ========= EVENTOS DE GRUPO (REFRESH METADATA) ========= */
    sock.ev.on('group-participants.update', async update => {
      try {
        const gid = update.id
        if (gid?.endsWith('@g.us')) {
          const fresh = await sock.groupMetadata(gid).catch(() => null)
          if (fresh) groupMetadataCache.set(gid, fresh)
        }

        await bienvenidaEventHandler(sock, update)
        await grupoHandler?.eventHandler?.(sock, update)
      } catch (e) {
        logger.error(e, 'group-participants')
      }
    })

    logger.info('🤖 Bot principal estable y listo para subbots')

  } catch (err) {
    logger.error(err, 'Error crítico')
    setTimeout(startBot, 8000)
  }
}

/* ===================== SALIDA LIMPIA ===================== */
process.on('SIGINT', () => {
  console.log('\nCerrando...')
  sock?.end()
  process.exit(0)
})

startBot()
