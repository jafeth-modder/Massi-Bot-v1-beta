// RETAR FINAL PRO BLINDADO 2026
// Uso: .retar <indice_mio> @usuario <indice_rival>
// Solo crea el reto (NO pelea)

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

/* ===================== RUTAS ===================== */
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')
const RETOS_FILE     = path.join(process.cwd(), 'database', 'retos.json')

/* ===================== HELPERS ===================== */

const normalizeJid = jid => {
  if (!jid) return null
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

const now = () => Date.now()
const EXPIRE_MS = 15 * 60 * 1000 // 15 minutos

async function loadJSON(file, def) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) ?? def }
  catch { return def }
}

async function saveJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

function formatMs(ms) {
  const m = Math.ceil(ms / 60000)
  if (m >= 60) return `${Math.ceil(m / 60)}h`
  return `${m}m`
}

/* ===================== VALIDACIÓN WAIFU ===================== */

function validateWaifu(w) {
  if (!w) return '❌ No existe'
  if (!w.id || w.hp === undefined || w.maxHp === undefined)
    return '⚠️ Incompatible'
  if (w.hp <= 0) return '💀 KO'
  if (w.flags?.locked) return '🔒 Bloqueada'
  if (w.cooldownUntil && now() < w.cooldownUntil)
    return `⏳ Recuperándose (${formatMs(w.cooldownUntil - now())})`
  return null
}

/* ===================== COMANDO ===================== */

export default {
  name: 'retar',
  aliases: ['duelo', 'challenge'],
  groupOnly: true,
  cooldown: 5,

  async execute(sock, msg, ctx) {
    try {
      /* ---------- JIDS ---------- */
      const fromJid = normalizeJid(
        msg.key.participant ??
        msg.message?.extendedTextMessage?.contextInfo?.participant ??
        msg.key.remoteJid
      )

      const mentioned =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

      if (!mentioned) {
        return ctx.reply(
          '❌ Debes mencionar al usuario que quieres retar\n' +
          'Ejemplo:\n.retar 1 @usuario 2'
        )
      }

      const toJid = normalizeJid(mentioned)

      if (fromJid === toJid) {
        return ctx.reply('❌ No puedes retarte a ti mismo')
      }

      /* ---------- ARGUMENTOS ---------- */
      const nums = (ctx.args || [])
        .map(n => parseInt(n))
        .filter(n => !isNaN(n))

      if (nums.length < 2) {
        return ctx.reply(
          '❌ Uso correcto:\n.retar <tu_indice> @usuario <indice_rival>'
        )
      }

      const idxFrom = nums[0] - 1
      const idxTo   = nums[1] - 1

      if (idxFrom < 0 || idxTo < 0) {
        return ctx.reply('❌ Los índices empiezan desde *1*')
      }

      /* ---------- CARGA ---------- */
      const inv   = await loadJSON(INVENTORY_FILE, {})
      const retos = await loadJSON(RETOS_FILE, {})

      /* ---------- LIMPIAR RETOS EXPIRADOS ---------- */
      let cleaned = false
      for (const r of Object.values(retos)) {
        if (
          r.status === 'pending' &&
          r.createdAt &&
          now() - r.createdAt > EXPIRE_MS
        ) {
          r.status = 'expired'
          cleaned = true
        }
      }
      if (cleaned) await saveJSON(RETOS_FILE, retos)

      const myInv  = inv[fromJid]
      const hisInv = inv[toJid]

      if (!Array.isArray(myInv) || !myInv[idxFrom])
        return ctx.reply('❌ Tu waifu no existe')

      if (!Array.isArray(hisInv) || !hisInv[idxTo])
        return ctx.reply('❌ La waifu del rival no existe')

      const myWaifu  = myInv[idxFrom]
      const hisWaifu = hisInv[idxTo]

      /* ---------- VALIDACIONES ---------- */
      const errMine = validateWaifu(myWaifu)
      if (errMine) return ctx.reply(`❌ Tu waifu: ${errMine}`)

      const errHis = validateWaifu(hisWaifu)
      if (errHis) return ctx.reply(`❌ Waifu rival: ${errHis}`)

      /* ---------- ANTI DUPLICADO POR WAIFU ---------- */
      const exists = Object.values(retos).find(r =>
        r.status === 'pending' &&
        (
          r.waifuFrom === myWaifu.id ||
          r.waifuTo === myWaifu.id
        )
      )

      if (exists) {
        return ctx.reply(
          '⚠️ Esa waifu ya tiene un reto pendiente'
        )
      }

      /* ---------- CREAR RETO ---------- */
      const retoId = crypto.randomUUID()

      retos[retoId] = {
        id: retoId,
        from: fromJid,
        to: toJid,

        waifuFrom: myWaifu.id,
        waifuTo: hisWaifu.id,

        idxFrom,
        idxTo,

        createdAt: now(),
        status: 'pending'
      }

      await saveJSON(RETOS_FILE, retos)

      const fromNum = fromJid.split('@')[0]
      const toNum   = toJid.split('@')[0]

      /* ---------- RESPUESTA ---------- */
      await ctx.reply(
`⚔️ *RETO ENVIADO*

👤 Retador » @${fromNum}
🆚 Retado » @${toNum}

🔥 Tu waifu » ${myWaifu.name}
🛡 Rival » ${hisWaifu.name}

⏳ El reto expira en 15 minutos
👉 Usa *.aceptar* para iniciar la pelea`,
        { mentions: [fromJid, toJid] }
      )

    } catch (err) {
      console.error('RETAR ERROR:', err)
      ctx.reply('❌ Error inesperado al crear el reto')
    }
  }
}
