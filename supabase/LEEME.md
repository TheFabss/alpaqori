# Supabase de Alpaqori: cocina, caja y pedidos por QR

La web ya apunta al proyecto `aanmrjntefkdwnhplbbz` (ver `web/js/supabase-config.js`).
Falta crear las tablas. Una sola vez, en Supabase > **SQL Editor**, pega y ejecuta en este orden:

1. `01-esquema.sql`: tablas de precios, personal y pedidos, con sus reglas de seguridad.
2. `02-precios.sql`: los 157 precios de la carta. Vuelve a ejecutarlo cada vez que cambies precios
   (antes corre `node generar-catalogo.js` en `C:\proyectos\alpaqori`).
3. `03-pago-demo.sql`: el pago simulado del cliente (quitarlo antes de abrir al público).
4. `04-personal.sql`: primero crea la cuenta en Authentication > Users > Add user
   (marca *Auto Confirm User*), luego escribe ese correo en el archivo y ejecútalo.

## Cómo queda

- `carta.html?mesa=N`: el cliente pide desde su mesa; el pedido llega a cocina sin WhatsApp.
- `mesa.html?mesa=N&ver=pedido`: el cliente ve el avance y paga (o avisa que pagará en caja).
- `personal.html`, `cocina.html`, `caja.html`: piden correo y contraseña del personal.
- `mesas-qr.html`: genera e imprime los QR (necesita la dirección pública de la web).
- Delivery y recojo siguen por WhatsApp, con el mismo mensaje que lee el bot.

Seguridad: en la web solo va la clave *publishable*. La clave secreta (service_role) nunca se pega en ningún archivo.
Los precios se recalculan en el servidor con la tabla `precios`: el navegador no puede cambiarlos.
