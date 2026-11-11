# Bot de WhatsApp — Alpaqori (beta)

Bot de pedidos basado en el de Komakai. Usa **whatsapp-web.js** (no oficial): solo con el número de prueba
**+51 973 548 429**. La versión para el cliente debe pasar a la API oficial de WhatsApp (Meta).

## Requisitos
- Node.js 18 o superior (`node -v`)
- Un celular con WhatsApp Business (el de pruebas)

## 1. Probar sin WhatsApp
```
cd bot-whatsapp
npm install
npm run probar     (39 pruebas automáticas)
npm run simular    (conversación en la terminal)
```
En el simulador escribe `hola alpaqori`. Atajos: `/web` (pedido desde la carta), `/foto` (captura de Yape),
`/ubicacion`, `/audio` y los comandos del local (`#resumen`, `#pendientes`, `#ayuda`).

## 2. Conectar a WhatsApp
1. Revisa `config.js` (número del local, palabra de activación, Yape, delivery, horario).
2. `npm start`
3. En el celular de pruebas: WhatsApp > Dispositivos vinculados > Vincular un dispositivo > escanea el QR.
4. Espera **✅ Bot de Alpaqori listo** y escribe "hola alpaqori" desde otro celular.

En WhatsApp Business desactiva el mensaje de bienvenida y el de ausencia para que no se crucen con el bot.
La sesión queda en `.wwebjs_auth/`. Para desvincular, bórrala o cierra la sesión desde el celular.

## Qué sabe hacer
- **Menú principal:** 1 menú del día · 2 carta · 3 ver pedido · 4 confirmar · 5 horario y ubicación · 6 delivery ·
  7 hablar con una persona · 9 repetir el último pedido (clientes que vuelven).
- **Menú del día:** muestra entradas, segundos y postre, y deja elegir entrada + segundo. Mientras el precio no esté
  en `catalogo.json` (`menu_del_dia.precio_pen`), el pedido sale con "precio por confirmar".
- **Carta completa:** los 154 productos de `../catalogo.json` (precios de qcarta), por categoría.
  Respeta los días: el Shambar solo se vende los martes, la Chanfainita los jueves, etc.
- **Texto libre:** "ceviche", "2 lomo saltado", "chaufa" (ofrece los tres), "quiero un cuy" (pregunta el tamaño),
  "caldo de gallina", "una cerveza", errores como "sevice".
- **Cierre del pedido:** recojo o delivery (dirección o ubicación con el clip 📎), nombre, indicaciones, pago
  (Yape, Plin o efectivo con vuelto) y confirmación. Cada pedido lleva ticket **#ALP-001**.
- **Delivery:** suma S/ 8.00 referencial y avisa que el costo final depende de la zona.
- **Fuera de horario** (8:00–18:00, viernes y sábado hasta las 22:00): recibe el pedido y avisa que se prepara al abrir.
- **Pedidos de la carta web:** el mensaje "Hola Alpaqori, quiero hacer este pedido: ..." se cierra directo.
  El bot recalcula los precios con el catálogo: si alguien altera el texto, la comanda lo marca en **Revisar**.
- **Comanda para el local** con detalle de cocina, notas, vuelto y un enlace para avisar al cliente en 1 toque.

## Comandos del local
Se escriben en **"Mensaje a ti mismo"** del WhatsApp del bot:
- Responder a una comanda con `preparando`, `listo`, `en ruta` (solo delivery) o `entregado`:
  el bot actualiza la comanda y le avisa al cliente. Al final el cliente responde SI y queda como recibido.
- `#listo 12`, `#ruta 12`, `#entregado 12`: lo mismo con el número de ticket.
- `#pendientes`, `#resumen`, `#menu`, `#tiempo 40` / `#tiempo off`, `#ayuda`.
- `#fin 987654321` / `#pausa 987654321`: reactivar o pausar el bot con un cliente (opción 7 o asesor escribiendo).

## Archivos
- `logica.js`: conversación (no depende de WhatsApp)
- `index.js`: conexión con WhatsApp
- `memoria.js`: clientes, tickets, comandas y resumen (`datos.json`; bórralo para empezar de cero)
- `config.js`: números, horario, delivery, Yape
- `pruebas.js` y `simular.js`: pruebas sin WhatsApp

## Pendiente `[CONFIRMAR]`
Precio y horario del menú del día · número y titular de Yape/Plin · zonas y costo final de delivery ·
URL pública de la carta web (`URL_CARTA`).

## Si `npm start` falla con "reading 'Socket'" o "Execution context was destroyed"

La sesión vinculada se cerró. Con la versión actual de WhatsApp Web, la librería se cae antes de mostrar un QR nuevo.

1. Cierra cualquier otro bot que use el mismo celular (por ejemplo el de Borgorosso), porque no pueden estar prendidos a la vez.
2. Copia una sesión que funcione. Por ejemplo, la de Borgorosso, que está vinculada al celular de pruebas:
   - Renombra `.wwebjs_auth/session-alpaqori-bot` a `session-alpaqori-bot.viejo`.
   - Copia `C:\proyectos\borgorosso-bot\.wwebjs_auth\session-borgorosso-demo` como `.wwebjs_auth/session-alpaqori-bot`.
3. `npm start` de nuevo. Debe decir "autenticado" y luego "listo", sin pedir QR.

Alternativa sin WhatsApp Web: `npm run api` (API oficial de Meta, con ngrok y token vigente en `.env`).
