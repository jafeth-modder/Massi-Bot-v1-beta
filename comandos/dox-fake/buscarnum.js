// comandos/buscanum.js
// VERSIÓN FINAL - Prefijo flexible (3-8 dígitos) + envío en 2 mensajes + pausas 10-30s

export default {
  name: 'buscanum',
  aliases: ['bn', 'buscar-num', 'numeros'],
  description: 'Busca números activos con prefijo flexible (ej: 665, 6654, 6651816)',
  cooldown: 120,
  ownerOnly: false,
  async execute(sock, msg, { reply, args, isOwner }) {
    if (args.length === 0) {
      return reply(
        `Uso:\n` +
        `.buscanum <prefijo 3-8 dígitos> [cantidad=15]\n\n` +
        `Ejemplos:\n` +
        `  .buscanum 665           → +507665xxxxxxx\n` +
        `  .buscanum 6654 10       → +5076654xxxxxx\n` +
        `  .buscanum 665416        → +507665416xxxx\n` +
        `  .buscanum 6651816       → +5076651816xx\n\n` +
        `Aleatorio para mejores chances. Pausas 10-30s.`
      );
    }

    let prefijoShort = args[0].replace(/\D/g, '');
    if (prefijoShort.length < 3 || prefijoShort.length > 8) {
      return reply('Prefijo debe tener **3 a 8 dígitos** (ej: 665, 6654, 6651816).');
    }

    const prefijo = '507' + prefijoShort;
    const sufijoDigits = 8 - prefijoShort.length; // cuántos dígitos random faltan para 8 totales
    const maxSufijo = Math.pow(10, sufijoDigits) - 1;
    const cantidad = args[1] ? parseInt(args[1], 10) : 15;

    if (isNaN(cantidad) || cantidad < 5 || cantidad > 30) {
      return reply('Cantidad: 5 a 30 (ideal 10-20).');
    }

    await reply(
      `🔍 Buscando ${cantidad} números en +507${prefijoShort}${'x'.repeat(sufijoDigits)}...\n` +
      `Tiempo aprox: ${Math.round(cantidad * 0.4)}–${Math.round(cantidad * 0.6)} min\n` +
      `⏳ Iniciando...`
    );

    const resultados = [];
    let chequeados = 0;

    // Genera sufijos random únicos
    const sufijos = new Set();
    while (sufijos.size < cantidad * 2) {
      const rand = Math.floor(Math.random() * (maxSufijo + 1));
      sufijos.add(rand);
    }
    const sufijosArray = Array.from(sufijos);

    for (let i = 0; i < cantidad && i < sufijosArray.length; i++) {
      const sufijo = sufijosArray[i].toString().padStart(sufijoDigits, '0');
      const fullNum = prefijo + sufijo;
      const jid = `${fullNum}@s.whatsapp.net`;

      let bioInfo = 'Sin bio pública';

      try {
        const [result] = await sock.onWhatsApp(jid);
        if (result?.exists) {
          try {
            const status = await sock.fetchStatus(jid);
            if (status?.status) bioInfo = `"${status.status}"`;
          } catch {}

          resultados.push({ numero: fullNum, bio: bioInfo });
          console.log(`[+] Encontrado: wa.me/+${fullNum} | Bio: ${bioInfo}`);
        }
      } catch (err) {
        console.error(`Error ${fullNum}: ${err?.message || err}`);
      }

      chequeados++;

      if (chequeados % 5 === 0 || chequeados === cantidad) {
        await reply(`⏳ ${chequeados}/${cantidad} chequeados • Encontrados: ${resultados.length}`);
      }

      await new Promise(r => setTimeout(r, 10000 + Math.random() * 20000)); // 10-30s
    }

    if (resultados.length === 0) {
      await reply(`❌ Ninguno encontrado (chequeados ${chequeados}). Prueba otro prefijo.`);
      return;
    }

    // Mensaje 1: Validación / Resumen
    await reply(
      `✅ Validación final:\n` +
      `Encontré ${resultados.length} números activos en +507${prefijoShort}...\n` +
      `Chequeados: ${chequeados}\n` +
      `Enviando resultados...`
    );

    // Mensaje 2: Lista de resultados
    let lista = '';
    resultados.forEach((item, idx) => {
      lista += `${idx + 1}. wa.me/+${item.numero}\n`;
      lista += `Bio: ${item.bio}\n\n`;
    });

    try {
      await reply(lista);
    } catch {
      // Si falla por longitud, envía uno por uno
      await reply('Lista larga, enviando uno por uno...');
      for (const item of resultados) {
        await reply(`wa.me/+${item.numero}\nBio: ${item.bio}`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
};