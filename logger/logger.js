// logger/logger.js (FINAL++ PRO) - Node 24 + Termux
import fs from 'fs'
import path from 'path'
import util from 'util'

/* ===================== CONFIG ===================== */
const DEFAULT_LEVEL = process.env.LOG_LEVEL || 'info' // debug|info|success|warn|error|off
const SAVE_TO_FILE = (process.env.LOG_SAVE ?? 'true') === 'true'
const TIME_FORMAT = process.env.LOG_TIME ?? 'local' // local|iso

const LOG_DIR = path.resolve('logs')
const LOG_FILE = path.join(LOG_DIR, 'bot.log')

// Rotación simple por tamaño (bytes). Default: 2MB
const LOG_MAX_BYTES = Number(process.env.LOG_MAX_BYTES || 2 * 1024 * 1024)
// Mantener N backups: bot.log.1, bot.log.2 ...
const LOG_BACKUPS = Number(process.env.LOG_BACKUPS || 2)

/* ===================== COLORS ===================== */
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

/* ===================== LEVELS ===================== */
const levels = {
  debug: 10,
  info: 20,
  success: 25,
  warn: 30,
  error: 40,
  off: 999,
}

const levelColors = {
  debug: colors.blue,
  info: colors.cyan,
  success: colors.green,
  warn: colors.yellow,
  error: colors.red,
  off: colors.gray,
}

/* ===================== STATE ===================== */
let currentLevel = normalizeLevel(DEFAULT_LEVEL)
let currentLevelValue = levels[currentLevel] ?? levels.info

// cola simple para escritura a archivo
let writeQueue = []
let flushing = false

/* ===================== FILE SETUP ===================== */
if (SAVE_TO_FILE) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')
  } catch {
    // no uses el mismo logger aquí
    console.error('❌ No se pudo inicializar el archivo de logs')
  }
}

/* ===================== HELPERS ===================== */
function normalizeLevel(lvl) {
  return String(lvl || '').toLowerCase().trim()
}

function now() {
  const d = new Date()
  if (TIME_FORMAT === 'iso') {
    return d.toISOString().replace('T', ' ').split('.')[0]
  }
  return d.toLocaleString()
}

function shouldLog(level) {
  const v = levels[level] ?? levels.info
  // allow DEBUG env override
  if (level === 'debug' && process.env.DEBUG === 'true') return true
  return v >= currentLevelValue
}

function stringify(data) {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (data instanceof Error) return data.stack || data.message
  return util.inspect(data, { depth: 6, colors: false, maxArrayLength: 50 })
}

function rotateIfNeeded() {
  if (!SAVE_TO_FILE) return
  try {
    const st = fs.statSync(LOG_FILE)
    if (!st.isFile()) return
    if (st.size < LOG_MAX_BYTES) return

    // rotar: bot.log.(n) <- bot.log.(n-1)
    for (let i = LOG_BACKUPS; i >= 1; i--) {
      const src = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`
      const dst = `${LOG_FILE}.${i}`
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dst)
        } catch {}
      }
    }
    // recrear bot.log vacío
    fs.writeFileSync(LOG_FILE, '', 'utf8')
  } catch {
    // ignore
  }
}

function enqueueWrite(line) {
  if (!SAVE_TO_FILE) return
  writeQueue.push(line + '\n')
  flushQueue().catch(() => {})
}

async function flushQueue() {
  if (!SAVE_TO_FILE) return
  if (flushing) return
  flushing = true

  try {
    rotateIfNeeded()

    const chunk = writeQueue.join('')
    writeQueue = []
    if (chunk) {
      await fs.promises.appendFile(LOG_FILE, chunk, 'utf8')
    }
  } catch {
    // ignore
  } finally {
    flushing = false
    // si entraron más mientras escribíamos
    if (writeQueue.length) flushQueue().catch(() => {})
  }
}

function formatLine(level, message, scope) {
  const color = levelColors[level] || colors.reset
  const ts = now()
  const lvl = level.toUpperCase().padEnd(7)
  const sc = scope ? ` ${colors.gray}[${scope}]${colors.reset}` : ''
  const text = stringify(message)

  const consoleLine =
    `${colors.gray}[${ts}]${colors.reset} ` +
    `${color}${lvl}${colors.reset}` +
    sc +
    ` ${text}`

  const fileLine = `[${ts}] ${lvl}${scope ? ` [${scope}]` : ''} ${text}`
  return { consoleLine, fileLine }
}

function coreLog(level, message, scope) {
  if (!shouldLog(level)) return

  const { consoleLine, fileLine } = formatLine(level, message, scope)

  if (level === 'error') console.error(consoleLine)
  else console.log(consoleLine)

  enqueueWrite(fileLine)
}

/* ===================== LOGGER FACTORY ===================== */
function createLogger(scope = '') {
  return {
    debug: (msg) => coreLog('debug', msg, scope),
    info: (msg) => coreLog('info', msg, scope),
    success: (msg) => coreLog('success', msg, scope),
    warn: (msg) => coreLog('warn', msg, scope),

    // error flexible: (err) | (err, msg) | (err, msg, metaObj)
    error: (err, msg = '', meta = null) => {
      if (msg) coreLog('error', msg, scope)
      if (meta) coreLog('error', meta, scope)
      coreLog('error', err, scope)
    },

    // logs estructurados a un nivel
    raw: (level, data) => coreLog(normalizeLevel(level) || 'info', data, scope),

    // cambiar nivel en caliente (ahora sí)
    setLevel: (lvl) => {
      const n = normalizeLevel(lvl)
      if (!levels[n]) return
      currentLevel = n
      currentLevelValue = levels[n]
      coreLog('info', `🔧 LOG_LEVEL cambiado a ${n}`, scope)
    },

    // crear logger con scope: logger.child('GMAIL')
    child: (childScope) => createLogger(childScope ? `${scope ? scope + ':' : ''}${childScope}` : scope),
  }
}

const logger = createLogger()
export default logger
