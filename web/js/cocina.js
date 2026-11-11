/* =========================================================
   ALPAQORI · cocina.js
   Pantalla de cocina: comandas en vivo por estado.
   Por confirmar → Aceptados → En el fogón → Listos → Entregado
   ========================================================= */
(function () {
  'use strict';

  const P = window.AlpaqoriPedidos;
  const esc = P.esc;
  const MINUTOS_TARDE = 15;
  const ACCIONES = { por_confirmar: 'Aceptar', nuevo: 'Al fogón', preparando: 'Marcar listo', listo: 'Entregado' };

  const botonSonido = document.getElementById('coc-sonido');
  let audio = null;
  let conocidos = null;
  let pedidos = [];

  /* Dos notas cortas, como una campanita de barra. */
  function campana() {
    if (!audio) return;
    [880, 1320].forEach((frecuencia, i) => {
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      const inicio = audio.currentTime + i * 0.18;
      osc.frequency.value = frecuencia;
      vol.gain.setValueAtTime(0.28, inicio);
      vol.gain.exponentialRampToValueAtTime(0.001, inicio + 0.55);
      osc.connect(vol).connect(audio.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.55);
    });
  }

  function linea(i) {
    return `<li><strong>${i.cantidad} ×</strong> ${esc(i.nombre)}${i.variante ? ` (${esc(i.variante)})` : ''}</li>`;
  }

  function tarjeta(p, nuevos) {
    const minutos = Math.max(0, Math.floor((Date.now() - new Date(p.creado).getTime()) / 60000));
    const clases = ['coc-tarjeta', minutos >= MINUTOS_TARDE ? 'is-tarde' : '', nuevos.has(p.id) ? 'is-entrando' : ''].join(' ');
    const pagado = p.pago.estado === 'pagado';
    const aviso = p.estado === 'por_confirmar'
      ? (p.origen === 'whatsapp'
        ? '<p class="coc-verificar">Pedido por WhatsApp: revisa la dirección y el pago antes de aceptar.</p>'
        : '<p class="coc-verificar">Antes de aceptar, un mozo confirma que hay personas en la mesa.</p>')
      : '';
    const atras = p.estado === 'por_confirmar'
      ? `<button type="button" class="per-boton per-boton--rechazo" data-rechazar="${p.id}">Rechazar</button>`
      : `<button type="button" class="per-boton" data-retroceder="${p.id}" aria-label="Regresar el pedido ${p.numero} al paso anterior">Atrás</button>`;
    return `<article class="${clases}">
      <div class="coc-tarjeta__cabeza"><span class="coc-lugar">${esc(p.lugar)}</span><span class="coc-tiempo">${minutos} min</span></div>
      ${p.cliente ? `<p class="coc-cliente">${esc(p.cliente)}</p>` : ''}
      <ul>${p.items.map(linea).join('')}</ul>
      ${p.notas ? `<p class="coc-notas">${esc(p.notas)}</p>` : ''}
      ${aviso}
      <div class="coc-pie">
        <span class="coc-sello${pagado ? ' is-pagado' : ''}">#${p.numero} · ${pagado ? 'Pagado' : 'Por cobrar'}</span>
        <span class="coc-acciones">${atras}<button type="button" class="per-boton per-boton--lleno" data-avanzar="${p.id}">${ACCIONES[p.estado]}</button></span>
      </div>
    </article>`;
  }

  function pintar() {
    const activos = pedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'rechazado');
    const nuevos = new Set(conocidos ? activos.filter((p) => !conocidos.has(p.id)).map((p) => p.id) : []);
    if (nuevos.size) campana();
    conocidos = new Set(pedidos.map((p) => p.id));

    ['por_confirmar', 'nuevo', 'preparando', 'listo'].forEach((estado) => {
      const grupo = activos.filter((p) => p.estado === estado);
      document.getElementById(`n-${estado}`).textContent = grupo.length;
      document.getElementById(`col-${estado}`).innerHTML = grupo.length
        ? grupo.map((p) => tarjeta(p, nuevos)).join('')
        : '<p class="per-vacio">Sin comandas</p>';
    });
    const pendientes = activos.filter((p) => p.estado === 'por_confirmar').length;
    document.title = pendientes ? `(${pendientes}) Cocina · Alpaqori` : 'Cocina · Alpaqori';
  }

  const fallo = () => window.alert('No se pudo guardar el cambio. Revisa la conexión.');

  document.querySelector('.coc-columnas').addEventListener('click', (e) => {
    const rechazo = e.target.closest('[data-rechazar]');
    if (rechazo) {
      /* Rechazar exige un segundo toque: evita descartar un pedido real por error. */
      if (!rechazo.dataset.armado) {
        rechazo.dataset.armado = '1';
        rechazo.textContent = '¿Seguro? Toca otra vez';
        rechazo.classList.add('per-boton--armado');
        setTimeout(() => {
          rechazo.textContent = 'Rechazar';
          rechazo.classList.remove('per-boton--armado');
          delete rechazo.dataset.armado;
        }, 4000);
        return;
      }
      P.rechazar(rechazo.dataset.rechazar).catch(fallo);
      return;
    }
    const atras = e.target.closest('[data-retroceder]');
    if (atras) P.retroceder(atras.dataset.retroceder).catch(fallo);
    const boton = e.target.closest('[data-avanzar]');
    if (boton) P.avanzar(boton.dataset.avanzar).catch(fallo);
  });

  /* El navegador exige un toque del personal antes de permitir sonido. */
  botonSonido.addEventListener('click', () => {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    campana();
    botonSonido.textContent = 'Sonido activo';
    botonSonido.classList.remove('per-boton--lleno');
    botonSonido.setAttribute('aria-pressed', 'true');
  });

  window.AlpaqoriAcceso.entrar(() => P.suscribir((lista) => {
    pedidos = lista;
    pintar();
  }));
  setInterval(pintar, 30000); // actualiza los minutos de espera
})();
