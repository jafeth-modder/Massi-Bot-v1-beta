// ppt.js — PIEDRA PAPEL TIJERA ULTIMATE 2026 (AZAR REAL)
// Uso:
// .ppt piedra | papel | tijera
// .ppt rank
// Azar puro con crypto (sin patrones, sin memoria, sin balanceo)

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

/* ===================== CONFIG ===================== */
const CONFIG = {
  COOLDOWN: 3,
  ANIM_DELAY: 1200,
  MAX_TOP: 5,
  EMOJI: {
    piedra: '🪨',
    papel: '📄',
    tijera: '✂️'
  },
  REACT: {
    win: '🎉',
    lose: '💀',
    draw: '🤝'
  }
}

const OPCIONES = ['piedra', 'papel', 'tijera']
const RANK_FILE = path.join(process.cwd(), 'database', 'ppt_ranking.json')

/* ===================== HELPERS ===================== */
const sleep = ms => new Promise(r => setTimeout(r, ms))
const jidToNum = jid => String(jid || '').split('@')[0].replace(/\D/g, '')

async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key }
    })
  } catch {}
}

/* ===================== AZAR PURO ===================== */
// Cada llamada es independiente, sin memoria, sin corrección
function randomChoice() {
  return OPCIONES[crypto.randomInt(0, OPCIONES.length)]
}

function decidirResultado(user, bot) {
  if (user === bot) return 'draw'
  if (
    (user === 'piedra' && bot === 'tijera') ||
    (user === 'papel' && bot === 'piedra') ||
    (user === 'tijera' && bot === 'papel')
  ) return 'win'
  return 'lose'
}

/* ===================== RANKING ===================== */
async function loadRank() {
  try {
    return JSON.parse(await fs.readFile(RANK_FILE, 'utf8')) ?? {}
  } catch {
    return {}
  }
}

async function saveRank(data) {
  await fs.mkdir(path.dirname(RANK_FILE), { recursive: true })
  await fs.writeFile(RANK_FILE, JSON.stringify(data, null, 2))
}

async function updateRank(jid, result) {
  const data = await loadRank()
  data[jid] ??= { win: 0, lose: 0, draw: 0 }
  data[jid][result]++
  await saveRank(data)
}

async function getTop(limit) {
  const data = await loadRank()
  return Object.entries(data)
    .map(([jid, r]) => ({
      jid,
      score: r.win * 3 + r.draw,
      ...r
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/* ===================== COMANDO ===================== */
export default {
  name: 'ppt',
  aliases: ['piedrapapeltijera'],
  cooldown: CONFIG.COOLDOWN,

  async execute(sock, msg, ctx) {
    const arg = (ctx.args?.[0] || '').toLowerCase()
    const userJid = msg.key.participant || msg.key.remoteJid

    /* ===== RANKING ===== */
    if (arg === 'rank') {
      const top = await getTop(CONFIG.MAX_TOP)
      if (top.length === 0) {
        return ctx.reply('📊 *Ranking PPT vacío*')
      }

      let txt = '🏆 *RANKING PPT*\n\n'
      top.forEach((u, i) => {
        txt += `${i + 1}. @${u.jid.split('@')[0]} → ${u.score} pts (W:${u.win} D:${u.draw} L:${u.lose})\n`
      })

      return sock.sendMessage(
        ctx.jid,
        { text: txt, mentions: top.map(u => u.jid) },
        { quoted: msg }
      )
    }

    /* ===== VALIDACIÓN ===== */
    if (!OPCIONES.includes(arg)) {
      return ctx.reply(
        '❌ Uso correcto:\n.ppt piedra\n.ppt papel\n.ppt tijera\n.ppt rank'
      )
    }

    const userChoice = arg
    const botChoice = randomChoice()

    /* ===== MENSAJE 1 ===== */
    await ctx.reply(`🧠 Elegiste *${userChoice.toUpperCase()}* ${CONFIG.EMOJI[userChoice]}`)

    /* ===== ANIMACIÓN ===== */
    await sleep(CONFIG.ANIM_DELAY)
    await ctx.reply(`🤖 Yo elijo *${botChoice.toUpperCase()}* ${CONFIG.EMOJI[botChoice]}`)

    /* ===== RESULTADO ===== */
    await sleep(CONFIG.ANIM_DELAY)
    const result = decidirResultado(userChoice, botChoice)
    await updateRank(userJid, result)

    const resultText =
      result === 'win' ? '🎉 *GANASTE*' :
      result === 'lose' ? '💀 *PERDISTE*' :
      '🤝 *EMPATE*'

    await ctx.reply(
`🏁 *RESULTADO*

👤 Tú: ${userChoice} ${CONFIG.EMOJI[userChoice]}
🤖 Bot: ${botChoice} ${CONFIG.EMOJI[botChoice]}

${resultText}`
    )

    /* ===== REACCIÓN ===== */
    await react(sock, msg, CONFIG.REACT[result])
  }
}
