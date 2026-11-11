/* ==========================================================
   Lógica conversacional del bot de Alpaqori (independiente de WhatsApp)
   procesar(estado, texto, extra) -> { respuestas: string[], pedido?, humano? }
   La usan index.js (WhatsApp), simular.js (terminal) y pruebas.js.
   Basado en el bot de Komakai; adaptado a la carta criolla de Alpaqori.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const memoria = require('./memoria');

/* ---------- Catálogo (el mismo de la web, sale de qcarta) ---------- */
const CATALOGO = JSON.parse(fs.readFileSync(path.resolve(__dirname, config.RUTA_CATALOGO), 'utf8'));
const PRODUCTOS = CATALOGO.productos;
const MENU_DIA = CATALOGO.menu_del_dia;

const CATEGORIAS = [
  ['desayunos', 'Desayunos', '🍳'],
  ['entradas', 'Entradas', '🥔'],
  ['sopas', 'Sopas', '🍲'],
  ['platos-de-fondo', 'Platos de fondo', '🍛'],
  ['platos-fin-de-semana', 'Platos de fin de semana', '🐟'],
  ['promociones', 'Promociones', '🎉'],
  ['guarniciones', 'Guarniciones', '🍚'],
  ['jugos-bebidas-calientes', 'Jugos y bebidas calientes', '☕'],
  ['bebidas-naturales-frozen', 'Bebidas naturales y frozen', '🥤'],
  ['gaseosas-agua', 'Gaseosas y agua', '🧃'],
  ['cervezas', 'Cervezas', '🍺'],
  ['vinos', 'Vinos', '🍷'],
  ['cocteles-drinks', 'Cócteles', '🍸']
].map(([id, nombre, emoji]) => ({ id, nombre, emoji, items: PRODUCTOS.filter(p => p.categoria === id) }))
  .filter(c => c.items.length);

const producto = id => PRODUCTOS.find(p => p.id === id);

/* ---------- Utilidades ---------- */
const soles = n => `S/ ${Number(n).toFixed(2)}`;
const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const lista = items => items.map((t, i) => `*${i + 1}.* ${t}`).join('\n');
const PALABRAS_NUM = { cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const NOMBRES_DIA = { lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo' };

// Entiende "2", "opción 2", "la 2", "dos". "2 ceviches" NO es una opción: es una cantidad con un plato.
function numero(texto) {
  const t = normalizar(texto).replace(/\b(opcion|la|el|numero|nro|elijo|marco)\b/g, ' ').replace(/[.#°º*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^\d{1,3}$/.test(t)) return parseInt(t, 10);
  return t in PALABRAS_NUM ? PALABRAS_NUM[t] : null;
}

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/* ---------- Fecha, horario y disponibilidad (hora de Lima) ---------- */
function ahoraLima() {
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(new Date());
  const valor = tipo => (partes.find(p => p.type === tipo) || {}).value;
  return { dia: normalizar(valor('weekday')), hora: Number(valor('hour')), minuto: Number(valor('minute')) };
}

const diaHoy = () => ahoraLima().dia;
const disponibleHoy = p => !p.disponible_dias || !p.disponible_dias.length || p.disponible_dias.includes(diaHoy());
const textoDias = dias => {
  const n = dias.map(d => NOMBRES_DIA[d] || d);
  return n.length === 1 ? `solo los ${n[0]}` : `solo ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
};

function cierreDeHoy() {
  const h = config.HORARIO;
  return h.diasExtendidos.includes(diaHoy()) ? h.cierreExtendido : h.cierre;
}

function abierto() {
  const { hora } = ahoraLima();
  return hora >= config.HORARIO.apertura && hora < cierreDeHoy();
}

const textoHorario = () => {
  const h = config.HORARIO;
  return `Todos los días de ${h.apertura}:00 a ${h.cierre}:00\nViernes y sábado hasta las ${h.cierreExtendido}:00`;
};

/* ---------- Medios de pago y entrega ---------- */
const PAGOS = ['Yape', 'Plin', 'Efectivo'];
const MODALIDADES = [
  { id: 'recojo', texto: '🏮 Recojo en el local' },
  { id: 'delivery', texto: `🛵 Delivery _(referencial ${soles(config.DELIVERY_TARIFA)})_` }
];
const nombreModalidad = id => ({ recojo: 'Recojo en el local', delivery: 'Delivery' })[id] || '';
const SI = ['si', 's', 'ok', 'confirmo', 'dale', 'listo', 'claro', 'si confirmo', 'de una', 'ya', 'yes'];
const NO = ['no', 'n', 'nop', 'no gracias'];

/* ---------- Búsqueda en texto libre ---------- */
const RELLENO = /\b(hola|buenas|buenos|dias|tardes|noches|alpaqori|alpa qori|quisiera|quiero|deseo|pedir|me|das|dame|manda|mandame|por favor|porfa|un|una|unos|unas|el|la|los|las|de|del|con|para|info|informacion|precio|cuanto|cuesta|hay|tienen|tienes)\b/g;

const CLAVES = [
  { re: /\b(menu del dia|menu de hoy|menu de dia|almuerzo|menu campechano|el menu)\b/, accion: 'menu_dia' },
  { re: /\b(ubicacion|direccion|donde (estan|quedan|queda)|como llego|mapa)\b/, accion: 'ubicacion' },
  { re: /\b(horario|hora|abren|cierran|atienden|abierto)\b/, accion: 'ubicacion' },
  { re: /\b(delivery|envio|envian|reparto|llevan)\b/, accion: 'delivery' },
  { re: /\bcarta\b/, accion: 'carta' },
  { re: /\b(sopas?|caldos?)\b/, categoria: 'sopas' },
  { re: /\bdesayunos?\b/, categoria: 'desayunos' },
  { re: /\bentradas?\b/, categoria: 'entradas' },
  { re: /\b(fondo|segundos?)\b/, categoria: 'platos-de-fondo' },
  { re: /\b(fin de semana|marinos?|mariscos?|pescados?)\b/, categoria: 'platos-fin-de-semana' },
  { re: /\bpromos?(ciones?)?\b/, categoria: 'promociones' },
  { re: /\b(guarnicion(es)?|adicional(es)?|extras?)\b/, categoria: 'guarniciones' },
  { re: /\b(jugos?|cafe|infusion)\b/, categoria: 'jugos-bebidas-calientes' },
  { re: /\b(frozen|refrescos?|bebidas?|limonadas?)\b/, categoria: 'bebidas-naturales-frozen' },
  { re: /\b(gaseosas?|inca ?kola|inca ?cola|coca ?cola|aguas?)\b/, categoria: 'gaseosas-agua' },
  { re: /\b(cervezas?|chelas?)\b/, categoria: 'cervezas' },
  { re: /\bvinos?\b/, categoria: 'vinos' },
  { re: /\b(cocteles?|cocktails?|tragos?|drinks?)\b/, categoria: 'cocteles-drinks' }
];

const palabras = s => normalizar(s).split(' ').filter(w => w.length >= 3);

// Devuelve { productos: [...] } (uno o varios), { categoria }, { accion } o null
function buscar(texto) {
  const original = normalizar(texto);
  if (original.length < 3) return null;
  for (const c of CLAVES.slice(0, 1)) if (c.re.test(original)) return { accion: c.accion };

  // 1) nombre exacto
  const exacto = PRODUCTOS.filter(p => normalizar(p.nombre) === original);
  if (exacto.length) return { productos: exacto };
  // 2) un plato mencionado dentro de la frase ("quiero un lomo saltado por favor"): el nombre más largo gana
  const enFrase = PRODUCTOS.filter(p => normalizar(p.nombre).length >= 5 && ` ${original} `.includes(` ${normalizar(p.nombre)} `))
    .sort((a, b) => b.nombre.length - a.nombre.length);
  if (enFrase.length) return { productos: [enFrase[0]] };

  const t = original.replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
  // Una palabra genérica sola ("sopa", "cerveza", "bebidas") lleva a su sección
  for (const c of CLAVES.slice(1)) {
    if (c.categoria && new RegExp(`^(?:${c.re.source})$`).test(t)) return { categoria: c.categoria };
  }
  if (t.length >= 3) {
    // 3) todas las palabras importantes aparecen en el nombre ("chaufa" → los tres chaufas).
    //    Primero palabra completa ("chicha" → chichas, no chicharrones); luego comienzo de palabra.
    //    Nunca dentro de otra palabra: "cuy" no debe encontrar "maracuyá".
    const claves = palabras(t);
    if (claves.length) {
      const palabrasDe = p => normalizar(p.nombre).split(/[\s()]+/);
      const completas = PRODUCTOS.filter(p => claves.every(w => palabrasDe(p).includes(w)));
      if (completas.length) return { productos: completas };
      const contienen = PRODUCTOS.filter(p => claves.every(w => palabrasDe(p).some(pw => pw.startsWith(w))));
      if (contienen.length) return { productos: contienen };
      // 4) errores de tipeo: "sevice", "chaufaa", "anticucho"
      const parecidos = PRODUCTOS.filter(p => claves.every(w => palabras(p.nombre).some(pw => w.length >= 5 && distancia(w, pw) <= (w.length >= 6 ? 2 : 1))));
      if (parecidos.length) return { productos: parecidos };
    }
  }
  // 5) palabras clave que llevan a una sección o acción
  for (const c of CLAVES.slice(1)) if (c.re.test(original)) return c.accion ? { accion: c.accion } : { categoria: c.categoria };
  return null;
}

/* ---------- Estado ---------- */
function crearEstado(numeroCliente = null) {
  return {
    numero: numeroCliente, nuevo: true, paso: 'menu', carrito: [], categoria: null, producto: null,
    resultados: [], cantidadSugerida: null, menuSel: {}, datos: {}, esperaComprobante: null,
    pausadoHasta: 0, ultimo: Date.now()
  };
}

const conPrecio = i => typeof i.precio === 'number';
const totalCarrito = estado => estado.carrito.filter(conPrecio).reduce((s, i) => s + i.precio * i.cantidad, 0);
const hayPorConfirmar = items => items.some(i => !conPrecio(i));
const unidades = estado => estado.carrito.reduce((s, i) => s + i.cantidad, 0);
const nombreConVariante = i => `${i.nombre}${i.variante ? ` (${i.variante})` : ''}`;
const lineaItem = i => `• ${i.cantidad} x ${nombreConVariante(i)} — ${conPrecio(i) ? soles(i.precio * i.cantidad) : '_precio por confirmar_'}${i.nota ? `\n   _Nota: ${i.nota}_` : ''}`;
const costoDelivery = d => (d.modalidad === 'delivery' ? config.DELIVERY_TARIFA : 0);

function resumenCarrito(estado) {
  if (!estado.carrito.length) return 'Tu pedido está vacío por ahora 🛒';
  return `🛒 *Tu pedido:*\n${estado.carrito.map(lineaItem).join('\n')}\n\n*Subtotal: ${soles(totalCarrito(estado))}*` +
    (hayPorConfirmar(estado.carrito) ? '\n_+ menú del día (precio por confirmar)_' : '');
}

function agregar(estado, item, cantidad) {
  const existente = estado.carrito.find(i => i.id === item.id && (i.variante || '') === (item.variante || '') && !i.nota);
  if (existente) existente.cantidad += cantidad;
  else estado.carrito.push({ ...item, cantidad });
}

function ultimoPedido(estado) {
  const c = memoria.cliente(estado.numero);
  return c && Array.isArray(c.ultimo) && c.ultimo.length ? c.ultimo : null;
}

/* ---------- Siguiente dato que falta para cerrar el pedido ---------- */
function siguienteCheckout(estado) {
  const d = estado.datos;
  if (!d.modalidad) return 'modalidad';
  if (d.modalidad === 'delivery' && !d.direccion) return 'direccion';
  if (!d.nombre) {
    const c = memoria.cliente(estado.numero);
    if (c && c.nombre) d.nombre = c.nombre;   // cliente conocido: no se lo volvemos a preguntar
    else return 'nombre';
  }
  if (d.indicaciones === undefined) return 'indicaciones';
  if (!d.pago) return 'pago';
  if (d.pago === 'Efectivo' && d.efectivo === undefined) return 'vuelto';
  return 'confirmar';
}

/* ---------- Textos ---------- */
function avisoCerrado() {
  if (abierto()) return '';
  return `\n\n🌙 _Ahora estamos fuera de horario (${textoHorario().replace('\n', ' · ')}). Puedes dejar tu pedido y lo atendemos apenas abramos._`;
}

function bienvenida(estado) {
  const c = memoria.cliente(estado.numero);
  const ultimo = ultimoPedido(estado);
  if (c && c.nombre) {
    return `¡Hola de nuevo, *${c.nombre}*! 🦙\n_Cada plato, una historia por contar._` +
      (ultimo ? `\n\nEn tu último pedido llevaste:\n${ultimo.map(lineaItem).join('\n')}\n\nEscribe *9* para repetirlo.` : '') +
      avisoCerrado();
  }
  return `*ALPAQORI* · Tierra de Oro 🦙\n_Cada plato, una historia por contar._\n\n` +
    `Soy el asistente virtual de Alpaqori y te ayudo a armar tu pedido.\n` +
    `_Escribe *menu* para volver al inicio o *cancelar* para vaciar tu pedido._` + avisoCerrado();
}

function textoMenu(estado) {
  return `¿En qué te ayudo? Responde con el número:\n\n` +
    `*1.* 🍲 Menú del día\n` +
    `*2.* 📋 Ver la carta\n` +
    `*3.* 🛒 Ver mi pedido\n` +
    `*4.* ✅ Confirmar mi pedido\n` +
    `*5.* 📍 Horario y ubicación\n` +
    `*6.* 🛵 Delivery\n` +
    `*7.* 🙋 Hablar con una persona` +
    (ultimoPedido(estado) ? '\n*9.* 🔁 Repetir mi último pedido' : '') +
    `\n\n💡 _También puedes escribir lo que buscas: "ceviche", "caldo de gallina", "2 chicha morada"..._` +
    (config.URL_CARTA ? `\n🌐 _O arma tu pedido en nuestra carta web:_ ${config.URL_CARTA}` : '');
}

const precioMenu = () => (typeof MENU_DIA.precio_pen === 'number' ? MENU_DIA.precio_pen : null);

function textoMenuDia() {
  const hoy = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(new Date());
  return `🍲 *MENÚ DEL DÍA* · _${hoy}_\n\n` +
    `*Entradas:*\n${MENU_DIA.entradas.map(e => `• ${e}`).join('\n')}\n\n` +
    `*Segundos:*\n${MENU_DIA.segundos.map(s => `• ${s}`).join('\n')}\n\n` +
    `*Postre:* ${MENU_DIA.postre.join(', ')}\n` +
    `*Precio:* ${precioMenu() !== null ? soles(precioMenu()) : '_te lo confirmamos al recibir tu pedido_'}`;
}

function etiquetaProducto(p) {
  const precio = p.variantes ? `desde ${soles(Math.min(...Object.values(p.variantes)))}` : soles(p.precio_pen);
  const dias = p.disponible_dias && p.disponible_dias.length ? ` _(${textoDias(p.disponible_dias)})_` : '';
  return `${p.nombre} — ${precio}${dias}`;
}

function textoPaso(estado) {
  switch (estado.paso) {
    case 'menu':
      return textoMenu(estado);
    case 'menu_dia':
      return `${textoMenuDia()}\n\n¿Lo pedimos?\n*1.* Sí, quiero el menú\n*0.* Volver al inicio`;
    case 'menu_entrada':
      return `Elige tu *entrada*:\n\n${lista(MENU_DIA.entradas)}\n\n*0.* Volver al inicio`;
    case 'menu_segundo':
      return `Entrada: *${estado.menuSel.entrada}* ✓\nAhora elige tu *segundo*:\n\n${lista(MENU_DIA.segundos)}\n\n*0.* Volver al inicio`;
    case 'menu_cantidad':
      return `¿Cuántos menús de *${estado.menuSel.entrada} + ${estado.menuSel.segundo}*? Escribe un número (1 a 10).`;
    case 'categoria':
      return `📋 *Nuestra carta*\nElige una categoría:\n\n${lista(CATEGORIAS.map(c => `${c.emoji} ${c.nombre}`))}\n\n*0.* Volver al inicio`;
    case 'producto': {
      const c = CATEGORIAS.find(x => x.id === estado.categoria);
      return `${c.emoji} *${c.nombre}*\n\n${lista(c.items.map(etiquetaProducto))}\n\n_Responde con el número del plato._\n*0.* Volver al inicio`;
    }
    case 'resultados':
      return `Encontré estas opciones 👇\n\n${lista(estado.resultados.map(etiquetaProducto))}\n\n_Responde con el número._\n*0.* Volver al inicio`;
    case 'variante': {
      const p = estado.producto;
      return `*${p.nombre}* 🍽️\n¿Qué tamaño?\n\n${lista(Object.entries(p.variantes).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} — ${soles(v)}`))}\n\n*0.* Volver al inicio`;
    }
    case 'cantidad': {
      const p = estado.producto;
      const precio = estado.variante ? p.variantes[estado.variante] : p.precio_pen;
      return `*${p.nombre}*${estado.variante ? ` (${estado.variante})` : ''} — ${soles(precio)}\n\n¿Cuántos? Escribe un número (1 a 20).\n\n*0.* Volver al inicio`;
    }
    case 'post':
      return `¿Qué sigue?\n*2.* 📋 Seguir viendo la carta\n*1.* 🍲 Menú del día\n*3.* 🛒 Ver mi pedido\n*4.* ✅ Confirmar mi pedido`;
    case 'modalidad':
      return `¿Cómo quieres tu pedido?\n\n${lista(MODALIDADES.map(m => m.texto))}`;
    case 'direccion':
      return '🛵 ¿A qué dirección llevamos tu pedido?\nEscribe calle, número y una referencia, o envíame tu *ubicación* con el clip 📎 de WhatsApp.';
    case 'nombre':
      return '📝 ¿A nombre de quién va el pedido?';
    case 'indicaciones':
      return '✍️ ¿Alguna indicación para la cocina? Por ejemplo: sin picante, alergias, cubiertos…\nEscribe *no* si no tienes.';
    case 'pago':
      return `💳 ¿Cómo vas a pagar?\n\n${lista(PAGOS)}`;
    case 'vuelto':
      return '💵 ¿Con cuánto vas a pagar? Así llevamos tu vuelto. Escribe el monto (ej. *100*) o *exacto*.';
    case 'confirmar':
      return textoConfirmar(estado);
    default:
      return '';
  }
}

function lineasTotales(items, d, subtotal) {
  const delivery = costoDelivery(d);
  const lineas = [`Subtotal: ${soles(subtotal)}`];
  if (delivery) lineas.push(`Delivery (referencial): ${soles(delivery)}`);
  lineas.push(`*Total: ${soles(subtotal + delivery)}*`);
  if (hayPorConfirmar(items)) lineas.push('_+ menú del día: precio por confirmar_');
  if (delivery) lineas.push('_El costo final de delivery depende de tu zona; te lo confirmamos._');
  return lineas.join('\n');
}

function textoConfirmar(estado) {
  return `*REVISA TU PEDIDO* 🧾\n\n${estado.carrito.map(lineaItem).join('\n')}\n───────────────\n` +
    `${lineasTotales(estado.carrito, estado.datos, totalCarrito(estado))}\n\n${detalleDatos(estado.datos)}\n\n` +
    `¿Todo bien? Responde *SI* para enviarlo a cocina o *NO* para seguir editando.`;
}

function detalleDatos(d) {
  const lineas = [`${d.modalidad === 'delivery' ? '🛵' : '🏮'} *${nombreModalidad(d.modalidad)}*`];
  if (d.nombre) lineas.push(`👤 A nombre de: ${d.nombre}`);
  if (d.direccion) lineas.push(`📍 ${d.direccion}`);
  if (d.indicaciones) lineas.push(`✍️ ${d.indicaciones}`);
  if (d.pago) lineas.push(`💳 ${d.pago}${d.pago === 'Efectivo' && d.efectivo ? ` (paga con ${soles(d.efectivo)})` : ''}`);
  return lineas.join('\n');
}

const textoUbicacion = () =>
  `📍 *ALPAQORI*\n${config.DIRECCION}\n\n🕗 ${textoHorario()}\n${abierto() ? '🟢 _Ahora estamos abiertos._' : '🌙 _Ahora estamos cerrados._'}\n\n🗺️ Cómo llegar: ${config.MAPS}`;

const textoDelivery = () =>
  `🛵 *Delivery Alpaqori*\nLlevamos tu pedido en Chosica. El costo es referencial desde *${soles(config.DELIVERY_TARIFA)}* y el monto final depende de tu zona: te lo confirmamos al recibir tu pedido.\n\nPara pedir, elige platos con *2* (carta) o *1* (menú del día).`;

function irA(estado, paso) {
  estado.paso = paso;
  return textoPaso(estado);
}

function noEntendi(estado, r) {
  r.push('Disculpa, no logré entender ese mensaje 🙏\nElige un *número* de las opciones o escribe el *nombre de un plato*. Escribe *menu* para volver al inicio.');
  r.push(textoPaso(estado));
  return { respuestas: r };
}

function textoAgregado(estado, n, item) {
  const items = unidades(estado);
  const precio = conPrecio(item) ? soles(item.precio * n) : 'precio por confirmar';
  return `*Añadido a tu pedido* 🦙\n✓ *${n} x ${nombreConVariante(item)}* — ${precio}\n🛒 Subtotal: *${soles(totalCarrito(estado))}* (${items} ${items === 1 ? 'ítem' : 'ítems'})`;
}

/* ---------- Elegir un producto (desde la carta, la búsqueda o un mensaje con cantidad) ---------- */
function elegirProducto(estado, p, r) {
  if (!disponibleHoy(p)) {
    r.push(`😔 *${p.nombre}* se prepara ${textoDias(p.disponible_dias)}. Hoy no está disponible.`);
    r.push(textoPaso(estado));
    return;
  }
  estado.producto = p;
  estado.variante = null;
  if (p.variantes) { r.push(irA(estado, 'variante')); return; }
  if (estado.cantidadSugerida) {
    const n = estado.cantidadSugerida;
    estado.cantidadSugerida = null;
    const item = { id: p.id, nombre: p.nombre, variante: '', precio: p.precio_pen };
    agregar(estado, item, n);
    r.push(textoAgregado(estado, n, item));
    r.push(irA(estado, 'post'));
    return;
  }
  r.push(irA(estado, 'cantidad'));
}

/* ---------- Cierre del pedido ---------- */
function horaLima() {
  return new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
}

function cerrarPedido(estado, r, encabezado) {
  const d = estado.datos;
  const ticket = memoria.siguienteTicket();
  const subtotal = totalCarrito(estado);
  const delivery = costoDelivery(d);
  const pedido = {
    ticket, numero: estado.numero, items: estado.carrito.map(i => ({ ...i })),
    subtotal, delivery, total: subtotal + delivery, porConfirmar: hayPorConfirmar(estado.carrito), ...d
  };
  memoria.registrarPedido(pedido);
  memoria.registrarComanda(ticket, {
    tipo: nombreModalidad(d.modalidad),
    modalidad: d.modalidad,
    nombre: d.nombre || '',
    numero: estado.numero,
    total: pedido.total,
    historial: [{ estado: 'pendiente', hora: horaLima() }]
  });
  if (estado.numero) {
    const previo = memoria.cliente(estado.numero) || {};
    memoria.guardarCliente(estado.numero, {
      nombre: d.nombre || previo.nombre,
      ultimo: pedido.items.map(({ nota, ...i }) => i)
    });
  }

  const tiempo = memoria.tiempo();
  const lineas = [encabezado || '*¡Pedido recibido!* 🔥'];
  lineas.push(`Tu pedido *#${ticket}* ya pasó a cocina.`);
  lineas.push(`Total: *${soles(pedido.total)}*${pedido.porConfirmar ? ' _+ menú del día (precio por confirmar)_' : ''}`);
  if (d.modalidad === 'delivery') lineas.push('🛵 En breve te confirmamos el costo final del delivery según tu zona.');
  else lineas.push(`🏮 Te esperamos en ${config.DIRECCION}.`);
  if (tiempo) lineas.push(`⏳ Tiempo estimado: *${tiempo} minutos*.`);
  if (!abierto()) lineas.push(`🌙 Estamos fuera de horario: preparamos tu pedido apenas abramos (${config.HORARIO.apertura}:00).`);

  if (d.pago === 'Yape' || d.pago === 'Plin') {
    estado.esperaComprobante = ticket;
    if (config.YAPE_NUMERO) {
      lineas.push(`\n*Datos para ${d.pago}:*\n📱 Número: *${config.YAPE_NUMERO}*${config.YAPE_TITULAR ? ` (${config.YAPE_TITULAR})` : ''}\n💰 Monto: *${soles(pedido.total)}*\n_Envíame la captura de tu constancia por aquí y la pasamos a caja._`);
    } else {
      lineas.push(`\nCuando hagas tu ${d.pago}, envíame la captura de la constancia por aquí y la pasamos a caja.`);
    }
  }
  lineas.push('\nGracias por elegir *ALPAQORI* · Tierra de Oro 🦙');
  r.push(lineas.join('\n'));

  estado.carrito = []; estado.datos = {}; estado.paso = 'menu'; estado.menuSel = {};
  return { respuestas: r, pedido };
}

/* ---------- Mensajes que llegan desde la web ----------
   Formato que arma web/js/carta.js (construirMensaje):
   Hola Alpaqori, quiero hacer este pedido:
   - 2 x Pollo a la plancha (S/ 56.00)
      Nota: sin picante
   - 1 x Cuy frito (cuarto) (S/ 28.00)
   Entrega: Delivery | Recojo en local
   Dirección: ...
   Nombre: ...
   Pago: Efectivo (paga con S/ 100.00)
   Indicaciones: ...
   Los precios se vuelven a calcular con el catálogo: no se confía en el texto. */
function productoDeLinea(nombreWeb) {
  const n = normalizar(nombreWeb);
  const exacto = PRODUCTOS.find(p => normalizar(p.nombre) === n);
  if (exacto) return { p: exacto, variante: '' };
  const m = nombreWeb.match(/^(.+?) \(([^()]+)\)$/);
  // Menú del día desde la carta web: "Menú del día (entrada + segundo + postre)"
  if (m && normalizar(m[1]) === normalizar('Menú del día')) {
    return { p: { id: 'menu-del-dia', nombre: 'Menú del día', variantes: { [m[2]]: precioMenu() }, disponible_dias: [] }, variante: m[2] };
  }
  if (m) {
    const base = PRODUCTOS.find(p => normalizar(p.nombre) === normalizar(m[1]) && p.variantes);
    const variante = base && Object.keys(base.variantes).find(k => normalizar(k) === normalizar(m[2]));
    if (variante) return { p: base, variante };
  }
  return null;
}

function leerPedidoWeb(texto) {
  if (!/hola alpaqori/i.test(texto) || !/quiero hacer este pedido/i.test(texto)) return null;
  const items = [];
  const avisos = [];
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^- (\d+) x (.+?) \(S\/ ([\d.]+)\)\s*$/);
    if (m) {
      const cantidad = Number(m[1]);
      const precioWeb = Number(m[3]) / cantidad;
      const encontrado = productoDeLinea(m[2]);
      if (encontrado) {
        const { p, variante } = encontrado;
        const precio = variante ? p.variantes[variante] : p.precio_pen;
        if (Math.abs(precio - precioWeb) > 0.009) avisos.push(`${m[2]}: la web mostró ${soles(precioWeb)}, la carta dice ${soles(precio)}`);
        if (!disponibleHoy(p)) avisos.push(`${p.nombre} es ${textoDias(p.disponible_dias)}: hoy no está disponible`);
        items.push({ id: p.id, nombre: p.nombre, variante, precio, cantidad });
      } else {
        avisos.push(`${m[2]}: no está en el catálogo, revisar`);
        items.push({ id: `web:${m[2]}`, nombre: m[2], variante: '', precio: precioWeb, cantidad, verificar: true });
      }
      continue;
    }
    const nota = linea.match(/^\s+Nota:\s*(.+)$/);
    if (nota && items.length) items[items.length - 1].nota = nota[1].trim();
  }
  if (!items.length) return null;

  const campo = re => ((texto.match(re) || [])[1] || '').trim();
  const pagoTexto = campo(/^Pago:\s*(.+)$/im);
  const pago = PAGOS.find(x => normalizar(pagoTexto).startsWith(normalizar(x))) || '';
  const efectivo = Number((pagoTexto.match(/paga con S\/ ([\d.]+)/i) || [])[1]) || 0;
  return {
    items,
    avisos,
    datos: {
      modalidad: /delivery/i.test(campo(/^Entrega:\s*(.+)$/im)) ? 'delivery' : 'recojo',
      direccion: campo(/^Direcci[oó]n:\s*(.+)$/im),
      nombre: campo(/^Nombre:\s*(.+)$/im),
      pago,
      efectivo: pago === 'Efectivo' ? efectivo : undefined,
      indicaciones: campo(/^Indicaciones:\s*(.+)$/im),
      desdeWeb: true
    }
  };
}

function procesarWeb(estado, texto, r) {
  // Botón "Pedir el menú del día" de la web
  if (/hola alpaqori/i.test(texto) && /menu del dia/.test(normalizar(texto))) {
    r.push(irA(estado, 'menu_dia'));
    return { respuestas: r };
  }

  const web = leerPedidoWeb(texto);
  if (!web) return null;
  estado.carrito = web.items;
  estado.datos = web.datos;
  if (!web.datos.modalidad || (web.datos.modalidad === 'delivery' && !web.datos.direccion) || !web.datos.nombre || !web.datos.pago) {
    r.push(`✨ *Recibimos tu pedido desde nuestra carta web.*\n\n${resumenCarrito(estado)}\n\nSolo nos faltan unos datos para enviarlo a cocina.`);
    r.push(irA(estado, siguienteCheckout(estado)));
    return { respuestas: r };
  }
  const resultado = cerrarPedido(estado, r, `✨ *Recibimos tu pedido desde nuestra carta web.*\n\n${web.items.map(lineaItem).join('\n')}\n`);
  resultado.pedido.avisos = web.avisos;
  return resultado;
}

/* ---------- Acciones del menú (también se usan después de agregar un plato) ---------- */
function opcionMenu(estado, n, r) {
  switch (n) {
    case 1: r.push(irA(estado, 'menu_dia')); return true;
    case 2: r.push(irA(estado, 'categoria')); return true;
    case 3: r.push(resumenCarrito(estado)); r.push(irA(estado, 'menu')); return true;
    case 4:
      if (!estado.carrito.length) {
        r.push('Aún no has agregado nada 🛒 Elige *1* para el menú del día o *2* para ver la carta.');
        estado.paso = 'menu';
        return true;
      }
      r.push(irA(estado, siguienteCheckout(estado)));
      return true;
    case 5: r.push(textoUbicacion()); r.push(irA(estado, 'menu')); return true;
    case 6: r.push(textoDelivery()); r.push(irA(estado, 'menu')); return true;
    case 9: {
      const ultimo = ultimoPedido(estado);
      if (!ultimo) return false;
      estado.carrito = ultimo.map(i => {
        const p = producto(i.id);
        const precio = p ? (i.variante && p.variantes ? p.variantes[i.variante] : p.precio_pen) : i.precio;
        return { ...i, precio: i.id === 'menu-del-dia' ? precioMenu() : precio };
      });
      estado.datos = {};
      r.push(`🔁 Listo, armé de nuevo tu último pedido (con los precios de hoy):\n\n${resumenCarrito(estado)}`);
      r.push(irA(estado, siguienteCheckout(estado)));
      return true;
    }
    default: return false;
  }
}

// Lleva a la sección que corresponde a lo que escribió el cliente
function irPorBusqueda(estado, texto, r) {
  // "2 ceviches", "dos chicha morada": la cantidad viene adelante
  let consulta = texto;
  const conCantidad = normalizar(texto).match(/^(\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.{3,})$/);
  if (conCantidad) {
    const n = /^\d+$/.test(conCantidad[1]) ? Number(conCantidad[1]) : PALABRAS_NUM[conCantidad[1]];
    if (n >= 1 && n <= 20) { estado.cantidadSugerida = n; consulta = conCantidad[2]; }
  }
  // Plurales simples: "ceviches" → "ceviche"
  let b = buscar(consulta);
  if (!b && /s$/.test(normalizar(consulta))) b = buscar(normalizar(consulta).replace(/(es|s)$/, ''));
  if (!b) { estado.cantidadSugerida = null; return false; }

  if (b.productos) {
    if (b.productos.length === 1) elegirProducto(estado, b.productos[0], r);
    else {
      estado.resultados = b.productos.slice(0, 15);
      r.push(irA(estado, 'resultados'));
    }
  } else if (b.categoria) {
    estado.cantidadSugerida = null;
    estado.categoria = b.categoria;
    r.push(irA(estado, 'producto'));
  } else {
    estado.cantidadSugerida = null;
    if (b.accion === 'menu_dia') r.push(irA(estado, 'menu_dia'));
    else if (b.accion === 'carta') r.push(irA(estado, 'categoria'));
    else if (b.accion === 'ubicacion') { r.push(textoUbicacion()); r.push(irA(estado, 'menu')); }
    else if (b.accion === 'delivery') { r.push(textoDelivery()); r.push(irA(estado, 'menu')); }
  }
  return true;
}

/* ---------- Procesar mensaje ---------- */
function procesar(estado, texto, extra = {}) {
  const t = normalizar(texto);
  const n = numero(texto);
  const r = [];
  estado.ultimo = Date.now();

  // Ubicación enviada con el clip de WhatsApp
  if (extra.ubicacion) {
    const link = `https://maps.google.com/?q=${extra.ubicacion.lat},${extra.ubicacion.lng}`;
    if (estado.paso === 'direccion') {
      estado.datos.direccion = `Ubicación GPS: ${link}`;
      r.push('📍 ¡Recibí tu ubicación! El motorizado llegará con el pin exacto.');
      r.push(irA(estado, siguienteCheckout(estado)));
      return { respuestas: r };
    }
    estado.ubicacionGuardada = link;
    r.push('📍 ¡Gracias! Guardé tu ubicación para el delivery.');
    r.push(textoPaso(estado));
    return { respuestas: r };
  }

  // Los mensajes que vienen de la web se entienden en cualquier momento
  const desdeWeb = procesarWeb(estado, texto, r);
  if (desdeWeb) { estado.nuevo = false; return desdeWeb; }

  // Primer mensaje: bienvenida y, si ya pidió algo concreto, lo llevamos ahí
  if (estado.nuevo) {
    estado.nuevo = false;
    r.push(bienvenida(estado));
    const sinSaludo = t.replace(RELLENO, ' ').replace(/\b(hacer|pedido|orden|ordenar|algo|si)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (sinSaludo.length >= 3 && irPorBusqueda(estado, sinSaludo, r)) return { respuestas: r };
    r.push(irA(estado, 'menu'));
    return { respuestas: r };
  }

  // Comandos globales
  if (/\b(menu del dia|menu de hoy|almuerzo)\b/.test(t) && !['menu_entrada', 'menu_segundo', 'menu_cantidad'].includes(estado.paso)) {
    r.push(irA(estado, 'menu_dia'));
    return { respuestas: r };
  }
  if (['menu', 'inicio', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'volver', 'hola alpaqori'].includes(t)) {
    r.push(irA(estado, 'menu'));
    return { respuestas: r };
  }
  if (/^(ok |ya )?(gracias|muchas gracias|mil gracias|chau|chao|adios|hasta luego)\b/.test(t)) {
    r.push(`¡Gracias a ti! 🦙 Aquí estamos cuando quieras.${estado.carrito.length ? ' Tu pedido sigue guardado: escribe *4* para confirmarlo.' : ''}`);
    return { respuestas: r };
  }
  if (/^(cancel|anul|vaci)/.test(t)) {
    estado.carrito = []; estado.datos = {}; estado.menuSel = {};
    r.push('Listo, vacié tu pedido. 🗑️');
    r.push(irA(estado, 'menu'));
    return { respuestas: r };
  }
  if (/^(ubicacion|direccion|donde (estan|quedan|queda)|como llego|horario)/.test(t) && estado.paso !== 'direccion') {
    r.push(textoUbicacion());
    r.push(textoPaso(estado));
    return { respuestas: r };
  }
  const pasosConVolver = ['menu_dia', 'menu_entrada', 'menu_segundo', 'categoria', 'producto', 'resultados', 'variante', 'cantidad'];
  if (n === 0 && pasosConVolver.includes(estado.paso)) {
    r.push(irA(estado, 'menu'));
    return { respuestas: r };
  }

  switch (estado.paso) {
    case 'menu':
    case 'post': {
      if (n === 7) {
        estado.pausadoHasta = Date.now() + config.MINUTOS_PAUSA_HUMANO * 60000;
        r.push('🙋 En un momento te atiende una persona de Alpaqori. ¡Gracias por tu paciencia!');
        return { respuestas: r, humano: 'cliente' };
      }
      if (n !== null && opcionMenu(estado, n, r)) break;
      if (irPorBusqueda(estado, texto, r)) break;
      return noEntendi(estado, r);
    }

    case 'menu_dia': {
      if (n === 1 || SI.includes(t)) { estado.menuSel = {}; r.push(irA(estado, 'menu_entrada')); break; }
      if (irPorBusqueda(estado, texto, r)) break;
      return noEntendi(estado, r);
    }

    case 'menu_entrada': {
      const entrada = MENU_DIA.entradas[n - 1];
      if (!entrada) return noEntendi(estado, r);
      estado.menuSel.entrada = entrada;
      r.push(irA(estado, 'menu_segundo'));
      break;
    }

    case 'menu_segundo': {
      const segundo = MENU_DIA.segundos[n - 1];
      if (!segundo) return noEntendi(estado, r);
      estado.menuSel.segundo = segundo;
      r.push(irA(estado, 'menu_cantidad'));
      break;
    }

    case 'menu_cantidad': {
      if (!n || n < 1 || n > 10) return noEntendi(estado, r);
      const item = {
        id: 'menu-del-dia', nombre: 'Menú del día',
        variante: `${estado.menuSel.entrada} + ${estado.menuSel.segundo} + ${MENU_DIA.postre.join(', ')}`,
        precio: precioMenu()
      };
      agregar(estado, item, n);
      estado.menuSel = {};
      r.push(textoAgregado(estado, n, item));
      r.push(irA(estado, 'post'));
      break;
    }

    case 'categoria': {
      const cat = CATEGORIAS[n - 1];
      if (!cat) {
        if (irPorBusqueda(estado, texto, r)) break;
        return noEntendi(estado, r);
      }
      estado.categoria = cat.id;
      r.push(irA(estado, 'producto'));
      break;
    }

    case 'producto':
    case 'resultados': {
      const items = estado.paso === 'resultados' ? estado.resultados : CATEGORIAS.find(c => c.id === estado.categoria).items;
      const p = n !== null ? items[n - 1] : null;
      if (!p) {
        if (irPorBusqueda(estado, texto, r)) break;
        return noEntendi(estado, r);
      }
      elegirProducto(estado, p, r);
      break;
    }

    case 'variante': {
      const claves = Object.keys(estado.producto.variantes);
      const v = claves[n - 1] || claves.find(k => t.includes(normalizar(k)));
      if (!v) return noEntendi(estado, r);
      estado.variante = v;
      if (estado.cantidadSugerida) {
        const cant = estado.cantidadSugerida;
        estado.cantidadSugerida = null;
        const item = { id: estado.producto.id, nombre: estado.producto.nombre, variante: v, precio: estado.producto.variantes[v] };
        agregar(estado, item, cant);
        r.push(textoAgregado(estado, cant, item));
        r.push(irA(estado, 'post'));
        break;
      }
      r.push(irA(estado, 'cantidad'));
      break;
    }

    case 'cantidad': {
      if (!n || n < 1 || n > 20) return noEntendi(estado, r);
      const p = estado.producto;
      const item = { id: p.id, nombre: p.nombre, variante: estado.variante || '', precio: estado.variante ? p.variantes[estado.variante] : p.precio_pen };
      agregar(estado, item, n);
      estado.variante = null;
      r.push(textoAgregado(estado, n, item));
      r.push(irA(estado, 'post'));
      break;
    }

    case 'modalidad': {
      const m = MODALIDADES[n - 1] || MODALIDADES.find(x => t.includes(x.id));
      if (!m) return noEntendi(estado, r);
      estado.datos.modalidad = m.id;
      if (m.id === 'delivery' && estado.ubicacionGuardada) estado.datos.direccion = `Ubicación GPS: ${estado.ubicacionGuardada}`;
      if (m.id === 'recojo') delete estado.datos.direccion;
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'direccion': {
      if (texto.trim().length < 6) return noEntendi(estado, r);
      estado.datos.direccion = texto.trim();
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'nombre': {
      // Un nombre no lleva números (evita que una dirección o un monto se guarden como nombre)
      if (texto.trim().length < 2 || texto.trim().length > 40 || /\d/.test(texto)) {
        r.push('Escríbeme solo el *nombre* de la persona que recibe el pedido 🙂');
        return { respuestas: r };
      }
      estado.datos.nombre = texto.trim().replace(/^(soy|me llamo|a nombre de)\s+/i, '');
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'indicaciones': {
      estado.datos.indicaciones = ['no', 'ninguna', 'nada', 'ninguno', 'n', 'no gracias', 'sin indicaciones'].includes(t) ? '' : texto.trim();
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'pago': {
      const pago = PAGOS[n - 1] || PAGOS.find(x => t.includes(normalizar(x)));
      if (!pago) return noEntendi(estado, r);
      estado.datos.pago = pago;
      if (pago !== 'Efectivo') delete estado.datos.efectivo;
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'vuelto': {
      const totalPedido = totalCarrito(estado) + costoDelivery(estado.datos);
      if (/exact|justo|completo/.test(t)) estado.datos.efectivo = 0;
      else {
        const monto = Number((t.match(/\d+(?:[.,]\d+)?/) || [])[0]?.replace(',', '.'));
        if (!monto) return noEntendi(estado, r);
        if (monto < totalPedido) {
          r.push(`Ese monto no cubre el total de *${soles(totalPedido)}*. ¿Con cuánto vas a pagar?`);
          return { respuestas: r };
        }
        estado.datos.efectivo = monto;
      }
      r.push(irA(estado, siguienteCheckout(estado)));
      break;
    }

    case 'confirmar': {
      if (SI.includes(t) || /^si\b/.test(t)) return cerrarPedido(estado, r);
      if (NO.includes(t)) {
        r.push('Sin problema, tu pedido sigue guardado 👍 Puedes sumar más platos o escribir *cancelar* para empezar de nuevo.');
        r.push(irA(estado, 'menu'));
        break;
      }
      return noEntendi(estado, r);
    }

    default:
      r.push(irA(estado, 'menu'));
  }

  return { respuestas: r };
}

/* ---------- Comprobante de Yape / Plin (imagen) ---------- */
function comprobante(estado) {
  if (!estado.esperaComprobante) return null;
  const ticket = estado.esperaComprobante;
  estado.esperaComprobante = null;
  return { ticket, respuestas: [`🙏 Recibí tu comprobante del pedido *#${ticket}*. Lo verificamos en caja y te confirmamos por aquí.`] };
}

/* ---------- Estados de la comanda ----------
   pendiente → preparando → listo → en ruta (solo delivery) → entregado → recibido (lo confirma el cliente)
   El personal responde a la comanda con la palabra del estado (o usa #listo 12, #ruta 12...). */
const ESTADOS = {
  pendiente: { orden: 0, emoji: '🔔', titulo: 'NUEVA COMANDA', corto: 'Recibida' },
  preparando: { orden: 1, emoji: '👨‍🍳', titulo: 'EN PREPARACIÓN', corto: 'En preparación' },
  listo: { orden: 2, emoji: '✅', titulo: 'LISTO', corto: 'Listo' },
  ruta: { orden: 3, emoji: '🛵', titulo: 'EN RUTA', corto: 'En ruta' },
  entregado: { orden: 4, emoji: '📦', titulo: 'ENTREGADO', corto: 'Entregado' },
  recibido: { orden: 5, emoji: '🤝', titulo: 'RECIBIDO POR EL CLIENTE', corto: 'Recibido por el cliente' }
};
const PALABRAS_ESTADO = [
  { estado: 'preparando', re: /^(preparando|en preparacion|cocinando|en cocina)$/ },
  { estado: 'listo', re: /^(listo|lista|ok|hecho|atendido|atendida|✅|👍)$/ },
  { estado: 'ruta', re: /^(en ruta|ruta|salio|en camino|despachado|enviado)$/ },
  { estado: 'entregado', re: /^(entregado|entregada|entregue)$/ }
];
const estadoDeRespuesta = texto => {
  const t = normalizar(texto).replace(/[.!]+$/, '');
  const p = PALABRAS_ESTADO.find(x => x.re.test(t));
  return p ? p.estado : null;
};
// "#listo 12", "#ruta ALP-012", "#entregado #ALP-12"
function comandoEstado(texto) {
  const m = normalizar(texto).match(/^#(preparando|listo|ruta|entregado)\s+#?(?:alp-?)?(\d{1,4})$/);
  return m ? { estado: m[1], ticket: `ALP-${String(Number(m[2])).padStart(3, '0')}` } : null;
}
const pieComanda = modalidad =>
  `✋ _Responde a este mensaje: *preparando*, *listo*${modalidad === 'delivery' ? ', *en ruta*' : ''} o *entregado*._`;
const esAvisoDelBot = texto => /NUEVA COMANDA|(EN PREPARACIÓN|LISTO|EN RUTA|ENTREGADO|RECIBIDO POR EL CLIENTE) · #ALP/.test(texto || '');
const ticketDeAviso = texto => ((texto || '').match(/#(ALP-\d+)/) || [])[1] || null;

// Reescribe la comanda con el estado nuevo arriba y la línea de tiempo abajo
function textoComanda(texto, c) {
  const e = ESTADOS[c.estado];
  const lineas = texto.split('\n');
  lineas[0] = `${e.emoji} *${e.titulo} · #${c.ticket}*`;
  const cuerpo = lineas.join('\n').replace(/\n\n✋ [^\n]*$/, '').replace(/\n\n🕒 [\s\S]*$/, '');
  const tiempo = (c.historial || []).map(h => `${ESTADOS[h.estado].emoji} ${ESTADOS[h.estado].corto} ${h.hora}`).join('\n');
  const cerrada = ['entregado', 'recibido'].includes(c.estado);
  return `${cuerpo}\n\n🕒 *Seguimiento*\n${tiempo}${cerrada ? '' : `\n\n${pieComanda(c.modalidad)}`}`;
}

function avisoClienteEstado(c, estado) {
  const t = `*#${c.ticket}*`;
  switch (estado) {
    case 'preparando': return `👨‍🍳 Tu pedido ${t} ya está en preparación. ¡Gracias por tu paciencia!`;
    case 'listo':
      return c.modalidad === 'delivery'
        ? `✅ Tu pedido ${t} está listo y pronto sale hacia tu dirección 🛵`
        : `✅ ¡Tu pedido ${t} está listo para recoger! Te esperamos en ${config.DIRECCION} 🦙`;
    case 'ruta': return `🛵 ¡Tu pedido ${t} salió en camino! Pronto llega a tu dirección.`;
    case 'entregado': return `📦 Tu pedido ${t} figura como entregado. ¿Lo recibiste conforme? Responde *SI* para confirmar 🙏`;
    default: return null;
  }
}

// Cambia el estado de una comanda. Devuelve el mensaje para el local y el aviso para el cliente.
function aplicarEstado(ticket, estado) {
  const c = memoria.comanda(ticket);
  if (!c) return { error: `No encontré la comanda *#${ticket}*. Escribe #pendientes para ver las que faltan.` };
  if (c.estado === estado) return { error: `La comanda *#${ticket}* ya está en *${ESTADOS[estado].corto.toLowerCase()}*.` };
  if (ESTADOS[estado].orden < ESTADOS[c.estado].orden) {
    return { error: `La comanda *#${ticket}* ya está en *${ESTADOS[c.estado].corto.toLowerCase()}*; no puede volver a *${ESTADOS[estado].corto.toLowerCase()}*.` };
  }
  if (estado === 'ruta' && c.modalidad !== 'delivery') {
    return { error: `*En ruta* es solo para delivery; la comanda *#${ticket}* es ${c.tipo.toLowerCase()}.` };
  }
  const comanda = memoria.actualizarComanda(ticket, {
    estado,
    historial: [...(c.historial || []), { estado, hora: horaLima() }],
    esperaRecepcion: estado === 'entregado'
  });
  return {
    comanda,
    mensajeLocal: `${ESTADOS[estado].emoji} Comanda *#${ticket}* → *${ESTADOS[estado].corto}*`,
    avisoCliente: avisoClienteEstado(comanda, estado)
  };
}

// El cliente responde "SI" después de "¿Lo recibiste conforme?"
function confirmarRecepcion(numeroCliente, texto) {
  const c = memoria.esperandoRecepcion(numeroCliente);
  if (!c || !aceptaInvitacion(texto)) return null;
  const comanda = memoria.actualizarComanda(c.ticket, {
    estado: 'recibido',
    esperaRecepcion: false,
    historial: [...(c.historial || []), { estado: 'recibido', hora: horaLima() }]
  });
  return {
    comanda,
    respuestas: [`🙏 ¡Gracias por confirmar! Que disfrutes tu pedido *#${c.ticket}*.\n*ALPAQORI* · Tierra de Oro 🦙`],
    mensajeLocal: `🤝 *#${c.ticket}*: el cliente confirmó que recibió su pedido.`
  };
}

/* ---------- Comandos del local: #tiempo 40, #resumen, #pendientes, #ayuda ---------- */
function masPedido(contador) {
  const top = Object.entries(contador).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (${top[1]})` : '—';
}

function procesarAdmin(texto) {
  const t = normalizar(texto);
  let m;
  if ((m = t.match(/^#tiempo\s+(\d{1,3})$/))) {
    memoria.fijarTiempo(Number(m[1]));
    return `⚙️ Listo: el tiempo estimado para nuevos pedidos ahora es de *${m[1]} minutos*.`;
  }
  if (/^#tiempo\s+(off|no|quitar|0)$/.test(t)) {
    memoria.fijarTiempo(null);
    return '⚙️ Listo: los pedidos ya no muestran tiempo estimado.';
  }
  if (t === '#resumen') {
    const r = memoria.resumen();
    const tiempo = memoria.tiempo();
    return `📊 *RESUMEN ALPAQORI · HOY*\n\n` +
      `• Pedidos cerrados: *${r.pedidos}* (${r.web} desde la web, ${r.delivery} delivery)\n` +
      `• Ventas por el bot: *${soles(r.ventas)}* _(sin delivery)_\n` +
      `• Ticket promedio: *${r.pedidos ? soles(r.ventas / r.pedidos) : '—'}*\n` +
      `• Plato más pedido: ${masPedido(r.platos)}\n` +
      `• Comandas pendientes: *${memoria.pendientes().length}*\n` +
      `• Tiempo estimado actual: ${tiempo ? `${tiempo} min` : 'sin definir'}`;
  }
  if (t === '#pendientes') {
    const p = memoria.pendientes();
    if (!p.length) return '✅ No hay comandas pendientes. ¡Todo entregado!';
    return `⏳ *COMANDAS EN CURSO (${p.length})*\n\n` +
      p.map(c => {
        const e = ESTADOS[c.estado];
        return `${e.emoji} *#${c.ticket}* · ${e.corto} · ${c.tipo}${c.nombre ? ` · ${c.nombre}` : ''} · ${soles(c.total)} · hace ${Math.max(0, Math.round((Date.now() - c.creado) / 60000))} min`;
      }).join('\n') +
      `\n\n_Responde a su comanda con *preparando*, *listo*, *en ruta* o *entregado*, o escribe #listo ${Number(p[0].ticket.slice(4))}_`;
  }
  if (t === '#menu' || t === '#menudia') return textoMenuDia();
  const ce = comandoEstado(texto);
  if (ce) {
    const r = aplicarEstado(ce.ticket, ce.estado);
    return r.error || `${r.mensajeLocal}${r.avisoCliente ? `\n_Al cliente: ${r.avisoCliente}_` : ''}`;
  }
  if (t === '#ayuda') {
    return '⚙️ *Comandos del local*\n' +
      'Responde a una comanda: *preparando*, *listo*, *en ruta* o *entregado* — cambia su estado y avisa al cliente\n' +
      '#listo 12 · #ruta 12 · #entregado 12 — lo mismo con el número de ticket\n' +
      '#pendientes — comandas en curso\n' +
      '#resumen — ventas y pedidos de hoy\n' +
      '#menu — ver el menú del día que muestra el bot\n' +
      '#tiempo 40 — tiempo estimado de los pedidos · #tiempo off — quitarlo\n' +
      '#fin 987654321 — reactivar el bot con un cliente\n' +
      '#pausa 987654321 — pausar el bot con un cliente';
  }
  return null;
}

/* ---------- Avisos para el local ---------- */
const telefono = n => (/^51\d{9}$/.test(n) ? `+51 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : n);

function avisoLocal(pedido, numeroCliente) {
  const detalle = pedido.items.map(i =>
    `• *${i.cantidad} x ${i.nombre}* — ${conPrecio(i) ? soles(i.precio * i.cantidad) : 'precio por confirmar'}` +
    (i.variante ? `\n   └ ${i.variante}` : '') +
    (i.nota ? `\n   📝 ${i.nota}` : '') +
    (i.verificar ? '\n   ⚠️ _No está en el catálogo: verificar_' : '')
  ).join('\n');
  let texto = `🔔 *NUEVA COMANDA #${pedido.ticket}*${pedido.desdeWeb ? ' 🌐 _web_' : ''}\n` +
    `📍 *Modalidad:* ${nombreModalidad(pedido.modalidad).toUpperCase()}\n` +
    (pedido.nombre ? `👤 *Cliente:* ${pedido.nombre}\n` : '') +
    `📱 ${telefono(numeroCliente)}\n` +
    (pedido.direccion ? `🏠 *Dirección:* ${pedido.direccion}\n` : '') +
    `────────────────\n*DETALLE COCINA:*\n${detalle}\n────────────────\n` +
    (pedido.indicaciones ? `📝 *Indicaciones:* ${pedido.indicaciones}\n` : '') +
    `Subtotal: ${soles(pedido.subtotal)}\n` +
    (pedido.delivery ? `Delivery (referencial): ${soles(pedido.delivery)} _— confirmar según zona_\n` : '') +
    (pedido.pago ? `💳 *Pago:* ${pedido.pago.toUpperCase()}${pedido.pago === 'Efectivo' && pedido.efectivo ? ` (paga con ${soles(pedido.efectivo)}, vuelto ${soles(pedido.efectivo - pedido.total)})` : ''} · ` : '') +
    `*TOTAL: ${soles(pedido.total)}*` +
    (pedido.porConfirmar ? '\n⚠️ _Incluye menú del día sin precio configurado: confirmar con el cliente_' : '');
  if (pedido.avisos && pedido.avisos.length) texto += `\n\n⚠️ *Revisar:*\n${pedido.avisos.map(a => `• ${a}`).join('\n')}`;
  // Enlace para avisarle al cliente en un toque
  if (/^\d{8,15}$/.test(numeroCliente || '')) {
    const saludo = pedido.nombre ? `Hola ${pedido.nombre.split(' ')[0]}` : 'Hola';
    const msg = pedido.modalidad === 'delivery'
      ? `${saludo}, tu pedido #${pedido.ticket} de Alpaqori ya salió en camino 🛵`
      : `${saludo}, tu pedido #${pedido.ticket} de Alpaqori ya está listo para recoger en Jr. Trujillo Sur 674 🦙`;
    texto += `\n\n👉 *Avisar al cliente en 1 toque:*\nhttps://wa.me/${numeroCliente}?text=${encodeURIComponent(msg)}`;
  }
  return `${texto}\n\n${pieComanda(pedido.modalidad)}`;
}

const avisoComprobante = (ticket, numeroCliente) => `💳 *Comprobante del pedido #${ticket}*\n📱 ${telefono(numeroCliente)}`;

const TEXTO_AUDIO = '🎧 Por ahora no puedo escuchar audios. ¿Me lo escribes o eliges un número del menú?';

/* ---------- Invitación para quien escribe por primera vez sin la palabra de activación ---------- */
const TEXTO_INVITACION = '¡Hola! 👋 Te saluda el asistente virtual de *ALPAQORI* · Comida criolla 🦙\n\n¿Quieres ver el menú del día o hacer un pedido?\nResponde *SI* para comenzar.';
// "si" como palabra suelta o dentro de una frase: "si", "sí", "si quiero pedir", "quiero pedir, si"
const aceptaInvitacion = texto => /\bsi\b/.test(normalizar(texto));

module.exports = {
  crearEstado, procesar, comprobante, procesarAdmin, avisoLocal, avisoComprobante, normalizar,
  TEXTO_AUDIO, TEXTO_INVITACION, aceptaInvitacion,
  esAvisoDelBot, ticketDeAviso, textoComanda,
  estadoDeRespuesta, comandoEstado, aplicarEstado, confirmarRecepcion, ESTADOS,
  // para pruebas
  leerPedidoWeb, buscar
};
