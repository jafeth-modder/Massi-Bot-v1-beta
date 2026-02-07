// comandos/imagen.js
// Stroke negro + shadow negro + inner shadow color random (estable)

import { execFile } from "child_process"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"

const IMAGES_DIR = path.join(process.cwd(), "assets", "images")
const TMP_DIR = path.join(process.cwd(), "tmp")

// 🔤 Fuente con fallback
const FONT_PRIMARY = "/system/fonts/DancingScript-Regular.ttf"
const FONT_FALLBACK = "/system/fonts/Roboto-Regular.ttf"
const FONT = fsSync.existsSync(FONT_PRIMARY) ? FONT_PRIMARY : FONT_FALLBACK

// 🖼️ Fondos
const BACKGROUNDS = [
  "image1.png",
  "image2.png",
  "image3.png",
  "image4.png",
  "image5.png",
  "image6.png",
  "image7.png",
  "image8.png",
  "image9.png",
 "image10.png",
 "image11.png",
 "image12.png",
 "image13.png",
 "image14.png",
 "image15.png"
 
]

// 🎨 Colores para inner shadow (aleatorio)
const INNER_COLORS = [
  "#F472B6", // pink
  "#F47655", 
  "#FF362F", 
  "#60A5FA", // blue
  "#34D399", // green
  "#FBBF24", // yellow
  "#A78BFA", // purple
  "#FB7185"  // rose
]

// Utils
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)]

function escapeText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
}

// ✂️ Auto wrap
function smartWrap(text) {
  const words = text.split(" ")
  if (words.length <= 2) return text

  let lines = []
  let current = ""

  for (const w of words) {
    const test = current ? current + " " + w : w
    if (test.length > 14) {
      lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.join("\n")
}

// 🔠 Auto font-size
function calcFontSize(text) {
  const len = text.length
  if (len <= 6) return 210
  if (len <= 14) return 180
  if (len <= 28) return 150
  return 125
}

export default {
  name: "image",
  aliases: ["img"],
  cooldown: 5,

  async execute(sock, msg, ctx) {
    const raw = ctx.args.join(" ")
    if (!raw) {
      return ctx.reply({ text: "🖼️ Ejemplo:\n.image Bendiciones" })
    }

    await fs.mkdir(TMP_DIR, { recursive: true })

    const bg = randomItem(BACKGROUNDS)
    const innerColor = randomItem(INNER_COLORS)

    const input = path.join(IMAGES_DIR, bg)
    const output = path.join(TMP_DIR, `image_${Date.now()}.png`)

    const text = escapeText(smartWrap(raw))
    const FONT_SIZE = calcFontSize(raw)

    /**
     * CAPAS drawtext:
     * 1️⃣ Stroke negro (border)
     * 2️⃣ Inner shadow color (offset leve)
     * 3️⃣ Texto principal blanco
     */

    const filter =
      `scale=1080:1080,` +

      // 1️⃣ Stroke negro
      `drawtext=` +
      `fontfile=${FONT}:` +
      `text='${text}':` +
      `fontsize=${FONT_SIZE}:` +
      `fontcolor=white:` +
      `borderw=8:` +
      `bordercolor=black:` +
      `x=(w-text_w)/2:` +
      `y=(h-text_h)/2,` +

      // 2️⃣ Inner shadow color
      `drawtext=` +
      `fontfile=${FONT}:` +
      `text='${text}':` +
      `fontsize=${FONT_SIZE}:` +
      `fontcolor=${innerColor}@0.65:` +
      `x=(w-text_w)/2+2:` +
      `y=(h-text_h)/2+2,` +

      // 3️⃣ Texto principal + shadow negro
      `drawtext=` +
      `fontfile=${FONT}:` +
      `text='${text}':` +
      `fontsize=${FONT_SIZE}:` +
      `fontcolor=white:` +
      `shadowcolor=black@0.6:` +
      `shadowx=2:` +
      `shadowy=2:` +
      `line_spacing=24:` +
      `x=(w-text_w)/2:` +
      `y=(h-text_h)/2`

    execFile(
      "ffmpeg",
      ["-y", "-i", input, "-vf", filter, output],
      async (err, stdout, stderr) => {
        if (err) {
          console.error("FFMPEG ERROR:\n", stderr)
          return ctx.reply({ text: "⚠️ Error creando imagen." })
        }

        try {
          const buffer = await fs.readFile(output)
          await sock.sendMessage(
            ctx.jid,
            { image: buffer },
            { quoted: msg }
          )
        } finally {
          fs.unlink(output).catch(() => {})
        }
      }
    )
  }
}
