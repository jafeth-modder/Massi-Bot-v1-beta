// eliminar.js — ANTI FAKE KICK (VERIFICADO)

export default {
  name: 'eliminar',
  aliases: ['kick'],
  groupOnly: true,

  async execute(sock, msg, ctx) {
    const { jid, args, reply, senderJid, isOwner } = ctx

    // ================= METADATA INICIAL =================
    const meta = await sock.groupMetadata(jid)
    const participants = meta.participants

    const admins = participants.filter(p => p.admin).map(p => p.id)
    const isAdmin = admins.includes(senderJid)

    if (!isAdmin && !isOwner) {
      return reply('❌ Solo admins del grupo')
    }

    const cleanNum = j =>
      j?.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')

    // ================= TARGETS SOLICITADOS =================
    let requested = (
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    ).map(cleanNum)

    args.forEach(arg => {
      const n = arg.replace(/\D/g, '')
      if (n.length >= 8 && n.length <= 15) requested.push(n)
    })

    requested = [...new Set(requested)]

    if (!requested.length) {
      return reply('⚠️ Debes mencionar o escribir un número')
    }

    // ================= TARGETS REALES DEL GRUPO =================
    const kickIds = []
    const nameMap = {}

    participants.forEach(p => {
      const n = cleanNum(p.id)
      if (requested.includes(n) && !p.admin) {
        kickIds.push(p.id) // ID REAL
        nameMap[n] = p.notify || p.name || 'Usuario'
      }
    })

    if (!kickIds.length) {
      return reply('⚠️ No se pudo eliminar (admin o no está en el grupo)')
    }

    // ================= KICK =================
    try {
      await sock.groupParticipantsUpdate(jid, kickIds, 'remove')
    } catch {}

    // ⏳ esperar a WhatsApp
    await new Promise(r => setTimeout(r, 1500))

    // ================= VERIFICAR =================
    const metaAfter = await sock.groupMetadata(jid)
    const stillInGroup = metaAfter.participants.map(p => cleanNum(p.id))

    const removed = []
    const failed = []

    kickIds.forEach(j => {
      const n = cleanNum(j)
      if (!stillInGroup.includes(n)) removed.push(n)
      else failed.push(n)
    })

    // ================= RESPUESTA REAL =================
    let text = ''

    if (removed.length) {
      text +=
        '✅ Usuario(s) eliminado(s):\n' +
        removed.map(n => `• ${nameMap[n]})`).join('\n')
    }

    if (failed.length) {
      text +=
        (text ? '\n\n' : '') +
        '⚠️ No se pudo eliminar:\n' +
        failed.map(n => `• @${n}`).join('\n')
    }

    await reply({
      text,
      mentions: [...removed, ...failed].map(n => `${n}@s.whatsapp.net`)
    })
  }
}
