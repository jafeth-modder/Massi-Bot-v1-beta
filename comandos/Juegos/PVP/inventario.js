// INVENTARIO FINAL BLINDADO 2026
// Compatible con RETOS / PELEAS / RW
// Uso: .inventario | .inventario @usuario

import fs from 'fs/promises'
import path from 'path'

/* ===================== RUTA ===================== */
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')

/* ===================== HELPERS ===================== */

// Normaliza SIEMPRE a @s.whatsapp.net
const normalizeJid = jid => {
  if (!jid) return null
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

async function loadObjectJSON(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    return typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

function formatFecha(ts) {
  if (!ts) return 'Desconocida'
  return new Date(ts).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function hpBar(hp, maxHp) {
  if (!maxHp || maxHp <= 0) return '❓'
  const total = 10
  const filled = Math.max(0, Math.round((hp / maxHp) * total))
  return '❤️'.repeat(filled) + '🖤'.repeat(total - filled)
}

/* ===================== COMANDO ===================== */

export default {
  name: 'inventario',
  aliases: ['inv'],
  groupOnly: true,
  cooldown: 3,

  async execute(sock, msg, ctx) {
    try {
      /* ---------- JID USUARIO ---------- */
      const rawSelf =
        msg.key.participant ??
        msg.message?.extendedTextMessage?.contextInfo?.participant ??
        msg.key.remoteJid

      const selfJid = normalizeJid(rawSelf)

      /* ---------- MENTION OPCIONAL ---------- */
      const mentioned =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

      const targetJid = mentioned
        ? normalizeJid(mentioned)
        : selfJid

      /* ---------- CARGA ---------- */
      const inv = await loadObjectJSON(INVENTORY_FILE)

      if (!Array.isArray(inv[targetJid]) || inv[targetJid].length === 0) {
        return ctx.reply(
          targetJid === selfJid
            ? '📦 Tu inventario está vacío'
            : '📦 El inventario de ese usuario está vacío'
        )
      }

      const list = inv[targetJid]
      const ownerNum = targetJid.split('@')[0]

      const title =
        targetJid === selfJid
          ? '📦 *TU INVENTARIO*'
          : `📦 *INVENTARIO DE @${ownerNum}*`

      let text = `${title}\n\n`

      /* ---------- LISTADO ---------- */
      list.forEach((w, i) => {
        const estado =
          w.hp <= 0
            ? '💀 KO'
            : w.cooldownUntil && w.cooldownUntil > Date.now()
              ? '🩺 Recuperándose'
              : w.hp < w.maxHp * 0.3
                ? '⚠️ Herida'
                : '✅ Lista'

        text +=
`*${i + 1}.* ${w.name}
🎖 Rareza » ${w.rarity ?? 'N/A'}
⚔️ Arma » ${w.arma?.tipo ?? 'N/A'}
🌟 Elemento » ${w.element ?? 'N/A'}
❤️ HP » ${w.hp}/${w.maxHp} ${hpBar(w.hp, w.maxHp)}
📌 Estado » ${estado}
🏷️ Precio » ${w.price ?? 'N/A'}
📅 Compra » ${formatFecha(w.boughtAt)}

`
      })

      /* ---------- AYUDA CONTEXTUAL ---------- */
      if (targetJid !== selfJid) {
        text +=
`🔥 *Acciones disponibles*
.retar <tu_indice> @${ownerNum} <indice_rival>`
      } else {
        text +=
`🧠 *Comandos útiles*
.retar <indice> @usuario <indice>
.curar <indice>
.favorita <indice>`
      }

      /* ---------- ENVÍO ---------- */
      await sock.sendMessage(
        ctx.jid,
        {
          text,
          mentions: targetJid === selfJid ? [] : [targetJid]
        },
        { quoted: msg }
      )

    } catch (err) {
      console.error('INVENTARIO ERROR:', err)
      ctx.reply('❌ Error al mostrar el inventario')
    }
  }
}
