// pair.js – FIXED 515 + edge Baileys (febrero 2026)

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys'

import fs from 'fs'
import path from 'path'
import pino from 'pino'

const number = process.argv[2]

if (!number || !/^[0-9]{8,15}$/.test(number)) {
  console.log('ERROR:INVALID_NUMBER')
  process.exit(1)
}

const BASE_DIR = './auth/subbot'
const AUTH_DIR = path.join(BASE_DIR, number)

// Borra auth automáticamente si existe (para forzar pairing limpio)
if (fs.existsSync(AUTH_DIR)) {
  console.log(`Borrando auth corrupta previa para ${number}...`)
  fs.rmSync(AUTH_DIR, { recursive: true, force: true })
}
fs.mkdirSync(AUTH_DIR, { recursive: true })

async function startPair(attempt = 1) {
  const MAX_ATTEMPTS = 4
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Chrome', 'Chrome', '131.0.0.0'], // versión alta para 2026
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 90000,
      shouldSyncHistoryMessage: () => false // evita sync que causa 515 en algunos casos
    })

    sock.ev.on('creds.update', saveCreds)

    let pairingRequested = false

    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        console.log(`READY:${number}`)
        setTimeout(() => {
          sock.end()
          process.exit(0)
        }, 15000) // más margen para creds
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        console.log(`CLOSE:${number}:${statusCode || 'unknown'}`)

        if (statusCode === DisconnectReason.loggedOut) {
          console.log(`LOGOUT:${number}`)
          process.exit(1)
        } else if (statusCode === 515) {
          console.log(`515 DETECTADO → auth corrupta o rate-limit. Reintentando (${attempt}/${MAX_ATTEMPTS})...`)
          if (attempt < MAX_ATTEMPTS) {
            const delay = 10000 * attempt // 10s, 20s, 30s...
            setTimeout(() => startPair(attempt + 1), delay)
          } else {
            console.log('Máximo intentos alcanzado. Espera 10-30 min (rate-limit posible) o cambia IP.')
            process.exit(1)
          }
        } else {
          process.exit(1)
        }
      }

      // Mejor trigger: usa qr o connecting
      if ((update.qr || connection === 'connecting') && !state.creds.registered && !pairingRequested) {
        pairingRequested = true
        await new Promise(r => setTimeout(r, 8000)) // espera handshake completo

        try {
          const code = await sock.requestPairingCode(number)
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code
          console.log(`PAIR:${number}:${formatted}`)
        } catch (e) {
          console.log(`ERROR:PAIR_FAILED:${e.message || e}`)
          sock.end()
          process.exit(1)
        }
      }
    })
  } catch (err) {
    console.log(`ERROR:CRITICAL:${err.message || err}`)
    process.exit(1)
  }
}

startPair().catch(err => console.error('FATAL:', err))