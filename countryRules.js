// countryRules.js
// Reglas de países permitidos para serbots

export const ALLOWED_COUNTRIES = {
  '52': 'México',
  '51': 'Perú',
  '58': 'Venezuela',
  '507': 'Panamá',
  '56': 'Chile',
  '506': 'Costa Rica',
  '57': 'Colombia'
}

export function validateCountry(number) {
  for (const code of Object.keys(ALLOWED_COUNTRIES)) {
    if (number.startsWith(code)) {
      return {
        ok: true,
        code,
        country: ALLOWED_COUNTRIES[code]
      }
    }
  }
  return { ok: false }
}
