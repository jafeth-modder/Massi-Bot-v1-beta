// comandos/biblia.js
// Biblia random 😂📖
// Uso: .biblia

export default {
  name: 'biblia',
  aliases: ['lee', 'oracion', 'rezar'],
  description: 'Menciona 3 usuarios que no leen la biblia 😂',
  cooldown: 20,
  groupOnly: true,

  async execute(sock, msg, ctx) {
    if (!ctx.isGroup) {
      return ctx.reply({ text: '🚫 Este comando solo funciona en grupos.' })
    }

    try {
      const meta = await sock.groupMetadata(ctx.jid)
      let participants = meta.participants || []

      // Quitar bot
      participants = participants.filter(p => p.id !== sock.user?.id)

      if (participants.length < 3) {
        return ctx.reply({ text: '❌ No hay suficientes usuarios para este mensaje 🙏' })
      }

      // Random
      const shuffled = participants.sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, 3)

      const u1 = selected[0].id
      const u2 = selected[1].id
      const u3 = selected[2].id

      const text = `
📖🙏 *MENSAJE URGENTE MIS AMADOS HERMAN@S* 🙏📖

😇 *Estos usuarios no leen la Biblia…*
pero para andar pensando en:

💔 El amor que tu ex te prometió\nY luego te montó los cachos  
⏰ Ahí sí tienen tiempo de sobra...

👇 Los señalados de hoy son:

👉 @${u1.split('@')[0]}
👉 @${u2.split('@')[0]}
👉 @${u3.split('@')[0]}

📜 *Versículo perdido:*  
“Busca de Dios y no de tu ex\nEllameAma 3:13” 😌🙏
      `.trim()

      await sock.sendMessage(
        ctx.jid,
        {
          text,
          mentions: [u1, u2, u3]
        },
        { quoted: msg }
      )

    } catch (err) {
      console.error('[Biblia Error]', err)
      await ctx.reply({
        text: '❌ Error ejecutando el comando biblia.'
      })
    }
  }
}
