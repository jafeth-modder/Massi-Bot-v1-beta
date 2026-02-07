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
  name: 'bienvenida',
  groupOnly: true,

  async execute(sock, msg, ctx) {
    const { jid, args, reply, senderJid, isOwner } = ctx

    // 👮‍♂️ validar admin real
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

    const opt = args[0]

    if (opt === 'on') {
      db[jid].welcome = true
      await saveDB(db)
      return reply('✅ Bienvenida activada')
    }

    if (opt === 'off') {
      db[jid].welcome = false
      await saveDB(db)
      return reply('❌ Bienvenida desactivada')
    }

    if (opt === 'texto') {
      db[jid].description = args.slice(1).join(' ')
      await saveDB(db)
      return reply('📝 Texto de bienvenida actualizado')
    }

    reply(
`Uso:
.bienvenida on
.bienvenida off
.bienvenida texto <mensaje>`
    )
  }
}
