
export default {
  name: 'bañate',
  aliases: ['banate', 'ducha', 'apestate'],
  description: 'Menciona 2 usuarios que necesitan bañarse 😂',
  cooldown: 15,
  groupOnly: true,

  async execute(sock, msg, ctx) {
    if (!ctx.isGroup) {
      return ctx.reply({ text: '🚫 Este comando solo funciona en grupos.' })
    }

    try {
      const meta = await sock.groupMetadata(ctx.jid)
      let participants = meta.participants || []

      // Quitar al bot
      participants = participants.filter(p => p.id !== sock.user?.id)

      if (participants.length < 2) {
        return ctx.reply({ text: '❌ No hay suficientes usuarios para esto 😂' })
      }

      // Mezclar aleatoriamente
      const shuffled = participants.sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, 2)

      const u1 = selected[0].id
      const u2 = selected[1].id

      const text = `
🧼🚿 *ALERTA DE HIGIENE* 🚿🧼

🤢 *Este usuario tiene 4 días sin bañarse:*
👉 @${u1.split('@')[0]}

😷 *Este usuario le está haciendo la competencia con 3 días sin visitar el baño:*
👉 @${u2.split('@')[0]}

💦 ¡Por favor, una duchita no hace daño!
      `.trim()

      await sock.sendMessage(
        ctx.jid,
        {
          text,
          mentions: [u1, u2]
        },
        { quoted: msg }
      )

    } catch (err) {
      console.error('[Bañate Error]', err)
      await ctx.reply({
        text: '❌ Error ejecutando el comando bañate.'
      })
    }
  }
}
