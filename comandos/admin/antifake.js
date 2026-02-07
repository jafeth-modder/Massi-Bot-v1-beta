import { antiSpamEnabled, isOwner } from '../../comandos.js'

export default {
  name: 'antifake',
  aliases: ['antifakes', 'antipaíses', 'antibasura'],
  groupOnly: true,
  cooldown: 0,

  async execute(sock, msg, ctx) {
    const { jid, args, reply } = ctx
    const opt = (args[0] || '').toLowerCase()

    let isAdmin = isOwner(msg)
    if (!isAdmin) {
      const meta = await sock.groupMetadata(jid).catch(() => null)
      if (meta) {
        isAdmin = meta.participants.some(p => p.admin && p.id === msg.key.participant)
      }
    }

    if (!isAdmin) return reply('❌ Solo admins/owner')

    if (!['on','off','status'].includes(opt)) {
      return reply('Uso:\n.antifake on\n.antifake off\n.antispam status')
    }

    if (opt === 'on') {
      antiSpamEnabled.add(jid)
      return reply('🛡️ Anti-spam / anti-fakes ACTIVADO\nBloquea: +51, +91, +92, +234, +7, +34, etc.')
    }

    if (opt === 'off') {
      antiSpamEnabled.delete(jid)
      return reply('❌ Anti-spam DESACTIVADO')
    }

    reply(antiSpamEnabled.has(jid) ? '🟢 ACTIVADO' : '🔴 DESACTIVADO')
  }
}