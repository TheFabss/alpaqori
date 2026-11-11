/* ==========================================================
   La Carta Artesanal de Alpaqori (versión beta)
   - Filtros por sección con rombo animado
   - Buscador reactivo: sin tildes, resalta coincidencias, sugiere si no hay resultados
   - Inteligencia de días (disponible_dias): los especiales de hoy van primero con brillo dorado;
     los que no tocan hoy quedan al final, en reposo y sin poder pedirse
   - Revelado escalonado al hacer scroll (vida.js → ALPAQORI.observar)
   - Carrito y envío por WhatsApp con el formato que lee el bot
     (bot-whatsapp/logica.js → leerPedidoWeb). Si cambias el formato, cámbialo en los dos lados.
   Precios: catalogo.js (generado desde catalogo.json, que sale de qcarta).
   ========================================================== */
(function () {
  var CFG = window.ALPAQORI_CONFIG;
  var CATALOGO = window.ALPAQORI_CATALOGO;
  var PRODUCTOS = CATALOGO.productos;
  var A = window.ALPAQORI;

  // Pedido desde el QR de una mesa (carta.html?mesa=5): llega directo a cocina, sin WhatsApp.
  // Sin ?mesa la carta sigue igual: recojo o delivery por WhatsApp.
  var MESA = (function () {
    var m = (new URLSearchParams(location.search).get("mesa") || "").trim().match(/^(?:mesa\s*)?(\d{1,3})$/i);
    return m && Number(m[1]) > 0 ? String(Number(m[1])) : "";
  })();
  var PEDIDOS = window.AlpaqoriPedidos || null;
  var CLAVE_MIS_PEDIDOS = "alpaqori_mesa_pedidos";
  var gps = null;   // { url } cuando el cliente comparte su ubicación para el delivery

  var CATEGORIAS = [
    { id: "desayunos", nombre: "Desayunos", lema: "Para empezar con fuerza" },
    { id: "entradas", nombre: "Entradas", lema: "Para abrir el apetito" },
    { id: "sopas", nombre: "Sopas", lema: "Una para cada día de la semana" },
    { id: "platos-de-fondo", nombre: "Platos de fondo", lema: "Los clásicos criollos" },
    { id: "platos-fin-de-semana", nombre: "Fin de semana", lema: "Marinos, combinados y especiales" },
    { id: "promociones", nombre: "Promociones", lema: "Para compartir" },
    { id: "guarniciones", nombre: "Guarniciones", lema: "El acompañante perfecto" },
    { id: "jugos-bebidas-calientes", nombre: "Jugos y calientes", lema: "Café, infusiones y jugos naturales" },
    { id: "bebidas-naturales-frozen", nombre: "Bebidas y frozen", lema: "Chicha, maracuyá y limonada" },
    { id: "gaseosas-agua", nombre: "Gaseosas y agua", lema: "Bien heladitas" },
    { id: "cervezas", nombre: "Cervezas", lema: "Artesanales y clásicas" },
    { id: "vinos", nombre: "Vinos", lema: "Para brindar" },
    { id: "cocteles-drinks", nombre: "Cócteles", lema: "Piscos, chilcanos y más" }
  ].filter(function (c) { return PRODUCTOS.some(function (p) { return p.categoria === c.id; }); });
  var categoriaPorId = {};
  CATEGORIAS.forEach(function (c) { categoriaPorId[c.id] = c; });

  var SUGERENCIAS = ["ceviche", "caldo", "chaufa", "lomo saltado", "chicha", "pisco sour", "cuy"];
  var MAX_ESCALON = 8;   // a partir de la 9.ª tarjeta ya no se espera más (no hacer esperar al cliente)
  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Maridaje: si hay un plato de fondo y ninguna bebida, se sugieren estas jarras (productos reales de qcarta)
  var CATEGORIAS_BEBIDA = ["jugos-bebidas-calientes", "bebidas-naturales-frozen", "gaseosas-agua", "cervezas", "vinos", "cocteles-drinks"];
  var CATEGORIAS_FONDO = ["platos-de-fondo", "platos-fin-de-semana"];
  var BEBIDAS_SUGERIDAS = ["chicha-morada-litro", "limonada-frozen-litro"];
  var productoPorIdMapa = {};
  PRODUCTOS.forEach(function (p) { productoPorIdMapa[p.id] = p; });
  function productoPorId(id) { return productoPorIdMapa[id] || null; }

  var estado = {
    categoria: categoriaDesdeHash(),
    texto: "",
    carrito: cargarCarrito(),
    ultimoCambio: null,      // { clave, tipo: "nueva" | "cantidad" } para animar solo esa línea
    sinMaridaje: false       // el cliente cerró la sugerencia de bebida
  };

  var el = {
    buscador: document.getElementById("buscador"),
    limpiar: document.getElementById("limpiar"),
    chips: document.getElementById("chips"),
    conteo: document.getElementById("conteo"),
    lista: document.getElementById("lista"),
    hoyToca: document.getElementById("hoy-toca"),
    carrito: document.getElementById("carrito"),
    resumen: document.getElementById("resumen"),
    verPedido: document.getElementById("ver-pedido"),
    form: document.getElementById("form-pedido"),
    campoDireccion: document.getElementById("campo-direccion"),
    direccion: document.getElementById("direccion"),
    campoEfectivo: document.getElementById("campo-efectivo"),
    efectivo: document.getElementById("efectivo"),
    consentimiento: document.getElementById("consentimiento"),
    barra: document.getElementById("barra-carrito"),
    barraCuenta: document.getElementById("barra-cuenta"),
    barraTotal: document.getElementById("barra-total"),
    toast: document.getElementById("toast")
  };

  /* ---------- Utilidades ---------- */

  function soles(n) { return "S/ " + Number(n).toFixed(2); }

  function normalizar(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  var HOY = A.ahoraLima().dia;
  var NOMBRE_HOY = A.NOMBRES_DIA[HOY] || HOY;

  function disponibleHoy(p) { return !p.disponible_dias.length || p.disponible_dias.indexOf(HOY) !== -1; }
  function especialDeHoy(p) { return p.disponible_dias.length > 0 && p.disponible_dias.indexOf(HOY) !== -1; }

  // ["martes"] → "los martes"; ["jueves","domingo"] → "jueves y domingo"
  function textoDias(dias) {
    var n = dias.map(function (d) { return A.NOMBRES_DIA[d] || d; });
    if (n.length === 1) return "los " + n[0];
    return n.slice(0, -1).join(", ") + " y " + n[n.length - 1];
  }

  // 0 = especial de hoy, 1 = de siempre, 2 = no toca hoy. Orden estable dentro de cada grupo.
  function rango(p) { return especialDeHoy(p) ? 0 : (disponibleHoy(p) ? 1 : 2); }
  function priorizar(lista) {
    return lista.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return rango(a.p) - rango(b.p) || a.i - b.i; })
      .map(function (x) { return x.p; });
  }

  function categoriaDesdeHash() {
    var m = location.hash.match(/cat=([\w-]+)/);
    return m ? m[1] : "todas";
  }

  function cargarCarrito() {
    try {
      var guardado = JSON.parse(localStorage.getItem("alpaqori_carrito") || "[]");
      return Array.isArray(guardado) ? guardado : [];
    } catch (e) { return []; }
  }

  function guardarCarrito() {
    try { localStorage.setItem("alpaqori_carrito", JSON.stringify(estado.carrito)); } catch (e) { /* sin almacenamiento */ }
  }

  function guardarPedido(pedido) {
    try {
      var lista = JSON.parse(localStorage.getItem("alpaqori_pedidos") || "[]");
      lista.push(pedido);
      localStorage.setItem("alpaqori_pedidos", JSON.stringify(lista.slice(-20)));
    } catch (e) { /* el historial local es opcional */ }
  }

  function ultimoPedido() {
    try {
      var lista = JSON.parse(localStorage.getItem("alpaqori_pedidos") || "[]");
      return lista.length ? lista[lista.length - 1] : null;
    } catch (e) { return null; }
  }

  // "Lo de siempre": arma el carrito con el último pedido, con los precios de hoy y solo lo que hay hoy
  function itemsParaRepetir() {
    var ultimo = ultimoPedido();
    if (!ultimo || !Array.isArray(ultimo.items)) return [];
    return ultimo.items.map(function (i) {
      var p = productoPorId(i.id);
      if (!p || !disponibleHoy(p)) return null;
      var precio = i.variante && p.variantes ? p.variantes[i.variante] : p.precio_pen;
      if (typeof precio !== "number") return null;
      return { clave: i.clave, id: p.id, nombre: p.nombre, variante: i.variante || "", precio: precio, cantidad: i.cantidad, nota: i.nota || "" };
    }).filter(Boolean);
  }

  function mostrarToast(texto) {
    el.toast.textContent = texto;
    el.toast.classList.remove("visible");
    void el.toast.offsetWidth;   // reinicia la animación de entrada
    el.toast.classList.add("visible");
    clearTimeout(mostrarToast.t);
    mostrarToast.t = setTimeout(function () { el.toast.classList.remove("visible"); }, 2800);
  }

  function crear(etiqueta, clase, texto) {
    var nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  /* ---------- Búsqueda ---------- */

  // Coincide si todas las palabras buscadas están en el nombre o en el nombre de la sección
  function coincide(p, palabras) {
    var donde = normalizar(p.nombre + " " + (categoriaPorId[p.categoria] || {}).nombre);
    return palabras.every(function (w) { return donde.indexOf(w) !== -1; });
  }

  // Escribe "texto" en "nodo" resaltando con <mark> cada palabra buscada (sin importar tildes)
  function resaltar(nodo, texto, palabras) {
    if (!palabras.length) { nodo.textContent = texto; return; }
    var normal = "", mapa = [];
    for (var i = 0; i < texto.length; i++) {
      var n = texto[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (var k = 0; k < n.length; k++) { normal += n[k]; mapa.push(i); }
    }
    var marcas = new Array(texto.length).fill(false);
    palabras.forEach(function (w) {
      var desde = 0, pos;
      while (w && (pos = normal.indexOf(w, desde)) !== -1) {
        for (var j = pos; j < pos + w.length; j++) marcas[mapa[j]] = true;
        desde = pos + w.length;
      }
    });
    var actual = "", marcado = false;
    function volcar() {
      if (!actual) return;
      nodo.appendChild(marcado ? crear("mark", "", actual) : document.createTextNode(actual));
      actual = "";
    }
    for (var c = 0; c < texto.length; c++) {
      if (marcas[c] !== marcado) { volcar(); marcado = marcas[c]; }
      actual += texto[c];
    }
    volcar();
  }

  /* ---------- Portada: lo que toca hoy ---------- */

  function renderHoyToca() {
    var deHoy = PRODUCTOS.filter(especialDeHoy);
    if (!deHoy.length) return;
    var rotuloHoy = crear("span", "", "Hoy " + NOMBRE_HOY + " toca:");
    rotuloHoy.insertAdjacentHTML("afterbegin", window.ALPAQORI_ARTE.icono("sol"));
    el.hoyToca.appendChild(rotuloHoy);
    deHoy.forEach(function (p) {
      var b = crear("button", "", p.nombre);
      b.type = "button";
      b.addEventListener("click", function () { irAPlato(p); });
      el.hoyToca.appendChild(b);
    });
    el.hoyToca.hidden = false;
  }

  function irAPlato(p) {
    estado.texto = "";
    // El plato está en su sección (la vista Inicio ya no muestra toda la carta)
    if (estado.categoria !== p.categoria) cambiarCategoria(p.categoria, false);
    var tarjeta = document.getElementById("plato-" + p.id);
    if (!tarjeta) return;
    tarjeta.classList.add("visible");
    tarjeta.scrollIntoView({ behavior: menosMovimiento ? "auto" : "smooth", block: "center" });
    tarjeta.classList.remove("resaltado");
    setTimeout(function () { tarjeta.classList.add("resaltado"); }, 350);
  }

  /* ---------- Chips de secciones ---------- */

  /* ---------- Secciones: pestañas de texto con un subrayado que se desliza ---------- */
  var carril = document.getElementById("carril");
  var indicador = document.getElementById("chips-indicador");

  function moverIndicador(sinAnimar) {
    var activo = el.chips.querySelector('.chip[aria-pressed="true"]');
    if (!activo) { indicador.style.opacity = "0"; return; }
    indicador.classList.toggle("sin-animar", Boolean(sinAnimar));
    indicador.style.opacity = "1";
    // Indicador de 100px escalado: solo se anima transform (no width ni left)
    indicador.style.transform = "translateX(" + (activo.offsetLeft + 12) + "px) scaleX(" + ((activo.offsetWidth - 24) / 100).toFixed(3) + ")";
  }

  function bordesCarril() {
    var max = el.chips.scrollWidth - el.chips.clientWidth;
    carril.classList.toggle("hay-izq", el.chips.scrollLeft > 4);
    carril.classList.toggle("hay-der", el.chips.scrollLeft < max - 4);
  }

  function renderChips() {
    if (!el.chips.querySelector(".chip")) {
      [{ id: "todas", nombre: "Inicio" }].concat(CATEGORIAS).forEach(function (c) {
        var b = crear("button", "chip", c.nombre);
        b.type = "button";
        b.dataset.cat = c.id;
        b.addEventListener("click", function () { irASeccion(c.id); });
        el.chips.appendChild(b);
      });
      el.chips.appendChild(indicador);   // vive dentro del carril que se desplaza
      el.chips.addEventListener("scroll", bordesCarril, { passive: true });
      window.addEventListener("resize", function () { moverIndicador(true); bordesCarril(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moverIndicador(true); });
    }
    var primera = !renderChips.listo;
    renderChips.listo = true;
    el.chips.querySelectorAll(".chip").forEach(function (b) {
      var activo = b.dataset.cat === estado.categoria;
      b.setAttribute("aria-pressed", String(activo));
      if (activo) {
        var destino = b.offsetLeft - (el.chips.clientWidth - b.offsetWidth) / 2;
        el.chips.scrollTo({ left: Math.max(0, destino), behavior: primera || menosMovimiento ? "auto" : "smooth" });
      }
    });
    moverIndicador(primera);
    bordesCarril();
  }

  function cambiarCategoria(id, animar) {
    estado.categoria = categoriaPorId[id] ? id : "todas";
    history.replaceState(null, "", estado.categoria === "todas" ? location.pathname : "#cat=" + estado.categoria);
    renderChips();
    renderProductos(animar);
  }

  /* ---------- Lista de platos ---------- */

  function cabecera(titulo, icono, lema, cantidad, clase) {
    var c = crear("div", "cat-cabecera" + (clase ? " " + clase : ""));
    var izq = crear("div");
    var h2 = crear("h2");
    if (icono) h2.insertAdjacentHTML("beforeend", window.ALPAQORI_ARTE.icono(icono));
    h2.appendChild(document.createTextNode(titulo));
    izq.appendChild(h2);
    if (lema) izq.appendChild(crear("p", "", lema));
    c.appendChild(izq);
    if (cantidad) c.appendChild(crear("span", "cuenta", cantidad + (cantidad === 1 ? " plato" : " platos")));
    return c;
  }

  function grupo(titulo, icono, lema, tarjetas, clase) {
    var s = crear("section", "grupo-carta");
    s.appendChild(cabecera(titulo, icono, lema, tarjetas.length, clase));
    var g = crear("div", "grilla");
    tarjetas.forEach(function (t, i) {
      t.style.setProperty("--i", Math.min(i, MAX_ESCALON));
      g.appendChild(t);
    });
    s.appendChild(g);
    return s;
  }

  function irASeccion(id) {
    estado.texto = "";
    el.buscador.value = "";
    el.limpiar.hidden = true;
    cambiarCategoria(id, true);
    var y = el.lista.getBoundingClientRect().top + window.scrollY - 190;
    window.scrollTo({ top: Math.max(0, y), behavior: menosMovimiento ? "auto" : "smooth" });
  }

  /* ---------- Los más pedidos (fotos referenciales del restaurante) ----------
     Para cambiar la lista: id del plato en catalogo.json, foto en images/ y la zona de la foto
     (recorte = x, y, ancho, alto en fracciones de la imagen, como data-recorte en index.html). */
  var MAS_PEDIDOS = [
    { id: "lomo-saltado", foto: "images/16.webp", recorte: [0.59, 0.09, 0.345, 0.146] },
    { id: "pollo-a-la-plancha", foto: "images/11.webp", recorte: [0.458, 0.145, 0.23, 0.64] },
    { id: "ceviche", foto: "images/20.webp", recorte: [0.52, 0.08, 0.39, 0.124] },
    { id: "el-achorado-caldo-de-gallina", foto: "images/17.webp", recorte: [0.13, 0.47, 0.74, 0.415] },
    { id: "chicha-morada-litro", foto: "images/20.webp", recorte: [0.1, 0.08, 0.38, 0.12] }
  ];

  // Muestra solo la zona "recorte" de la foto, cubriendo la caja sin deformarla
  function encuadrar(caja, img, r) {
    function ajustar() {
      var cw = caja.clientWidth, ch = caja.clientHeight;
      if (!cw || !img.naturalWidth) return;
      var zw = r[2] * img.naturalWidth, zh = r[3] * img.naturalHeight;
      var escala = Math.max(cw / zw, ch / zh);
      var ancho = img.naturalWidth * escala, alto = img.naturalHeight * escala;
      var cx = (r[0] + r[2] / 2) * ancho, cy = (r[1] + r[3] / 2) * alto;
      img.style.width = ancho + "px";
      img.style.height = alto + "px";
      img.style.transform = "translate(" + (cw / 2 - cx).toFixed(1) + "px," + (ch / 2 - cy).toFixed(1) + "px)";
      caja.classList.add("lista");
    }
    if (img.complete && img.naturalWidth) ajustar();
    else img.addEventListener("load", ajustar);
    if (window.ResizeObserver) new ResizeObserver(ajustar).observe(caja);
  }

  function masPedidos() {
    var s = crear("section", "grupo-carta mas-pedidos");
    s.appendChild(cabecera("Los más pedidos", "", "Los favoritos del patio, a un toque", 0));
    var carrusel = crear("div", "carrusel");
    carrusel.setAttribute("role", "list");
    MAS_PEDIDOS.forEach(function (m, i) {
      var p = productoPorId(m.id);
      if (!p) return;
      var hoy = disponibleHoy(p);
      var item = crear("article", "favorito" + (hoy ? "" : " no-hoy"));
      item.setAttribute("role", "listitem");
      item.style.setProperty("--i", i);
      var foto = crear("div", "favorito__foto");
      var img = document.createElement("img");
      img.src = m.foto;
      img.alt = p.nombre + " (foto referencial)";
      img.loading = i < 2 ? "eager" : "lazy";
      img.decoding = "async";
      foto.appendChild(img);
      foto.appendChild(crear("span", "favorito__ref", "Foto referencial"));
      encuadrar(foto, img, m.recorte);
      item.appendChild(foto);
      var cuerpo = crear("div", "favorito__cuerpo");
      var nombre = crear("button", "favorito__nombre", p.nombre);
      nombre.type = "button";
      nombre.addEventListener("click", function () { irAPlato(p); });
      cuerpo.appendChild(nombre);
      var precio = p.variantes ? p.variantes[Object.keys(p.variantes)[0]] : p.precio_pen;
      var fila = crear("div", "favorito__fila");
      fila.appendChild(crear("span", "favorito__precio", (p.variantes ? "desde " : "") + soles(precio)));
      var mas = crear("button", "favorito__agregar");
      mas.type = "button";
      mas.disabled = !hoy;
      mas.setAttribute("aria-label", hoy ? "Agregar " + p.nombre : p.nombre + ": disponible " + textoDias(p.disponible_dias));
      mas.innerHTML = hoy
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
        : '<span>Hoy no</span>';
      mas.addEventListener("click", function (e) {
        if (p.variantes) { irAPlato(p); return; }   // con tamaños: se elige en su tarjeta
        agregar(p, "", p.precio_pen, { boton: mas, x: e.clientX, y: e.clientY });
      });
      fila.appendChild(mas);
      cuerpo.appendChild(fila);
      item.appendChild(cuerpo);
      carrusel.appendChild(item);
    });
    s.appendChild(carrusel);
    return s;
  }

  // Al final de cada sección: anterior, todas y siguiente (sin volver a subir)
  function navegacionSecciones(id) {
    var i = CATEGORIAS.findIndex(function (c) { return c.id === id; });
    var nav = crear("nav", "nav-secciones");
    nav.setAttribute("aria-label", "Otras secciones");
    function boton(c, clase, texto) {
      var b = crear("button", "nav-secciones__boton " + clase);
      b.type = "button";
      b.appendChild(crear("small", "", texto));
      b.appendChild(crear("strong", "", c.nombre));
      b.addEventListener("click", function () { irASeccion(c.id); });
      return b;
    }
    if (i > 0) nav.appendChild(boton(CATEGORIAS[i - 1], "anterior", "← Anterior"));
    var todas = crear("button", "nav-secciones__boton todas", "Todas las secciones");
    todas.type = "button";
    todas.addEventListener("click", function () { irASeccion("todas"); });
    nav.appendChild(todas);
    if (i < CATEGORIAS.length - 1) nav.appendChild(boton(CATEGORIAS[i + 1], "siguiente", "Siguiente →"));
    return nav;
  }

  function separador() {
    var t = crear("div", "telar claro");
    t.setAttribute("data-telar", "");
    t.setAttribute("aria-hidden", "true");
    return t;
  }

  // Envuelve el SVG de la ilustración y prepara sus trazos para dibujarse (pathLength = 1)
  function ilustracion(svg) {
    var caja = crear("div", "ilus");
    caja.setAttribute("aria-hidden", "true");
    caja.innerHTML = svg;
    caja.querySelectorAll(".tr").forEach(function (n) { n.setAttribute("pathLength", "1"); });
    return caja;
  }

  function renderProductos(animar) {
    el.lista.textContent = "";
    var palabras = normalizar(estado.texto).split(/\s+/).filter(function (w) { return w.length > 0; });
    var bloques = [];

    if (palabras.length) {
      // Búsqueda: todos los resultados, agrupados por sección y priorizados por día
      var encontrados = PRODUCTOS.filter(function (p) { return coincide(p, palabras); });
      el.conteo.textContent = "";
      el.conteo.appendChild(crear("strong", "", String(encontrados.length)));
      el.conteo.appendChild(document.createTextNode((encontrados.length === 1 ? " plato" : " platos") + " para «" + estado.texto.trim() + "»"));
      if (!encontrados.length) { el.lista.appendChild(sinResultados()); return; }
      CATEGORIAS.forEach(function (c) {
        var deEsta = priorizar(encontrados.filter(function (p) { return p.categoria === c.id; }));
        if (deEsta.length) bloques.push(grupo(c.nombre, c.id, "", deEsta.map(function (p) { return tarjetaProducto(p, palabras); })));
      });
    } else if (estado.categoria === "todas") {
      var especiales = PRODUCTOS.filter(especialDeHoy);
      el.conteo.textContent = "";
      bloques.push(masPedidos());
      var estrella = grupo("Plato estrella del día", "estrella", "Entrada, segundo y postre, como en casa", [tarjetaMenuDelDia()], "hoy");
      estrella.querySelector(".cuenta").remove();   // un solo plato: el contador sobra
      bloques.push(estrella);
      if (especiales.length) {
        bloques.push(grupo("Hoy en el patio", "sol", "Lo que solo preparamos los " + NOMBRE_HOY + (/s$/.test(NOMBRE_HOY) ? "" : "s") + "… y hoy es su día", especiales.map(function (p) { return tarjetaProducto(p, []); }), "hoy"));
      }
    } else {
      var cat = categoriaPorId[estado.categoria];
      var items = priorizar(PRODUCTOS.filter(function (p) { return p.categoria === cat.id; }));
      el.conteo.textContent = "";
      var bloqueCat = grupo(cat.nombre, cat.id, cat.lema, items.map(function (p) { return tarjetaProducto(p, []); }));
      bloqueCat.appendChild(navegacionSecciones(cat.id));
      bloques.push(bloqueCat);
    }

    bloques.forEach(function (b, i) {
      if (i > 0) el.lista.appendChild(separador());
      el.lista.appendChild(b);
    });

    // Al escribir no se anima (sería ruido); al cambiar de sección, las tarjetas suben escalonadas
    if (!animar) {
      el.lista.querySelectorAll("[data-revelar]").forEach(function (n) { n.classList.add("visible"); });
      el.lista.querySelectorAll("[data-telar]").forEach(function (n) { n.classList.add("tejido"); });
    }
    A.observar(el.lista);
  }

  function sinResultados() {
    var caja = crear("div", "sin-resultados");
    var llama = crear("div", "recorte llama");
    llama.setAttribute("data-recorte", "0.375,0.163,0.25,0.245");
    llama.setAttribute("data-fijo", "");
    var img = document.createElement("img");
    img.src = "images/1.png";
    img.alt = "";
    img.style.width = "400%"; img.style.left = "-150%"; img.style.top = "-66.5%";
    llama.appendChild(img);
    caja.appendChild(llama);
    caja.appendChild(crear("h3", "", "No encontramos «" + estado.texto.trim() + "»"));
    caja.appendChild(crear("p", "", "Prueba con otra palabra o elige una de estas:"));
    var sug = crear("div", "sugerencias");
    SUGERENCIAS.forEach(function (s) {
      var b = crear("button", "", s);
      b.type = "button";
      b.addEventListener("click", function () { el.buscador.value = s; buscar(); });
      sug.appendChild(b);
    });
    caja.appendChild(sug);
    return caja;
  }

  function tarjetaMenuDelDia() {
    var menu = CATALOGO.menu_del_dia;
    var card = crear("article", "plato destacado");
    card.setAttribute("data-revelar", "");
    card.appendChild(ilustracion(window.ALPAQORI_ARTE.ilustracionPorClave("olla")));
    card.appendChild(crear("span", "badge-hoy", "Todos los días"));
    card.appendChild(crear("h3", "", "Menú del día"));
    card.appendChild(crear("p", "desc",
      "Entrada: " + menu.entradas.join(", ") + ". Segundo: " + menu.segundos.join(", ") + ". Postre: " + menu.postre.join(", ") + "."));
    var fila = crear("div", "fila");
    var precio = crear("span", "precio-item", typeof menu.precio_pen === "number" ? soles(menu.precio_pen) : "Precio por confirmar");
    if (typeof menu.precio_pen !== "number") precio.style.fontSize = "16px";
    fila.appendChild(precio);
    if (MESA && typeof menu.precio_pen === "number") {
      // En la mesa el menú se suma al pedido: el cliente elige entrada y segundo
      var eleccion = crear("div", "eleccion-menu");
      function selector(etiqueta, opciones) {
        var s = document.createElement("select");
        s.setAttribute("aria-label", etiqueta);
        opciones.forEach(function (o) { var op = crear("option", "", o); op.value = o; s.appendChild(op); });
        return s;
      }
      var selEntrada = selector("Entrada del menú", menu.entradas);
      var selSegundo = selector("Segundo del menú", menu.segundos);
      eleccion.appendChild(selEntrada);
      eleccion.appendChild(selSegundo);
      card.appendChild(eleccion);
      var sumar = crear("button", "btn-agregar", "+ Agregar");
      sumar.type = "button";
      sumar.setAttribute("aria-label", "Agregar menú del día");
      sumar.addEventListener("click", function (e) {
        agregar({ id: "menu-del-dia", nombre: "Menú del día" }, "", menu.precio_pen, { boton: sumar, x: e.clientX, y: e.clientY });
        var item = estado.carrito.find(function (i) { return i.clave === "menu-del-dia"; });
        var texto = selEntrada.value + " + " + selSegundo.value;
        if (item) { item.nota = item.nota ? item.nota + "; " + texto : texto; guardarCarrito(); renderCarrito(); }
      });
      fila.appendChild(sumar);
      card.appendChild(fila);
      return card;
    }
    var enlace = crear("a", "btn-agregar", "Pedir por WhatsApp");
    enlace.href = A.enlaceWhatsApp("Hola Alpaqori, quiero pedir el menú del día");
    enlace.target = "_blank";
    enlace.rel = "noopener";
    fila.appendChild(enlace);
    card.appendChild(fila);
    return card;
  }

  function tarjetaProducto(p, palabras) {
    var hoy = disponibleHoy(p);
    var especial = especialDeHoy(p);
    var card = crear("article", "plato" + (especial ? " especial-hoy" : "") + (hoy ? "" : " no-hoy"));
    card.id = "plato-" + p.id;
    card.setAttribute("data-revelar", "");
    card.appendChild(ilustracion(window.ALPAQORI_ARTE.ilustracion(p)));

    if (especial) card.appendChild(crear("span", "badge-hoy", "¡Especial de hoy " + NOMBRE_HOY + "!"));
    else if (!hoy) card.appendChild(crear("span", "etiqueta-dias", "Disponible " + textoDias(p.disponible_dias)));

    var h3 = crear("h3");
    resaltar(h3, p.nombre, palabras);
    card.appendChild(h3);
    if (p.descripcion) card.appendChild(crear("p", "desc", p.descripcion));

    var fila = crear("div", "fila");
    var grupoPrecio = crear("div", "grupo-precio");
    var precio = crear("span", "precio-item");
    var select = null;
    if (p.variantes) {
      var claves = Object.keys(p.variantes);
      select = document.createElement("select");
      select.setAttribute("aria-label", "Tamaño de " + p.nombre);
      claves.forEach(function (k) {
        var op = crear("option", "", k.charAt(0).toUpperCase() + k.slice(1));
        op.value = k;
        select.appendChild(op);
      });
      select.addEventListener("change", function () { precio.textContent = soles(p.variantes[select.value]); });
      precio.textContent = soles(p.variantes[claves[0]]);
      grupoPrecio.appendChild(precio);
      grupoPrecio.appendChild(select);
    } else {
      precio.textContent = soles(p.precio_pen);
      grupoPrecio.appendChild(precio);
    }
    fila.appendChild(grupoPrecio);

    var boton = crear("button", "btn-agregar", hoy ? "+ Agregar" : "Hoy no");
    boton.type = "button";
    boton.disabled = !hoy;
    boton.setAttribute("aria-label", hoy ? "Agregar " + p.nombre : p.nombre + ": disponible " + textoDias(p.disponible_dias));
    boton.addEventListener("click", function (e) {
      var variante = select ? select.value : "";
      agregar(p, variante, select ? p.variantes[variante] : p.precio_pen, { boton: boton, x: e.clientX, y: e.clientY });
    });
    fila.appendChild(boton);
    card.appendChild(fila);
    return card;
  }

  /* ---------- Buscador reactivo ---------- */

  /* ---------- Buscador a pantalla completa ----------
     Se abre con la lupa. Resultados al instante mientras escribes, agregar sin salir,
     búsquedas recientes y populares. Esc o "Cerrar" lo cierran. */
  var capa = document.getElementById("buscador-capa");
  var resultados = document.getElementById("buscador-resultados");
  var botonLupa = document.getElementById("abrir-buscador");
  var CLAVE_RECIENTES = "alpaqori_busquedas";
  var POPULARES = ["Ceviche", "Lomo saltado", "Caldo de gallina", "Chaufa", "Chicha morada", "Pisco sour", "Desayuno"];
  var ICONO_RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/></svg>';
  var ICONO_MAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var ICONO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var temporizadorCierre;

  function leerRecientes() {
    try {
      var r = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || "[]");
      return Array.isArray(r) ? r.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) { return []; }
  }
  function guardarReciente(texto) {
    texto = texto.trim();
    if (texto.length < 2) return;
    var lista = leerRecientes().filter(function (x) { return normalizar(x) !== normalizar(texto); });
    lista.unshift(texto);
    try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista.slice(0, 6))); } catch (e) { /* opcional */ }
  }

  function abrirBuscador() {
    clearTimeout(temporizadorCierre);
    capa.hidden = false;
    document.body.classList.add("buscando");
    void capa.offsetWidth;   // fija el estado inicial antes de animar
    capa.classList.add("abierta");
    el.buscador.value = "";
    el.limpiar.hidden = true;
    pintarBusqueda();
    el.buscador.focus({ preventScroll: true });   // dentro del toque: así iPhone abre el teclado
  }

  function cerrarBuscador(despues) {
    if (capa.hidden) return;
    capa.classList.remove("abierta");
    document.body.classList.remove("buscando");
    el.buscador.blur();
    temporizadorCierre = setTimeout(function () {
      capa.hidden = true;
      if (typeof despues === "function") despues();
      else botonLupa.focus({ preventScroll: true });
    }, menosMovimiento ? 0 : 160);
  }

  function seccionBusqueda(titulo, accion) {
    var s = crear("section", "busqueda-bloque");
    var cab = crear("div", "busqueda-bloque__cabeza");
    cab.appendChild(crear("h2", "", titulo));
    if (accion) cab.appendChild(accion);
    s.appendChild(cab);
    return s;
  }

  function sugerencias(lista) {
    var g = crear("div", "busqueda-sugerencias");
    lista.forEach(function (t) {
      var b = crear("button", "busqueda-sugerencia", t);
      b.type = "button";
      b.addEventListener("click", function () { el.buscador.value = t; pintarBusqueda(); el.buscador.focus({ preventScroll: true }); });
      g.appendChild(b);
    });
    return g;
  }

  function filaResultado(p, palabras) {
    var hoy = disponibleHoy(p);
    var cat = categoriaPorId[p.categoria];
    var fila = crear("div", "resultado" + (hoy ? "" : " no-hoy"));
    fila.setAttribute("role", "listitem");
    var ir = crear("button", "resultado__ir");
    ir.type = "button";
    var icono = crear("span", "resultado__icono");
    icono.innerHTML = window.ALPAQORI_ARTE.icono(p.categoria);
    ir.appendChild(icono);
    var texto = crear("span", "resultado__texto");
    var nombre = crear("strong");
    resaltar(nombre, p.nombre, palabras);
    texto.appendChild(nombre);
    texto.appendChild(crear("small", "", (cat ? cat.nombre : "") + (hoy ? "" : " · Solo " + textoDias(p.disponible_dias).replace(/^los /, ""))));
    ir.appendChild(texto);
    var precio = p.variantes ? p.variantes[Object.keys(p.variantes)[0]] : p.precio_pen;
    ir.appendChild(crear("span", "resultado__precio", (p.variantes ? "desde " : "") + soles(precio)));
    ir.addEventListener("click", function () {
      guardarReciente(el.buscador.value);
      cerrarBuscador(function () { irAPlato(p); });
    });
    fila.appendChild(ir);
    var mas = crear("button", "resultado__agregar");
    mas.type = "button";
    mas.disabled = !hoy;
    mas.innerHTML = ICONO_MAS;
    mas.setAttribute("aria-label", hoy ? (p.variantes ? "Elegir tamaño de " : "Agregar ") + p.nombre : p.nombre + ": hoy no está disponible");
    mas.addEventListener("click", function (e) {
      guardarReciente(el.buscador.value);
      if (p.variantes) { cerrarBuscador(function () { irAPlato(p); }); return; }
      agregar(p, "", p.precio_pen, { boton: mas, x: e.clientX, y: e.clientY });
      mas.innerHTML = ICONO_OK;
      mas.classList.add("hecho");
      setTimeout(function () { mas.innerHTML = ICONO_MAS; mas.classList.remove("hecho"); }, 1200);
    });
    fila.appendChild(mas);
    return fila;
  }

  function pintarBusqueda() {
    var texto = el.buscador.value.trim();
    el.limpiar.hidden = !el.buscador.value;
    resultados.textContent = "";
    var palabras = normalizar(texto).split(/\s+/).filter(function (w) { return w.length > 0; });

    if (!palabras.length) {
      var recientes = leerRecientes();
      if (recientes.length) {
        var borrar = crear("button", "busqueda-accion", "Borrar");
        borrar.type = "button";
        borrar.addEventListener("click", function () {
          try { localStorage.removeItem(CLAVE_RECIENTES); } catch (e) { /* opcional */ }
          pintarBusqueda();
        });
        var bloqueR = seccionBusqueda("Recientes", borrar);
        var listaR = crear("div", "busqueda-recientes");
        recientes.forEach(function (t) {
          var b = crear("button", "busqueda-reciente");
          b.type = "button";
          b.innerHTML = ICONO_RELOJ;
          b.appendChild(document.createTextNode(t));
          b.addEventListener("click", function () { el.buscador.value = t; pintarBusqueda(); });
          listaR.appendChild(b);
        });
        bloqueR.appendChild(listaR);
        resultados.appendChild(bloqueR);
      }
      var bloqueP = seccionBusqueda("Lo más buscado");
      bloqueP.appendChild(sugerencias(POPULARES));
      resultados.appendChild(bloqueP);
      return;
    }

    var encontrados = priorizar(PRODUCTOS.filter(function (p) { return coincide(p, palabras); }));
    if (!encontrados.length) {
      var vacio = crear("div", "busqueda-vacia");
      vacio.appendChild(crear("p", "busqueda-vacia__titulo", "No encontramos «" + texto + "»"));
      vacio.appendChild(crear("p", "", "Revisa cómo se escribe o prueba con algo parecido:"));
      resultados.appendChild(vacio);
      resultados.appendChild(sugerencias(POPULARES.slice(0, 5)));
      return;
    }
    resultados.appendChild(crear("p", "busqueda-conteo", encontrados.length + (encontrados.length === 1 ? " resultado" : " resultados")));
    var lista = crear("div", "busqueda-lista");
    lista.setAttribute("role", "list");
    encontrados.slice(0, 40).forEach(function (p) { lista.appendChild(filaResultado(p, palabras)); });
    resultados.appendChild(lista);
  }

  // Compatibilidad: sinResultados() llama a buscar()
  function buscar() { pintarBusqueda(); }

  var espera;
  botonLupa.addEventListener("click", abrirBuscador);
  document.getElementById("cerrar-buscador").addEventListener("click", function () { cerrarBuscador(); });
  el.buscador.addEventListener("input", function () {
    clearTimeout(espera);
    espera = setTimeout(pintarBusqueda, 90);
  });
  el.buscador.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (el.buscador.value) { el.buscador.value = ""; pintarBusqueda(); }
      else cerrarBuscador();
    }
    if (e.key === "Enter") {
      var primero = resultados.querySelector(".resultado__ir");
      if (primero) primero.click();
    }
  });
  el.limpiar.addEventListener("click", function () {
    el.buscador.value = "";
    pintarBusqueda();
    el.buscador.focus({ preventScroll: true });
  });
  capa.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && e.target !== el.buscador) cerrarBuscador();
  });
  // "/" abre el buscador en computadora
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && capa.hidden && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); abrirBuscador(); }
  });

  /* ---------- Totales ---------- */

  function subtotal() {
    return estado.carrito.reduce(function (s, i) { return s + i.precio * i.cantidad; }, 0);
  }

  function unidades() {
    return estado.carrito.reduce(function (n, i) { return n + i.cantidad; }, 0);
  }

  function valorRadio(nombre) {
    return document.querySelector("input[name='" + nombre + "']:checked").value;
  }

  function esDelivery() { return valorRadio("entrega") === "delivery"; }

  function total() { return subtotal() + (esDelivery() ? CFG.deliveryTarifa : 0); }

  /* ---------- Carrito ---------- */

  // origen (opcional): { boton, x, y } del toque, para la animación hacia el carrito
  function agregar(p, variante, precioUnitario, origen) {
    var clave = p.id + (variante ? ":" + variante : "");
    var item = estado.carrito.find(function (i) { return i.clave === clave; });
    if (item) {
      item.cantidad += 1;
      estado.ultimoCambio = { clave: clave, tipo: "cantidad" };
    } else {
      estado.carrito.push({ clave: clave, id: p.id, nombre: p.nombre, variante: variante, precio: precioUnitario, cantidad: 1, nota: "" });
      estado.ultimoCambio = { clave: clave, tipo: "nueva" };
    }
    // La chispa sale antes de redibujar el carrito (el botón de origen puede desaparecer al redibujar)
    if (origen && origen.boton) celebrarBoton(origen.boton);
    volarAlCarrito(origen, impactoCarrito);
    cambio();
    mostrarToast("✓ " + p.nombre + (variante ? " (" + variante + ")" : "") + " agregado");
  }

  function cambiarCantidad(clave, delta) {
    var item = estado.carrito.find(function (i) { return i.clave === clave; });
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito = estado.carrito.filter(function (i) { return i.clave !== clave; });
    else estado.ultimoCambio = { clave: clave, tipo: "cantidad" };
    cambio();
  }

  /* ---------- La olla: "¡A la mesa!", vuelo parabólico e impacto ---------- */

  function celebrarBoton(boton) {
    if (boton.getAttribute("data-festejando")) return;
    var texto = boton.textContent;
    boton.setAttribute("data-festejando", "1");
    boton.textContent = "¡A la mesa!";
    boton.classList.add("a-la-mesa");
    setTimeout(function () {
      boton.textContent = texto;
      boton.classList.remove("a-la-mesa");
      boton.removeAttribute("data-festejando");
    }, 900);
  }

  // En celular, si la barra inferior está a la vista, la chispa va hacia ella; si no, al botón "Mi pedido"
  function destinoCarrito() {
    var barraVisible = el.barra.classList.contains("visible") && getComputedStyle(el.barra).display !== "none";
    return barraVisible ? el.barra : el.verPedido;
  }

  // Una chispa dorada en forma de rombo recorre una curva cuadrática desde el toque hasta el carrito
  function volarAlCarrito(origen, alLlegar) {
    if (menosMovimiento || !origen || !origen.boton || !Element.prototype.animate) { alLlegar(); return; }
    var caja = origen.boton.getBoundingClientRect();
    var x0 = origen.x || caja.left + caja.width / 2;
    var y0 = origen.y || caja.top + caja.height / 2;
    var d = destinoCarrito().getBoundingClientRect();
    var x1 = d.left + d.width / 2;
    var y1 = d.top + d.height / 2;
    // Punto de control por encima de ambos extremos: dibuja el arco
    var cx = (x0 + x1) / 2;
    var cy = Math.min(y0, y1) - Math.max(110, Math.abs(x1 - x0) * 0.35);
    var cuadros = [];
    for (var i = 0; i <= 18; i++) {
      var t = i / 18, u = 1 - t;
      var x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      var y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      cuadros.push({
        transform: "translate(" + (x - 8).toFixed(1) + "px," + (y - 8).toFixed(1) + "px) rotate(" + (45 + t * 540).toFixed(0) + "deg) scale(" + (1 - t * 0.45).toFixed(2) + ")",
        opacity: t > 0.9 ? 0.5 : 1
      });
    }
    var chispa = crear("div", "chispa");
    chispa.setAttribute("aria-hidden", "true");
    document.body.appendChild(chispa);
    var anim = chispa.animate(cuadros, { duration: 720, easing: "cubic-bezier(0.45, 0, 0.55, 1)" });
    var listo = false;
    function terminar() {
      if (listo) return;
      listo = true;
      chispa.remove();
      alLlegar();
    }
    anim.onfinish = terminar;
    anim.oncancel = terminar;
  }

  function reiniciarAnimacion(nodo, clase) {
    nodo.classList.remove(clase);
    void nodo.offsetWidth;   // fuerza a que la animación vuelva a empezar
    nodo.classList.add(clase);
  }

  // La olla se sacude y el contador da un salto
  function impactoCarrito() {
    if (menosMovimiento) return;
    reiniciarAnimacion(el.verPedido, "sacude");
    if (el.barra.classList.contains("visible")) reiniciarAnimacion(el.barra, "sacude");
    document.querySelectorAll(".contador").forEach(function (c) { reiniciarAnimacion(c, "salta"); });
  }

  /* ---------- Maridaje: sugerencia de bebida ---------- */

  function necesitaBebida() {
    if (estado.sinMaridaje) return false;
    var categorias = estado.carrito.map(function (i) { var p = productoPorId(i.id); return p ? p.categoria : ""; });
    var conFondo = categorias.some(function (c) { return CATEGORIAS_FONDO.indexOf(c) !== -1; });
    var conBebida = categorias.some(function (c) { return CATEGORIAS_BEBIDA.indexOf(c) !== -1; });
    return conFondo && !conBebida;
  }

  function maridaje() {
    if (!necesitaBebida()) return null;
    var bebidas = BEBIDAS_SUGERIDAS.map(productoPorId).filter(function (p) { return p && disponibleHoy(p); });
    if (!bebidas.length) return null;
    var caja = crear("div", "maridaje");
    caja.appendChild(crear("p", "", "¿Para la sed de Chosica? Agrega una jarra de Chicha Morada o Limonada Frozen con 1 toque."));
    var opciones = crear("div", "opciones-bebida");
    bebidas.forEach(function (p) {
      var b = crear("button", "", "+ " + p.nombre + " · " + soles(p.precio_pen));
      b.type = "button";
      b.addEventListener("click", function (e) { agregar(p, "", p.precio_pen, { boton: b, x: e.clientX, y: e.clientY }); });
      opciones.appendChild(b);
    });
    caja.appendChild(opciones);
    var cerrar = crear("button", "cerrar", "×");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "No, gracias");
    cerrar.addEventListener("click", function () { estado.sinMaridaje = true; renderCarrito(); });
    caja.appendChild(cerrar);
    return caja;
  }

  function nombreItem(item) {
    return item.nombre + (item.variante ? " (" + item.variante + ")" : "");
  }

  function renderCarrito() {
    var n = unidades();
    // Un solo hijo: el botón es flex con separación, y "(", número y ")" quedarían separados
    var textoPedido = crear("span", "", "Mi pedido (");
    textoPedido.appendChild(crear("span", "contador", String(n)));
    textoPedido.appendChild(document.createTextNode(")"));
    el.verPedido.textContent = "";
    el.verPedido.appendChild(textoPedido);
    el.barra.classList.toggle("visible", n > 0);
    el.barraCuenta.textContent = "";
    el.barraCuenta.appendChild(crear("span", "contador", String(n)));
    el.barraCuenta.appendChild(document.createTextNode(n === 1 ? " plato" : " platos"));
    el.barraTotal.textContent = soles(total());
    el.carrito.textContent = "";
    el.resumen.textContent = "";

    if (!estado.carrito.length) {
      el.carrito.appendChild(crear("p", "vacio", "Aún no agregaste platos. Elige desde la carta."));
      var repetir = itemsParaRepetir();
      if (repetir.length) {
        var n = repetir.reduce(function (s, i) { return s + i.cantidad; }, 0);
        var boton = crear("button", "repetir-pedido", "Repetir mi último pedido (" + n + (n === 1 ? " plato)" : " platos)"));
        boton.type = "button";
        boton.addEventListener("click", function () {
          estado.carrito = repetir;
          cambio();
          impactoCarrito();
          mostrarToast("✓ Listo: tu pedido de siempre está en el carrito");
        });
        el.carrito.appendChild(boton);
      }
      return;
    }

    var ultimo = estado.ultimoCambio;
    estado.ultimoCambio = null;
    estado.carrito.forEach(function (item) {
      var tipoCambio = ultimo && ultimo.clave === item.clave && !menosMovimiento ? ultimo.tipo : null;
      var linea = crear("div", "linea" + (tipoCambio === "nueva" ? " nueva" : ""));
      var info = crear("div");
      info.appendChild(crear("strong", "", nombreItem(item)));
      info.appendChild(document.createElement("br"));
      info.appendChild(crear("small", "", soles(item.precio * item.cantidad)));

      var controles = crear("div", "controles");
      var menos = crear("button", "", "−");
      menos.type = "button";
      menos.setAttribute("aria-label", "Quitar uno de " + item.nombre);
      menos.addEventListener("click", function () { cambiarCantidad(item.clave, -1); });
      var mas = crear("button", "", "+");
      mas.type = "button";
      mas.setAttribute("aria-label", "Agregar uno de " + item.nombre);
      mas.addEventListener("click", function () { cambiarCantidad(item.clave, 1); });
      controles.appendChild(menos);
      controles.appendChild(crear("span", "cant" + (tipoCambio === "cantidad" ? " cambia" : ""), String(item.cantidad)));
      controles.appendChild(mas);

      var nota = document.createElement("input");
      nota.type = "text";
      nota.placeholder = "Nota para este plato (opcional)";
      nota.value = item.nota || "";
      nota.maxLength = 80;
      nota.setAttribute("aria-label", "Nota para " + item.nombre);
      nota.addEventListener("change", function () { item.nota = nota.value.trim(); guardarCarrito(); });

      linea.appendChild(info);
      linea.appendChild(controles);
      linea.appendChild(nota);
      el.carrito.appendChild(linea);
    });

    var sugerencia = maridaje();
    if (sugerencia) el.carrito.appendChild(sugerencia);

    el.resumen.appendChild(filaResumen("Subtotal", soles(subtotal())));
    if (esDelivery()) el.resumen.appendChild(filaResumen("Delivery (referencial)", soles(CFG.deliveryTarifa)));
    el.resumen.appendChild(filaResumen("Total", soles(total()), "total"));
  }

  function filaResumen(etiqueta, valor, extra) {
    var fila = crear("div", "fila-resumen" + (extra ? " " + extra : ""));
    fila.appendChild(crear("span", "", etiqueta));
    fila.appendChild(crear("span", "", valor));
    return fila;
  }

  function cambio() {
    guardarCarrito();
    renderCarrito();
  }

  /* ---------- Formulario y envío ---------- */

  function actualizarFormulario() {
    el.campoDireccion.hidden = !esDelivery();
    el.campoEfectivo.hidden = valorRadio("pago") !== "Efectivo";
    renderCarrito();
  }

  function leerFormulario() {
    return {
      entrega: valorRadio("entrega"),
      direccion: el.direccion.value.trim(),
      nombre: document.getElementById("nombre").value.trim(),
      pago: valorRadio("pago"),
      efectivo: parseFloat(el.efectivo.value) || 0,
      indicaciones: document.getElementById("indicaciones").value.trim()
    };
  }

  // Devuelve { texto, campo } con el primer problema, o null si todo está bien
  function validar(d) {
    if (!estado.carrito.length) return { texto: "Agrega al menos un plato.", campo: null };
    if (d.entrega === "delivery" && d.direccion.length < 6 && !gps) return { texto: "Escribe la dirección de entrega o comparte tu ubicación.", campo: el.campoDireccion };
    if (d.nombre.length < 2) return { texto: "Escribe tu nombre.", campo: document.getElementById("nombre").closest(".campo") };
    if (d.pago === "Efectivo" && d.efectivo && d.efectivo < total()) return { texto: "El monto para el vuelto no cubre el total.", campo: el.campoEfectivo };
    if (!el.consentimiento.checked) return { texto: "Acepta el uso de tus datos (Ley 29733) para continuar.", campo: el.consentimiento.closest(".consentimiento") };
    return null;
  }

  // Señala el campo con problema: tiembla, se marca en coral y recibe el foco
  function marcarError(campo) {
    el.form.querySelectorAll(".error").forEach(function (n) { n.classList.remove("error"); });
    if (!campo) return;
    reiniciarAnimacion(campo, "error");
    campo.scrollIntoView({ behavior: menosMovimiento ? "auto" : "smooth", block: "center" });
    var entrada = campo.querySelector("input");
    if (entrada) {
      entrada.focus({ preventScroll: true });
      entrada.addEventListener(entrada.type === "checkbox" ? "change" : "input", function quitar() {
        campo.classList.remove("error");
        entrada.removeEventListener("input", quitar);
      }, { once: true });
    }
  }

  // Ráfaga de 20 confetis (rombos y flores) con el mensaje del fogón; luego sigue a WhatsApp
  function fiesta(alTerminar, subtitulo) {
    subtitulo = subtitulo || "Te llevamos a WhatsApp para enviarlo…";
    if (menosMovimiento || !Element.prototype.animate) {
      mostrarToast("¡Prendiendo el fogón para tu pedido!");
      setTimeout(alTerminar, 400);
      return;
    }
    var capa = crear("div", "fiesta");
    capa.setAttribute("role", "status");
    var mensaje = crear("div", "mensaje");
    var fuego = crear("span", "fuego");
    fuego.innerHTML = window.ALPAQORI_ARTE.icono("fuego", "icono-fuego");
    mensaje.appendChild(fuego);
    mensaje.appendChild(crear("strong", "", "¡Prendiendo el fogón para tu pedido!"));
    mensaje.appendChild(crear("span", "", subtitulo));
    capa.appendChild(mensaje);
    var colores = ["#EE6C5E", "#C9A45C", "#FBF6EF", "#F49A8C", "#E6CC92"];
    for (var i = 0; i < 20; i++) {
      var c = crear("span", "confeti " + (i % 3 === 0 ? "flor" : "rombo"));
      var color = colores[i % colores.length];
      c.style.background = color;
      c.style.color = color;   // los pétalos de la flor usan currentColor
      capa.appendChild(c);
      var angulo = (i / 20) * Math.PI * 2 + Math.random() * 0.4;
      var distancia = 140 + Math.random() * 170;
      var dx = Math.cos(angulo) * distancia;
      var dy = Math.sin(angulo) * distancia;
      var giro = (Math.random() * 2 - 1) * 540;
      c.animate([
        { transform: "translate(0, 0) rotate(45deg) scale(.4)", opacity: 1 },
        { transform: "translate(" + (dx * 0.7).toFixed(0) + "px," + (dy * 0.7 - 90).toFixed(0) + "px) rotate(" + (45 + giro / 2).toFixed(0) + "deg) scale(1.1)", opacity: 1, offset: 0.45 },
        { transform: "translate(" + dx.toFixed(0) + "px," + (dy + 240).toFixed(0) + "px) rotate(" + (45 + giro).toFixed(0) + "deg) scale(.9)", opacity: 0 }
      ], { duration: 1150 + Math.random() * 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
    }
    document.body.appendChild(capa);
    setTimeout(function () {
      alTerminar();
      setTimeout(function () { capa.remove(); }, 600);
    }, 1200);
  }

  // Si el navegador restaura la página al volver de WhatsApp, no debe quedar la fiesta encima
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) document.querySelectorAll(".fiesta").forEach(function (n) { n.remove(); });
  });

  // Formato que entiende el bot (leerPedidoWeb): no cambiar sin actualizar bot-whatsapp/logica.js
  function construirMensaje(d) {
    var l = ["Hola Alpaqori, quiero hacer este pedido:"];
    estado.carrito.forEach(function (item) {
      l.push("- " + item.cantidad + " x " + nombreItem(item) + " (" + soles(item.precio * item.cantidad) + ")");
      if (item.nota) l.push("   Nota: " + item.nota);
    });
    l.push("");
    l.push("Entrega: " + (d.entrega === "delivery" ? "Delivery" : "Recojo en local"));
    if (d.entrega === "delivery") l.push("Dirección: " + [d.direccion, gps && gps.url].filter(Boolean).join(" · "));
    l.push("Nombre: " + d.nombre);
    l.push("Pago: " + d.pago + (d.pago === "Efectivo" && d.efectivo ? " (paga con " + soles(d.efectivo) + ")" : ""));
    if (d.indicaciones) l.push("Indicaciones: " + d.indicaciones);
    l.push("Subtotal: " + soles(subtotal()));
    if (d.entrega === "delivery") l.push("Delivery (referencial): " + soles(CFG.deliveryTarifa));
    l.push("Total: " + soles(total()));
    return l.join("\n");
  }

  /* ---------- Pedido desde la mesa (QR): directo a cocina ---------- */

  var enviandoCocina = false;
  function enviarACocina() {
    if (enviandoCocina) return;   // un doble toque no debe duplicar la comanda
    if (!estado.carrito.length) { mostrarToast("Agrega al menos un plato."); marcarError(null); return; }
    if (!PEDIDOS) { mostrarToast("No pudimos conectar con cocina. Pide ayuda a un mozo."); return; }
    var nombre = document.getElementById("nombre").value.trim().replace(/\s+/g, " ").slice(0, 50);
    var indicaciones = document.getElementById("indicaciones").value.trim();
    var notas = [indicaciones].concat(estado.carrito.filter(function (i) { return i.nota; }).map(function (i) {
      return nombreItem(i) + ": " + i.nota;
    })).filter(Boolean).join(" · ").slice(0, 300);
    var items = estado.carrito.map(function (i) {
      return { id: i.id, nombre: i.nombre, variante: i.variante || "", precio: i.precio, cantidad: i.cantidad };
    });
    var boton = document.getElementById("enviar");
    enviandoCocina = true;
    boton.disabled = true;
    boton.textContent = "Enviando a cocina…";
    PEDIDOS.crear({ lugar: "Mesa " + MESA, origen: "qr", cliente: nombre, items: items, notas: notas }).then(function (pedido) {
      try {
        var mios = JSON.parse(localStorage.getItem(CLAVE_MIS_PEDIDOS) || "[]");
        mios.push(pedido.token || pedido.id);
        localStorage.setItem(CLAVE_MIS_PEDIDOS, JSON.stringify(mios.slice(-30)));
      } catch (err) { /* sin almacenamiento: el pedido igual llegó a cocina */ }
      guardarPedido({ fecha: new Date().toISOString(), datos: { mesa: MESA, nombre: nombre }, items: estado.carrito, total: total() });
      estado.carrito = [];
      estado.sinMaridaje = false;
      guardarCarrito();
      el.form.reset();
      actualizarFormulario();
      fiesta(function () {
        location.href = "mesa.html?mesa=" + MESA + "&ver=pedido&nuevo=" + encodeURIComponent(pedido.numero);
      }, "Tu pedido va directo a cocina…");
    }).catch(function () {
      mostrarToast("No pudimos enviar tu pedido. Revisa tu conexión e inténtalo otra vez.");
    }).then(function () {
      enviandoCocina = false;
      boton.disabled = false;
      boton.textContent = "Enviar a cocina";
    });
  }

  function iniciarModoMesa() {
    document.body.classList.add("modo-mesa");
    var miCuenta = "mesa.html?mesa=" + MESA + "&ver=pedido";
    document.getElementById("titulo-pedido").textContent = "Pedido de la Mesa " + MESA;
    var boton = document.getElementById("enviar");
    boton.textContent = "Enviar a cocina";
    boton.classList.remove("wa");
    document.getElementById("aviso-envio").textContent = "Tu pedido llega directo a cocina. Un mozo confirmará tu mesa y podrás seguirlo desde tu celular.";
    document.getElementById("nombre").placeholder = "Opcional: para llamarte por tu nombre";
    var bajada = document.querySelector(".portada-carta .bajada");
    if (bajada) bajada.textContent = "Precios en soles, incluyen IGV. Elige tus platos y envíalos a cocina desde tu mesa.";
    var aviso = crear("div", "aviso-mesa");
    aviso.setAttribute("role", "status");
    var texto = crear("p");
    texto.appendChild(document.createTextNode("Estás en la "));
    texto.appendChild(crear("strong", "", "Mesa " + MESA));
    texto.appendChild(document.createTextNode(". Tu pedido llega directo a cocina."));
    aviso.appendChild(texto);
    var enlace = crear("a", "", "Ver mi pedido y cuenta");
    enlace.href = miCuenta;
    aviso.appendChild(enlace);
    var hoy = document.getElementById("hoy-toca");
    hoy.parentNode.insertBefore(aviso, hoy);
    var cuenta = crear("a", "boton chico claro mi-cuenta", "Mi cuenta");
    cuenta.href = miCuenta;
    el.verPedido.parentNode.insertBefore(cuenta, el.verPedido);
  }

  /* ---------- Ubicación GPS para el delivery ---------- */

  function iniciarGPS() {
    var boton = document.getElementById("usar-gps");
    var info = document.getElementById("gps-info");
    if (!boton) return;
    if (!navigator.geolocation) { boton.hidden = true; return; }
    boton.addEventListener("click", function () {
      info.textContent = "Buscando tu ubicación…";
      boton.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude.toFixed(6);
        var lng = pos.coords.longitude.toFixed(6);
        gps = { url: "https://maps.google.com/?q=" + lat + "," + lng };
        info.textContent = "✓ Ubicación lista: el repartidor verá tu punto en el mapa.";
        boton.textContent = "Ubicación compartida";
        el.campoDireccion.classList.remove("error");
        boton.disabled = false;
      }, function (err) {
        gps = null;
        info.textContent = (err.code === 1 ? "No diste permiso de ubicación." : "No pudimos detectar tu ubicación.") + " Escribe tu dirección.";
        boton.disabled = false;
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  function enviar(e) {
    e.preventDefault();
    if (MESA) { enviarACocina(); return; }
    var d = leerFormulario();
    var error = validar(d);
    if (error) { mostrarToast(error.texto); marcarError(error.campo); return; }
    marcarError(null);
    if (String(CFG.whatsappNumero).charAt(0) === "[") { mostrarToast("Falta configurar el número de WhatsApp en js/config.js."); return; }

    guardarPedido({ fecha: new Date().toISOString(), datos: d, items: estado.carrito, total: total() });
    var url = A.enlaceWhatsApp(construirMensaje(d));   // el mensaje se arma antes de vaciar el carrito

    estado.carrito = [];
    estado.sinMaridaje = false;
    guardarCarrito();
    el.form.reset();
    gps = null;
    actualizarFormulario();
    fiesta(function () { A.irAWhatsApp(url); });
  }

  /* ---------- Arranque ---------- */

  document.querySelectorAll("input[name='entrega'], input[name='pago']").forEach(function (r) {
    r.addEventListener("change", actualizarFormulario);
  });
  el.form.addEventListener("submit", enviar);
  window.addEventListener("hashchange", function () {
    if (!/cat=/.test(location.hash)) return;   // "#pedido" solo baja al carrito
    cambiarCategoria(categoriaDesdeHash(), true);
  });

  /* Activar la ilustración de una tarjeta.
     - Mouse: al entrar con el puntero (.encima). No se usa :hover en CSS porque en celular queda
       "pegado" tras un toque y en iPhone puede exigir un segundo toque para pulsar el botón.
     - Toque: tocar la tarjeta la enciende o apaga (.viva). Tocar "+ Agregar" agrega al primer toque
       y además enciende la tarjeta como respuesta visual. */
  el.lista.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;
    var tarjeta = e.target.closest(".plato");
    if (tarjeta) tarjeta.classList.add("encima");
  });
  el.lista.addEventListener("pointerout", function (e) {
    if (e.pointerType !== "mouse") return;
    var tarjeta = e.target.closest(".plato");
    if (tarjeta && !tarjeta.contains(e.relatedTarget)) tarjeta.classList.remove("encima");
  });
  el.lista.addEventListener("click", function (e) {
    var tarjeta = e.target.closest(".plato");
    var enControl = e.target.closest("button, select, a, input");
    el.lista.querySelectorAll(".plato.viva").forEach(function (t) { if (t !== tarjeta) t.classList.remove("viva"); });
    if (!tarjeta) return;
    if (enControl) tarjeta.classList.add("viva");   // el botón ya hizo su trabajo; solo se enciende
    else tarjeta.classList.toggle("viva");
  });

  /* ---------- "Mi pedido": hoja a pantalla completa en celular; en computadora, desplazamiento ---------- */
  var esCelular = window.matchMedia("(max-width: 999px)");
  var hoja = document.getElementById("pedido");
  var cerrarHoja = crear("button", "cerrar-pedido", "✕");
  cerrarHoja.type = "button";
  cerrarHoja.setAttribute("aria-label", "Cerrar mi pedido");
  hoja.insertBefore(cerrarHoja, hoja.firstChild);
  var ultimoFoco = null;

  function abrirPedido(e) {
    if (e) e.preventDefault();
    if (!esCelular.matches) {
      hoja.scrollIntoView({ behavior: menosMovimiento ? "auto" : "smooth", block: "start" });
      reiniciarAnimacion(hoja, "llamar");
      return;
    }
    ultimoFoco = document.activeElement;
    document.body.classList.add("pedido-abierto");
    hoja.setAttribute("role", "dialog");
    hoja.setAttribute("aria-modal", "true");
    hoja.scrollTop = 0;
    cerrarHoja.focus({ preventScroll: true });
  }
  function cerrarPedido() {
    if (!document.body.classList.contains("pedido-abierto")) return;
    document.body.classList.remove("pedido-abierto");
    hoja.removeAttribute("role");
    hoja.removeAttribute("aria-modal");
    if (ultimoFoco) ultimoFoco.focus({ preventScroll: true });
  }
  el.verPedido.addEventListener("click", abrirPedido);
  el.barra.addEventListener("click", abrirPedido);
  cerrarHoja.addEventListener("click", cerrarPedido);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarPedido(); });
  esCelular.addEventListener("change", function () { if (!esCelular.matches) cerrarPedido(); });
  if (location.hash === "#pedido") setTimeout(abrirPedido, 0);

  if (MESA) iniciarModoMesa();
  iniciarGPS();
  // Cliente frecuente: su nombre ya está escrito
  (function () {
    var ultimo = ultimoPedido();
    var campo = document.getElementById("nombre");
    if (ultimo && ultimo.datos && ultimo.datos.nombre && !campo.value) campo.value = ultimo.datos.nombre;
  })();

  renderHoyToca();
  renderChips();
  renderProductos(true);
  actualizarFormulario();
})();
