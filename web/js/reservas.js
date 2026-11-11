/* =========================================================
   ALPAQORI · reservas.js
   Modal "Reserva tu mesa" (y cotización de celebraciones).
   Se abre con cualquier botón [data-reservar] o
   [data-reservar="grupo"]. El mensaje sale por WhatsApp.
   Requiere config.js y comun.js (window.ALPAQORI).
   ========================================================= */
(function () {
  'use strict';

  var A = window.ALPAQORI;
  var CFG = window.ALPAQORI_CONFIG;
  if (!A || !CFG) return;

  var ANTICIPACION_MIN = 30;
  var AMBIENTES = [
    { id: 'salon', nombre: 'Salón del mural', desc: 'Bajo el mural de la llama y los nevados' },
    { id: 'patio', nombre: 'Patio de buganvillas', desc: 'Al aire libre, entre flores y banderines' }
  ];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* Fecha y hora de Lima en formato de los campos (AAAA-MM-DD y HH:MM). */
  function hoyLima() {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { fecha: p.year + '-' + p.month + '-' + p.day, minutos: Number(p.hour) * 60 + Number(p.minute) };
  }
  function diaSemana(iso) { return new Date(iso + 'T12:00:00').getDay(); }
  /* Horario oficial: 8:00 a 18:00; viernes y sábado hasta las 22:00. Última reserva una hora antes del cierre. */
  function cierre(iso) { var d = diaSemana(iso); return (d === 5 || d === 6) ? 22 * 60 : 18 * 60; }
  function aMin(hhmm) { var x = hhmm.split(':'); return Number(x[0]) * 60 + Number(x[1]); }
  function fechaLarga(iso) {
    var x = iso.split('-');
    return DIAS[diaSemana(iso)] + ' ' + x[2] + '/' + x[1] + '/' + x[0];
  }
  function horaBonita(hhmm) {
    var m = aMin(hhmm);
    var h = Math.floor(m / 60);
    var sufijo = h < 12 ? 'a. m.' : 'p. m.';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m % 60).padStart(2, '0') + ' ' + sufijo;
  }

  var ICONO_CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ICONO_RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function montar() {
    if (document.getElementById('modal-reserva')) return;
    var personas = [2, 3, 4, 6, 8].map(function (n) {
      return '<button type="button" class="chip-personas" data-personas="' + n + '" aria-pressed="false">' + (n === 8 ? '8+' : n) + '</button>';
    }).join('');
    var ambientes = AMBIENTES.map(function (a, i) {
      return '<label class="opcion-tarjeta"><input type="radio" name="ambiente" value="' + a.id + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span><strong>' + esc(a.nombre) + '</strong><small>' + esc(a.desc) + '</small></span></label>';
    }).join('');

    document.body.insertAdjacentHTML('beforeend',
      '<dialog class="modal-alpa" id="modal-reserva" aria-labelledby="reserva-titulo">' +
      '<button type="button" class="modal-alpa__cerrar" data-cerrar-modal aria-label="Cerrar">✕</button>' +
      '<div id="reserva-vista-form">' +
        '<p class="modal-alpa__eyebrow">Tierra de Oro · Chosica</p>' +
        '<h2 id="reserva-titulo" class="modal-alpa__titulo">Reserva tu mesa</h2>' +
        '<p class="modal-alpa__intro">Cuéntanos cuándo vienes y te guardamos un lugar en el patio.</p>' +
        '<form id="reserva-form" novalidate>' +
          '<fieldset class="paso-alpa"><legend><span class="paso-alpa__num">1</span>¿Qué celebramos?</legend>' +
            '<div class="opciones-dos">' +
              '<label class="opcion-tarjeta"><input type="radio" name="tipo" value="mesa" checked><span><strong>Una mesa</strong><small>Almuerzo o cena con la familia o los amigos</small></span></label>' +
              '<label class="opcion-tarjeta"><input type="radio" name="tipo" value="grupo"><span><strong>Celebración o grupo</strong><small>Cumpleaños, reuniones y menú para muchos</small></span></label>' +
            '</div></fieldset>' +
          '<fieldset class="paso-alpa"><legend><span class="paso-alpa__num">2</span>¿Cuándo nos visitas?</legend>' +
            '<div class="dos-col">' +
              '<label class="campo-alpa"><span>Fecha</span><span class="campo-alpa__control">' + ICONO_CAL + '<input name="fecha" type="date" required></span></label>' +
              '<label class="campo-alpa"><span>Hora de llegada</span><span class="campo-alpa__control">' + ICONO_RELOJ + '<input name="hora" type="time" step="900" required></span></label>' +
            '</div>' +
            '<p class="modal-alpa__nota" id="reserva-horario"></p>' +
          '</fieldset>' +
          '<fieldset class="paso-alpa"><legend><span class="paso-alpa__num">3</span>¿Cuántos serán?</legend>' +
            '<div class="fila-chips" data-bloque-mesa>' + personas + '</div>' +
            '<input type="hidden" name="personas" value="">' +
            '<div data-bloque-grupo hidden>' +
              '<div class="dos-col">' +
                '<label class="campo-alpa"><span>N.º de invitados</span><span class="campo-alpa__control"><input name="invitados" type="number" min="6" max="200" inputmode="numeric"></span></label>' +
                '<label class="campo-alpa"><span>Ocasión</span><span class="campo-alpa__control"><input name="ocasion" type="text" maxlength="60" placeholder="Cumpleaños, reunión…"></span></label>' +
              '</div>' +
              '<label class="campo-alpa"><span>¿Qué les gustaría comer?</span><span class="campo-alpa__control"><textarea name="menu" rows="2" maxlength="300" placeholder="Ej. Pachamanca para todos, con chicha y postre"></textarea></span></label>' +
            '</div></fieldset>' +
          '<fieldset class="paso-alpa"><legend><span class="paso-alpa__num">4</span>Elige tu rincón</legend><div class="opciones-dos">' + ambientes + '</div></fieldset>' +
          '<fieldset class="paso-alpa"><legend><span class="paso-alpa__num">5</span>Tus datos</legend>' +
            '<label class="campo-alpa"><span>Nombre</span><span class="campo-alpa__control"><input name="nombre" type="text" autocomplete="name" maxlength="60" required></span></label>' +
            '<label class="campo-alpa"><span>Notas (opcional)</span><span class="campo-alpa__control"><input name="notas" type="text" maxlength="120" placeholder="Silla para bebé, cerca de las flores…"></span></label>' +
          '</fieldset>' +
          '<p class="modal-alpa__error" id="reserva-error" role="alert"></p>' +
          '<button class="boton wa modal-alpa__enviar" type="submit">Enviar reserva por WhatsApp</button>' +
        '</form>' +
      '</div>' +
      '<div id="reserva-vista-ok" class="modal-alpa__ok" hidden>' +
        '<span class="modal-alpa__sello" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<h2 class="modal-alpa__titulo">¡Te esperamos en el patio!</h2>' +
        '<p class="modal-alpa__intro">Abrimos WhatsApp con tu reserva escrita. Solo toca <strong>Enviar</strong> y te confirmamos por ahí.</p>' +
        '<a class="boton wa modal-alpa__enviar" id="reserva-wa" href="#" target="_blank" rel="noopener">Abrir WhatsApp otra vez</a>' +
      '</div>' +
      '</dialog>');

    var modal = document.getElementById('modal-reserva');
    var form = document.getElementById('reserva-form');
    form.addEventListener('submit', enviar);
    form.addEventListener('change', function (e) { if (e.target.name === 'tipo' || e.target.name === 'fecha') ajustar(); });
    form.elements.fecha.addEventListener('input', ajustar);
    form.querySelectorAll('[data-personas]').forEach(function (b) {
      b.addEventListener('click', function () {
        form.elements.personas.value = b.dataset.personas;
        form.querySelectorAll('[data-personas]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
    modal.querySelector('[data-cerrar-modal]').addEventListener('click', function () { modal.close(); });
    /* Tocar fuera del panel cierra el modal. */
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  }

  function ajustar() {
    var form = document.getElementById('reserva-form');
    var grupo = form.elements.tipo.value === 'grupo';
    var fecha = form.elements.fecha.value;
    form.elements.fecha.min = hoyLima().fecha;
    form.querySelector('[data-bloque-mesa]').hidden = grupo;
    form.querySelector('[data-bloque-grupo]').hidden = !grupo;
    form.querySelector('[type="submit"]').textContent = grupo ? 'Pedir cotización por WhatsApp' : 'Enviar reserva por WhatsApp';
    var hora = form.elements.hora;
    hora.min = '08:00';
    hora.max = fecha ? String(cierre(fecha) / 60 - 1).padStart(2, '0') + ':00' : '21:00';
    document.getElementById('reserva-horario').textContent = fecha
      ? 'Ese ' + DIAS[diaSemana(fecha)] + ' atendemos de 8:00 a. m. a ' + horaBonita(String(cierre(fecha) / 60) + ':00')
      : 'Atendemos todos los días de 8:00 a. m. a 6:00 p. m.; viernes y sábado hasta las 10:00 p. m.';
  }

  function abrir(tipo) {
    montar();
    var modal = document.getElementById('modal-reserva');
    var form = document.getElementById('reserva-form');
    form.reset();
    form.querySelectorAll('[data-personas]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    form.elements.tipo.value = tipo === 'grupo' ? 'grupo' : 'mesa';
    document.getElementById('reserva-vista-form').hidden = false;
    document.getElementById('reserva-vista-ok').hidden = true;
    document.getElementById('reserva-error').textContent = '';
    try {
      var historial = JSON.parse(localStorage.getItem('alpaqori_pedidos') || '[]');
      var ultimo = historial[historial.length - 1];
      if (ultimo && ultimo.datos && ultimo.datos.nombre) form.elements.nombre.value = ultimo.datos.nombre;
    } catch (e) { /* sin historial */ }
    ajustar();
    modal.showModal();
  }

  function validar(d) {
    var ahora = hoyLima();
    if (!d.fecha) return 'Elige la fecha de tu visita.';
    if (d.fecha < ahora.fecha) return 'Esa fecha ya pasó.';
    if (!d.hora) return 'Elige la hora de llegada.';
    var m = aMin(d.hora);
    if (m < 8 * 60 || m > cierre(d.fecha) - 60) return 'Ese día recibimos reservas de 8:00 a. m. a ' + horaBonita(String(cierre(d.fecha) / 60 - 1) + ':00') + '.';
    if (d.fecha === ahora.fecha && m < ahora.minutos + ANTICIPACION_MIN) return 'Para hoy, reserva con al menos 30 minutos de anticipación.';
    if (!d.personas) return d.grupo ? 'Indica cuántos invitados serán.' : 'Indica cuántas personas serán.';
    if (d.nombre.length < 2) return 'Escribe tu nombre para la reserva.';
    return '';
  }

  function mensaje(d) {
    var l = [d.grupo ? 'Hola Alpaqori, quiero cotizar una celebración:' : 'Hola Alpaqori, quiero reservar una mesa:'];
    l.push('Fecha: ' + fechaLarga(d.fecha));
    l.push('Hora: ' + horaBonita(d.hora));
    l.push((d.grupo ? 'Invitados: ' : 'Personas: ') + d.personas);
    if (d.grupo && d.ocasion) l.push('Ocasión: ' + d.ocasion);
    if (d.grupo && d.menu) l.push('Menú deseado: ' + d.menu);
    l.push('Ambiente: ' + d.ambiente);
    l.push('Nombre: ' + d.nombre);
    if (d.notas) l.push('Notas: ' + d.notas);
    return l.join('\n');
  }

  function enviar(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var grupo = form.elements.tipo.value === 'grupo';
    var ambiente = AMBIENTES.find(function (a) { return a.id === form.elements.ambiente.value; }) || AMBIENTES[0];
    var d = {
      grupo: grupo,
      fecha: form.elements.fecha.value,
      hora: form.elements.hora.value,
      personas: grupo ? Number(form.elements.invitados.value) || 0 : (form.elements.personas.value === '8' ? '8 o más' : Number(form.elements.personas.value) || 0),
      ocasion: form.elements.ocasion.value.trim(),
      menu: form.elements.menu.value.trim(),
      ambiente: ambiente.nombre,
      nombre: form.elements.nombre.value.trim().replace(/\s+/g, ' '),
      notas: form.elements.notas.value.trim()
    };
    var error = validar(d);
    document.getElementById('reserva-error').textContent = error;
    if (error) return;
    var url = A.enlaceWhatsApp(mensaje(d));
    document.getElementById('reserva-wa').href = url;
    document.getElementById('reserva-vista-form').hidden = true;
    document.getElementById('reserva-vista-ok').hidden = false;
    window.open(url, '_blank', 'noopener');
  }

  document.addEventListener('click', function (e) {
    var boton = e.target.closest('[data-reservar]');
    if (!boton) return;
    e.preventDefault();
    abrir(boton.getAttribute('data-reservar'));
  });

  window.ALPAQORI_RESERVAS = { abrir: abrir };
})();
