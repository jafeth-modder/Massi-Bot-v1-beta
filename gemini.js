// gemini.js
import axios from 'axios'
import logger from './logger/logger.js'

/* ===================== CONFIG ===================== */

if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY no definida en el entorno')
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-1.5-flash'
const MAX_HISTORY = 20

/* ===================== MEMORIA ===================== */
// key = jid o jid:usuario (lo define ai.js)
const chatHistorial = new Map()

/* ===================== MAIN ===================== */

export async function preguntarGemini(pregunta, contextKey) {
  try {
    let historial = [...(chatHistorial.get(contextKey) || [])]

    const contents = [
      ...historial,
      {
        role: 'user',
        parts: [{ text: pregunta }]
      }
    ]

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      { contents },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 30000
      }
    )

    const texto =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      '🤖 No obtuve una respuesta válida.'

    // Guardar historial
    historial.push({ role: 'user', parts: [{ text: pregunta }] })
    historial.push({ role: 'model', parts: [{ text: texto }] })

    if (historial.length > MAX_HISTORY) {
      historial = historial.slice(-MAX_HISTORY)
    }

    chatHistorial.set(contextKey, historial)

    return texto
  } catch (error) {
    const status = error?.response?.status
    const data = error?.response?.data || error.message

    logger.error({ status, data }, 'Gemini Error')

    if (status === 429) {
      return '⏳ Límite de uso alcanzado. Intenta más tarde.'
    }

    if (status === 403) {
      return '🔑 API Key inválida o bloqueada.'
    }

    if (status === 404) {
      return '❌ Modelo de Gemini no disponible.'
    }

    if (status === 400) {
      return '⚠️ Error en el formato de la solicitud.'
    }

    return '❌ Error al conectar con Gemini.'
  }
}

/* ===================== UTILS ===================== */

export function clearGeminiHistorial(contextKey) {
  chatHistorial.delete(contextKey)
}

export function clearAllGeminiHistorial() {
  chatHistorial.clear()
}
