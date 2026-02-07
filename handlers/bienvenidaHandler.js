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

// 🔐 normaliza participante (string u objeto)
const getJid = p => {
  if (!p) return null
  if (typeof p === 'string') return p
  if (typeof p === 'object') return p.id || null
  return null
}

export async function bienvenidaEventHandler(sock, update) {
  const { id, participants, action } = update
  if (!participants || !Array.isArray(participants)) return

  const db = await loadDB()
  const conf = db[id]
  if (!conf) return

  // 📸 foto del grupo
  let groupImage = null
  try {
    groupImage = await sock.profilePictureUrl(id, 'image')
  } catch {}

  // 👥 metadata
  const meta = await sock.groupMetadata(id).catch(() => null)
  const total = meta?.participants?.length || 0

  for (const p of participants) {
    const userJid = getJid(p)
    if (!userJid) continue

    const mention = userJid.split('@')[0]

    /* ===== BIENVENIDA ===== */
    if (action === 'add' && conf.welcome) {
      await sock.sendMessage(id, {
        image: groupImage ? { url: groupImage } : undefined,
        caption:
          `👋 *Bienvenido* @${mention}\n\n` +
          `${conf.description || '> 📌 Respeta las reglas del grupo'}\n\n\n` +
           `> 🔰Usa:\n.menu para ver mis comandos \n\n` +
          `> 👥 *Miembros actuales:* ${total}`,
        mentions: [userJid]
      }).catch(() => {})
    }

    /* ===== SALIDA ===== */
    if ((action === 'remove' || action === 'leave') && conf.bye) {
      const byeMsg =
        conf.byeText ||
        `👋 *@${mention}* salió del grupo\n\nUn Gay menos en el grupo\n Miembros actuales:* ${total} `

      await sock.sendMessage(id, {
        image: groupImage ? { url: groupImage } : undefined,
        caption: byeMsg,
        mentions: [userJid]
      }).catch(() => {})
    }
  }
}
