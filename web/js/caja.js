/* =========================================================
   ALPAQORI · caja.js
   Cuentas abiertas por mesa, cobro en caja y resumen del día.
   ========================================================= */
(function () {
  'use strict';

  const P = window.AlpaqoriPedidos;
  const esc = P.esc;
  const soles = P.soles;
  const METODOS = { efectivo: 'Efectivo', yape_plin: 'Yape / Plin', tarjeta: 'Tarjeta', en_linea: 'En línea' };
  const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  const sumar = (lista) => lista.reduce((s, p) => s + p.total, 0);

  function pintar(pedidos) {
    const pagados = pedidos.filter((p) => p.pago.estado === 'pagado' && esHoy(p.creado));
    document.getElementById('caj-resumen').innerHTML = [
      `<div>Cobrado hoy<strong>${soles(sumar(pagados))}</strong></div>`,
      ...Object.keys(METODOS).map((m) => `<div>${METODOS[m]}<strong>${soles(sumar(pagados.filter((p) => p.pago.metodo === m)))}</strong></div>`)
    ].join('');

    const grupos = new Map();
    pedidos.filter((p) => p.pago.estado === 'pendiente' && p.estado !== 'por_confirmar' && p.estado !== 'rechazado').forEach((p) => {
      grupos.set(p.lugar, [...(grupos.get(p.lugar) || []), p]);
    });

    /* Primero las mesas que pidieron la cuenta. */
    const cuentas = [...grupos.entries()]
      .sort(([, a], [, b]) => Number(b.some((p) => p.pago.solicitaCaja)) - Number(a.some((p) => p.pago.solicitaCaja)))
      .map(([lugar, lista]) => {
        const solicita = lista.some((p) => p.pago.solicitaCaja);
        const total = sumar(lista);
        const ids = lista.map((p) => p.id).join(',');
        const lineas = lista.flatMap((p) => p.items).map((i) =>
          `<li>${i.cantidad} × ${esc(i.nombre)}${i.variante ? ` (${esc(i.variante)})` : ''} — ${soles(i.precio * i.cantidad)}</li>`
        ).join('');
        const botones = ['efectivo', 'yape_plin', 'tarjeta'].map((m) =>
          `<button type="button" class="per-boton" data-cobrar="${ids}" data-metodo="${m}">${METODOS[m]}</button>`
        ).join('');
        return `<article class="caj-cuenta${solicita ? ' is-solicita' : ''}">
          <div class="caj-cuenta__cabeza"><h2>${esc(lugar)}</h2><span class="caj-total">${soles(total)}</span></div>
          ${solicita ? '<p class="caj-aviso">Pidió la cuenta: pagará en caja</p>' : ''}
          <ul>${lineas}</ul>
          <div class="caj-metodos" role="group" aria-label="Cobrar ${esc(lugar)}">${botones}</div>
        </article>`;
      }).join('');

    document.getElementById('caj-cuentas').innerHTML = cuentas || '<p class="per-vacio">No hay cuentas abiertas</p>';
  }

  document.getElementById('caj-cuentas').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-cobrar]');
    if (!boton) return;
    /* Cerrar una cuenta exige un segundo toque: evita cobros por error. */
    if (!boton.dataset.armado) {
      const original = boton.textContent;
      boton.dataset.armado = '1';
      boton.textContent = `¿Cobrar en ${original}? Toca otra vez`;
      boton.classList.add('per-boton--lleno');
      setTimeout(() => {
        boton.textContent = original;
        boton.classList.remove('per-boton--lleno');
        delete boton.dataset.armado;
      }, 4000);
      return;
    }
    P.pagar(boton.dataset.cobrar.split(','), boton.dataset.metodo).catch(() => window.alert('No se pudo registrar el cobro. Revisa la conexión.'));
  });

  window.AlpaqoriAcceso.entrar(() => P.suscribir(pintar));
})();
