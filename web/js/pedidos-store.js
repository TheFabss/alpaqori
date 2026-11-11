/* =========================================================
   ALPAQORI · pedidos-store.js
   Única capa que lee y escribe comandas. Sin Supabase usa
   localStorage (demostración en un solo navegador, varias
   pestañas sincronizadas al instante). pedidos-supabase.js
   la reemplaza con la misma API cuando supabase-config.js
   tiene url.
   ========================================================= */
(function () {
  'use strict';

  const CLAVE = 'alpaqori_comandas';
  const ESTADOS = ['por_confirmar', 'nuevo', 'preparando', 'listo', 'entregado'];
  const oyentes = new Set();
  const redondear = (n) => Math.round(Number(n) * 100) / 100;

  function leer() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE)) || [];
    } catch {
      return [];
    }
  }

  const avisar = () => {
    const lista = leer();
    oyentes.forEach((fn) => fn(lista));
  };

  function guardar(lista) {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    avisar();
  }

  /* Otras pestañas del mismo navegador (cocina, caja, cliente) reciben los cambios al instante. */
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE) avisar();
  });

  function modificar(ids, cambio) {
    guardar(leer().map((p) => (ids.includes(p.id) || ids.includes(p.token) ? cambio(p) : p)));
  }

  /* En producción el total se recalcula en el servidor con la tabla precios (ver supabase/). */
  async function crear({ lugar, origen, cliente = '', items, notas = '' }) {
    const lista = leer();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const pedido = {
      id,
      token: id,
      numero: lista.reduce((max, p) => Math.max(max, p.numero), 0) + 1,
      lugar,
      origen,
      cliente,
      items,
      notas,
      total: redondear(items.reduce((suma, i) => suma + i.precio * i.cantidad, 0)),
      estado: 'por_confirmar',
      pago: { estado: 'pendiente', metodo: '', solicitaCaja: false },
      creado: new Date().toISOString()
    };
    lista.push(pedido);
    guardar(lista);
    return pedido;
  }

  async function avanzar(id) {
    modificar([id], (p) => {
      const siguiente = ESTADOS[ESTADOS.indexOf(p.estado) + 1];
      return siguiente ? { ...p, estado: siguiente } : p;
    });
  }

  async function retroceder(id) {
    modificar([id], (p) => {
      const anterior = ESTADOS[ESTADOS.indexOf(p.estado) - 1];
      return anterior ? { ...p, estado: anterior } : p;
    });
  }

  async function rechazar(id) {
    modificar([id], (p) => ({ ...p, estado: 'rechazado' }));
  }

  async function pagar(ids, metodo) {
    modificar(ids, (p) => ({ ...p, pago: { estado: 'pagado', metodo, solicitaCaja: false } }));
  }

  async function solicitarCaja(ids) {
    modificar(ids, (p) => ({ ...p, pago: { ...p.pago, solicitaCaja: true } }));
  }

  function suscribir(fn) {
    oyentes.add(fn);
    fn(leer());
    return () => oyentes.delete(fn);
  }

  /* Solo para la demostración: borra las comandas guardadas en este navegador. */
  async function vaciarDemo() {
    guardar([]);
  }

  const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  /* Precios de Alpaqori con céntimos: S/ 18.00 */
  const soles = (n) => `S/ ${redondear(n).toFixed(2)}`;

  const pagarEnLinea = (ids) => pagar(ids, 'en_linea');

  window.AlpaqoriPedidos = {
    ESTADOS, crear, avanzar, retroceder, rechazar, pagar, pagarEnLinea, solicitarCaja, suscribir, esc, soles,
    vaciarDemo,
    remoto: false,
    suscribirCliente: suscribir,
    refrescar: async () => avisar()
  };
})();
