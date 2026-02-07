// FIGHT ENGINE FINAL DEFINITIVO PRO 2026
// Motor puro de combate por rounds
// NO guarda archivos
// NO manda mensajes
// NO muta waifus originales

/* ===================== CONFIG ===================== */

const ARMAS = {
  martillo: { daño: 95,  crit: 0.05 },
  cuchillo: { daño: 60,  crit: 0.25 },
  espada:   { daño: 75,  crit: 0.15 },
  varita:   { daño: 45,  magiaBonus: 0.3 }
}

const MAX_ROUNDS = 5
const CRIT_MULT = 1.5
const BONUS_HEAL = 8

/* ===================== HELPERS ===================== */

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

function safeStats(stats = {}) {
  return {
    fuerza: Number(stats.fuerza) || 0,
    defensa: Number(stats.defensa) || 0,
    magia:   Number(stats.magia)   || 0
  }
}

/* ===================== DAMAGE ===================== */

function calcDamage(attacker, defender) {
  const arma = ARMAS[attacker.arma?.tipo] || { daño: 55, crit: 0.05 }

  const atkStats = safeStats(attacker.stats)
  const defStats = safeStats(defender.stats)

  let dmg = arma.daño

  // magia
  if (attacker.arma?.tipo === 'varita') {
    dmg += atkStats.magia * arma.magiaBonus
  }

  // fuerza vs defensa
  dmg += atkStats.fuerza * 0.6
  dmg -= defStats.defensa * 0.4

  // variación
  dmg += randInt(-6, 6)

  // crítico
  let crit = false
  if (Math.random() < (arma.crit || 0)) {
    dmg *= CRIT_MULT
    crit = true
  }

  return {
    dmg: Math.max(1, Math.floor(dmg)),
    crit
  }
}

/* ===================== ENGINE ===================== */

export function pelear(a, b) {
  // clonamos (motor puro)
  const waifuA = structuredClone(a)
  const waifuB = structuredClone(b)

  let hpA = waifuA.hp
  let hpB = waifuB.hp

  const rounds = []
  const bonusRound = randInt(1, MAX_ROUNDS)

  for (let r = 1; r <= MAX_ROUNDS && hpA > 0 && hpB > 0; r++) {
    const eventos = []

    // ⚔️ A ataca
    const atkA = calcDamage(waifuA, waifuB)
    hpB -= atkA.dmg
    eventos.push(
      `🥊 ${waifuA.name} golpea (${atkA.dmg}${atkA.crit ? ' 💥CRIT' : ''})`
    )

    if (hpB <= 0) {
      rounds.push({
        round: r,
        eventos,
        winner: waifuA.name,
        bonus: r === bonusRound,
        ko: true
      })
      break
    }

    // 🔁 B responde
    const atkB = calcDamage(waifuB, waifuA)
    hpA -= atkB.dmg
    eventos.push(
      `🔁 ${waifuB.name} responde (${atkB.dmg}${atkB.crit ? ' 💥CRIT' : ''})`
    )

    // 🎁 BONUS REAL
    if (r === bonusRound) {
      if (hpA > hpB) {
        hpA += BONUS_HEAL
        eventos.push(`✨ ${waifuA.name} se recupera (+${BONUS_HEAL} HP)`)
      } else {
        hpB += BONUS_HEAL
        eventos.push(`✨ ${waifuB.name} se recupera (+${BONUS_HEAL} HP)`)
      }
    }

    // ganador del round
    let roundWinner = 'Empate'
    if (hpA > hpB) roundWinner = waifuA.name
    else if (hpB > hpA) roundWinner = waifuB.name

    rounds.push({
      round: r,
      eventos,
      winner: roundWinner,
      bonus: r === bonusRound,
      ko: false
    })
  }

  // ganador final
  let winner = null
  let winnerName = 'Empate'

  if (hpA > hpB) {
    winner = 'A'
    winnerName = waifuA.name
  } else if (hpB > hpA) {
    winner = 'B'
    winnerName = waifuB.name
  }

  return {
    rounds,
    bonusRound,
    hpA: Math.max(0, hpA),
    hpB: Math.max(0, hpB),
    winner,
    winnerName
  }
}
