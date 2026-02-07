// ACEPTAR FINAL DEFINITIVO PRO 2026
// - Pelea por rounds
// - Cooldown del perdedor
// - Bonus del ganador
// - Anti-spam (mensajes cada 6s)
// - Limpia retos colgados
// - NO rompe inventario / retar / engine

import fs from 'fs/promises'
import path from 'path'
import { pelear } from './fightEngine.js'

/* ===================== RUTAS ===================== */
const INVENTORY_FILE = path.join(process.cwd(), 'database', 'inventario.json')
const RETOS_FILE     = path.join(process.cwd(), 'database', 'retos.json')
const USERS_FILE     = path.join(process.cwd(), 'database', 'waifu.json')

/* ===================== CONFIG ===================== */
const MSG_DELAY = 6000
const EXPIRE_MS = 15 * 60 * 1000 // 15 min

const RECOVERY_TIMES = [
  { label: '8 minutos',  ms: 8  * 60 * 1000 },
  { label: '16 minutos', ms: 16 * 60 * 1000 },
  { label: '2 horas',    ms: 2  * 60 * 60 * 1000 }
]

/* ===================== HELPERS ===================== */

const normalizeJid = jid => {
  if (!jid) return null
  const num = jid.split('@')[0].replace(/\D/g, '')
  return num ? `${num}@s.whatsapp.net` : null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

async function loadJSON(file, def) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) ?? def }
  catch { return def }
}

async function saveJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

/* ===================== COMANDO ===================== */

export default {
  name: 'aceptar',
  aliases: ['ok'],
  groupOnly: true,
  cooldown: 5,

  async execute(sock, msg, ctx) {
    try {
      /* ---------- JID USUARIO ---------- */
      const userJid = normalizeJid(
        msg.key.participant ??
        msg.message?.extendedTextMessage?.contextInfo?.participant ??
        msg.key.remoteJid
      )

      /* ---------- CARGA ---------- */
      const retos = await loadJSON(RETOS_FILE, {})
      const inv   = await loadJSON(INVENTORY_FILE, {})
      const users = await loadJSON(USERS_FILE, {})

      users[userJid] ??= { points: 0 }

      /* ---------- LIMPIAR RETOS EXPIRADOS ---------- */
      let dirty = false
      for (const r of Object.values(retos)) {
        if (
          r.status === 'pending' &&
          r.createdAt &&
          Date.now() - r.createdAt > EXPIRE_MS
        ) {
          r.status = 'expired'
          dirty = true
        }
      }
      if (dirty) await saveJSON(RETOS_FILE, retos)

      /* ---------- BUSCAR RETO ---------- */
      const entry = Object.entries(retos).find(
        ([, r]) => r.to === userJid && r.status === 'pending'
      )

      if (!entry) {
        return ctx.reply('❌ No tienes retos pendientes')
      }

      const [retoId, reto] = entry
      const { from, to, waifuFrom, waifuTo } = reto

      const waifuA = inv[from]?.find(w => w.id === waifuFrom)
      const waifuB = inv[to]?.find(w => w.id === waifuTo)

      if (!waifuA || !waifuB || waifuA.hp <= 0 || waifuB.hp <= 0) {
        retos[retoId].status = 'cancelled'
        await saveJSON(RETOS_FILE, retos)
        return ctx.reply('⚠️ Reto cancelado (waifu inválida o KO)')
      }

      /* ---------- COOLDOWN CHECK ---------- */
      if (
        (waifuA.cooldownUntil && waifuA.cooldownUntil > Date.now()) ||
        (waifuB.cooldownUntil && waifuB.cooldownUntil > Date.now())
      ) {
        return ctx.reply('🩺 Una waifu aún está en recuperación')
      }

      /* ---------- BLOQUEAR RETO ---------- */
      retos[retoId].status = 'processing'
      await saveJSON(RETOS_FILE, retos)

      /* ================== INICIO ================== */
      await ctx.reply(
`⚔️ *PELEA INICIADA*

🔥 ${waifuA.name}
🆚
🛡 ${waifuB.name}`
      )

      await sleep(MSG_DELAY)

      /* ================== PELEA ================== */
      const result = pelear(waifuA, waifuB)

      /* ================== ROUNDS ================== */
      for (const r of result.rounds) {
        let txt = `🥊 *ROUND ${r.round}*\n\n`
        r.eventos.forEach(e => txt += `${e}\n`)
        txt += `\n🏆 Ganador del round: *${r.winner}*`
        if (r.bonus) txt += `\n✨ *BONUS ROUND*`
        if (r.ko) txt += `\n💀 *KO*`

        await ctx.reply(txt)
        await sleep(MSG_DELAY)
      }

      /* ================== RESULTADOS ================== */
      waifuA.hp = result.hpA
      waifuB.hp = result.hpB

      let winnerJid = null
      let loserWaifu = null

      if (result.winner === 'A') {
        winnerJid = from
        loserWaifu = waifuB
      } else if (result.winner === 'B') {
        winnerJid = to
        loserWaifu = waifuA
      }

      /* ---------- PUNTOS ---------- */
      if (winnerJid) {
        users[winnerJid] ??= { points: 0 }
        users[winnerJid].points += 50 + randInt(15, 35)
      }

      /* ---------- RECUPERACIÓN ---------- */
      let recoveryText = ''
      if (loserWaifu && loserWaifu.hp > 0) {
        const rec = RECOVERY_TIMES[randInt(0, RECOVERY_TIMES.length - 1)]
        loserWaifu.cooldownUntil = Date.now() + rec.ms
        recoveryText = `\n🩺 ${loserWaifu.name} entra en recuperación (${rec.label})`
      }

      /* ---------- ELIMINAR MUERTAS ---------- */
      if (waifuA.hp <= 0) inv[from] = inv[from].filter(w => w.id !== waifuA.id)
      if (waifuB.hp <= 0) inv[to]   = inv[to].filter(w => w.id !== waifuB.id)

      retos[retoId].status = 'done'

      await saveJSON(INVENTORY_FILE, inv)
      await saveJSON(USERS_FILE, users)
      await saveJSON(RETOS_FILE, retos)

      await sleep(MSG_DELAY)

      /* ================== MENSAJE FINAL ================== */
      let finalMsg =
`🏁 *RESULTADO FINAL*

❤️ ${waifuA.name}: ${waifuA.hp}/${waifuA.maxHp}
❤️ ${waifuB.name}: ${waifuB.hp}/${waifuB.maxHp}`

      let mentions = []

      if (winnerJid) {
        const winNum = winnerJid.split('@')[0]
        finalMsg +=
`\n\n🏆 *GANADORA:* ${result.winnerName}
👤 Dueño: @${winNum}
💰 +50 puntos + bonus`
        mentions.push(winnerJid)
      } else {
        finalMsg += '\n\n🤝 *EMPATE*'
      }

      finalMsg += recoveryText

      await ctx.reply(finalMsg, { mentions })

    } catch (err) {
      console.error('ACEPTAR ERROR:', err)
      ctx.reply('❌ Error crítico al aceptar el reto')
    }
  }
}
