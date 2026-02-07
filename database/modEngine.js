import fs from 'fs/promises'
import path from 'path'
import { jidToNum, OWNERS } from '../comandos.js'

const DATA_FILE = path.join(process.cwd(), 'database/warns.json')
let warns = new Map()

/* ================= LOAD ================= */
async function loadWarns() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    warns = new Map(JSON.parse(raw))
  } catch {
    warns = new Map()
  }
}

async function saveWarns() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify([...warns]), 'utf8')
}

await loadWarns()

/* ================= HELPERS ================= */
export const canModerate = ({ admins, senderJid, botJid, isOwner }) => {
  if (isOwner) return true
  if (!admins.has(senderJid)) return false
  if (!admins.has(botJid)) return false
  return true
}

export const canTarget = ({ user, senderJid, admins, botJid }) => {
  if (user === senderJid) return false
  if (user === botJid) return false
  if (admins.has(user)) return false
  if (OWNERS.has(jidToNum(user))) return false
  return true
}

/* ================= WARNS ================= */
export const addWarn = async (user, reason) => {
  const data = warns.get(user) || []
  data.push({ reason, time: Date.now() })
  warns.set(user, data)
  await saveWarns()
  return data.length
}

export const getWarns = user => warns.get(user) || []

export const resetWarns = async user => {
  warns.delete(user)
  await saveWarns()
}

/* ================= KICK ================= */
export const doKick = async (sock, jid, user) => {
  await sock.groupParticipantsUpdate(jid, [user], 'remove')
}
