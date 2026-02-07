// play.js — FINAL DEFINITIVO 2026 PRO
// Multi-user | Progreso por etapas | UX tipo GataBot

import fs from 'fs'
import fsP from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import yts from 'yt-search'

/* ===================== CONFIG ===================== */
const CFG = {
  MAX_RESULTS: 5,
  MAX_AUDIO_SEC: 10 * 60,
  MAX_VIDEO_SEC: 15 * 60,
  AUDIO_BITRATE: '192K',
  TMP_DIR: path.join(process.cwd(), 'tmp'),
  MENU_EXPIRE_MS: 5 * 60 * 1000,
  MIN_FILE_SIZE: 50 * 1024,
  DOWNLOAD_TIMEOUT_MS: 180000
}

/* ===================== CACHE ===================== */
// jid => Map(sender => session)
const CACHE = new Map()

/* ===================== HELPERS ===================== */
const now = () => Date.now()

function getInvoked(ctx) {
  return String(ctx.fullArgs || '').trim().split(/\s+/)[0]?.toLowerCase()
}

function getQuotedMenuId(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null
}

function expired(ts) {
  return now() - ts > CFG.MENU_EXPIRE_MS
}

async function ensureTmp() {
  await fsP.mkdir(CFG.TMP_DIR, { recursive: true }).catch(() => {})
}

function fileOk(file) {
  try {
    const s = fs.statSync(file)
    return s.isFile() && s.size >= CFG.MIN_FILE_SIZE
  } catch {
    return false
  }
}

function safeDelete(file) {
  try { fs.unlinkSync(file) } catch {}
}

function getSession(jid, sender) {
  if (!CACHE.has(jid)) CACHE.set(jid, new Map())
  return CACHE.get(jid).get(sender)
}

function setSession(jid, sender, data) {
  if (!CACHE.has(jid)) CACHE.set(jid, new Map())
  CACHE.get(jid).set(sender, data)
}

/* ===================== YT-DLP ===================== */
function runYTDLP(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('yt-dlp', args)
    const t = setTimeout(() => {
      p.kill()
      reject(new Error('Timeout de descarga'))
    }, CFG.DOWNLOAD_TIMEOUT_MS)

    p.on('close', code => {
      clearTimeout(t)
      code === 0 ? resolve() : reject(new Error('yt-dlp falló'))
    })
  })
}

const downloadAudio = (url, out) =>
  runYTDLP([
    '--no-playlist',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', CFG.AUDIO_BITRATE,
    '--embed-thumbnail',
    '--embed-metadata',
    '-o', out,
    url
  ])

const downloadVideo = (url, out) =>
  runYTDLP([
    '--no-playlist',
    '-f', 'bestvideo+bestaudio/best',
    '--merge-output-format', 'mp4',
    '--embed-thumbnail',
    '--embed-metadata',
    '-o', out,
    url
  ])

/* ===================== PROGRESO UX ===================== */
async function progress(sock, jid, key, pct, label = 'Descargando') {
  await sock.sendMessage(jid, {
    edit: key,
    text: `⬇️ *${label}*… ${pct}%`
  })
}

/* ===================== COMANDO ===================== */
export default {
  name: 'play',
  aliases: ['playvideo', 'descargar', 'eliminar'],
  cooldown: 4,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid
    const sender = ctx.sender
    const invoked = getInvoked(ctx)
    const query = ctx.args.join(' ').trim()

    /* ===== LIMPIEZA ===== */
    for (const [j, map] of CACHE.entries()) {
      for (const [s, v] of map.entries()) {
        if (expired(v.createdAt)) map.delete(s)
      }
    }

    /* ===== ELIMINAR ===== */
    if (invoked === 'eliminar') {
      CACHE.get(jid)?.delete(sender)
      return ctx.reply('🗑️ Menú eliminado para ti.')
    }

    /* ===== DESCARGAR ===== */
    if (invoked === 'descargar') {
      const session = getSession(jid, sender)
      if (!session) return ctx.reply('❌ No tienes un play activo.')

      if (getQuotedMenuId(msg) !== session.menuMsgId)
        return ctx.reply('❌ Este menú no te pertenece.')

      const n = parseInt(ctx.args[0])
      const idx = n - 1
      if (!session.results[idx]) return ctx.reply('⚠️ Número inválido.')

      await ensureTmp()
      const item = session.results[idx]
      const out = path.join(CFG.TMP_DIR, `${Date.now()}_${sender}.${session.type === 'play' ? 'mp3' : 'mp4'}`)

      const status = await ctx.reply(`🔵 *Preparando*\n${item.title.slice(0, 40)}…`)

      try {
        await progress(sock, jid, status.key, 20)
        await progress(sock, jid, status.key, 30)

        session.type === 'play'
          ? await downloadAudio(item.url, out)
          : await downloadVideo(item.url, out)

        await progress(sock, jid, status.key, 70)
        await progress(sock, jid, status.key, 90)

        if (!fileOk(out)) throw new Error('Archivo inválido')

        const buffer = await fsP.readFile(out)

        await progress(sock, jid, status.key, 100)

        await sock.sendMessage(jid,
          session.type === 'play'
            ? { audio: buffer, mimetype: 'audio/mpeg', fileName: `${item.title}.mp3` }
            : { video: buffer, caption: `🎬 ${item.title}`, fileName: `${item.title}.mp4` },
          { quoted: msg }
        )

        await sock.sendMessage(jid, { edit: status.key, text: '✅ *LISTO* — Disfrútalo 🎧' })
      } catch (e) {
        await sock.sendMessage(jid, { edit: status.key, text: `🔴 Error: ${e.message}` })
      } finally {
        safeDelete(out)
      }
      return
    }

    /* ===== PLAY ===== */
    if (!query) return ctx.reply('🎵 Usa `.play <texto>` o `.playvideo <texto>`')

    await ctx.reply('🟡 *Buscando…*')

    const type = invoked === 'playvideo' ? 'playvideo' : 'play'
    const res = await yts(query)
    const vids = res.videos
      .filter(v => !v.live && v.duration?.seconds)
      .slice(0, CFG.MAX_RESULTS)

    if (!vids.length) return ctx.reply('😕 Sin resultados.')

    const menu = vids.map((v, i) =>
      `*${i + 1}.* ${v.title.slice(0, 50)}\n👤 ${v.author.name} • ⏱ ${v.timestamp}`
    ).join('\n\n')

    const sent = await sock.sendMessage(jid, {
      text: `✨ *RESULTADOS*\n\n${menu}\n\n📌 Responde con:\n.descargar 1-${vids.length}`
    }, { quoted: msg })

    setSession(jid, sender, {
      type,
      results: vids,
      menuMsgId: sent.key.id,
      createdAt: now()
    })
  }
}
