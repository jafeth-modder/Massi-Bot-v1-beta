import fs from 'fs/promises'
import path from 'path'

const DB = path.join(process.cwd(), 'database', 'bienvenida.json')

const loadDB = async () => {
  try {
    return JSON.parse(await fs.readFile(DB, 'utf8'))
  } catch {
    return {}
  }
}

const saveDB = data =>
  fs.writeFile(DB, JSON.stringify(data, null, 2))

export default {
  name: 'salida',
  aliases: ['bye'],
  groupOnly: true,

  async execute(sock, msg, ctx) {
    const { jid, args, reply, senderJid, isOwner } = ctx

    // ✅ Validar admin real del grupo
    const meta = await sock.groupMetadata(jid)
    const admins = meta.participants
      .filter(p => p.admin)
      .map(p => p.id)

    const isAdmin = admins.includes(senderJid)

    if (!isAdmin && !isOwner) {
      return reply('❌ Solo admins del grupo')
    }

    const db = await loadDB()
    db[jid] ??= {}

    const opt = (args[0] || '').toLowerCase()

    if (opt === 'on') {
      db[jid].bye = true
      await saveDB(db)
      return reply('👋 Salida activada')
    }

    if (opt === 'off') {
      db[jid].bye = false
      await saveDB(db)
      return reply('❌ Salida desactivada')
    }

    if (opt === 'texto') {
      db[jid].byeText = args.slice(1).join(' ')
      await saveDB(db)
      return reply('📝 Texto de salida actualizado')
    }

    reply(
`Uso:
.salida on
.salida off
.salida texto <mensaje>`
    )
  }
}
