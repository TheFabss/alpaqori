/* =========================================================
   ALPAQORI · nube.js
   Copia cada pedido que cierra el bot (delivery o recojo) a
   Supabase, para que aparezca en cocina.html y caja.html.

   Necesita en .env (nunca en el código):
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_SERVICE_KEY=<clave secreta: sb_secret_... o service_role>
   Sin esas variables no hace nada: el bot sigue funcionando
   igual (pruebas y simulador incluidos).
   ========================================================= */
const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_KEY || '';
const activo = Boolean(URL_BASE && CLAVE);

let avisado = false;

function cabeceras() {
  const h = { apikey: CLAVE, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  // Las claves nuevas (sb_secret_...) van solo en "apikey"; las antiguas (JWT) también en Authorization
  if (!CLAVE.startsWith('sb_')) h.Authorization = `Bearer ${CLAVE}`;
  return h;
}

const soles = (n) => `S/ ${Number(n).toFixed(2)}`;

/* Convierte el pedido del bot en una fila de la tabla "pedidos" de Supabase. */
function filaPedido(p) {
  const delivery = p.modalidad === 'delivery';
  const nombre = (p.nombre || 'Cliente').slice(0, 50);
  const notas = [
    `WhatsApp #${p.ticket}`,
    delivery && p.direccion ? `Dirección: ${p.direccion}` : '',
    p.pago ? `Pago: ${p.pago}${p.efectivo ? ` (paga con ${soles(p.efectivo)})` : ''}` : '',
    delivery && p.delivery ? `Delivery: ${soles(p.delivery)}` : '',
    p.indicaciones ? `Indicaciones: ${p.indicaciones}` : '',
    ...p.items.filter((i) => i.nota).map((i) => `${i.nombre}: ${i.nota}`),
    p.numero ? `Tel: +${p.numero}` : ''
  ].filter(Boolean).join(' · ');
  return {
    lugar: `${delivery ? 'Delivery' : 'Recojo'} · ${nombre}`,
    // "celular" es un origen que la tabla ya acepta sin cambios en Supabase.
    // Cocina reconoce el pedido de WhatsApp por el lugar ("Delivery · …" / "Recojo · …").
    origen: 'celular',
    cliente: nombre,
    items: p.items.map((i) => ({ nombre: i.nombre, variante: i.variante || '', precio: Number(i.precio) || 0, cantidad: i.cantidad })),
    notas: notas.slice(0, 600),
    total: Math.round(Number(p.total || 0) * 100) / 100
  };
}

/* Envía el pedido sin bloquear la conversación. Si falla, lo dice en consola y el bot sigue. */
function registrarPedido(pedido) {
  if (!activo) {
    if (!avisado) {
      avisado = true;
      console.log('ℹ️  Cocina web desactivada: falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
    }
    return Promise.resolve(false);
  }
  return fetch(`${URL_BASE}/rest/v1/pedidos`, { method: 'POST', headers: cabeceras(), body: JSON.stringify(filaPedido(pedido)) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      console.log(`🍳 Pedido #${pedido.ticket} enviado a la pantalla de cocina`);
      return true;
    })
    .catch((err) => {
      console.error(`⚠️ No se pudo enviar el pedido #${pedido.ticket} a cocina web: ${err.message}`);
      return false;
    });
}

module.exports = { registrarPedido, filaPedido, activo };
