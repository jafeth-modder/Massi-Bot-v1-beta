// subBotManager.js
// Manager FINAL de sub-bots (serbots)

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys'

import pino from 'pino'
import fs from 'fs'
import path from 'path'
import { validateCountry } from './countryRules.js'

const AUTH_BASE = path.resolve('auth-bots')
const subBots = new Map()

const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function createSubBot({
  phone,
  onValidate,
  onCode,
  onReady,
  onFail
}) {
  try {
    const number = phone.replace(/[^0-9]/g, '')

    if (subBots.has(number)) {
      return onFail?.('Este número ya tiene un subbot activo')
    }

    // 🌎 Validar país
    const country = validateCountry(number)
    if (!country.ok) {
      return onFail?.('País no permitido para serbot')
    }

    await onValidate?.(number, country.country)

    // 📂 Auth por número
    const authDir = path.join(AUTH_BASE, number)
    fs.mkdirSync(authDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestWaWebVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false
    })

    sock.ev.on('creds.update', saveCreds)

    let pairingSent = false
    let finished = false

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (finished) return

      // 🔐 Solicitar código
      if (
        connection === 'connecting' &&
        !state.creds.registered &&
        !pairingSent
      ) {
        pairingSent = true

        await sleep(3000)

        try {
          const code = await sock.requestPairingCode(number)
          await onCode?.(code)
        } catch (e) {
          finished = true
          return onFail?.('No se pudo generar el código de vinculación')
        }
      }

      // ✅ Vinculado
      if (connection === 'open') {
        finished = true
        subBots.set(number, sock)
        return onReady?.()
      }

      // ❌ Error / logout
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        finished = true

        if (reason === DisconnectReason.loggedOut) {
          subBots.delete(number)
          return onFail?.('Sesión cerrada o código no confirmado')
        }
      }
    })

  } catch (err) {
    return onFail?.(err?.message || 'Error desconocido al crear serbot')
  }
}

// 📋 Opcional: listar subbots activos
export function listSubBots() {
  return [...subBots.keys()]
}
