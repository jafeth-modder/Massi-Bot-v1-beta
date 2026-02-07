// comandos/sticker.js
// Versión FINAL 2026 – Sticker con texto multilínea + fondos + media respondida
// Limpieza de prefijo ultra-perfecta + preservación de saltos de línea

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import {
  downloadMediaMessage,
  getContentType
} from '@whiskeysockets/baileys'

const execAsync = promisify(exec)

/* ================= CONFIG ================= */
const TMP_DIR = './tmp'
const STICKER_SIZE = 512
const MAX_TEXT_LENGTH = 300
const MAX_VIDEO_SECONDS = 7

/* Fondos disponibles */
const BACKGROUNDS = {
  default: 'black',
  negro: 'black',
  blanco: 'white',
  amarillo: 'yellow',
  rojo: 'red',
  azul: 'blue',
  verde: 'green',
  morado: 'purple',
  rosa: 'pink',
  naranja: 'orange'
}

/* Crear tmp si no existe */
;(async () => {
  try { await fs.mkdir(TMP_DIR, { recursive: true }) } catch {}
})()

/* Helpers */
const safeDelete = async (...files) => {
  for (const f of files) {
    try { await fs.unlink(f) } catch {}
  }
}

const escapeText = (text) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/!/g, '\\!')
    .replace(/\n/g, '\\n')  // Preservar saltos de línea

// Limpieza de prefijo FINAL – elimina cualquier variante y evita cortes
const stripStickerPrefix = (text = '') => {
  if (!text) return ''

  // Quitar prefijo + cualquier cosa después hasta el primer espacio o fin
  text = text.replace(/^[.!\/\-*]?s\s*/i, '').trim()

  // Quitar variantes comunes al inicio
  text = text.replace(/^(sticker|stick|stiker|pegatina|s)\s*/i, '').trim()

  // Quitar corchetes/paréntesis/llaves pegadas
  text = text.replace(/^[\[\({]/, '').replace(/[\]\)}]$/, '').trim()

  // Quitar "s " repetido o prefijo suelto (hasta 2 veces)
  text = text.replace(/^s\s+/i, '').trim()
  text = text.replace(/^s\s+/i, '').trim()

  // Quitar cualquier cosa no deseada al inicio (último recurso)
  text = text.replace(/^\W{1,5}\s*/, '').trim()

  return text
}

const extractQuoted = (msg) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  if (!ctx?.quotedMessage) return null

  let quoted = ctx.quotedMessage
  const type = getContentType(quoted)

  if (type === 'viewOnceMessageV2' || type === 'viewOnceMessage') {
    quoted = quoted[type].message
  }

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

/* ========================================== */

export default {
  name: 'sticker',
  aliases: ['s', 'stick', 'stiker', 'pegatina'],
  description: 'Crea stickers desde texto multilínea o media (fondos: rojo, azul, etc.)',
  cooldown: 6,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid
    let fullText = stripStickerPrefix(ctx.fullArgs || ctx.body || '')
    const quotedMsg = extractQuoted(msg)

    try {
      await sock.sendMessage(jid, { react: { text: '🖼️', key: msg.key } })
      await sock.sendPresenceUpdate('composing', jid)

      let stickerBuffer

      /* ========= STICKER TEXTO (multilínea corregida) ========= */
      if (fullText && !quotedMsg) {
        if (fullText.length > MAX_TEXT_LENGTH) {
          return ctx.reply({
            text: `❌ Texto demasiado largo (máx ${MAX_TEXT_LENGTH} caracteres)`
          })
        }

        const ts = Date.now()
        const png = path.join(TMP_DIR, `text_${ts}.png`)
        const webp = path.join(TMP_DIR, `sticker_${ts}.webp`)

        // Detectar fondo
        let bgColor = 'black'
        const firstWord = fullText.split(' ')[0].toLowerCase()
        if (BACKGROUNDS[firstWord]) {
          bgColor = BACKGROUNDS[firstWord]
          fullText = fullText.slice(firstWord.length).trim()
        }

        // Escapar y preservar multilínea
        const escapedText = escapeText(fullText)

        const drawCmd = `
ffmpeg -y \
-f lavfi -i color=c=${bgColor}:s=${STICKER_SIZE}x${STICKER_SIZE} \
-vf "drawtext=text='${escapedText}':fontcolor=white:fontsize=48:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.4:boxborderw=5" \
-frames:v 1 -update 1 ${png}
        `.trim()

        await execAsync(drawCmd)

        const convertCmd = `
ffmpeg -y -i ${png} \
-vf scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease \
${webp}
        `.trim()

        await execAsync(convertCmd)

        stickerBuffer = await fs.readFile(webp)
        await safeDelete(png, webp)
      }

      /* ========= STICKER MEDIA ========= */
      else if (quotedMsg) {
        let buffer
        try {
          buffer = await downloadMediaMessage(
            quotedMsg,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
          )
        } catch {
          return ctx.reply({ text: '❌ No se pudo descargar el media' })
        }

        const ts = Date.now()
        const input = path.join(TMP_DIR, `input_${ts}`)
        const output = path.join(TMP_DIR, `sticker_${ts}.webp`)

        await fs.writeFile(input, buffer)

        await execAsync(`
ffmpeg -y -i ${input} \
-vf "scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease,fps=15" \
-t ${MAX_VIDEO_SECONDS} -an -vsync 0 \
${output}
        `.trim())

        stickerBuffer = await fs.readFile(output)
        await safeDelete(input, output)
      }

      /* ========= USO ========= */
      else {
        return ctx.reply({
          text:
            '📌 *Uso del sticker*\n\n' +
            '• `.s Hola\nmundo` → texto en dos líneas\n' +
            '• `.s rojo Hola\namigo` → fondo rojo + multilínea\n' +
            '• `.s azul Prueba épica` → fondo azul\n' +
            '• `.s` respondiendo imagen / GIF / video → convertir'
        })
      }

      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg })
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } })
      await sock.sendPresenceUpdate('available', jid)

    } catch (err) {
      console.error('[Sticker Error]', err)
      await ctx.reply({
        text: '❌ Error creando el sticker.\n\n' +
              'Prueba con texto más simple.\n' +
              'Si persiste, ejecuta "ffmpeg -version" y dime qué sale.'
      })
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } })
    }
  }
}