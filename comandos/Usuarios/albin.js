// comandos/albin.php
// ALBIN TTS — ultra chillón, gracioso y 100% compatible con Termux ✅

import fs from 'fs/promises'
import path from 'path'
import gTTS from 'gtts'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const TMP_DIR = './tmp'
const MAX_TEXT_LENGTH = 500

await fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {})

/* ========= UTILS ========= */

const cleanTemp = async (...files) => {
  for (const f of files) {
    try { await fs.unlink(f) } catch {}
  }
}

const sanitizeText = (t = '') =>
  t.replace(/\s+/g, ' ').trim()

const detectLanguage = (text) =>
  /[áéíóúñ¿¡]/i.test(text) ? 'es' : 'en'

function stripCommand(text, command, aliases = []) {
  if (!text) return ''
  const all = [command, ...aliases]
    .map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return text.replace(new RegExp(`^\\.?(?:${all})\\s*`, 'i'), '').trim()
}

/* ========= COMMAND ========= */

export default {
  name: 'albin',
  aliases: ['gracioso', 'ardilla', 'chipmunk', 'tts_albin'],
  description: 'ALBIN ultra chillón 🤣',
  cooldown: 8,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid

    let text =
      ctx.text?.trim() ||
      ctx.fullArgs?.trim() ||
      ''

    text = stripCommand(text, ctx.command, this.aliases)

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
          text: '😂🐿️ ¡ALBIN QUIERE TEXTO! escribe algo'
        })
      }

      if (text.length > MAX_TEXT_LENGTH) {
        return ctx.reply({
          text: '❌ Muy largo… Albin se queda sin aire 🤯'
        })
      }

      await sock.sendMessage(jid, {
        react: { text: '😆', key: msg.key }
      })

      await sock.sendPresenceUpdate('recording', jid)

      const lang = detectLanguage(text)
      const ts = Date.now()
      const mp3Path = path.join(TMP_DIR, `albin_${ts}.mp3`)
      const opusPath = path.join(TMP_DIR, `albin_${ts}.opus`)

      const tts = new gTTS(text, lang)
      await new Promise((res, rej) =>
        tts.save(mp3Path, err => err ? rej(err) : res())
      )

      // 🔊 EFECTO ALBIN (UNA SOLA LÍNEA — TERMUX SAFE)
      const ffmpegCmd =
  `ffmpeg -y -loglevel error -i "${mp3Path}" ` +
  `-af "asetrate=44100*1.14,aresample=44100,atempo=0.5,highpass=f=500,lowpass=f=9500,volume=2.0,acrusher=bits=10:mix=0.15" ` +
  `-c:a libopus -b:a 64k -vbr on -compression_level 10 "${opusPath}"`

      await execAsync(ffmpegCmd)

      const audio = await fs.readFile(opusPath)

      await sock.sendMessage(
        jid,
        {
          audio,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        },
        { quoted: msg }
      )

      await sock.sendMessage(jid, {
        react: { text: '🤣', key: msg.key }
      })

      await sock.sendPresenceUpdate('available', jid)
      await cleanTemp(mp3Path, opusPath)

    } catch (e) {
      console.error('[ALBIN ERROR]', e)
      await ctx.reply({
        text: '❌ Albin gritó tan fuerte que rompió el micrófono 😭'
      })
    }
  }
}
