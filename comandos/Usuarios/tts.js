// comandos/tts.js
// TTS profesional → Nota de voz WhatsApp (PTT / Opus)
// Uso: .tts hola mundo | responder a un mensaje con .tts

import fs from 'fs/promises'
import path from 'path'
import gTTS from 'gtts'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const TMP_DIR = './tmp'
const MAX_TEXT_LENGTH = 500

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
await fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {})

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────
const cleanTemp = async (...files) => {
  for (const f of files) {
    try { await fs.unlink(f) } catch {}
  }
}

const sanitizeText = (text) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()

const detectLanguage = (text) => {
  if (/[áéíóúñ¿¡]/i.test(text)) return 'es'
  if (/[àèìòù]/i.test(text)) return 'it'
  if (/[ç]/i.test(text)) return 'fr'
  return 'es'
}

// 🔥 FUNCIÓN CLAVE: elimina comando y aliases SIEMPRE
function stripCommand(text, command, aliases = []) {
  if (!text) return ''

  const all = [command, ...aliases]
    .filter(Boolean)
    .map(c => c.toLowerCase())

  const lower = text.toLowerCase()

  for (const cmd of all) {
    if (lower === cmd) return ''
    if (lower.startsWith(cmd + ' ')) {
      return text.slice(cmd.length).trim()
    }
  }
  return text
}

// ─────────────────────────────────────────────
// Command
// ─────────────────────────────────────────────
export default {
  name: 'tts',
  aliases: ['voz', 'hablar', 'say', 'audio'],
  description: 'Convierte texto en nota de voz. Ej: .tts hola mundo',
  cooldown: 8,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid

    // 1️⃣ Obtener texto crudo
    let text = ctx.text?.trim() || ctx.fullArgs?.trim() || ''

    // 2️⃣ ELIMINAR comando + aliases (definitivo)
    text = stripCommand(text, ctx.command, [
      'tts', 'voz', 'hablar', 'say', 'audio'
    ])

    // 3️⃣ Si no hay texto → usar mensaje citado
    const quoted =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

    if (!text && quoted) {
      text =
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        ''
    }

    text = sanitizeText(text)

    try {
      if (!text) {
        return ctx.reply({
          text: '📝 Escribe texto después del comando o responde a un mensaje con *.tts*'
        })
      }

      if (text.length > MAX_TEXT_LENGTH) {
        return ctx.reply({
          text: `❌ Texto demasiado largo (máx ${MAX_TEXT_LENGTH} caracteres)`
        })
      }

      await sock.sendMessage(jid, {
        react: { text: '🎤', key: msg.key }
      })
      await sock.sendPresenceUpdate('recording', jid)

      const lang = detectLanguage(text)
      const ts = Date.now()
      const mp3Path = path.join(TMP_DIR, `tts_${ts}.mp3`)
      const opusPath = path.join(TMP_DIR, `tts_${ts}.opus`)

      // ─── Generar MP3 ───
      const tts = new gTTS(text, lang)
      await new Promise((resolve, reject) =>
        tts.save(mp3Path, err => err ? reject(err) : resolve())
      )

      // ─── Convertir a Opus (PTT WhatsApp) ───
      await execAsync(
        `ffmpeg -y -loglevel error -i "${mp3Path}" \
        -c:a libopus -b:a 64k -vbr on -compression_level 10 \
        "${opusPath}"`
      )

      const audioBuffer = await fs.readFile(opusPath)

      // ─── Enviar nota de voz ───
      await sock.sendMessage(
        jid,
        {
          audio: audioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      )

      await sock.sendMessage(jid, {
        react: { text: '✅', key: msg.key }
      })
      await sock.sendPresenceUpdate('available', jid)

      await cleanTemp(mp3Path, opusPath)

    } catch (err) {
      console.error('[TTS ERROR]', err)

      await ctx.reply({
        text:
          '❌ Error generando la nota de voz.\n\n' +
          '• Verifica ffmpeg\n' +
          '• Texto inválido\n' +
          '• Error de gTTS'
      })

      await sock.sendMessage(jid, {
        react: { text: '❌', key: msg.key }
      })
    }
  }
}
