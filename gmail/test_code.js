import { getLatestNetflixCode } from './netflix.js'

const code = await getLatestNetflixCode()
console.log('Código:', code)
