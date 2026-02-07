import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import util from 'util'
import { fileURLToPath } from 'url'

const execAsync = util.promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')

export default {
  name: 'gay',
  groupOnly: true,
  cooldown: 8,

  async execute(sock, msg, ctx) {
    const { jid, reply } = ctx

    const mentioned =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mentioned) {
      return reply('🌈 Usa: *.gay @usuario*')
    }

    const tmpDir = path.join(ROOT, 'tmp')
    await fs.mkdir(tmpDir, { recursive: true })

    const avatar = path.join(tmpDir, 'avatar.jpg')
    const out = path.join(tmpDir, 'gay_final.png')
    const overlay = path.join(ROOT, 'assets', 'bandera_gay.png')

    // 📥 Descargar foto de perfil
    let url
    try {
      url = await sock.profilePictureUrl(mentioned, 'image')
    } catch {
      return reply('❌ El usuario no tiene foto de perfil')
    }

    const res = await fetch(url)
    await fs.writeFile(avatar, Buffer.from(await res.arrayBuffer()))

    // 🖼️ Composición FINAL (bandera 40% encima)
    const cmd = `
      magick
      "${avatar}"
      -resize 1080x1080^
      -gravity center
      -extent 1080x1080
      "(" "${overlay}" -resize 1080x1080 -alpha on ")"
      -compose dissolve
      -define compose:args=40,100
      -composite
      "${out}"
    `.replace(/\n/g, ' ')

    try {
      await execAsync(cmd)
    } catch (e) {
      console.error(e)
      return reply('❌ Error procesando la imagen')
    }

    const tag = `@${mentioned.split('@')[0]}`

    await sock.sendMessage(
      jid,
      {
        image: await fs.readFile(out),
        caption: `🌈 ${tag}\nRespeto ante todo 💖 siempre lo sospechaba no te preocupéis ya era hora de salir `,
        mentions: [mentioned]
      },
      { quoted: msg }
    )

    // 🧹 Limpieza
    fs.unlink(avatar).catch(() => {})
    fs.unlink(out).catch(() => {})
  }
}
