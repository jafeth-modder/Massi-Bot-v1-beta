// authorize.js (FINAL MEJORADO) - Gmail OAuth Token Generator
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { google } from 'googleapis'

/* ===================== CONFIG ===================== */
const ROOT = process.cwd()
const GMAIL_DIR = path.join(ROOT, 'gmail')
const CREDENTIALS_PATH = path.join(GMAIL_DIR, 'credentials.json')
const TOKEN_PATH = path.join(GMAIL_DIR, 'token.json')

// Solo lectura (recomendado para tu bot)
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

/* ===================== HELPERS ===================== */
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const readJSON = (file) => {
  try {
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

const writeJSONAtomic = (file, data) => {
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, (ans) => {
      rl.close()
      resolve(String(ans || '').trim())
    })
  })

const pickOAuthConfig = (credentials) => {
  // Google credentials pueden venir en "installed" o "web"
  const cfg = credentials?.installed || credentials?.web
  if (!cfg) return null

  const client_id = cfg.client_id
  const client_secret = cfg.client_secret
  const redirect_uris = cfg.redirect_uris

  if (!client_id || !client_secret || !Array.isArray(redirect_uris) || !redirect_uris[0]) return null
  return { client_id, client_secret, redirect_uri: redirect_uris[0] }
}

/* ===================== MAIN ===================== */
async function main() {
  ensureDir(GMAIL_DIR)

  const credentials = readJSON(CREDENTIALS_PATH)
  if (!credentials) {
    console.log('❌ No pude leer credentials.json')
    console.log(`👉 Colócalo aquí: ${CREDENTIALS_PATH}`)
    process.exit(1)
  }

  const oauth = pickOAuthConfig(credentials)
  if (!oauth) {
    console.log('❌ credentials.json inválido. Debe tener "installed" o "web" con client_id, client_secret y redirect_uris.')
    process.exit(1)
  }

  const oAuth2Client = new google.auth.OAuth2(
    oauth.client_id,
    oauth.client_secret,
    oauth.redirect_uri
  )

  // URL de autorización
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // fuerza refresh_token (útil si ya autorizaste antes)
  })

  console.log('\n🔐 Autoriza Gmail en este enlace:\n')
  console.log(authUrl)
  console.log('\n📌 Luego pega aquí el *código* que te da Google.\n')

  const code = await ask('📥 Pega aquí el código: ')
  if (!code) {
    console.log('❌ No pegaste ningún código. Saliendo...')
    process.exit(1)
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code)
    oAuth2Client.setCredentials(tokens)

    // Guardar token
    writeJSONAtomic(TOKEN_PATH, tokens)

    console.log('\n✅ Token guardado correctamente en:')
    console.log(`📄 ${TOKEN_PATH}\n`)

    // Info útil
    const hasRefresh = !!tokens.refresh_token
    console.log(`🔁 refresh_token: ${hasRefresh ? '✅ Sí' : '⚠️ No (vuelve a autorizar con prompt=consent)'}`)
    console.log('✅ Listo. Ya puedes usar tu bot para leer Gmail.\n')
  } catch (err) {
    console.log('\n❌ Error obteniendo token.')
    console.log('👉 Asegúrate de pegar el código completo y que el redirect_uri coincida con credentials.json.\n')
    console.error(err?.response?.data || err?.message || err)
    process.exit(1)
  }
}

process.on('unhandledRejection', (e) => {
  console.error('❌ UnhandledRejection:', e?.message || e)
  process.exit(1)
})

process.on('uncaughtException', (e) => {
  console.error('❌ UncaughtException:', e?.message || e)
  process.exit(1)
})

main()
