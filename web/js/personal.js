/* =========================================================
   ALPAQORI · personal.js
   Inicio del personal: resumen en vivo del salón y accesos
   a cocina, caja y QR. En modo demostración permite crear y
   borrar pedidos de prueba.
   ========================================================= */
(function () {
  'use strict';

  const P = window.AlpaqoriPedidos;
  const $ = (id) => document.getElementById(id);
  const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString();

  const hora = Number(new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  $('hub-saludo').textContent = hora < 12 ? 'Buen día, equipo' : hora < 19 ? 'Buenas tardes, equipo' : 'Buenas noches, equipo';

  function pintar(pedidos) {
    const activos = pedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'rechazado');
    const abiertas = new Set(pedidos.filter((p) => p.pago.estado === 'pendiente' && p.estado !== 'por_confirmar' && p.estado !== 'rechazado').map((p) => p.lugar));
    const cobrado = pedidos.filter((p) => p.pago.estado === 'pagado' && esHoy(p.creado)).reduce((s, p) => s + p.total, 0);
    $('d-confirmar').textContent = activos.filter((p) => p.estado === 'por_confirmar').length;
    $('d-cocina').textContent = activos.filter((p) => p.estado === 'nuevo' || p.estado === 'preparando').length;
    $('d-cuentas').textContent = abiertas.size;
    $('d-cobrado').textContent = P.soles(cobrado);
  }

  /* Pedido de prueba con platos reales de la carta (solo modo demostración). */
  const PRUEBAS = [
    [{ id: 'menu-del-dia', nombre: 'Menú del día', variante: '', precio: 18, cantidad: 2 }, { id: 'chicha-morada-litro', nombre: 'Chicha morada (litro)', variante: '', precio: 12, cantidad: 1 }],
    [{ id: 'pollo-a-la-plancha', nombre: 'Pollo a la plancha', variante: '', precio: 28, cantidad: 1 }],
    [{ id: 'menu-del-dia', nombre: 'Menú del día', variante: '', precio: 18, cantidad: 1 }]
  ];
  $('hub-prueba').addEventListener('click', async () => {
    const items = PRUEBAS[Math.floor(Math.random() * PRUEBAS.length)];
    const mesa = 1 + Math.floor(Math.random() * 10);
    await P.crear({ lugar: `Mesa ${mesa}`, origen: 'qr', cliente: 'Prueba', items, notas: 'Pedido de prueba' });
  });
  const vaciar = $('hub-vaciar');
  vaciar.addEventListener('click', async () => {
    if (!vaciar.dataset.armado) {
      vaciar.dataset.armado = '1';
      vaciar.textContent = '¿Borrar todo? Toca otra vez';
      vaciar.classList.add('per-boton--armado');
      setTimeout(() => {
        vaciar.textContent = 'Borrar pedidos de prueba';
        vaciar.classList.remove('per-boton--armado');
        delete vaciar.dataset.armado;
      }, 4000);
      return;
    }
    await P.vaciarDemo();
    vaciar.textContent = 'Borrar pedidos de prueba';
    vaciar.classList.remove('per-boton--armado');
    delete vaciar.dataset.armado;
  });

  window.AlpaqoriAcceso.entrar(() => P.suscribir(pintar));
})();
