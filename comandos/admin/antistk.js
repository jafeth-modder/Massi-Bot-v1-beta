// comandos/antistk.js
// Activa / desactiva Anti-Sticker del core (comandos.js)
// Requiere admin u owner

import { antiStickerEnabled } from '../../comandos.js'

export default {
  name: 'antistk',
  aliases: ['antisticker', 'nosticker', 'artistk'],
  description: 'Activa o desactiva el anti-sticker (3 strikes → expulsión)',
  cooldown: 5,
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, ctx) {
    if (!ctx.isGroup) {
      return ctx.reply({ text: '🚫 Este comando solo funciona en grupos.' })
    }

    const groupJid = ctx.jid
    const arg = (ctx.args[0] || '').toLowerCase()

    if (!arg) {
      return ctx.reply({
        text:
          `🛡️ *Anti-Sticker*\n` +
          `Estado: *${antiStickerEnabled.has(groupJid) ? 'ACTIVO' : 'INACTIVO'}*\n\n` +
          `Uso:\n` +
          `• .antistk on\n` +
          `• .antistk off`
      })
    }

    if (arg === 'on') {
      antiStickerEnabled.add(groupJid)
      return ctx.reply({
        text: '✅ Anti-sticker ACTIVADO\n(3 stickers → expulsión automática)'
      })
    }

    if (arg === 'off') {
      antiStickerEnabled.delete(groupJid)
      return ctx.reply({
        text: '❌ Anti-sticker DESACTIVADO'
      })
    }

    return ctx.reply({
      text: '❓ Uso correcto:\n.antistk on | off'
    })
  }
}
