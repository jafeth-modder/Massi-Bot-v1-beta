// comandos/verunavez.js – FINAL DEFINITIVO 2026
// View Once → reenviar desde memoria (1 solo mensaje + reacción ✌️)

import {
  downloadMediaMessage,
  downloadContentFromMessage,
  getContentType
} from '@whiskeysockets/baileys'

export default {
  name: 'ver',
  aliases: ['veruna', 'verunavez', 'vo', 'rever', 'viewonce'],
  description: 'Reenvía View Once citado (1 solo mensaje)',
  cooldown: 5,

  async execute(sock, msg, { reply, jid }) {
    const quotedCtx = msg.message?.extendedTextMessage?.contextInfo
    if (!quotedCtx?.quotedMessage) {
      return reply('→ Responde a una imagen o video *View Once*')
    }

    const quotedMsg = quotedCtx.quotedMessage
    let realContent = null

    const wrappers = [
      quotedMsg.viewOnceMessage?.message,
      quotedMsg.viewOnceMessageV2?.message,
      quotedMsg.viewOnceMessageV2Extension?.message,
      quotedMsg
    ]

    for (const w of wrappers) {
      if (w && getContentType(w)) {
        realContent = w
        break
      }
    }

    if (!realContent) {
      return reply('→ No se detectó media View Once válida')
    }

    const type = getContentType(realContent)
    if (!['imageMessage', 'videoMessage'].includes(type)) {
      return reply('→ Solo imágenes o videos')
    }

    const media = realContent[type]
    if (!media?.mediaKey) {
      return reply('→ View Once expirado o ya abierto')
    }

    try {
      let buffer

      try {
        buffer = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          { reuploadRequest: sock.updateMediaMessage }
        )
      } catch (err) {
        if (err.message?.includes('media key') || err.message?.includes('derive')) {
          const stream = await downloadContentFromMessage(
            media,
            type === 'imageMessage' ? 'image' : 'video'
          )
          const chunks = []
          for await (const chunk of stream) chunks.push(Buffer.from(chunk))
          buffer = Buffer.concat(chunks)
        } else {
          throw err
        }
      }

      // 👉 UN SOLO MENSAJE (media + texto)
      await sock.sendMessage(
        jid,
        type === 'imageMessage'
          ? { image: buffer, caption: 'Reenviado correctamente ✓' }
          : { video: buffer, caption: 'Reenviado correctamente ✓' },
        { quoted: msg }
      )

      // 👉 Reacción al comando del usuario
      await sock.sendMessage(jid, {
        react: {
          text: '✌️',
          key: msg.key
        }
      })

    } catch (err) {
      console.error('[VERUNAVEZ ERROR]', err)
      await reply('❌ Error al procesar el View Once')
    }
  }
}
