// index.js
import makeWASocket, { useMultiFileAuthState, fetchLatestWaWebVersion } 
from '@whiskeysockets/baileys'
import pino from 'pino'

export async function createSocket(sessionPath, { pairing = false } = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestWaWebVersion()

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    version,
    printQRInTerminal: false,
    markOnlineOnConnect: false
  })

  sock.ev.on('creds.update', saveCreds)

  // ⚠️ SI ES PAIRING → NO CARGAR NADA MÁS
  if (pairing) return sock

  return sock
}
