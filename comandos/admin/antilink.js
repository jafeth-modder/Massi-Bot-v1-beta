// comandos/antilink.js
// Activa / desactiva Anti-Link del core (comandos.js)
// Requiere admin u owner

import { antiLinkEnabled } from '../../comandos.js'

export default {
  name: 'antilink',
  aliases: ['nolink', 'antilinks', 'antienlace'],
  description: 'Activa o desactiva el anti-link (3 strikes → expulsión)',
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
          `🔗 *Anti-Link*\n` +
          `Estado: *${antiLinkEnabled.has(groupJid) ? 'ACTIVO' : 'INACTIVO'}*\n\n` +
          `Uso:\n` +
          `• .antilink on\n` +
          `• .antilink off`
      })
    }

    if (arg === 'on') {
      antiLinkEnabled.add(groupJid)
      return ctx.reply({
        text: '✅ Anti-link ACTIVADO\n(3 links → expulsión automática)'
      })
    }

    if (arg === 'off') {
      antiLinkEnabled.delete(groupJid)
      return ctx.reply({
        text: '❌ Anti-link DESACTIVADO'
      })
    }

    return ctx.reply({
      text: '❓ Uso correcto:\n.antilink on | off'
    })
  }
}
