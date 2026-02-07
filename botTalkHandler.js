// botTalkHandler.js – FINAL LIMPIO SIN IMPORTS CIRCULARES

import fs from 'fs/promises'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'bot_respuestas.json')

let config = null
let lastResponse = new Map()

async function loadConfig() {
  if (!config) {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    config = JSON.parse(raw)
  }
}

const normalize = text =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const random = arr => arr[Math.floor(Math.random() * arr.length)]

export async function botTalkHandler(sock, msg, botTalkEnabled) {
  try {
    const jid = msg.key?.remoteJid
    if (!jid || !jid.endsWith('@g.us')) return
    if (!botTalkEnabled?.has(jid)) return

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text

    if (!text) return
    if (/^[./!]/.test(text.trim())) return

    const cleanText = normalize(text)
    if (cleanText.length > 60) return

    const now = Date.now()
    if (lastResponse.has(jid) && now - lastResponse.get(jid) < 6000) return

    await loadConfig()

    for (const block of config?.qa || []) {
      if (block.keys?.some(k => cleanText.includes(normalize(k)))) {
        lastResponse.set(jid, now)
        return sock.sendMessage(jid, { text: random(block.respuestas) })
      }
    }

    if (cleanText.length < 25 && config?.default?.length) {
      lastResponse.set(jid, now)
      return sock.sendMessage(jid, { text: random(config.default) })
    }
  } catch {}
}
