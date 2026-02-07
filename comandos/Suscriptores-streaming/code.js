// comandos/code.js (FINAL 2026 – Mejorado UX + Botones + Reacciones)

import { getLatestNetflixCode } from '../../gmail/netflix.js'

export default {
  name: 'code',
  aliases: ['netflix', 'nfcode', 'codigo', 'netcode'],
  description: 'Obtiene el último código de verificación de Netflix desde Gmail',
  cooldown: 30,          // segundos entre usos
  privateOnly: true,     // 🔒 solo chat privado (más seguro)
  ownerOnly: false,

  async execute(sock, msg, ctx) {
    const jid = ctx.jid

    // 1. Reacción inmediata para feedback visual
    await sock.sendMessage(jid, {
      react: {
        text: '🔎',
        key: msg.key
      }
    })

    // 2. Mensaje de "buscando" (con typing indicator)
    await sock.sendPresenceUpdate('composing', jid)
    await ctx.reply({ text: '🔎 Buscando el código más reciente de *Netflix*...' })
    await sock.sendPresenceUpdate('available', jid) // termina typing

    try {
      const rawCode = await getLatestNetflixCode()

      if (!rawCode || !String(rawCode).trim()) {
        return ctx.reply({
          text: '❌ No se encontró ningún código reciente en Gmail.\n' +
                'Intenta de nuevo más tarde o verifica tu cuenta.'
        })
      }

      const code = String(rawCode).trim()

      // 3. Mensaje final bonito + botones interactivos
      const buttons = [
        {
          buttonId: 'copy_code',
          buttonText: { displayText: 'Copiar código' },
          type: 1
        },
        {
          buttonId: 'retry',
          buttonText: { displayText: 'Reintentar' },
          type: 1
        }
      ]

      await sock.sendMessage(jid, {
        text: `📩 *Código de verificación Netflix*\n\n` +
              `🔐 *${code}*\n\n` +
              `⏱ Válido por pocos minutos\n` +
              `⚠️ *No compartas este código con nadie*\n` +
              `Este código fue obtenido de tu Gmail recientemente.`,
        footer: 'Massi-Bot v2 • Seguro y privado',
        buttons,
        headerType: 1
      }, { quoted: msg })

      // Reacción de éxito
      await sock.sendMessage(jid, {
        react: {
          text: '✅',
          key: msg.key
        }
      })

    } catch (err) {
      console.error('Error en comando code:', err)

      // Diferenciamos errores comunes
      let errorMsg = '❌ Ocurrió un error al obtener el código. Intenta de nuevo.'

      if (err.message?.includes('auth') || err.message?.includes('login')) {
        errorMsg = '❌ Problema de autenticación con Gmail. Verifica credenciales.'
      } else if (err.message?.includes('timeout')) {
        errorMsg = '⏳ Tiempo de espera agotado. Gmail tardó demasiado.'
      }

      await ctx.reply({ text: errorMsg })

      // Reacción de error
      await sock.sendMessage(jid, {
        react: {
          text: '❌',
          key: msg.key
        }
      })

      throw err // para que el logger global lo registre
    }
  }
}