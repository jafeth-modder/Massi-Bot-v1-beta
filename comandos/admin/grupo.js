// comandos/admin/admin.js
// Comandos:
// .promote @usuario
// .demote @usuario

export default {
  name: 'promote',
  aliases: ['demote'],
  description: 'Da o quita admin a un participante',
  groupOnly: true,
  adminOnly: true,
  botMustBeAdmin: true,
  cooldown: 5,

  async execute(sock, msg, ctx) {
    // detectar acción según comando usado
    const accion = ctx.command === 'demote' ? 'demote' : 'promote'

    // obtener menciones
    const mentions =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

    if (!mentions.length) {
      return ctx.reply(
        `Uso:\n` +
        `• ${ctx.prefix}promote @usuario\n` +
        `• ${ctx.prefix}demote @usuario`
      )
    }

    const targetJid = mentions[0]

    try {
      // metadata del grupo
      const meta = await sock.groupMetadata(ctx.jid)
      const groupName = meta.subject || 'este grupo'

      // aplicar acción
      await sock.groupParticipantsUpdate(
        ctx.jid,
        [targetJid],
        accion
      )

      const accionTexto =
        accion === 'promote'
          ? '👑 *ADMIN OTORGADO*'
          : '🚫 *ADMIN RETIRADO*'

      const detalle =
        accion === 'promote'
          ? 'ahora es administrador del grupo.'
          : 'ya no es administrador del grupo.'

      await ctx.send({
        text:
          `${accionTexto}\n\n` +
          `👤 Usuario: @${targetJid.split('@')[0]}\n` +
          `🏷️ Grupo: *${groupName}*\n` +
          `🛠️ Acción por: @${ctx.senderNum}\n`,
        mentions: [targetJid, ctx.senderJid]
      })

    } catch (err) {
      console.error('[admin.js]', err)
      return ctx.reply('❌ No se pudo actualizar el rol del usuario.')
    }
  }
}
