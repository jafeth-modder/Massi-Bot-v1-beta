// comandos/todos.js
// Menciona a TODOS los participantes del grupo (solo admins / owner)
// Uso: .todos [mensaje opcional]

/* ===================== CONFIG ===================== */
const CONFIG = {
  EMOJIS: {
    start: '📣',
    end: '✅',
    deny: '🚫',
    alert: '🔔'
  },
  TITLE: 'MENCIÓN GENERAL',
  DEFAULT_MESSAGE: 'Por favor, atentos al aviso.',
  FOOTER: '*Massi Bot MD*'
}

/* ===================== HELPERS ===================== */
const normalizeJid = jid =>
  jid?.split('@')[0]?.split(':')[0]

export default {
  name: 'todos',
  aliases: ['mencionar', 'everyone', 'all', 'alerta', 'tagall'],
  description: 'Menciona a todos los participantes del grupo (solo admins)',
  cooldown: 10,
  groupOnly: true,

  async execute(sock, msg, ctx) {
    if (!ctx.isGroup) {
      return ctx.reply({ text: '🚫 Este comando solo funciona en grupos.' })
    }

    try {
      /* ===================== METADATA ===================== */
      const groupMeta = await sock.groupMetadata(ctx.jid)
      const participants = groupMeta.participants || []

      if (!participants.length) {
        return ctx.reply({ text: '❌ No se pudieron obtener los participantes.' })
      }

      /* ===================== ADMINS REALES ===================== */
      const admins = participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => normalizeJid(p.id))

      // 🔑 USAR SIEMPRE participant REAL
      const realSenderJid =
        msg.key.participant || msg.key.remoteJid

      const senderNum = normalizeJid(realSenderJid)

      const isAdmin =
        ctx.isOwner || admins.includes(senderNum)

      if (!isAdmin) {
        await sock.sendMessage(ctx.jid, {
          react: { text: CONFIG.EMOJIS.deny, key: msg.key }
        })
        return ctx.reply({
          text: '🔒 Solo administradores u owner pueden usar este comando.'
        })
      }

      /* ===================== REACCIÓN INICIAL ===================== */
      await sock.sendMessage(ctx.jid, {
        react: { text: CONFIG.EMOJIS.start, key: msg.key }
      })

      await sock.sendPresenceUpdate('composing', ctx.jid)

      /* ===================== MENSAJE ===================== */
      const customMessage = ctx.args?.length
        ? ctx.args.join(' ')
        : CONFIG.DEFAULT_MESSAGE

      const mentions = participants.map(p => p.id)

      const mentionLines = participants
        .map(p => `• @${normalizeJid(p.id)}`)
        .join('\n')

      const messageText =
`╭━━━〔 📢 ${CONFIG.TITLE} 〕━━━╮
┃
┃ 👥 *Grupo:* ${groupMeta.subject || 'Sin nombre'}
┃ ${CONFIG.EMOJIS.alert} *Aviso:*
┃ ${customMessage}
┃
┣━━━〔 👤 Participantes 〕━━━┫
${mentionLines}
┃
╰━━━〔 ✔️ Oficial 〕━━━╯
🧾 ${CONFIG.FOOTER}
👤 Enviado por: @${senderNum}`

      /* ===================== QUOTED ESTATUS VERIFICADO ===================== */
      const quotedStatus = {
        key: {
          remoteJid: 'status@broadcast',
          fromMe: false,
          id: 'STATUS-VERIFIED'
        },
        message: {
          extendedTextMessage: {
            text: '📢 Aviso oficial verificado'
          }
        }
      }

      /* ===================== ENVÍO ===================== */
      await sock.sendMessage(
        ctx.jid,
        {
          text: messageText,
          mentions
        },
        { quoted: quotedStatus }
      )

      /* ===================== REACCIÓN FINAL ===================== */
      await sock.sendMessage(ctx.jid, {
        react: { text: CONFIG.EMOJIS.end, key: msg.key }
      })

      await sock.sendPresenceUpdate('available', ctx.jid)

    } catch (err) {
      console.error('[todos.js]', err)
      await ctx.reply({
        text:
          '❌ Error al mencionar a todos.\n' +
          'Asegúrate de que el bot sea admin del grupo.'
      })
    }
  }
}
