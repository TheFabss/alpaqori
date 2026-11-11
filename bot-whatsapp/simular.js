/* Prueba el bot en la terminal, sin WhatsApp:  npm run simular
   Atajos del simulador:
   /foto        → simula que el cliente envía la captura de Yape
   /ubicacion   → simula que el cliente envía su ubicación con el clip
   /audio       → simula una nota de voz
   /web         → simula un pedido enviado desde la carta web
   #resumen, #pendientes, #tiempo 40, #menu, #ayuda → comandos del local */
const readline = require('readline');
const path = require('path');
// El simulador guarda su memoria aparte: así no suma pedidos de prueba al #resumen del bot real
process.env.ALPAQORI_DATOS = process.env.ALPAQORI_DATOS || path.join(__dirname, 'datos-simulador.json');
const { crearEstado, procesar, comprobante, procesarAdmin, avisoLocal, avisoComprobante, TEXTO_AUDIO } = require('./logica');

const NUMERO = '51900000000';
const estado = crearEstado(NUMERO);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\n🧑 Tú: ' });
const bot = textos => textos.forEach(r => console.log(`\n🤖 Bot:\n${r}`));
const local = texto => console.log(`\n----- Aviso que recibe el local -----\n${texto}`);

const PEDIDO_WEB = [
  'Hola Alpaqori, quiero hacer este pedido:',
  '- 2 x Lomo saltado (S/ 64.00)',
  '   Nota: sin cebolla',
  '- 1 x Cuy frito (medio) (S/ 42.00)',
  '- 1 x Chicha morada (1 L) (S/ 18.00)',
  '',
  'Entrega: Delivery',
  'Dirección: Jr. Lima 123, Chosica (frente a la botica)',
  'Nombre: Fabián',
  'Pago: Efectivo (paga con S/ 150.00)',
  'Subtotal: S/ 124.00',
  'Delivery (referencial): S/ 8.00',
  'Total: S/ 132.00'
].join('\n');

console.log('Simulador del bot de Alpaqori. Escribe "hola alpaqori" para empezar (Ctrl+C para salir).');
console.log('Atajos: /web  /foto  /ubicacion  /audio  y comandos del local: #resumen  #pendientes  #tiempo 40  #ayuda');
rl.prompt();
rl.on('line', linea => {
  let texto = linea.trim();
  if (!texto) return rl.prompt();   // WhatsApp no envía mensajes vacíos

  if (texto.startsWith('#')) {
    const r = procesarAdmin(texto);
    console.log(`\n⚙️ Local:\n${r || 'Comando no reconocido. Prueba #ayuda'}`);
    return rl.prompt();
  }
  if (texto === '/audio') { bot([TEXTO_AUDIO]); return rl.prompt(); }
  if (texto === '/foto') {
    const c = comprobante(estado);
    if (c) { bot(c.respuestas); local(avisoComprobante(c.ticket, NUMERO) + '\n(+ la imagen del comprobante)'); }
    else console.log('\n(el bot ignora la imagen: no espera ningún comprobante)');
    return rl.prompt();
  }
  if (texto === '/web') { console.log(`\n(mensaje de la web)\n${PEDIDO_WEB}`); texto = PEDIDO_WEB; }

  const extra = texto === '/ubicacion' ? { ubicacion: { lat: -11.9372, lng: -76.6968 } } : {};
  const { respuestas, pedido, humano } = procesar(estado, extra.ubicacion ? '' : texto, extra);
  bot(respuestas);
  if (pedido) local(avisoLocal(pedido, NUMERO));
  if (humano) console.log('\n----- El bot se calla en este chat: lo atiende una persona -----');
  rl.prompt();
});
