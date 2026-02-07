// comandos/topgay.js
// Top Gay random del grupo 🌈
// Uso: .topgay

export default {
  name: 'topgay',
  aliases: ['gaytop', 'topgays'],
  description: 'Menciona 3 gays ocultos del grupo (random 😂)',
  cooldown: 20,
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

      if (participants.length < 3) {
        return ctx.reply({ text: '❌ No hay suficientes usuarios para el top.' })
      }

      // Mezclar aleatoriamente
      const shuffled = participants.sort(() => 0.5 - Math.random())

      const selected = shuffled.slice(0, 3)
      const mentions = selected.map(p => p.id)

      const names = selected.map(
        (p, i) => `🥇🥈🥉`.charAt(i) + ` @${p.id.split('@')[0]}`
      )

      const text =
        `🌈 *TOP 3 GAY OCULTOS DEL GRUPO* 🌈\n\n` +
        `Después de una investigación profunda 🕵️‍♂️...\n` +
        `estos usuarios ya no pudieron esconderlo más 😳👇\n\n` +
        `${names.join('\n')}\n\n` +
        `💅 Felicidades, salieron del clóset oficialmente 💅`

      await sock.sendMessage(
        ctx.jid,
        {
          text,
          mentions
        },
        { quoted: msg }
      )

    } catch (err) {
      console.error('[TopGay Error]', err)
      await ctx.reply({ text: '❌ Error ejecutando el top gay.' })
    }
  }
}
