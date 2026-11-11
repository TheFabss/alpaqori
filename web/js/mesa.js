/* =========================================================
   ALPAQORI · mesa.js
   "Mi pedido y cuenta" del cliente que pidió desde el QR de
   su mesa: avance de cada pedido en vivo y pago de la cuenta.
   Los pedidos se arman en carta.html?mesa=N.
   ========================================================= */
(function () {
  'use strict';

  const P = window.AlpaqoriPedidos;
  const esc = P.esc;
  const soles = P.soles;
  const CLAVE_MIOS = 'alpaqori_mesa_pedidos';
  const HORAS_CUENTA = 8;
  const NOMBRES_ESTADO = ['Confirmado', 'En el fogón', 'Listo', 'Servido'];
  const PASOS = ['nuevo', 'preparando', 'listo', 'entregado'];
  const cobrable = (p) => p.pago.estado === 'pendiente' && p.estado !== 'por_confirmar' && p.estado !== 'rechazado';
  const $ = (id) => document.getElementById(id);

  const parametros = new URLSearchParams(location.search);
  const mesa = (parametros.get('mesa') || '').replace(/\D/g, '').slice(0, 3);
  const aCarta = `carta.html${mesa ? `?mesa=${mesa}` : ''}`;
  let recienEnviado = parametros.get('nuevo') || '';
  let ultimoHtml = '';
  let pedidos = [];

  /* Sin ?ver=pedido esta dirección es solo un atajo a la carta de la mesa. */
  if (parametros.get('ver') !== 'pedido') {
    location.replace(aCarta);
    return;
  }

  const leerMios = () => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_MIOS)) || [];
    } catch {
      return [];
    }
  };

  $('cli-lugar').textContent = mesa ? `Mesa ${mesa}` : 'Mi pedido';
  $('nav-carta').href = aCarta;

  function misPedidos() {
    const limite = Date.now() - HORAS_CUENTA * 3600000;
    const ids = leerMios();
    /* Solo los pedidos de esta mesa: un mismo teléfono pudo pedir antes en otra. */
    return pedidos.filter((p) => ids.includes(p.token || p.id)
      && new Date(p.creado).getTime() > limite
      && (!mesa || p.lugar === `Mesa ${mesa}`));
  }

  function tarjeta(p) {
    const actual = PASOS.indexOf(p.estado);
    const estado = p.estado === 'rechazado'
      ? '<p class="seg-estado seg-estado--rechazo">No pudimos confirmar tu mesa y el pedido se canceló. Si sigues aquí, llama a un mozo.</p>'
      : p.estado === 'por_confirmar'
        ? '<p class="seg-estado">Esperando confirmación: un mozo verificará tu mesa en un momento.</p>'
        : `<ol class="seg-pasos" aria-label="Avance del pedido">${NOMBRES_ESTADO.map((n, i) => `<li class="${i <= actual ? 'is-hecho' : ''}">${n}</li>`).join('')}</ol>`;
    return `<article class="seg-pedido${p.estado === 'rechazado' ? ' is-rechazado' : ''}">
      <div class="seg-pedido__cabeza"><span>Pedido #${p.numero}</span><span>${soles(p.total)}</span></div>
      <ul>${p.items.map((i) => `<li>${i.cantidad} × ${esc(i.nombre)}${i.variante ? ` (${esc(i.variante)})` : ''}</li>`).join('')}</ul>
      ${estado}
    </article>`;
  }

  function pintar() {
    const mios = misPedidos();
    const contenedor = $('vista-seguimiento');
    let html;
    if (!mios.length) {
      html = `<h1>Mi pedido</h1><p class="cli-vacio">Aún no has enviado pedidos desde esta mesa. Elige tus platos en la carta y llegan directo a cocina.</p>
        <a class="cli-accion cli-pedir-mas" href="${aCarta}">Ver la carta</a>`;
    } else {
      const pendientes = mios.filter(cobrable);
      const esperando = mios.some((p) => p.estado === 'por_confirmar');
      const porPagar = pendientes.reduce((s, p) => s + p.total, 0);
      const pidioCaja = pendientes.length && pendientes.every((p) => p.pago.solicitaCaja);

      let cuenta = esperando
        ? '<p>La cuenta se habilita cuando confirmemos tu pedido.</p>'
        : '<p><strong>Cuenta pagada.</strong> ¡Gracias por visitar el patio!</p>';
      if (mios.every((p) => p.estado === 'rechazado')) cuenta = '<p>No tienes pedidos por pagar.</p>';
      if (pendientes.length) {
        cuenta = `<p class="cli-total"><span>Por pagar</span><span>${soles(porPagar)}</span></p>
          ${pidioCaja ? '<p>Avisamos a caja: puedes pagar al salir o te llevamos la cuenta a la mesa.</p>' : ''}
          <button type="button" class="cli-accion" id="btn-pagar">Pagar desde el celular</button>
          ${pidioCaja ? '' : '<button type="button" class="cli-accion cli-accion--sec" id="btn-caja">Pagaré en caja</button>'}`;
      }
      const aviso = recienEnviado
        ? `<p class="seg-aviso">Tu pedido #${esc(recienEnviado)} llegó a cocina. Un mozo confirmará tu mesa en un momento.</p>`
        : '';
      html = `<h1>Mi pedido</h1>${aviso}${mios.map(tarjeta).join('')}
        <section class="seg-cuenta" aria-label="Cuenta">${cuenta}</section>
        <a class="cli-accion cli-accion--sec cli-pedir-mas" href="${aCarta}">Pedir algo más</a>`;
    }
    /* El sondeo no debe repintar ni reanunciar si nada cambió. */
    if (html !== ultimoHtml) contenedor.innerHTML = html;
    ultimoHtml = html;
  }

  const idsPendientes = () => misPedidos().filter(cobrable).map((p) => p.token || p.id);
  const avisarFallo = () => window.alert('No pudimos registrar tu solicitud. Revisa tu conexión e inténtalo de nuevo.');

  $('vista-seguimiento').addEventListener('click', (e) => {
    if (e.target.id === 'btn-caja') P.solicitarCaja(idsPendientes()).catch(avisarFallo);
    if (e.target.id === 'btn-pagar') {
      $('pago-total').textContent = soles(misPedidos().filter(cobrable).reduce((s, p) => s + p.total, 0));
      $('hoja-pago').showModal();
    }
  });
  $('pago-confirmar').addEventListener('click', () => {
    recienEnviado = '';
    P.pagarEnLinea(idsPendientes()).catch(avisarFallo);
    $('hoja-pago').close();
  });
  document.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('nav-seguimiento').addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* El aviso de "llegó a cocina" se muestra una vez: se quita del enlace para no repetirlo al recargar. */
  if (recienEnviado) history.replaceState(null, '', `mesa.html?${mesa ? `mesa=${mesa}&` : ''}ver=pedido`);

  P.suscribirCliente((lista) => {
    pedidos = lista;
    pintar();
  });
})();
