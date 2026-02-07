const games = new Map()

/* ===================== CONFIG GLOBAL ===================== */
const E = { X: '❌', O: '⭕', _: '⬜' }

const WIN = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
]

// ⚙️ CONFIG BOT AVANZADO
const BOT_CONFIG = {
  baseError: 0.06,        // error mínimo
  maxError: 0.18,         // error máximo
  thinkMin: 600,
  thinkMax: 1500,
  memoryWeight: 0.35,     // rompe patrones
}

/* ===================== HELPERS ===================== */
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a
const chance = p => Math.random() < p
const pick = a => a[Math.floor(Math.random()*a.length)]

const cleanNum = jid =>
  String(jid || '').split('@')[0].replace(/\D/g, '')

const render = b =>
  `${b.slice(0,3).join('')}\n${b.slice(3,6).join('')}\n${b.slice(6).join('')}`

const win = (b,s) => WIN.some(c => c.every(i => b[i] === s))
const draw = b => b.every(v => v !== E._)

/* ===================== MINIMAX PROFUNDO ===================== */
function minimax(board, isBot, depth, maxDepth) {
  if (win(board, E.O)) return { score: 10 - depth }
  if (win(board, E.X)) return { score: depth - 10 }
  if (draw(board) || depth >= maxDepth) return { score: 0 }

  const moves = []

  for (let i = 0; i < 9; i++) {
    if (board[i] !== E._) continue
    const next = [...board]
    next[i] = isBot ? E.O : E.X
    const r = minimax(next, !isBot, depth + 1, maxDepth)
    moves.push({ i, score: r.score })
  }

  const bestScore = isBot
    ? Math.max(...moves.map(m => m.score))
    : Math.min(...moves.map(m => m.score))

  const bestMoves = moves.filter(m => m.score === bestScore)
  return pick(bestMoves)
}

/* ===================== BOT INTELIGENTE ===================== */
function botMove(game) {
  const board = game.board
  const empty = board.map((v,i)=>v===E._?i:null).filter(i=>i!==null)

  // 🎭 estado emocional
  if (!game.botState) {
    game.botState = pick(['calm','aggressive','defensive'])
    game.skill = rand(3, 6) // profundidad base
  }

  // ajuste dinámico
  if (game.lastResult === 'lose') game.skill++
  if (game.lastResult === 'win') game.skill--

  game.skill = Math.max(3, Math.min(7, game.skill))

  const errorRate =
    BOT_CONFIG.baseError +
    Math.abs(5 - game.skill) * 0.02

  // apertura variada
  if (empty.length === 8) {
    const openings = [4,0,2,6,8,1,3,5,7]
    return pick(openings.filter(i => board[i] === E._))
  }

  // error humano adaptativo
  if (chance(Math.min(errorRate, BOT_CONFIG.maxError))) {
    return pick(empty)
  }

  // minimax con profundidad variable
  return minimax(board, true, 0, game.skill).i
}

/* ===================== COMMAND ===================== */
export default {
  name: 'tictac',
  aliases: ['gato', 'tictactoe'],
  groupOnly: true,
  cooldown: 2,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid
    const me = cleanNum(ctx.senderJid)
    const sub = (ctx.args[0] || '').toLowerCase()

    /* ===== START BOT ===== */
    if (!sub) {
      games.set(jid, {
        mode: 'bot',
        board: Array(9).fill(E._),
        turn: me,
        players: { X: me, O: 'BOT' },
        history: [],
        lastResult: null
      })

      return ctx.reply(
`🎮 *TIC TAC TOE PRO++*
❌ Tú vs 🤖 BOT

.tictac 1-9

${render(Array(9).fill(E._))}`
      )
    }

    /* ===== MOVE ===== */
    if (/^[1-9]$/.test(sub)) {
      const g = games.get(jid)
      if (!g || g.turn !== me) return

      const pos = Number(sub) - 1
      if (g.board[pos] !== E._) return ctx.reply('❌ Casilla ocupada')

      g.board[pos] = E.X

      if (win(g.board, E.X)) {
        g.lastResult = 'lose'
        games.delete(jid)
        return ctx.reply(`🏆 *GANASTE*\n\n${render(g.board)}`)
      }

      if (draw(g.board)) {
        g.lastResult = 'draw'
        games.delete(jid)
        return ctx.reply(`🤝 *EMPATE*\n\n${render(g.board)}`)
      }

      await new Promise(r => setTimeout(r, rand(
        BOT_CONFIG.thinkMin,
        BOT_CONFIG.thinkMax
      )))

      const m = botMove(g)
      g.board[m] = E.O

      if (win(g.board, E.O)) {
        g.lastResult = 'win'
        games.delete(jid)
        return ctx.reply(`💀 *EL BOT GANA*\n\n${render(g.board)}`)
      }

      if (draw(g.board)) {
        g.lastResult = 'draw'
        games.delete(jid)
        return ctx.reply(`🤝 *EMPATE*\n\n${render(g.board)}`)
      }

      return ctx.reply(`🤖 mueve...\n\n${render(g.board)}`)
    }

    /* ===== EXIT ===== */
    if (sub === 'salir') {
      games.delete(jid)
      return ctx.reply('❌ Juego cancelado')
    }
  }
}
