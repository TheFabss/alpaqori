/* ==========================================================
   Memoria del bot (se guarda en datos.json)
   - Clientes: nombre y último pedido, para saludarlos y repetir el pedido.
   - Correlativo de tickets (#ALP-001...).
   - Comandas y su estado.
   - Resumen del día para el comando #resumen.
   - Tiempo estimado que fija el local con #tiempo.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RUTA = process.env.ALPAQORI_DATOS || path.join(__dirname, 'datos.json');

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const resumenVacio = () => ({ dia: hoy(), pedidos: 0, ventas: 0, web: 0, delivery: 0, platos: {} });
const vacio = () => ({ correlativo: 0, tiempoMin: null, clientes: {}, comandas: {}, resumen: resumenVacio() });

function cargar() {
  try { return { ...vacio(), ...JSON.parse(fs.readFileSync(RUTA, 'utf8')) }; } catch (e) { return vacio(); }
}
let datos = cargar();

function guardar() {
  try { fs.writeFileSync(RUTA, JSON.stringify(datos, null, 2)); } catch (e) { console.error('   (no se pudo guardar datos.json)', e.message); }
}

function resumen() {
  if (datos.resumen.dia !== hoy()) datos.resumen = resumenVacio();
  return datos.resumen;
}

module.exports = {
  cliente: numero => (numero && datos.clientes[numero]) || null,

  guardarCliente(numero, info) {
    if (!numero) return;
    datos.clientes[numero] = { ...(datos.clientes[numero] || {}), ...info };
    guardar();
  },

  siguienteTicket() {
    datos.correlativo += 1;
    guardar();
    return `ALP-${String(datos.correlativo).padStart(3, '0')}`;
  },

  tiempo: () => datos.tiempoMin,
  fijarTiempo(minutos) { datos.tiempoMin = minutos; guardar(); },

  registrarPedido(pedido) {
    const r = resumen();
    r.pedidos += 1;
    r.ventas += pedido.subtotal;
    if (pedido.desdeWeb) r.web += 1;
    if (pedido.modalidad === 'delivery') r.delivery += 1;
    for (const i of pedido.items) r.platos[i.nombre] = (r.platos[i.nombre] || 0) + i.cantidad;
    guardar();
  },

  resumen,

  registrarComanda(ticket, info) {
    datos.comandas[ticket] = { ticket, ...info, estado: 'pendiente', creado: Date.now() };
    guardar();
  },

  guardarIdComanda(ticket, msgId) {
    if (datos.comandas[ticket]) { datos.comandas[ticket].msgId = msgId; guardar(); }
  },

  comanda: ticket => datos.comandas[ticket] || null,

  actualizarComanda(ticket, cambios) {
    if (!datos.comandas[ticket]) return null;
    Object.assign(datos.comandas[ticket], cambios);
    guardar();
    return datos.comandas[ticket];
  },

  // Comanda entregada que espera que el cliente confirme la recepción
  esperandoRecepcion(numero) {
    const desde = Date.now() - 24 * 3600000;
    return Object.values(datos.comandas)
      .filter(c => c.numero === numero && c.esperaRecepcion && c.creado > desde)
      .sort((a, b) => b.creado - a.creado)[0] || null;
  },

  // Comandas que aún no se entregan (últimas 24 horas), de la más antigua a la más nueva
  pendientes() {
    const desde = Date.now() - 24 * 3600000;
    const cerradas = ['entregado', 'recibido'];
    return Object.values(datos.comandas).filter(c => !cerradas.includes(c.estado) && c.creado > desde).sort((a, b) => a.creado - b.creado);
  },

  // Solo para pruebas
  _reiniciar() { datos = vacio(); guardar(); }
};
