/* Pruebas automáticas de la lógica del bot (sin WhatsApp):  npm run probar
   Usa una memoria aparte (datos-pruebas.json) que se borra al empezar. */
const fs = require('fs');
const path = require('path');
const RUTA = path.join(__dirname, 'datos-pruebas.json');
try { fs.unlinkSync(RUTA); } catch (e) { /* no existía */ }
process.env.ALPAQORI_DATOS = RUTA;

const { crearEstado, procesar, procesarAdmin, avisoLocal, leerPedidoWeb, buscar, aplicarEstado } = require('./logica');
const catalogo = require('../catalogo.json');

let fallas = 0, total = 0;
function prueba(nombre, condicion, detalle) {
  total++;
  if (condicion) console.log(`  ✓ ${nombre}`);
  else { fallas++; console.log(`  ✗ ${nombre}${detalle ? `\n      ${String(detalle).split('\n').join('\n      ')}` : ''}`); }
}
function conversar(estado, mensajes) {
  let ultimo;
  for (const m of mensajes) ultimo = procesar(estado, m);
  return ultimo;
}
const texto = r => r.respuestas.join('\n---\n');

console.log('\n1) Pedido completo por chat (delivery + efectivo)');
{
  const e = crearEstado('51911111111');
  let r = procesar(e, 'hola alpaqori');
  prueba('da la bienvenida y muestra el menú', /ALPAQORI/.test(texto(r)) && /Menú del día/.test(texto(r)));
  r = procesar(e, '2');
  prueba('muestra las categorías', /Nuestra carta/.test(texto(r)) && /Sopas/.test(texto(r)));
  const iSopas = texto(r).split('\n').find(l => /Sopas/.test(l)).match(/\*(\d+)\.\*/)[1];
  r = procesar(e, iSopas);
  prueba('lista las sopas con precio', /La Mama Patasca — S\/ 23\.00/.test(texto(r)), texto(r));
  r = procesar(e, '1');
  prueba('pregunta cuántos', /¿Cuántos\?/.test(texto(r)), texto(r));
  r = procesar(e, '2');
  prueba('agrega 2 Mama Patasca (S/ 46.00)', /2 x La Mama Patasca\* — S\/ 46\.00/.test(texto(r)), texto(r));
  r = conversar(e, ['4', '2']);
  prueba('pide la dirección para delivery', /dirección/.test(texto(r)), texto(r));
  r = conversar(e, ['Jr. Lima 456, Chosica', 'Fabián', 'no', '3']);
  prueba('pregunta con cuánto paga', /Con cuánto vas a pagar/.test(texto(r)), texto(r));
  r = procesar(e, '20');
  prueba('rechaza un monto menor al total', /no cubre el total/.test(texto(r)), texto(r));
  r = procesar(e, '100');
  prueba('muestra el resumen con delivery referencial', /Delivery \(referencial\): S\/ 8\.00/.test(texto(r)) && /Total: S\/ 54\.00/.test(texto(r)), texto(r));
  r = procesar(e, 'si');
  prueba('cierra el pedido con ticket ALP-001', r.pedido && r.pedido.ticket === 'ALP-001' && /#ALP-001/.test(texto(r)), texto(r));
  const aviso = avisoLocal(r.pedido, '51911111111');
  prueba('la comanda del local trae vuelto y dirección', /vuelto S\/ 46\.00/.test(aviso) && /Jr\. Lima 456/.test(aviso), aviso);
}

console.log('\n2) Texto libre');
{
  const e = crearEstado('51922222222');
  procesar(e, 'hola alpaqori');
  let r = procesar(e, '2 lomo saltado');
  prueba('"2 lomo saltado" agrega 2 directo', /2 x Lomo saltado\* — S\/ 64\.00/.test(texto(r)), texto(r));
  r = procesar(e, 'chaufa');
  prueba('"chaufa" ofrece los tres arroces chaufa', /Arroz chaufa amazónico/.test(texto(r)) && /Arroz chaufa de pollo/.test(texto(r)) && /Arroz chaufa de carne/.test(texto(r)), texto(r));
  r = procesar(e, '2');
  prueba('elegir de los resultados pide la cantidad', /¿Cuántos\?/.test(texto(r)), texto(r));
  r = procesar(e, '1');
  r = procesar(e, 'quiero un cuy');
  prueba('el cuy pide tamaño', /¿Qué tamaño\?/.test(texto(r)) && /Medio — S\/ 42\.00/.test(texto(r)), texto(r));
  r = conversar(e, ['3', '1']);
  prueba('agrega cuy entero a S/ 75.00', /Cuy frito \(entero\)\* — S\/ 75\.00/.test(texto(r)), texto(r));
  r = procesar(e, 'sevice');
  prueba('entiende errores de tipeo ("sevice" → ceviche)', /Ceviche/.test(texto(r)), texto(r));
  prueba('buscar("caldo de gallina") encuentra El Achorado', (buscar('caldo de gallina').productos || []).some(p => /Achorado/.test(p.nombre)));
  r = procesar(e, 'cuanto cuesta el pisco sour');
  prueba('pregunta de precio lleva al producto', /Pisco sour\* — S\/ 19\.00|Pisco sour — S\/ 19\.00/.test(texto(r)), texto(r));
}

console.log('\n3) Menú del día');
{
  const e = crearEstado('51933333333');
  let r = procesar(e, 'hola alpaqori, que hay de almuerzo?');
  prueba('"almuerzo" muestra el menú del día con su precio', /MENÚ DEL DÍA/.test(texto(r)) && /Sancochado/.test(texto(r)) && /S\/ 18\.00/.test(texto(r)), texto(r));
  r = conversar(e, ['1', '2', '3']);
  prueba('pide cuántos menús con entrada y segundo', /Llunca de gallina \+ Chuleta en salsa de champiñones/.test(texto(r)), texto(r));
  r = procesar(e, '2');
  prueba('dos menús suman S/ 36', /S\/ 36\.00/.test(texto(r)), texto(r));
  r = conversar(e, ['4', '1', 'Ana', 'no', '1']);
  prueba('el resumen muestra el total con el menú del día', /Subtotal: S\/ 36\.00|Total: S\/ 36\.00|\*Total: S\/ 36\.00\*/.test(texto(r)), texto(r));
  r = procesar(e, 'si');
  prueba('cierra el pedido y pide captura de Yape', r.pedido && /captura/.test(texto(r)), texto(r));
}

console.log('\n4) Pedido desde la carta web');
{
  const mensaje = [
    'Hola Alpaqori, quiero hacer este pedido:',
    '- 2 x Lomo saltado (S/ 64.00)',
    '   Nota: sin cebolla',
    '- 1 x Cuy frito (medio) (S/ 42.00)',
    '- 1 x Ceviche (S/ 10.00)',
    '',
    'Entrega: Recojo en local',
    'Nombre: Fabián',
    'Pago: Yape',
    'Indicaciones: cubiertos extra',
    'Subtotal: S/ 116.00',
    'Total: S/ 116.00'
  ].join('\n');
  const web = leerPedidoWeb(mensaje);
  prueba('lee los 3 platos', web && web.items.length === 3, JSON.stringify(web));
  prueba('lee la nota del plato', web.items[0].nota === 'sin cebolla');
  prueba('reconoce la variante del cuy', web.items[1].variante === 'medio' && web.items[1].precio === 42);
  prueba('corrige un precio alterado con el de la carta (ceviche S/ 29)', web.items[2].precio === 29 && web.avisos.some(a => /Ceviche/.test(a)), JSON.stringify(web.avisos));
  const e = crearEstado('51944444444');
  const r = procesar(e, mensaje);
  prueba('cierra el pedido directo (ya trae todos los datos)', r.pedido && /carta web/.test(texto(r)), texto(r));
  prueba('total recalculado: 64 + 42 + 29 = S/ 135.00', r.pedido && r.pedido.total === 135, r.pedido && r.pedido.total);
  const aviso = avisoLocal(r.pedido, '51944444444');
  prueba('la comanda marca el aviso de precio y la nota', /Revisar/.test(aviso) && /sin cebolla/.test(aviso) && /web/.test(aviso), aviso);

  const e2 = crearEstado('51955555555');
  const r2 = procesar(e2, 'Hola Alpaqori, quiero pedir el menú del día');
  prueba('el botón de la web "menú del día" abre el menú', /MENÚ DEL DÍA/.test(texto(r2)), texto(r2));
}

console.log('\n5) Disponibilidad por día');
{
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const hoy = new Intl.DateTimeFormat('es-PE', { weekday: 'long', timeZone: 'America/Lima' }).format(new Date()).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const noHoy = catalogo.productos.find(p => p.disponible_dias.length && !p.disponible_dias.includes(hoy));
  const e = crearEstado('51966666666');
  procesar(e, 'hola alpaqori');
  const r = procesar(e, noHoy.nombre);
  prueba(`"${noHoy.nombre}" (${noHoy.disponible_dias.join(', ')}) no se vende hoy (${hoy})`, /Hoy no está disponible/.test(texto(r)), texto(r));
  prueba('los días del catálogo son válidos', catalogo.productos.every(p => p.disponible_dias.every(d => dias.includes(d))));
}

console.log('\n7) Activación: cualquier mensaje invita; solo "si" abre el pedido');
{
  const { aceptaInvitacion } = require('./logica');
  prueba('"si" suelto abre el pedido', aceptaInvitacion('si') && aceptaInvitacion('Sí'));
  prueba('"si" dentro de una frase abre el pedido', aceptaInvitacion('sí, quiero pedir un ceviche'));
  prueba('"quiero pedir, si" abre el pedido', aceptaInvitacion('quiero pedir, si'));
  prueba('"hola" no abre el pedido', !aceptaInvitacion('hola'));
  prueba('"siempre" no cuenta como "si"', !aceptaInvitacion('siempre'));
  prueba('"quiero pedir" sin "si" no abre el pedido', !aceptaInvitacion('quiero pedir un caldo'));
}

console.log('\n6) Comandos del local');
{
  prueba('#resumen cuenta los pedidos de hoy', /Pedidos cerrados: \*3\*/.test(procesarAdmin('#resumen')), procesarAdmin('#resumen'));
  prueba('#pendientes lista las comandas', /ALP-001/.test(procesarAdmin('#pendientes')));
  prueba('#preparando 1 cambia el estado', /En preparación/.test(procesarAdmin('#preparando 1')));
  const r = aplicarEstado('ALP-003', 'ruta');
  prueba('"en ruta" no aplica a un recojo', /solo para delivery/.test(r.error || ''), JSON.stringify(r));
  prueba('#ayuda responde', /Comandos del local/.test(procesarAdmin('#ayuda')));
}

try { fs.unlinkSync(RUTA); } catch (e) { /* ya no existe */ }
console.log(`\n${total - fallas}/${total} pruebas correctas${fallas ? ` · ${fallas} fallaron` : ''}\n`);
process.exit(fallas ? 1 : 0);
