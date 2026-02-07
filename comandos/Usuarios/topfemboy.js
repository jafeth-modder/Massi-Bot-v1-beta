export default {
  name: 'topfemboy',
  aliases: ['tipgay', 'topfem'],
  groupOnly: true,
  cooldown: 10,

  async execute(sock, msg, ctx) {
    const { jid, reply, isGroup } = ctx
    if (!isGroup) return

    const meta = await sock.groupMetadata(jid).catch(() => null)
    if (!meta?.participants?.length) {
      return reply('❌ No pude leer los participantes.')
    }

    let ids = meta.participants.map(p => p.id).filter(Boolean)

    // Quitar bot
    const botJid = sock?.user?.id
    if (botJid) ids = ids.filter(id => id !== botJid)

    if (ids.length < 5) {
      return reply('😅 Necesito al menos 5 personas para esta investigación.')
    }

    // Mezclar y tomar 5
    ids.sort(() => Math.random() - 0.5)
    const top = ids.slice(0, 5)

    const mentions = top
    const tag = jid => `@${jid.split('@')[0]}`

    const descripciones = [
      'este femboy se pone en la esquina por las noches y por eso en el día siempre tiene dinero 💸',
      'aparenta ser tímido, pero cuando nadie mira es peligroso 😳',
      'dice que solo sale a comprar pan, pero vuelve a las 3 a.m. sospechosamente feliz 🌙',
      'no trabaja, no estudia… pero nunca anda limpio de bolsillo 💅',
      'dice “voy y vengo” y desaparece medio día y regresa en una camioneta feliz y la camioneta lo maneja un negro✨',
      'demasiado bonito para ser inocente 🪞',
      'siempre huele rico y nadie sabe por qué 🌸',
      'vive diciendo que es tranquilo e inocente… nadie le cree 😌'
    ]

    let texto = `🕵️‍♂️ *INFORME CONFIDENCIAL* 🕵️‍♂️\n`
    texto += `Después de una profunda investigación he detectado *5 femboy* en este grupo.\n`
    texto += `Aquí les dejo la *TOP LISTA OFICIAL*:\n\n`

    top.forEach((u, i) => {
      const desc = descripciones[Math.floor(Math.random() * descripciones.length)]
      texto += `${i + 1}. ${tag(u)} — ${desc}\n\n`
    })

    texto += `📌 *Este informe es 100% real, verificado y nada inventado.*`

    await sock.sendMessage(
      jid,
      { text: texto, mentions },
      { quoted: msg }
    )
  }
}
