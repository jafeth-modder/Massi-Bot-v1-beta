// comandos/bot.js
// Activa / desactiva Bot Talk por grupo

import fs from 'fs/promises'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'bot_groups.json')

// grupos con Bot Talk activo
let enabledGroups = new Set()

/* ================= LOAD / SAVE ================= */

async function load() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    enabledGroups = new Set(data)
  } catch {
    enabledGroups = new Set()
  }
}

async function save() {
  try {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify([...enabledGroups], null, 2)
    )
  } catch {}
}

// cargar al iniciar
await load()

// 🔹 exportado para handlers
export const botTalkEnabled = enabledGroups

/* ================= COMANDO ================= */

export default {
  name: 'bot',
  aliases: ['botchat', 'talkbot'],
  description: 'Activa o desactiva las respuestas automáticas del bot',
  groupOnly: true,
  adminOnly: true,
  cooldown: 3,

  async execute(sock, msg, ctx) {
    const arg = (ctx.args[0] || '').toLowerCase()
    const jid = ctx.jid

    // mostrar estado
    if (!arg) {
      return ctx.reply({
        text:
          `🤖 *BOT TALK*\n\n` +
          `Estado: *${enabledGroups.has(jid) ? 'ACTIVO ✅' : 'INACTIVO ❌'}*\n\n` +
          `Uso:\n` +
          `• .bot on  → activar\n` +
          `• .bot off → desactivar`
      })
    }

    // activar
    if (arg === 'on') {
      enabledGroups.add(jid)
      await save()
      return ctx.reply({
        text:
          '✅ *Bot Talk ACTIVADO*\n' +
          'Ahora responderé automáticamente según lo configurado.'
      })
    }

    // desactivar
    if (arg === 'off') {
      enabledGroups.delete(jid)
      await save()
      return ctx.reply({
        text:
          '❌ *Bot Talk DESACTIVADO*\n' +
          'Ya no responderé mensajes automáticos.'
      })
    }

    return ctx.reply({
      text: '❓ Uso correcto:\n.bot on | off'
    })
  }
}
