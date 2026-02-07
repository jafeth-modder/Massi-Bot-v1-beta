// comandos/stickerto.js
// Convierte stickers a JPG o video MP4 de 3 segundos

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import {
  downloadMediaMessage,
  getContentType
} from '@whiskeysockets/baileys'

const execAsync = promisify(exec)
const TMP_DIR = './tmp'

await fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {})

/* ================= HELPERS ================= */

const safeDelete = async (...files) => {
  for (const f of files) {
    try { await fs.unlink(f) } catch {}
  }
}

const getQuotedSticker = (msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  if (!ctx?.quotedMessage) return null

  let quoted = ctx.quotedMessage
  const type = getContentType(quoted)

  if (type === 'viewOnceMessageV2' || type === 'viewOnceMessage') {
    quoted = quoted[type].message
  }

  if (!quoted?.stickerMessage) return null

  return {
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant
    },
    message: quoted
  }
}

/* ================= COMMAND ================= */

export default {
  name: 'toimg',
  aliases: ['tovideo', 'jpg', 'mp4', 'unsticker'],
  description: 'Convierte sticker a JPG o video (3 segundos)',
  cooldown: 6,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid
    const quoted = getQuotedSticker(msg)

    if (!quoted) {
      return ctx.reply({
        text: '📌 Responde a un *sticker* para convertirlo a imagen o video'
      })
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🔄', key: msg.key } })

      const buffer = await downloadMediaMessage(
        quoted,
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      )

      const ts = Date.now()
      const input = path.join(TMP_DIR, `sticker_${ts}.webp`)
      await fs.writeFile(input, buffer)

      // Detectar si es animado por la extensión
      const extension = path.extname(input).toLowerCase()

      const isAnimated = extension === '.gif' || extension === '.webp'

      /* ========= STICKER ANIMADO → MP4 (3s) ========= */
      if (isAnimated) {
        const output = path.join(TMP_DIR, `sticker_${ts}.mp4`)

        await execAsync(
          `ffmpeg -y -i "${input}" -t 3 -movflags faststart -pix_fmt yuv420p ` +
          `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15" "${output}"`
        )

        const video = await fs.readFile(output)

        await sock.sendMessage(
          jid,
          { video, mimetype: 'video/mp4' },
          { quoted: msg }
        )

        await safeDelete(input, output)
      }

      /* ========= STICKER ESTÁTICO → JPG ========= */
      else {
        const output = path.join(TMP_DIR, `sticker_${ts}.jpg`)

        await execAsync(
          `ffmpeg -y -i "${input}" -frames:v 1 "${output}"`
        )

        const image = await fs.readFile(output)

        await sock.sendMessage(
          jid,
          { image, mimetype: 'image/jpeg' },
          { quoted: msg }
        )

        await safeDelete(input, output)
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('[StickerTo Error]', err)
      await ctx.reply({ text: '❌ Error convirtiendo el sticker' })
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } })
    }
  }
}
