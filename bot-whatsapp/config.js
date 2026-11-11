/* ==========================================================
   Configuración del bot de WhatsApp — Alpaqori (beta)
   ========================================================== */
module.exports = {
  // Catálogo único (el mismo que usa la web). Sale de qcarta.
  RUTA_CATALOGO: '../catalogo.json',

  // Enlace público de la carta web. Vacío mientras la web no esté publicada.
  URL_CARTA: '',

  // SEGURIDAD: si pones números aquí, el bot SOLO responde a ellos.
  // Formato: código de país + número, sin "+" ni espacios. Ej: '51987654321'
  NUMEROS_PERMITIDOS: [
  ],

  // Si NUMEROS_PERMITIDOS está vacío, el bot solo se activa en un chat cuando el mensaje contiene
  // esta palabra (así no responde a todos tus contactos). Los mensajes de la web empiezan con
  // "Hola Alpaqori", así que también lo activan. Déjala vacía ('') para responder a cualquiera.
  // Déjala vacía: cualquier mensaje de un chat nuevo recibe la invitación ("Responde SI").
  // Los pedidos que llegan desde la web ("Hola Alpaqori, quiero hacer este pedido…") entran directo.
  PALABRA_ACTIVACION: '',

  // Un chat nuevo recibe la invitación una sola vez. Solo si responde "si" (en una frase o solo)
  // el bot arranca el menú; cualquier otro mensaje no recibe respuesta durante HORAS_INVITACION.
  INVITAR_SIN_PALABRA: true,
  HORAS_INVITACION: 12,

  // El bot NUNCA responde a estos números.
  NUMEROS_IGNORADOS: [
    '51983080553', // WhatsApp real de pedidos de Alpaqori (no tocar durante las pruebas)
  ],

  // Número que recibe las comandas y los avisos ("cliente pide una persona").
  // En pruebas es el mismo WhatsApp Business del bot: las comandas llegan a "Mensaje a ti mismo".
  NUMERO_LOCAL: '51973548429',

  // Datos de Yape / Plin que se muestran al confirmar. Vacíos = solo se pide la captura. [CONFIRMAR]
  YAPE_NUMERO: '',
  YAPE_TITULAR: '',

  // Delivery: tarifa referencial (la final depende de la zona). [CONFIRMAR] zonas
  DELIVERY_TARIFA: 8,

  // Horario de atención (hora de Lima)
  HORARIO: {
    apertura: 8,
    cierre: 18,
    cierreExtendido: 22,
    diasExtendidos: ['viernes', 'sabado']
  },
  DIRECCION: 'Jr. Trujillo Sur 674, a media cuadra del Parque Central de Chosica',
  MAPS: 'https://www.google.com/maps/search/?api=1&query=Alpaqori%20Jr.%20Trujillo%20Sur%20674%20Chosica',

  MINUTOS_SESION: 60,
  MINUTOS_PAUSA_HUMANO: 30,
  MAX_MENSAJES_30S: 20,
  DEMORA_MS: 900
};
