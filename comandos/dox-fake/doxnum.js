// doxnum.js - INFORMACIÓN PÚBLICA FINAL v6 (sin número visible, solo país por prefijo)
// Compatible con LID y formato moderno de WhatsApp 2026

const isLid = jid => jid?.includes('@lid') || jid?.endsWith('@lid.user')

const extractNumber = jid => {
  if (!jid || isLid(jid)) return null
  const match = jid.match(/^(\d+)@/)
  return match ? match[1] : null
}

const getCountry = num => {
  if (!num) return '—'
  
  const countryMap = {
    '507': '🇵🇦 Panamá',
    '1':   '🇺🇸/🇨🇦 Estados Unidos / Canadá',
    '52':  '🇲🇽 México',
    '53':  '🇨🇺 Cuba',
    '54':  '🇦🇷 Argentina',
    '55':  '🇧🇷 Brasil',
    '56':  '🇨🇱 Chile',
    '57':  '🇨🇴 Colombia',
    '58':  '🇻🇪 Venezuela',
    '501': '🇧🇿 Belice',
    '502': '🇬🇹 Guatemala',
    '503': '🇸🇻 El Salvador',
    '504': '🇭🇳 Honduras',
    '505': '🇳🇮 Nicaragua',
    '506': '🇨🇷 Costa Rica',
    '509': '🇭🇹 Haití',
    '51':  '🇵🇪 Perú',
    '591': '🇧🇴 Bolivia',
    '593': '🇪🇨 Ecuador',
    '595': '🇵🇾 Paraguay',
    '598': '🇺🇾 Uruguay',
    '34':  '🇪🇸 España',
    '44':  '🇬🇧 Reino Unido',
    '60':  '🇲🇾 Malasia',
    '61':  '🇦🇺 Australia',
  }

  for (const [prefix, country] of Object.entries(countryMap)) {
    if (num.startsWith(prefix)) return country
  }
  
  return '🌍 Desconocido'
}

export default {
  name: 'doxnum',
  aliases: ['dox', 'info', 'who', 'usuario', 'doxearwhatsapp'],
  groupOnly: true,
  cooldown: 5,

  async execute(sock, msg, ctx) {
    // Obtener JID del objetivo
    let targetJid = 
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      msg.key.participant ||
      msg.key.remoteJid

    if (!targetJid) {
      return await sock.sendMessage(ctx.jid, {
        text: '⚠️ No se pudo identificar al usuario objetivo'
      }, { quoted: msg })
    }

    const num = extractNumber(targetJid)
    const country = getCountry(num)
    const mention = num ? `@${num}` : '@usuario'
    const isSelf = targetJid === sock.user?.id

    // Foto de perfil
    let avatar = null
    let avatarStatus = 'No disponible / Privada'
    try {
      avatar = await sock.profilePictureUrl(targetJid, 'image')
      avatarStatus = 'Visible'
    } catch {}

    // Estado / Bio
    let bio = 'No visible o privado'
    try {
      const status = await sock.fetchStatus(targetJid)
      if (status?.status) bio = status.status.trim()
    } catch {}

    // Mensaje final
    const text = `🕵️‍♂️ *INFORMACIÓN PÚBLICA*

━━━━━━━━━━━━━━━━━━━━━
👤 *Usuario*     ${mention}
🌍 *País*        ${country}
🤖 *Tipo*        ${isSelf ? 'Tú mismo' : 'Usuario normal'}
━━━━━━━━━━━━━━━━━━━━━

🖼️ *Foto de perfil*  ${avatarStatus}
📝 *Estado actual*
${bio || '— Sin estado —'}

━━━━━━━━━━━━━━━━━━━━━
🔧 *Datos técnicos*
• JID » ${targetJid}
• Chat » ${ctx.jid.endsWith('@g.us') ? 'Grupo' : 'Privado'}

ℹ️ Solo información pública de WhatsApp
🔐 Privacidad respetada al 100%`

    const payload = avatar
      ? { image: { url: avatar }, caption: text, mentions: num ? [targetJid] : [] }
      : { text, mentions: num ? [targetJid] : [] }

    try {
      await sock.sendMessage(ctx.jid, payload, { quoted: msg })
    } catch (err) {
      await sock.sendMessage(ctx.jid, {
        text: `❌ Error al enviar la información\n${err.message.slice(0, 120)}`
      }, { quoted: msg })
    }
  }
}