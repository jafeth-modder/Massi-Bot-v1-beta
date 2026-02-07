export default {
  name: 'test',
  async execute(sock, msg, ctx) {
    console.log('🔥 TEST EJECUTADO');
    return ctx.reply('✅ TEST OK');
  }
}
