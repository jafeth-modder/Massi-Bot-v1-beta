// gmail/netflix.js (FINAL) - Gmail code extractor (Netflix)
import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

/* ===================== CONFIG ===================== */
const ROOT = process.cwd()
const GMAIL_DIR = path.join(ROOT, 'gmail')

const CREDENTIALS_PATH = path.join(GMAIL_DIR, 'credentials.json')
const TOKEN_PATH = path.join(GMAIL_DIR, 'token.json')

// Query por defecto (ajusta si quieres)
const DEFAULT_QUERY = 'from:netflix newer_than:60m'

// Regex típica de códigos Netflix: 4–6 dígitos
const DEFAULT_CODE_REGEX = /\b(\d{4,6})\b/g

// Ventana real de “reciente” (minutos), además del newer_than del query.
// Esto evita que Gmail entregue algo viejo si el query no coincide perfecto.
const DEFAULT_MAX_AGE_MINUTES = 60

// Cuántos mensajes revisa como máximo
const DEFAULT_MAX_RESULTS = 10

/* ===================== HELPERS ===================== */
const fileExists = (p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile()
  } catch {
    return false
  }
}

const readJSON = (p) => {
  if (!fileExists(p)) return null
  try {
    const raw = fs.readFileSync(p, 'utf8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const pickOAuthConfig = (credentials) => {
  const cfg = credentials?.installed || credentials?.web
  if (!cfg) return null

  const client_id = cfg.client_id
  const client_secret = cfg.client_secret
  const redirect_uri = Array.isArray(cfg.redirect_uris) ? cfg.redirect_uris[0] : null

  if (!client_id || !client_secret || !redirect_uri) return null
  return { client_id, client_secret, redirect_uri }
}

// Base64URL -> utf8
const decodeBase64Url = (data) => {
  if (!data) return ''
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  // padding
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  return Buffer.from(padded, 'base64').toString('utf8')
}

// Quita html básico (sin dependencias)
const stripHtml = (html) =>
  String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// Recorre payload recursivo y junta texto preferido
const extractBodies = (payload, out = { plain: [], html: [], any: [] }) => {
  if (!payload) return out

  const mime = payload.mimeType || ''
  const data = payload.body?.data ? decodeBase64Url(payload.body.data) : ''

  if (data) {
    out.any.push(data)
    if (mime === 'text/plain') out.plain.push(data)
    if (mime === 'text/html') out.html.push(data)
  }

  const parts = payload.parts || []
  for (const p of parts) extractBodies(p, out)

  return out
}

const getHeader = (headers, name) => {
  const h = (headers || []).find((x) => String(x.name || '').toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

const uniq = (arr) => [...new Set(arr.filter(Boolean))]

/* ===================== GMAIL CLIENT (CACHED) ===================== */
let _gmail = null

const getGmailClient = () => {
  if (_gmail) return _gmail

  const credentials = readJSON(CREDENTIALS_PATH)
  if (!credentials) {
    throw new Error(`No se pudo leer ${CREDENTIALS_PATH}`)
  }

  const tokens = readJSON(TOKEN_PATH)
  if (!tokens) {
    throw new Error(`No se pudo leer ${TOKEN_PATH}. Ejecuta authorize.js primero.`)
  }

  const oauth = pickOAuthConfig(credentials)
  if (!oauth) {
    throw new Error('credentials.json inválido: falta installed/web con client_id, client_secret, redirect_uris')
  }

  const oAuth2Client = new google.auth.OAuth2(
    oauth.client_id,
    oauth.client_secret,
    oauth.redirect_uri
  )

  oAuth2Client.setCredentials(tokens)
  _gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
  return _gmail
}

/* ===================== CODE EXTRACTION ===================== */
const findBestCode = (text, regex = DEFAULT_CODE_REGEX) => {
  const s = String(text || '')
  const matches = [...s.matchAll(regex)].map((m) => m[1]).filter(Boolean)
  // Netflix suele poner el código al inicio; devolvemos el primero “razonable”
  return matches[0] || null
}

const isRecentEnough = (internalDateMs, maxAgeMinutes) => {
  if (!internalDateMs) return true
  const ageMs = Date.now() - Number(internalDateMs)
  return ageMs <= maxAgeMinutes * 60 * 1000
}

/* ===================== PUBLIC API ===================== */
/**
 * Obtiene el código más reciente de Netflix desde Gmail.
 *
 * @param {object} opts
 * @param {string} opts.query - Gmail search query
 * @param {number} opts.maxAgeMinutes - ventana máxima real
 * @param {number} opts.maxResults - mensajes a revisar
 * @param {RegExp} opts.codeRegex - regex con grupo ( ) para capturar código
 * @returns {Promise<string|null>}
 */
export async function getLatestNetflixCode(opts = {}) {
  const {
    query = DEFAULT_QUERY,
    maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
    maxResults = DEFAULT_MAX_RESULTS,
    codeRegex = DEFAULT_CODE_REGEX,
  } = opts

  const gmail = getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  const msgs = listRes?.data?.messages || []
  if (!msgs.length) return null

  // Revisamos en orden y devolvemos el primer código válido y reciente
  for (const m of msgs) {
    const fullRes = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'full',
    })

    const data = fullRes?.data
    const payload = data?.payload
    const headers = payload?.headers || []

    // Filtro extra por recencia usando internalDate (ms)
    const internalDate = data?.internalDate
    if (!isRecentEnough(internalDate, maxAgeMinutes)) continue

    const subject = getHeader(headers, 'Subject')
    const from = getHeader(headers, 'From')

    // Extrae body (plain/html)
    const bodies = extractBodies(payload)
    const plain = uniq(bodies.plain).join('\n\n')
    const html = uniq(bodies.html).join('\n\n')
    const any = uniq(bodies.any).join('\n\n')

    // 1) Intentar en Subject (a veces está ahí)
    let code = findBestCode(subject, codeRegex)
    if (code) return code

    // 2) Preferir plain
    code = findBestCode(plain, codeRegex)
    if (code) return code

    // 3) html -> strip
    if (html) {
      code = findBestCode(stripHtml(html), codeRegex)
      if (code) return code
    }

    // 4) fallback de cualquier cosa
    code = findBestCode(any, codeRegex)
    if (code) return code

    // Si quieres depurar:
    // console.log({ from, subject, internalDate })
  }

  return null
}
