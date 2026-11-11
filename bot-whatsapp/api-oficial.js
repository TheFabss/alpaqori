/* ==========================================================
   Bot de Alpaqori con la API oficial de WhatsApp (Meta Cloud API)
   Ejecuta:  npm run api          (lee WA_TOKEN, WA_PHONE_ID y WA_VERIFY_TOKEN de .env)
   Prueba sin enviar nada:  DRY_RUN=1 npm run api

   - GET  /webhook  → Meta verifica la URL con WA_VERIFY_TOKEN
   - POST /webhook  → Meta envía aquí cada mensaje que recibe el número
   La conversación es la misma de index.js (logica.js). Solo cambia cómo llega y cómo sale el mensaje.
   ========================================================== */
const http = require('http');
const config = require('./config');
const {
  crearEstado, procesar, procesarAdmin, avisoLocal, normalizar,
  TEXTO_AUDIO, TEXTO_INVITACION, aceptaInvitacion, comandoEstado, aplicarEstado
} = require('./logica');

const TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.WA_PHONE_ID;
const VERIFY = process.env.WA_VERIFY_TOKEN;
const PUERTO = Number(process.env.PORT) || 3000;
const SIMULADO = process.env.DRY_RUN === '1';
// En pruebas, el número del local debe ser tu celular personal (el que recibe las comandas)
const LOCAL = process.env.NUMERO_LOCAL || config.NUMERO_LOCAL;
const API = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;

if (!SIMULADO && (!TOKEN || !PHONE_ID || !VERIFY)) {
  console.error('❌ Faltan WA_TOKEN, WA_PHONE_ID o WA_VERIFY_TOKEN en .env');
  process.exit(1);
}

const sesiones = new Map();     // número -> estado de la conversación
const invitados = new Map();    // número -> cuándo se le invitó a empezar
const colas = new Map();        // número -> promesa: un mensaje después de otro, sin respuestas cruzadas
const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Envío ---------- */
// Meta a veces identifica al cliente con un identificador (p. ej. "PE.2286…") en vez de su número.
// Si no hay número, en pruebas se responde al número de WA_DESTINO_PRUEBA (tu celular en la lista de destinatarios).
function destinoDe(para) {
  if (/^\d+$/.test(para)) return para;
  return process.env.WA_DESTINO_PRUEBA || para;
}

async function enviarTexto(para, texto) {
  const destino = destinoDe(para);
  if (SIMULADO) {
    console.log(`   [prueba] → ${destino}:\n${texto.split('\n').map(l => '      ' + l).join('\n')}`);
    return;
  }
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: destino, type: 'text', text: { body: texto.slice(0, 4000), preview_url: false } })
  });
  if (!r.ok) console.error(`   ⚠️ Meta respondió ${r.status} al enviar a ${destino}: ${await r.text()}`);
}

async function responder(para, respuestas) {
  for (const texto of respuestas) {
    await esperar(config.DEMORA_MS);
    await enviarTexto(para, texto);
  }
}

/* ---------- Comandos del local (se escriben desde el celular del local al número del bot) ----------
   En la API oficial no se puede responder citando una comanda: usa #preparando 12, #listo 12, #ruta 12, #entregado 12 */
async function atenderLocal(texto) {
  const ce = comandoEstado(texto);
  if (ce) {
    const r = aplicarEstado(ce.ticket, ce.estado);
    await enviarTexto(LOCAL, r.error || r.mensajeLocal);
    if (!r.error && r.avisoCliente && r.comanda.numero) await enviarTexto(r.comanda.numero, r.avisoCliente);
    return;
  }
  const admin = procesarAdmin(texto);
  await enviarTexto(LOCAL, admin || 'Comando no reconocido. Escribe #ayuda.');
}

/* ---------- Un mensaje entrante ---------- */
async function atender(m) {
  const de = m.from;                       // número sin "+", ej. 51987654321
  const texto = m.type === 'text' ? m.text.body : '';

  // El celular del local solo da órdenes con "#" (#listo 12, #resumen…); lo demás se atiende como un cliente más
  if (de === LOCAL && texto.trim().startsWith('#')) {
    await atenderLocal(texto.trim());
    return;
  }

  // Audios e imágenes: el bot solo entiende texto y ubicación
  if (m.type === 'audio' || m.type === 'voice') {
    if (sesiones.has(de)) await responder(de, [TEXTO_AUDIO]);
    return;
  }

  const extra = {};
  if (m.type === 'location') extra.ubicacion = { lat: m.location.latitude, lng: m.location.longitude };
  else if (m.type !== 'text') return;

  // Mensajes que llegan desde la carta web entran directo (no necesitan "si")
  const desdeWeb = /hola alpaqori/i.test(texto) && /quiero hacer este pedido|quiero pedir el menú del día/i.test(texto);
  const conPalabra = desdeWeb || (config.PALABRA_ACTIVACION && normalizar(texto).includes(normalizar(config.PALABRA_ACTIVACION)));

  let estado = sesiones.get(de);
  if (!estado) {
    if (!conPalabra) {
      const invitadoEn = invitados.get(de);
      const reciente = invitadoEn && Date.now() - invitadoEn < config.HORAS_INVITACION * 3600000;
      if (reciente) {
        // Ya se le invitó: solo "si" abre el pedido; cualquier otra cosa no recibe respuesta
        if (!aceptaInvitacion(texto)) return;
        invitados.delete(de);
      } else {
        if (!config.INVITAR_SIN_PALABRA) return;
        invitados.set(de, Date.now());
        await responder(de, [TEXTO_INVITACION]);
        return;
      }
    }
    estado = crearEstado(de);
    sesiones.set(de, estado);
  }
  estado.numero = de;

  if (estado.pausadoHasta > Date.now()) return;   // lo atiende una persona

  const { respuestas, pedido, humano } = procesar(estado, texto, extra);
  await responder(de, respuestas);

  if (humano && LOCAL) await enviarTexto(LOCAL, `🙋 Cliente ${de} pide atención. Respóndele desde el WhatsApp del bot.`);
  if (pedido && LOCAL) {
    // Con la API oficial no se leen respuestas citadas: el pie indica los comandos con "#"
    const n = Number(pedido.ticket.slice(4));
    const pie = `✋ _Escribe *#preparando ${n}*, *#listo ${n}*${pedido.modalidad === 'delivery' ? `, *#ruta ${n}*` : ''} o *#entregado ${n}*._`;
    await enviarTexto(LOCAL, avisoLocal(pedido, de).replace(/✋ _Responde a este mensaje[^\n]*$/, pie));
  }
}

/* Un mensaje detrás de otro por cada cliente */
function encolar(de, tarea) {
  const previa = colas.get(de) || Promise.resolve();
  const siguiente = previa.then(tarea, tarea);
  colas.set(de, siguiente.catch(() => {}));
  return siguiente;
}

/* ---------- Servidor ---------- */
function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    let datos = '';
    req.on('data', trozo => { datos += trozo; if (datos.length > 1e6) req.destroy(); });
    req.on('end', () => resolver(datos));
    req.on('error', rechazar);
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/webhook') { res.writeHead(404); return res.end(); }

  // Verificación de la URL al configurarla en Meta
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY;
    if (ok) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(url.searchParams.get('hub.challenge')); }
    res.writeHead(403); return res.end();
  }

  if (req.method === 'POST') {
    let cuerpo;
    try { cuerpo = JSON.parse(await leerCuerpo(req)); } catch (e) { res.writeHead(400); return res.end(); }
    // Meta exige respuesta 200 rápida; el proceso sigue en segundo plano
    res.writeHead(200); res.end('EVENT_RECEIVED');

    for (const entrada of cuerpo.entry || []) {
      for (const cambio of entrada.changes || []) {
        const valor = cambio.value || {};
        // El número del cliente viene en "from" y, si falta, en la sección "contacts"
        const waId = (valor.contacts || [])[0] && valor.contacts[0].wa_id;
        for (const m of valor.messages || []) {
          // Meta ya envía "from_user_id" (identificador del usuario); a ese identificador se responde
          const de = m.from || m.from_user_id || waId;
          if (!de) {
            console.log('⚠️ Mensaje sin número de remitente. Campos recibidos:', JSON.stringify(m));
            continue;
          }
          m.from = de;
          console.log(`📩 ${de} (${m.type}): ${(m.text && m.text.body || '').slice(0, 40)}`);
          encolar(de, () => atender(m)).catch(err => console.error('Error procesando mensaje:', err));
        }
      }
    }
    return;
  }

  res.writeHead(405); res.end();
});

servidor.listen(PUERTO, () => {
  console.log(`✅ Bot de Alpaqori (API oficial) escuchando en http://localhost:${PUERTO}/webhook`);
  console.log(SIMULADO ? '   Modo prueba: los mensajes se muestran aquí, no se envían a WhatsApp.' : '   Modo real: los mensajes se envían con la API de Meta.');
});
