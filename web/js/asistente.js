/* =========================================================
   ALPAQORI · asistente.js
   Asistente de la web: responde al instante horario, menú
   del día, ubicación, delivery y pagos; busca platos y
   precios en el catálogo; abre la reserva o la carta.
   Lo que no sabe, lo pasa a WhatsApp con la pregunta escrita.
   Requiere config.js, catalogo.js y comun.js.
   ========================================================= */
(function () {
  'use strict';

  var A = window.ALPAQORI;
  var CFG = window.ALPAQORI_CONFIG;
  var CAT = window.ALPAQORI_CATALOGO;
  if (!A || !CFG || !CAT) return;

  var CLAVE = 'alpaqori_asistente';
  var VERSION = 1;
  var enCarta = document.body.classList.contains('pagina-carta');
  var mesa = (new URLSearchParams(location.search).get('mesa') || '').replace(/\D/g, '').slice(0, 3);
  var aCarta = 'carta.html' + (mesa ? '?mesa=' + mesa : '');

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function normalizar(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function soles(n) { return 'S/ ' + Number(n).toFixed(2); }
  function lista(arr) { return arr.length > 1 ? arr.slice(0, -1).join(', ') + ' o ' + arr[arr.length - 1] : arr[0]; }
  function hoyDisponible(p) { return !p.disponible_dias.length || p.disponible_dias.indexOf(A.ahoraLima().dia) !== -1; }

  /* ---------- Respuestas ---------- */
  function respHorario() {
    var e = A.estadoLocal();
    var ahora = e.abierto
      ? 'Ahora estamos <strong>abiertos</strong> hasta las ' + (e.cierre === 22 ? '10:00 p. m.' : '6:00 p. m.') + '.'
      : 'Ahora estamos <strong>cerrados</strong>; abrimos a las 8:00 a. m.';
    return ahora + '<br>' + esc(CFG.horario) + '.';
  }
  function respMenu() {
    var m = CAT.menu_del_dia;
    return '<strong>Menú del día · ' + soles(m.precio_pen) + '</strong><br>' +
      'Entrada: ' + esc(lista(m.entradas)) + '.<br>Segundo: ' + esc(lista(m.segundos)) + '.<br>Postre: ' + esc(lista(m.postre)) + '.';
  }
  function respUbicacion() {
    return esc(CFG.direccion) + '.<br><a class="asis-enlace" href="' + esc(CFG.mapsBusqueda) + '" target="_blank" rel="noopener">Abrir en Google Maps</a>';
  }
  function respDelivery() {
    return 'Sí, llevamos a tu casa. El delivery cuesta desde ' + soles(CFG.deliveryTarifa) + ' (unos 10 minutos en moto). ' +
      'Arma tu pedido en la carta y te lo enviamos por WhatsApp.<br><a class="asis-enlace" href="carta.html#pedido">Ir a la carta</a>';
  }
  function respPagos() {
    return 'Aceptamos <strong>Yape, Plin y efectivo</strong>. Si pagas en efectivo, dinos con cuánto pagas para llevarte el vuelto.';
  }
  function respMesa() {
    return mesa
      ? 'Estás en la <strong>Mesa ' + esc(mesa) + '</strong>: elige tus platos en esta carta y tu pedido llega directo a cocina.<br><a class="asis-enlace" href="mesa.html?mesa=' + esc(mesa) + '&amp;ver=pedido">Ver mi pedido y cuenta</a>'
      : 'Si estás en el local, escanea el QR de tu mesa: verás la carta con tu número de mesa y el pedido llega directo a cocina, sin esperar.';
  }

  var TEMAS = [
    { chip: 'Menú de hoy', re: /menu|almuerzo|hoy hay|que hay hoy|plato del dia|campechano/, r: respMenu },
    { chip: 'Horario', re: /horario|abren|abierto|cierran|atienden|a que hora|hasta que hora|domingo|feriado/, r: respHorario },
    { chip: '¿Dónde están?', re: /donde|ubica|direccion|llegar|mapa|queda|local/, r: respUbicacion },
    { chip: 'Delivery', re: /delivery|domicilio|envio|envian|llevan|reparto|moto/, r: respDelivery },
    { chip: 'Formas de pago', re: /pago|pagar|yape|plin|efectivo|tarjeta|visa/, r: respPagos },
    { chip: 'Pedir desde mi mesa', re: /\bqr\b|mesa|mozo|cuenta/, r: respMesa },
    { chip: 'Reservar', re: /reserv|separar|cumple|celebra|grupo|evento/, r: function () { return 'accion:reservar'; } }
  ];

  /* Busca platos por nombre; devuelve hasta 4 con precio y enlace a su tarjeta en la carta. */
  function buscarPlatos(texto) {
    var palabras = normalizar(texto).split(' ').filter(function (w) {
      return w.length > 2 && ['que', 'hay', 'tienen', 'precio', 'cuanto', 'cuesta', 'quiero', 'para', 'con', 'una', 'uno', 'los', 'las', 'del'].indexOf(w) === -1;
    });
    if (!palabras.length) return [];
    function tiene(p, w) { var n = normalizar(p.nombre); return n.indexOf(w) !== -1 || n.indexOf(w.replace(/s$/, '')) !== -1; }
    /* Primero los que tienen todas las palabras ("lomo saltado" → solo el lomo saltado). */
    var todas = CAT.productos.filter(function (p) { return palabras.every(function (w) { return tiene(p, w); }); });
    if (todas.length) return todas.slice(0, 4);
    return CAT.productos.filter(function (p) { return palabras.some(function (w) { return tiene(p, w); }); }).slice(0, 4);
  }
  function respPlatos(platos) {
    return 'Esto encontré en la carta:<ul class="asis-platos">' + platos.map(function (p) {
      var precio = p.variantes
        ? Object.keys(p.variantes).map(function (k) { return k + ' ' + soles(p.variantes[k]); }).join(' · ')
        : soles(p.precio_pen);
      var aviso = hoyDisponible(p) ? '' : ' <em>(no hay hoy)</em>';
      return '<li><a href="' + (enCarta ? '' : aCarta) + '#plato-' + esc(p.id) + '" data-ir-plato>' + esc(p.nombre) + '</a>' + aviso + '<span>' + esc(precio) + '</span></li>';
    }).join('') + '</ul>';
  }

  function responder(texto) {
    var t = normalizar(texto);
    if (/^(hola|buenas|buenos|hey|alo)\b/.test(t) && t.split(' ').length <= 3) return { html: '¡Hola! ¿En qué te ayudo? Puedes preguntarme por el menú, el horario o cualquier plato.' };
    if (/gracias/.test(t)) return { html: '¡Con gusto! Te esperamos en el patio.' };
    if (/persona|humano|asesor|hablar con|whatsapp|llamar|telefono/.test(t)) {
      return { html: 'Te paso con nuestro equipo por WhatsApp (' + esc(CFG.telefonoPublico) + ').', wa: texto };
    }
    var tema = TEMAS.find(function (x) { return x.re.test(t); });
    var platos = buscarPlatos(texto);
    if (platos.length && (!tema || /precio|cuanto|cuesta|tienen|hay/.test(t))) return { html: respPlatos(platos) };
    if (tema) {
      var r = tema.r();
      if (r === 'accion:reservar') return { html: 'Con gusto. Te abro el formulario de reserva: eliges fecha, hora y cuántos serán.', accion: 'reservar' };
      return { html: r };
    }
    if (platos.length) return { html: respPlatos(platos) };
    return { html: 'Esa no la sé responder todavía. Si quieres, te paso con una persona por WhatsApp con tu pregunta ya escrita.', wa: texto };
  }

  /* ---------- Interfaz ---------- */
  var ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

  document.body.insertAdjacentHTML('beforeend',
    '<div class="asis' + (enCarta ? ' asis--carta' : '') + '">' +
      '<button type="button" class="asis-fab" aria-expanded="false" aria-controls="asis-panel">' + ICONO + '<span>¿Te ayudo?</span></button>' +
      '<section class="asis-panel" id="asis-panel" role="dialog" aria-label="Asistente de Alpaqori" hidden>' +
        '<header class="asis-cabeza"><div><p class="asis-titulo">Asistente Alpaqori</p><p class="asis-sub" id="asis-estado"></p></div>' +
        '<button type="button" class="asis-cerrar" aria-label="Cerrar asistente">✕</button></header>' +
        '<div class="asis-mensajes" id="asis-mensajes" aria-live="polite"></div>' +
        '<div class="asis-chips" id="asis-chips"></div>' +
        '<form class="asis-form" id="asis-form"><label class="solo-lectores" for="asis-texto">Escribe tu pregunta</label>' +
        '<input id="asis-texto" type="text" autocomplete="off" maxlength="160" placeholder="Pregunta por un plato, el horario…">' +
        '<button type="submit" aria-label="Enviar pregunta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></form>' +
      '</section>' +
    '</div>');

  var raiz = document.querySelector('.asis');
  var fab = raiz.querySelector('.asis-fab');
  var panel = document.getElementById('asis-panel');
  var cajaMensajes = document.getElementById('asis-mensajes');
  var chips = document.getElementById('asis-chips');
  var form = document.getElementById('asis-form');
  var entrada = document.getElementById('asis-texto');
  var mensajes = cargar();

  function cargar() {
    try {
      var g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
      return g && g.v === VERSION ? g.mensajes : [];
    } catch (e) { return []; }
  }
  function guardar() {
    try { sessionStorage.setItem(CLAVE, JSON.stringify({ v: VERSION, mensajes: mensajes.slice(-40) })); } catch (e) { /* sin almacenamiento */ }
  }

  function pintarMensaje(m, animar) {
    var div = document.createElement('div');
    div.className = 'asis-msg asis-msg--' + m.de + (animar ? ' entra' : '');
    div.innerHTML = m.html;
    cajaMensajes.appendChild(div);
    cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
  }
  function agregar(de, html, extra) {
    var m = { de: de, html: html };
    if (extra && extra.wa) {
      m.html += '<br><a class="asis-enlace asis-enlace--wa" href="' + esc(A.enlaceWhatsApp('Hola Alpaqori, tengo una consulta: ' + extra.wa)) + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>';
    }
    mensajes.push(m);
    guardar();
    pintarMensaje(m, true);
  }

  function pintarChips() {
    var opciones = TEMAS.map(function (t) { return t.chip; });
    opciones.push(enCarta ? 'Hablar con una persona' : 'Ver la carta');
    chips.innerHTML = opciones.map(function (c) { return '<button type="button" class="asis-chip">' + esc(c) + '</button>'; }).join('');
  }

  function saludo() {
    var h = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
    var parte = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return parte + '. Soy el asistente de Alpaqori: te cuento el menú de hoy, el horario, precios de cualquier plato o te ayudo a reservar.';
  }

  function preguntar(texto) {
    texto = texto.trim();
    if (!texto) return;
    if (texto === 'Ver la carta') { location.href = aCarta; return; }
    agregar('yo', esc(texto));
    var r = responder(texto === 'Hablar con una persona' ? 'hablar con una persona' : texto);
    setTimeout(function () {
      agregar('bot', r.html, r);
      if (r.accion === 'reservar' && window.ALPAQORI_RESERVAS) setTimeout(function () { alternar(false); window.ALPAQORI_RESERVAS.abrir('mesa'); }, 650);
    }, 280);
  }

  function alternar(abrir) {
    var abierto = typeof abrir === 'boolean' ? abrir : panel.hidden;
    panel.hidden = !abierto;
    raiz.classList.toggle('abierto', abierto);
    fab.setAttribute('aria-expanded', String(abierto));
    if (abierto) {
      var e = A.estadoLocal();
      document.getElementById('asis-estado').textContent = e.abierto ? 'Abierto ahora · responde al instante' : 'Cerrado ahora · responde al instante';
      if (!mensajes.length) agregar('bot', esc(saludo()));
      cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
      if (window.matchMedia('(hover: hover)').matches) entrada.focus();
    } else {
      fab.focus();
    }
  }

  mensajes.forEach(function (m) { pintarMensaje(m, false); });
  pintarChips();
  fab.addEventListener('click', function () { alternar(); });
  raiz.querySelector('.asis-cerrar').addEventListener('click', function () { alternar(false); });
  chips.addEventListener('click', function (e) {
    var c = e.target.closest('.asis-chip');
    if (c) preguntar(c.textContent);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    preguntar(entrada.value);
    entrada.value = '';
  });
  cajaMensajes.addEventListener('click', function (e) {
    var enlace = e.target.closest('[data-ir-plato]');
    if (enlace && enCarta && window.matchMedia('(max-width: 640px)').matches) alternar(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) alternar(false); });
  document.querySelectorAll('[data-asistente]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); alternar(true); });
  });
})();
