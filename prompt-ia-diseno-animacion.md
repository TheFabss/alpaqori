Eres un director creativo y desarrollador front-end senior, especialista en experiencias web animadas para marcas gastronómicas (estilo sitios premiados en Awwwards, pero que cargan rápido en un celular de gama media en Perú). Necesito ideas concretas, y código de ejemplo, para que la web de **Alpaqori** se sienta viva, reactiva y única. Trabaja en español.

## 1. Qué es Alpaqori

- Restaurante de comida criolla peruana en Chosica (Lima), Jr. Trujillo Sur 674, a media cuadra del Parque Central.
- **Identidad:**
  - Logo: una llama con sombrero dentro de un círculo, sobre paisaje andino.
  - Slogans: "Tierra de Oro", "Cada plato, una historia por contar", "Sabores que cuentan historias".
- **Colores:**
  - Coral #EE6C5E (principal).
  - Dorado #C9A45C.
  - Crema #FBF6EF.
  - Tinta cálida #2A211D.
- **Motivos visuales:** franjas textiles de rombos blanco y dorado (estilo andino) y ondas coral de la carta impresa.
- **El local real:** patio lleno de flores, banderines, farolillos, murales de colores y mosaicos.
- **Tipografías actuales:** Fredoka (títulos redondeados) y Montserrat (texto).
- **Fotografía:** platos criollos con luz cálida, ollas de barro, mantel de tela, flores.
- **Tono:** cálido, popular, orgulloso de lo peruano. Nada corporativo ni frío.

## 2. Qué existe hoy

Hay una versión estática funcionando: HTML, CSS y JavaScript sin frameworks.
- **`web/index.html`:** inicio con hero coral, menú del día, categorías con fotos, nosotros, galería, ubicación y pie.
- **`web/carta.html`:** carta interactiva con buscador, filtros por categoría y carrito. El pedido se envía por WhatsApp con un mensaje que lee un bot.
- **Datos:** 154 productos en `catalogo.json` (nombre, categoría, precio, días de disponibilidad, variantes). No hay descripciones ni fotos por plato todavía.
- **Imágenes:** por ahora son capturas recortadas; habrá fotos originales más adelante.

**El problema:** se ve correcta, pero es "una web más del montón". La carta parece una lista y no transmite la experiencia de Alpaqori.

## 3. Lo que quiero lograr

1. **Que la web destaque:** que alguien la abra y diga "esto es Alpaqori", no una plantilla.
2. **Reactividad:** la página debe responder a lo que hace la persona (scroll, toque, mouse, búsqueda, carrito), no solo mostrarse.
3. **La carta es la estrella.** Al hacer clic en "Carta" debe sentirse como entrar a otro mundo, más importante que el inicio. Por ejemplo:
   - una transición de "puerta" o "portal" hacia el patio florido;
   - un cambio de ambiente de color;
   - la sensación de abrir una carta artesanal.
4. **Animaciones con significado**, ligadas a la identidad:
   - el sombrero de la llama;
   - los rombos textiles que se tejen;
   - el vapor de una sopa;
   - las flores del patio;
   - los banderines que se mueven;
   - el "oro" de Tierra de Oro.
5. **Que el pedido sea divertido:** agregar un plato, cambiar cantidades y enviar por WhatsApp deben tener feedback visual memorable, sin volverse lentos.

## 4. Restricciones (obligatorias)

- **Celular primero:** la mayoría de clientes entra desde su celular, a veces con datos móviles. Las animaciones deben ir a 60 fps en un Android de gama media y no bloquear la carga.
- **Accesibilidad:** respetar `prefers-reduced-motion` con una versión sin movimiento. Contraste suficiente, navegación con teclado, textos legibles. Nada de animaciones que impidan leer el precio o pedir.
- **Rendimiento:**
  - Preferir CSS, la View Transitions API, Intersection Observer y Web Animations API.
  - Usar librerías solo si aportan mucho (GSAP + ScrollTrigger, Lenis, Lottie, Motion One).
  - Justificar el peso en KB de cada librería y cargarla desde CDN con versión fija.
- **Stack:** debe funcionar en la versión estática actual. Si recomiendas migrar (por ejemplo a Astro o Next.js), explica qué gana y qué cuesta, pero da primero la opción sin migración.
- **No romper el flujo de pedido:** el formato del mensaje de WhatsApp y `catalogo.json` no se tocan. Los precios y días de disponibilidad siempre deben verse claros.
- **No inventar datos de negocio:** historia, precios, platos o fotos que no existen. Donde falte algo, usa `[CONFIRMAR]`.
- **Sin recursos de stock genéricos.** Si propones ilustraciones (llama, flores, rombos, banderines), descríbelas para hacerlas en SVG propio, basadas en el logo y la decoración real.

## 5. Qué necesito que me entregues

1. **Tres conceptos creativos distintos** para toda la web, cada uno con:
   - nombre;
   - idea central en dos líneas;
   - cómo se ve el inicio;
   - cómo se ve la carta;
   - la transición entre ambos;
   - qué emoción busca.
   Ejemplos de dirección, no te limites a ellos:
   - "El patio de Tierra de Oro": la carta como recorrido por el patio florido.
   - "La carta tejida": telar andino, rombos que se arman.
   - "La olla de barro": vapor, calor y cocina criolla.
2. **Recomendación:** cuál de los tres elegirías para Alpaqori y por qué.
3. **Catálogo de animaciones e interacciones** del concepto elegido, en una tabla con:
   - dónde ocurre;
   - qué dispara la animación (carga, scroll, toque, hover, agregar al carrito, cambio de categoría);
   - qué se mueve y durante cuánto tiempo;
   - técnica (CSS, View Transitions, GSAP, etc.);
   - impacto en rendimiento (bajo, medio o alto);
   - versión con `prefers-reduced-motion`.
4. **Momentos clave detallados con código de ejemplo**, listo para integrar en HTML, CSS y JS sin frameworks:
   - la entrada a la carta (transición index → carta);
   - el hero del inicio;
   - el cambio de categoría en la carta;
   - el botón "Agregar" y el carrito;
   - el envío del pedido por WhatsApp (confirmación festiva);
   - el menú del día como "plato estrella del día".
5. **Sistema de movimiento:** curvas de easing con nombre propio (por ejemplo "ritmo andino"), duraciones estándar, cómo se escalonan los elementos y reglas para no exagerar.
6. **Ideas de reactividad útil**, no solo decorativa. Por ejemplo:
   - la carta resalta automáticamente las sopas del día según el día de la semana;
   - saludo distinto según la hora (desayuno, almuerzo, noche de viernes);
   - estado "abierto ahora / cerrado" en vivo;
   - sugerencias de bebida al agregar un plato.
   Indica cuáles usan datos que ya existen (`disponible_dias`, horario) y cuáles necesitarían datos nuevos.
7. **Plan por fases:**
   - fase 1: impacto alto, esfuerzo bajo;
   - fase 2;
   - fase 3.
   En cada fase, estima la complejidad y lista qué archivos se tocarían (`web/css/styles.css`, `web/js/carta.js`, etc.).
8. **Riesgos:** qué podría salir mal (rendimiento, mareo, distracción al pedir) y cómo evitarlo.

## 6. Formato de respuesta

- Empieza con los tres conceptos y tu recomendación, en un máximo de una página.
- Después, el detalle del concepto elegido con tablas y código.
- El código debe estar completo y comentado en español, en bloques separados por archivo.
- Antes de escribir código largo, confirma conmigo cuál concepto seguimos.
- Si necesitas ver la web actual, pídeme capturas de `index.html` y `carta.html` en celular y escritorio.
