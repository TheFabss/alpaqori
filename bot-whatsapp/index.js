/* ==========================================================
   Bot de WhatsApp — Alpaqori (beta, whatsapp-web.js)
   ⚠️ Librería NO oficial: úsala solo con un número de prueba.
   Ejecuta:  npm install  →  npm start  → escanea el QR
   Basado en el bot de Komakai (C:\proyectos\tienda-makis\bot-whatsapp).
   ========================================================== */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const {
  crearEstado, procesar, comprobante, procesarAdmin,
  avisoLocal, avisoComprobante, normalizar, TEXTO_AUDIO,
  TEXTO_INVITACION, aceptaInvitacion,
  esAvisoDelBot, ticketDeAviso, textoComanda,
  estadoDeRespuesta, comandoEstado, aplicarEstado, confirmarRecepcion, ESTADOS
} = require('./logica');
const memoria = require('./memoria');

const sesiones = new Map();            // número -> estado de la conversación
const ritmo = new Map();               // número -> marcas de tiempo de sus últimos mensajes (anti-bucle)
const colas = new Map();               // número -> promesa: atiende los mensajes de cada chat en orden
const invitados = new Map();           // número -> cuándo se le preguntó "¿Deseas empezar?"
const esperar = ms => new Promise(r => setTimeout(r, ms));

// Si el cliente manda dos mensajes seguidos, se responden uno tras otro (sin respuestas cruzadas)
function enCola(id, tarea) {
  const previa = colas.get(id) || Promise.resolve();
  const siguiente = previa.then(tarea, tarea);
  colas.set(id, siguiente.catch(() => {}));
  return siguiente;
}

// WhatsApp a veces identifica el chat con un ID interno ("...@lid") en vez del teléfono.
async function numeroReal(chatId) {
  if (chatId.endsWith('@lid')) {
    try {
      const [r] = await client.getContactLidAndPhone([chatId]);
      if (r && r.pn) return r.pn.split('@')[0];
    } catch (e) { /* si falla, usamos el ID tal cual */ }
  }
  return chatId.split('@')[0];
}

// "Escribiendo..." es solo estético: si falla, se ignora.
async function escribiendo(chatId) {
  try { await client.pupPage.evaluate(id => window.WWebJS.sendChatstate('typing', id), chatId); } catch (e) { /* sin indicador */ }
}

// Con IDs "@lid", si falla el envío probamos con el número real
function destinosDe(msg, numeroCliente) {
  const destinos = [msg.from];
  if (msg.from.endsWith('@lid') && /^\d+$/.test(numeroCliente)) destinos.push(`${numeroCliente}@c.us`);
  return destinos;
}

async function enviar(destinos, contenido, opciones) {
  let ultimoError;
  for (const id of destinos) {
    try { return await client.sendMessage(id, contenido, opciones); } catch (e) { ultimoError = e; }
  }
  throw ultimoError;
}

async function avisarLocal(contenido, opciones) {
  if (!config.NUMERO_LOCAL) return;
  try {
    // Se marca antes de enviar: si el local es el mismo número del bot, el aviso no debe leerse como comando
    if (typeof contenido === 'string') marcarDelBot(contenido);
    return await client.sendMessage(`${config.NUMERO_LOCAL}@c.us`, contenido, opciones);
  } catch (e) { console.error('   (no se pudo avisar al local)', e.message); }
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'alpaqori-bot' }), // guarda la sesión: no pide QR cada vez
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
  console.log('\n📱 Escanea este QR desde WhatsApp > Dispositivos vinculados > Vincular un dispositivo\n');
  qrcode.generate(qr, { small: true });
});

// whatsapp-web.js a veces se queda en "autenticada" sin llegar a "listo". Si pasa, reinicia conservando la sesión.
let listo = false, vigilante = null, reintentos = 0;
const SEGUNDOS_ESPERA_LISTO = Number(process.env.SEGUNDOS_ESPERA_LISTO) || 45;

async function reiniciar() {
  vigilante = null;
  if (listo) return;
  if (++reintentos > 3) {
    console.error('⚠️ Sigue sin cargar tras 3 intentos. Si en un minuto no aparece "listo": Ctrl+C, borra la carpeta .wwebjs_auth y vuelve a escanear el QR.');
    return;
  }
  console.log(`🔄 No terminó de cargar en ${SEGUNDOS_ESPERA_LISTO}s. Reiniciando (intento ${reintentos}/3), no hace falta escanear de nuevo...`);
  try { await client.destroy(); } catch (e) { /* ya estaba cerrado */ }
  client.initialize();
}

client.on('loading_screen', p => console.log(`⏳ Cargando WhatsApp... ${p}%`));
client.on('authenticated', () => {
  console.log('🔐 Sesión autenticada');
  if (!listo && !vigilante) vigilante = setTimeout(reiniciar, SEGUNDOS_ESPERA_LISTO * 1000);
});
client.on('auth_failure', m => console.error('❌ Error de autenticación:', m));
client.on('ready', () => {
  if (listo) return;
  listo = true;
  clearTimeout(vigilante); vigilante = null;
  console.log('✅ Bot de Alpaqori listo.');
  if (config.NUMEROS_PERMITIDOS.length) console.log('   Solo responde a:', config.NUMEROS_PERMITIDOS.join(', '));
  else if (config.PALABRA_ACTIVACION) console.log(`   Se activa cuando un chat escribe la palabra "${config.PALABRA_ACTIVACION}".`);
  else console.log('   ⚠️ Responde a CUALQUIER contacto que escriba (salvo NUMEROS_IGNORADOS).');
  if (!config.NUMERO_LOCAL) console.log('   ℹ️ NUMERO_LOCAL está vacío: los pedidos solo se muestran aquí, no se avisan por WhatsApp.');
  console.log('   Comandos del local (en "Mensaje a ti mismo"): #ayuda');
  cargarMiLid().then(() => { if (miLid) console.log(`   (tu chat propio también se reconoce como ${miLid})`); });
});
client.on('disconnected', r => console.log('⚠️ Desconectado:', r));

const TIPOS_ATENDIDOS = ['chat', 'location', 'image', 'ptt', 'audio'];

client.on('message', msg => {
  // Registro de cada mensaje que llega: si algo no responde, aquí se ve por qué
  console.log(`📩 Llegó de ${msg.from} (tipo ${msg.type}): ${String(msg.body || '').slice(0, 40)}`);
  // Ignorar grupos, estados y mensajes propios
  if (msg.fromMe || msg.isStatus || msg.from === 'status@broadcast' || msg.from.endsWith('@g.us')) {
    console.log('   (ignorado: mensaje propio, estado o grupo)');
    return;
  }
  if (!TIPOS_ATENDIDOS.includes(msg.type)) {
    console.log(`   (ignorado: tipo ${msg.type} no se responde)`);
    return;
  }
  enCola(msg.from, () => atender(msg));
});

async function atender(msg) {
  try {
    const numeroCliente = await numeroReal(msg.from);

    // Comandos desde el celular del local (si es otro teléfono distinto al del bot)
    if (config.NUMERO_LOCAL && numeroCliente === config.NUMERO_LOCAL && msg.type === 'chat') {
      if (msg.body.trim().startsWith('#') || msg.hasQuotedMsg) await atenderComandoLocal(msg, msg.from);
      return;
    }

    // Cuentas de empresa (operadoras, bancos...) tienen respuestas automáticas: se ignoran para evitar bucles
    try {
      const contacto = await msg.getContact();
      if (contacto.isBusiness) { console.log(`   (ignorado: ${numeroCliente} es cuenta de empresa)`); return; }
    } catch (e) { /* si no se puede leer el contacto, seguimos */ }

    // Freno anti-bucle: más de MAX_MENSAJES_30S mensajes en 30 s
    const ahora = Date.now();
    const historialMsgs = (ritmo.get(numeroCliente) || []).filter(t => ahora - t < 30000);
    historialMsgs.push(ahora);
    ritmo.set(numeroCliente, historialMsgs);
    if (historialMsgs.length > (config.MAX_MENSAJES_30S || 20)) {
      const estadoRitmo = sesiones.get(numeroCliente) || crearEstado(numeroCliente);
      estadoRitmo.pausadoHasta = ahora + 2 * 60000;
      sesiones.set(numeroCliente, estadoRitmo);
      console.log(`   (ignorado: ${numeroCliente} escribe demasiado seguido; posible bucle)`);
      return;
    }

    // Filtro de seguridad
    if ((config.NUMEROS_IGNORADOS || []).includes(numeroCliente)) {
      console.log(`   (ignorado: ${numeroCliente} está en NUMEROS_IGNORADOS)`);
      return;
    }
    if (config.NUMEROS_PERMITIDOS.length && !config.NUMEROS_PERMITIDOS.includes(numeroCliente)) {
      console.log(`   (ignorado: ${numeroCliente} no está en NUMEROS_PERMITIDOS)`);
      return;
    }

    // Confirmación de recepción: "¿Lo recibiste conforme? Responde SI"
    if (msg.type === 'chat') {
      const activa = sesiones.get(numeroCliente);
      if (!(activa && activa.paso === 'confirmar')) {
        const rec = confirmarRecepcion(numeroCliente, msg.body);
        if (rec) {
          console.log(`🤝 ${numeroCliente} confirmó que recibió #${rec.comanda.ticket}`);
          await responder({ destinos: destinosDe(msg, numeroCliente) }, msg.from, rec.respuestas);
          const mensaje = await mensajeDeComanda(rec.comanda, null);
          if (mensaje) await editarYReaccionar(mensaje, textoComanda(mensaje.body, rec.comanda), ESTADOS.recibido.emoji);
          await avisarLocal(rec.mensajeLocal);
          return;
        }
      }
    }

    let estado = sesiones.get(numeroCliente);
    if (!estado) {
      if (msg.type !== 'chat') return;   // una conversación nueva empieza con texto
      const palabra = normalizar(config.PALABRA_ACTIVACION);
      // Entra directo: números permitidos, pedidos que llegan desde la web, o la palabra de activación
      const desdeWeb = /hola alpaqori/i.test(msg.body) && /quiero hacer este pedido|quiero pedir el menú del día/i.test(msg.body);
      const conPalabra = config.NUMEROS_PERMITIDOS.length > 0 || desdeWeb || (palabra !== '' && normalizar(msg.body).includes(palabra));
      if (!conPalabra) {
        // Sin la palabra de activación: se le pregunta una sola vez si desea empezar
        const invitadoEn = invitados.get(numeroCliente);
        const reciente = invitadoEn && Date.now() - invitadoEn < config.HORAS_INVITACION * 3600000;
        if (reciente) {
          if (!aceptaInvitacion(msg.body)) return;
          invitados.delete(numeroCliente);
          console.log(`👋 ${numeroCliente} aceptó la invitación`);
        } else {
          if (!config.INVITAR_SIN_PALABRA) return;
          invitados.set(numeroCliente, Date.now());
          console.log(`👋 ${numeroCliente} escribió por primera vez: se le invita a empezar (responde "si")`);
          await responder({ destinos: destinosDe(msg, numeroCliente) }, msg.from, [TEXTO_INVITACION]);
          return;
        }
      }
      estado = crearEstado(numeroCliente);
      sesiones.set(numeroCliente, estado);
    }
    estado.numero = numeroCliente;
    estado.destinos = destinosDe(msg, numeroCliente);

    // Si lo está atendiendo una persona, el bot no interviene
    if (estado.pausadoHasta > Date.now()) return;

    if (msg.type === 'ptt' || msg.type === 'audio') {
      console.log(`🎧 ${numeroCliente}: audio`);
      await responder(estado, msg.from, [TEXTO_AUDIO]);
      return;
    }

    // Imagen: si espera el comprobante de Yape/Plin, lo pasa a caja
    if (msg.type === 'image') {
      const c = comprobante(estado);
      if (!c) return;
      console.log(`💳 ${numeroCliente}: comprobante del pedido #${c.ticket}`);
      await responder(estado, msg.from, c.respuestas);
      try {
        const media = await msg.downloadMedia();
        if (media) await avisarLocal(media, { caption: avisoComprobante(c.ticket, numeroCliente) });
      } catch (e) {
        await avisarLocal(`${avisoComprobante(c.ticket, numeroCliente)}\n_(no se pudo reenviar la imagen; revísala en el chat del cliente)_`);
      }
      return;
    }

    const extra = {};
    if (msg.type === 'location' && msg.location) {
      extra.ubicacion = { lat: msg.location.latitude, lng: msg.location.longitude };
      console.log(`📍 ${numeroCliente}: ubicación ${extra.ubicacion.lat}, ${extra.ubicacion.lng}`);
    } else {
      console.log(`💬 ${numeroCliente}: ${msg.body.split('\n')[0]}`);
    }

    const { respuestas, pedido, humano } = procesar(estado, msg.type === 'chat' ? msg.body : '', extra);
    await responder(estado, msg.from, respuestas);

    if (humano) {
      console.log(`🙋 ${numeroCliente} pide hablar con una persona (escribe #fin al terminar)`);
      await avisarLocal(`🙋 *Cliente pide atención*\n📱 ${numeroCliente}\n\nRespóndele desde este WhatsApp. Al terminar, escribe *#fin ${numeroCliente.replace(/^51/, '')}* para reactivar el bot.`);
    }

    if (pedido) {
      console.log(`🧾 Pedido #${pedido.ticket} de ${numeroCliente}: S/ ${pedido.total.toFixed(2)}${pedido.desdeWeb ? ' (web)' : ''}`);
      const enviado = await avisarLocal(avisoLocal(pedido, numeroCliente));
      // Se guarda qué mensaje es la comanda, para poder cambiar su estado respondiéndola
      if (enviado && enviado.id) memoria.guardarIdComanda(pedido.ticket, enviado.id._serialized);
    }
  } catch (err) {
    console.error('Error procesando mensaje:', err);
  }
}

async function responder(estado, chatId, respuestas) {
  for (const texto of respuestas) {
    await escribiendo(chatId);
    await esperar(config.DEMORA_MS);
    marcarDelBot(texto);
    await enviar(estado.destinos, texto);
  }
}

/* ---------- Comandos del asesor y del local ----------
   Se escriben desde el WhatsApp del bot, en "Mensaje a ti mismo" (el cliente no ve nada):
   #fin 987654321 / #pausa 987654321   → atención por una persona
   #resumen, #pendientes, #tiempo 40, #menu, #ayuda → control del local */
const textosDelBot = new Set();   // para distinguir mensajes del bot de los del asesor
function marcarDelBot(texto) {
  textosDelBot.add(texto);
  setTimeout(() => textosDelBot.delete(texto), 15000);
}

// Borra el comando "para todos". Espera a que WhatsApp lo confirme: si se borra al instante, falla.
async function borrarComando(msg) {
  for (const espera of [1500, 3000]) {
    await esperar(espera);
    try { await msg.delete(true); return; } catch (e) { /* reintenta */ }
  }
  console.log('   (no se pudo borrar el comando; usa "Mensaje a ti mismo" para que el cliente no lo vea)');
}

/* ---------- Estados de las comandas ----------
   El personal responde a la comanda con "preparando", "listo", "en ruta" o "entregado" (o usa #listo 12).
   WhatsApp solo deja editar un mensaje durante 15 minutos: después queda la reacción y una confirmación. */
async function editarYReaccionar(mensaje, texto, emoji) {
  let editado = false;
  try { editado = Boolean(await mensaje.edit(texto)); } catch (e) { /* fuera del plazo de edición */ }
  try { await mensaje.react(emoji); } catch (e) { /* sin reacción */ }
  return editado;
}

async function enviarAlLocal(chatId, texto) {
  marcarDelBot(texto);
  await client.sendMessage(chatId, texto);
}

async function avisarCliente(numero, texto) {
  if (!texto || !/^\d{8,15}$/.test(numero || '')) return;
  try {
    marcarDelBot(texto);
    await client.sendMessage(`${numero}@c.us`, texto);
  } catch (e) { console.error('   (no se pudo avisar al cliente)', e.message); }
}

async function mensajeDeComanda(comanda, citado) {
  if (citado) return citado;
  if (!comanda || !comanda.msgId) return null;
  try { return await client.getMessageById(comanda.msgId); } catch (e) { return null; }
}

async function cambiarEstadoComanda(ticket, estado, chatId, citado) {
  const r = aplicarEstado(ticket, estado);
  if (r.error) { await enviarAlLocal(chatId, r.error); return; }
  const mensaje = await mensajeDeComanda(r.comanda, citado);
  const editado = mensaje ? await editarYReaccionar(mensaje, textoComanda(mensaje.body, r.comanda), ESTADOS[estado].emoji) : false;
  console.log(`${ESTADOS[estado].emoji} #${ticket} → ${ESTADOS[estado].corto}${editado ? '' : ' (sin editar: más de 15 min)'}`);
  if (!editado || !citado) await enviarAlLocal(chatId, r.mensajeLocal);
  await avisarCliente(r.comanda.numero, r.avisoCliente);
}

// Atiende las respuestas a comandas, "#listo 12" y los demás comandos del local. Devuelve true si era para el bot.
async function atenderComandoLocal(msg, chatId) {
  if (msg.hasQuotedMsg) {
    const estado = estadoDeRespuesta(msg.body);
    if (!estado) return false;
    const citado = await msg.getQuotedMessage().catch(() => null);
    if (!citado || !citado.fromMe || !esAvisoDelBot(citado.body)) return false;
    const ticket = ticketDeAviso(citado.body);
    if (ticket) { await cambiarEstadoComanda(ticket, estado, chatId, citado); return true; }
    return false;
  }

  const ce = comandoEstado(msg.body);
  if (ce) { await cambiarEstadoComanda(ce.ticket, ce.estado, chatId, null); return true; }

  const admin = procesarAdmin(msg.body);
  if (admin) {
    console.log(`⚙️ Comando del local: ${msg.body.trim()}`);
    await enviarAlLocal(chatId, admin);
    return true;
  }
  return false;
}

function aplicarComando(comando, numeroCliente, estado) {
  if (comando === '#fin') {
    estado.pausadoHasta = 0;
    console.log(`✅ Asesor terminó con ${numeroCliente}: bot reactivado`);
    const { respuestas } = procesar(estado, 'menu');
    return responder(estado, estado.destinos[0], ['¡Gracias por tu paciencia! 😊 ¿Te ayudo con algo más?', ...respuestas]);
  }
  // #pausa o cualquier mensaje escrito a mano: el bot se calla en ese chat
  const yaPausado = estado.pausadoHasta > Date.now();
  estado.pausadoHasta = Date.now() + config.MINUTOS_PAUSA_HUMANO * 60000;
  if (!yaPausado) console.log(`🙋 Asesor atendiendo a ${numeroCliente}: bot en pausa (escribe #fin al terminar)`);
}

// "Mensaje a ti mismo" puede venir con tu número (…@c.us) o con tu ID interno de WhatsApp (…@lid)
let miLid = null;
async function cargarMiLid() {
  try {
    miLid = await client.pupPage.evaluate(() => {
      const u = window.require('WAWebUserPrefsMeUser').getMaybeMeLidUser();
      return u ? (u._serialized || String(u)) : null;
    });
  } catch (e) { miLid = null; }
}
function esMiChat(msg, numeroChat) {
  if (!client.info) return false;
  const yo = client.info.wid;
  return numeroChat === yo.user || msg.to === yo._serialized || (miLid && msg.to === miLid) || msg.to === msg.from;
}

client.on('message_create', async msg => {
  try {
    if (!msg.fromMe || msg.type !== 'chat' || msg.to.endsWith('@g.us') || msg.to === 'status@broadcast') return;
    if (textosDelBot.has(msg.body)) return;                       // lo envió el bot
    const numeroChat = await numeroReal(msg.to);
    const texto = normalizar(msg.body);

    // Comandos desde "Mensaje a ti mismo"
    if (esMiChat(msg, numeroChat)) {
      console.log(`📝 Mensaje a ti mismo: "${msg.body.trim().slice(0, 40)}"${msg.hasQuotedMsg ? ' (respondiendo a un mensaje)' : ''}`);
      if (await atenderComandoLocal(msg, msg.to)) return;
      const m = texto.match(/^(#fin|#pausa)\s*\+?([\d\s]+)$/);
      if (!m) return;
      let numero = m[2].replace(/\s/g, '');
      if (numero.length === 9) numero = '51' + numero;
      const estado = sesiones.get(numero);
      if (!estado) return console.log(`   (${m[1]}: no hay conversación activa con ${numero})`);
      return await aplicarComando(m[1], numero, estado);
    }

    if (numeroChat === config.NUMERO_LOCAL) return;                // avisos al local
    const estado = sesiones.get(numeroChat);
    if (!estado) return;                                           // chat que el bot no atiende
    if (texto === '#fin' || texto === '#pausa') borrarComando(msg);
    await aplicarComando(texto === '#fin' ? '#fin' : '#pausa', numeroChat, estado);
  } catch (err) {
    console.error('Error con mensaje del asesor:', err);
  }
});

// Limpia conversaciones inactivas
setInterval(() => {
  const limite = Date.now() - config.MINUTOS_SESION * 60000;
  for (const [id, e] of sesiones) if (e.ultimo < limite && e.pausadoHasta < Date.now()) sesiones.delete(id);
}, 5 * 60000);

// Cierre limpio con Ctrl+C: evita que Chrome quede abierto y bloquee .wwebjs_auth (Windows)
process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando el bot...');
  try { await client.destroy(); } catch (e) { /* ya estaba cerrado */ }
  process.exit(0);
});

/* WhatsApp Web cambia seguido. Si la sesión guardada se cerró, la página de "sesión cerrada" no trae
   lo que la librería necesita y falla con "reading 'Socket'" antes de mostrar el QR. */
client.initialize().catch((err) => {
  const texto = String((err && err.message) || err);
  console.error('\n❌ No se pudo abrir WhatsApp Web:', texto);
  if (/Socket|Execution context was destroyed/.test(texto)) {
    console.error('   La sesión vinculada de este bot se cerró (o WhatsApp cambió su web).');
    console.error('   Revisa en el celular: WhatsApp > Dispositivos vinculados. Si ya no aparece, copia una sesión');
    console.error('   que funcione a .wwebjs_auth/session-alpaqori-bot (ver LEEME.md) o usa: npm run api');
  }
  process.exit(1);
});
