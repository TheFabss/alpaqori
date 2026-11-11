/* ==========================================================
   Vida del patio: arte SVG generado y motores contextuales
   - Guirnalda de banderines y farolillos (techo del hero)
   - El Telar Vivo: separadores de rombos que se tejen al hacer scroll
   - Revelado escalonado al hacer scroll
   - Motor de horario: abierto / cocina descansando (hora de Chosica)
   - Saludo según la hora
   - Especiales de hoy según disponible_dias del catálogo
   Requiere: config.js, catalogo.js y comun.js (window.ALPAQORI)
   ========================================================== */
(function () {
  var SVG = "http://www.w3.org/2000/svg";
  var A = window.ALPAQORI;
  var CATALOGO = window.ALPAQORI_CATALOGO;
  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function nodoSvg(etiqueta, atributos) {
    var n = document.createElementNS(SVG, etiqueta);
    Object.keys(atributos || {}).forEach(function (k) { n.setAttribute(k, atributos[k]); });
    return n;
  }

  /* ---------- Guirnalda de banderines y farolillos ---------- */
  // Punto sobre una curva cuadrática (P0, P1 de control, P2)
  function puntoCuadratica(p0, p1, p2, t) {
    var u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }

  // Una cuerda formada por dos curvas; devuelve el path y los puntos donde cuelgan los banderines
  function cuerda(tramos, cantidad) {
    var d = "M" + tramos[0][0].join(" ");
    tramos.forEach(function (tr) { d += " Q" + tr[1].join(" ") + " " + tr[2].join(" "); });
    var puntos = [];
    for (var i = 0; i < cantidad; i++) {
      var t = (i + 0.5) / cantidad * tramos.length;
      var idx = Math.min(Math.floor(t), tramos.length - 1);
      var tr = tramos[idx];
      puntos.push(puntoCuadratica(tr[0], tr[1], tr[2], t - idx));
    }
    return { d: d, puntos: puntos };
  }

  var BRISAS = ["brisa-lenta", "brisa-media", "brisa-rapida"];
  // Banderín de papel picado: triángulo con un rombo calado (fill-rule evenodd)
  var FORMA_BANDERIN = "M-13 0 H13 L0 30 Z M0 7 L4.5 12.5 L0 18 L-4.5 12.5 Z";

  function crearGuirnalda(svg) {
    var deDia = svg.classList.contains("dia");   // versión para fondo crema (carta)
    var defs = nodoSvg("defs");
    var grad = nodoSvg("radialGradient", { id: "luz-farol" });
    grad.appendChild(nodoSvg("stop", { offset: "0%", "stop-color": "#F5D98E", "stop-opacity": "0.9" }));
    grad.appendChild(nodoSvg("stop", { offset: "100%", "stop-color": "#F5D98E", "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var capas = [
      { // cuerda de atrás: más tenue
        tramos: [[[-40, 30], [380, 108], [760, 46]], [[760, 46], [1140, 108], [1480, 30]]],
        cantidad: 20, colores: ["#9E4A3F", "#8C7444", "#B9A88F"], opacidad: 0.75, faroles: false
      },
      { // cuerda principal
        tramos: [[[0, 6], [360, 80], [720, 22]], [[720, 22], [1080, 80], [1440, 6]]],
        cantidad: 24, colores: ["#EE6C5E", "#FBF6EF", "#C9A45C", "#F49A8C", "#E6CC92"], opacidad: 1, faroles: true
      }
    ];
    if (deDia) {
      capas[0].colores = ["#F49A8C", "#E6CC92", "#EE6C5E"];
      capas[0].opacidad = 0.45;
      capas[1].colores = ["#EE6C5E", "#C9A45C", "#F49A8C", "#B23C2F", "#E6CC92"];
    }

    capas.forEach(function (capa) {
      var c = cuerda(capa.tramos, capa.cantidad);
      var grupo = nodoSvg("g", { opacity: capa.opacidad });
      grupo.appendChild(nodoSvg("path", { d: c.d, class: "cuerda" }));
      c.puntos.forEach(function (p, i) {
        var g = nodoSvg("g", { transform: "translate(" + p[0].toFixed(1) + " " + p[1].toFixed(1) + ")" });
        if (capa.faroles && i % 6 === 3) {
          // Farolillo: hilo, luz cálida que titila y cuerpo dorado
          g.appendChild(nodoSvg("circle", { cx: 0, cy: 18, r: 18, fill: "url(#luz-farol)", class: "farol-luz" }));
          var cuerpo = nodoSvg("g", { class: "banderin " + BRISAS[i % 3] });
          cuerpo.appendChild(nodoSvg("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#E6CC92", "stroke-width": 1.4 }));
          cuerpo.appendChild(nodoSvg("rect", { x: -7, y: 7, width: 14, height: 20, rx: 6, fill: "#F2B544" }));
          cuerpo.appendChild(nodoSvg("rect", { x: -4, y: 5, width: 8, height: 3, rx: 1, fill: "#2A211D" }));
          g.appendChild(cuerpo);
        } else {
          g.appendChild(nodoSvg("path", {
            d: FORMA_BANDERIN, "fill-rule": "evenodd",
            fill: capa.colores[i % capa.colores.length],
            class: "banderin " + BRISAS[i % 3],
            style: "animation-delay:-" + ((i * 0.37) % 4).toFixed(2) + "s"
          }));
        }
        grupo.appendChild(g);
      });
      svg.appendChild(grupo);
    });
  }

  document.querySelectorAll("svg.guirnalda").forEach(crearGuirnalda);

  /* ---------- Buganvillas fucsias colgando del techo (como en la entrada del local) ---------- */
  var FUCSIAS = ["#D91485", "#C2127A", "#A80F66", "#E8379B", "#B5106A"];
  var HOJAS = ["#3E6B35", "#2F5A2A", "#4E7A3A"];

  // Una flor de buganvilla: tres brácteas fucsias alrededor de un centro crema
  function flor(g, x, y, r) {
    var color = FUCSIAS[Math.floor(Math.random() * FUCSIAS.length)];
    for (var k = 0; k < 3; k++) {
      var a = k * 2.094 + Math.random() * 0.5;
      g.appendChild(nodoSvg("circle", { cx: (x + Math.cos(a) * r * 0.7).toFixed(1), cy: (y + Math.sin(a) * r * 0.7).toFixed(1), r: r.toFixed(1), fill: color }));
    }
    g.appendChild(nodoSvg("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (r * 0.28).toFixed(1), fill: "#FBF6EF" }));
  }

  function hoja(g, x, y) {
    g.appendChild(nodoSvg("ellipse", {
      cx: x.toFixed(1), cy: y.toFixed(1), rx: 7.5, ry: 3.6,
      fill: HOJAS[Math.floor(Math.random() * HOJAS.length)],
      transform: "rotate(" + Math.round(Math.random() * 180) + " " + x.toFixed(1) + " " + y.toFixed(1) + ")"
    }));
  }

  function crearBuganvillas(svg) {
    // Franja de techo: follaje y flores tupidas a lo largo de todo el borde
    var techo = nodoSvg("g");
    for (var x = 0; x <= 1440; x += 7) {
      hoja(techo, x + Math.random() * 6, 2 + Math.random() * 12);
      if (Math.random() < 0.45) flor(techo, x + Math.random() * 8, 8 + Math.random() * 10, 3.4 + Math.random() * 2.6);
    }
    svg.appendChild(techo);
    // Ramas colgantes: largas en las esquinas (enmarcan como la puerta del local), cortas al centro
    var i = 0;
    for (var rx = 6; rx < 1440; rx += 24 + Math.random() * 10) {
      var borde = Math.min(rx, 1440 - rx) / 720;          // 0 en las esquinas, 1 al centro
      if (borde > 0.35 && Math.random() < 0.55) continue;  // el centro queda más despejado
      var largo = borde < 0.25 ? 70 + Math.random() * 75 : 18 + Math.random() * 40;
      var rama = nodoSvg("g", { class: "rama " + BRISAS[i++ % 3], style: "animation-delay:-" + (Math.random() * 4).toFixed(1) + "s" });
      var curva = (Math.random() - 0.5) * 16;
      rama.appendChild(nodoSvg("path", {
        d: "M" + rx.toFixed(1) + " 8 q" + curva.toFixed(1) + " " + (largo / 2).toFixed(0) + " " + (curva / 3).toFixed(1) + " " + largo.toFixed(0),
        fill: "none", stroke: "#2F5A2A", "stroke-width": 1.4
      }));
      for (var y = 16; y <= largo; y += 10 + Math.random() * 6) {
        var desvio = curva * Math.sin(Math.PI * y / largo) * 0.5;
        hoja(rama, rx + desvio + (Math.random() - 0.5) * 12, y);
        if (Math.random() < 0.5) hoja(rama, rx + desvio + (Math.random() - 0.5) * 12, y + 5);
        if (Math.random() < 0.7) flor(rama, rx + desvio + (Math.random() - 0.5) * 10, y + 3, 3 + Math.random() * 2.8);
      }
      svg.appendChild(rama);
    }
  }
  document.querySelectorAll("svg.buganvillas").forEach(crearBuganvillas);

  /* ---------- Luces de verbena bajo el menú (bombillas cálidas del patio de noche) ---------- */
  function crearVerbena(topbar) {
    var caja = document.createElement("div");
    caja.className = "verbena";
    caja.setAttribute("aria-hidden", "true");
    var svg = nodoSvg("svg", { viewBox: "0 0 1440 28", preserveAspectRatio: "xMidYMin slice", focusable: "false" });
    var defs = nodoSvg("defs");
    var grad = nodoSvg("radialGradient", { id: "halo-foco" });
    grad.appendChild(nodoSvg("stop", { offset: "0%", "stop-color": "#FFD27A", "stop-opacity": "0.9" }));
    grad.appendChild(nodoSvg("stop", { offset: "100%", "stop-color": "#FFD27A", "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    // Tramos de cable con caída suave entre postes cada 240 px; un foco cada ~30 px
    for (var x0 = 0; x0 < 1440; x0 += 240) {
      var x1 = x0 + 240, cx = x0 + 120, cy = 16;
      svg.appendChild(nodoSvg("path", { class: "cable", d: "M" + x0 + " 2 Q" + cx + " " + (cy * 2 - 2) + " " + x1 + " 2" }));
      for (var t = 0.0625; t < 1; t += 0.125) {
        var u = 1 - t;
        var px = u * u * x0 + 2 * u * t * cx + t * t * x1;
        var py = u * u * 2 + 2 * u * t * (cy * 2 - 2) + t * t * 2;
        var titila = Math.random() < 0.35 ? " titila" : "";
        svg.appendChild(nodoSvg("circle", { class: "halo" + titila, cx: px.toFixed(1), cy: (py + 6).toFixed(1), r: 9 }));
        svg.appendChild(nodoSvg("line", { x1: px.toFixed(1), y1: py.toFixed(1), x2: px.toFixed(1), y2: (py + 2.5).toFixed(1), stroke: "rgba(42,33,29,.85)", "stroke-width": 1.4 }));
        svg.appendChild(nodoSvg("circle", { class: "foco", cx: px.toFixed(1), cy: (py + 6).toFixed(1), r: 3.8 }));
      }
    }
    caja.appendChild(svg);
    topbar.appendChild(caja);
  }
  document.querySelectorAll(".topbar").forEach(crearVerbena);

  /* ---------- Flores silvestres del mural (lirios amarillos, zinnias rojas, lavandas) ---------- */
  document.querySelectorAll(".flores-mural").forEach(function (g) {
    var COLORES = ["#F2B544", "#F2B544", "#D9314A", "#D91485", "#8E6BBF", "#F5E1AE"];
    for (var n = 0; n < 70; n++) {
      var x = Math.random() * 1440;
      var y = 520 + Math.random() * 100;
      var alto = 10 + Math.random() * 18;
      var color = COLORES[Math.floor(Math.random() * COLORES.length)];
      var planta = nodoSvg("g", { class: "flor-mural", opacity: (0.45 + Math.random() * 0.3).toFixed(2) });
      planta.appendChild(nodoSvg("path", { d: "M" + x.toFixed(1) + " " + y.toFixed(1) + " q2 -" + (alto / 2).toFixed(0) + " 0 -" + alto.toFixed(0), stroke: "#3E6B35", "stroke-width": 1.6, fill: "none" }));
      var r = 3 + Math.random() * 3;
      for (var p = 0; p < 5; p++) {
        var a = p * 1.2566;
        planta.appendChild(nodoSvg("ellipse", {
          cx: (x + Math.cos(a) * r).toFixed(1), cy: (y - alto + Math.sin(a) * r).toFixed(1), rx: (r * 0.9).toFixed(1), ry: (r * 0.5).toFixed(1),
          fill: color, transform: "rotate(" + Math.round(a * 57.3) + " " + (x + Math.cos(a) * r).toFixed(1) + " " + (y - alto + Math.sin(a) * r).toFixed(1) + ")"
        }));
      }
      planta.appendChild(nodoSvg("circle", { cx: x.toFixed(1), cy: (y - alto).toFixed(1), r: (r * 0.4).toFixed(1), fill: "#7A4E1E" }));
      g.appendChild(planta);
    }
  });

  /* ---------- Escena de la Llama Guardiana ---------- */
  // Rayos del Inti: 16 triángulos alternando largos y cortos
  document.querySelectorAll(".inti .rayos").forEach(function (g) {
    var cx = 396, cy = 118;
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2;
      var largo = i % 2 ? 54 : 66;
      var ancho = 0.09;
      var p = [
        [cx + Math.cos(a - ancho) * 40, cy + Math.sin(a - ancho) * 40],
        [cx + Math.cos(a) * largo, cy + Math.sin(a) * largo],
        [cx + Math.cos(a + ancho) * 40, cy + Math.sin(a + ancho) * 40]
      ];
      g.appendChild(nodoSvg("path", { d: "M" + p.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L") + " Z" }));
    }
  });

  // Parallax: el mouse mueve orejas, sombrero e Inti; en celular lo hace el scroll
  var escena = document.querySelector(".escena");
  if (escena && !menosMovimiento) {
    var pendiente = false, px = 0, py = 0;
    function aplicar() {
      pendiente = false;
      escena.style.setProperty("--px", px.toFixed(3));
      escena.style.setProperty("--py", py.toFixed(3));
    }
    function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(aplicar); } }
    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("mousemove", function (e) {
        px = (e.clientX / window.innerWidth) * 2 - 1;
        py = (e.clientY / window.innerHeight) * 2 - 1;
        pedir();
      }, { passive: true });
    } else {
      window.addEventListener("scroll", function () {
        var y = window.scrollY;
        if (y > window.innerHeight * 1.5) return;   // fuera del hero no hace falta
        px = Math.sin(y / 180) * 0.6;
        py = Math.min(1, y / 400);
        pedir();
      }, { passive: true });
    }
  }

  /* ---------- Lluvia de pétalos (equivalente a los pétalos de sakura de Komakai) ---------- */
  document.querySelectorAll(".lluvia").forEach(function (lluvia) {
    if (menosMovimiento) return;
    var TIPOS = ["retama-p", "geranio", "retama-p", "geranio", "chakana", "retama-p"];
    for (var i = 0; i < 18; i++) {
      var petalo = document.createElement("span");
      petalo.className = "petalo";
      var duracion = 10 + Math.random() * 8;
      petalo.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
      petalo.style.setProperty("--d", duracion.toFixed(1) + "s");
      petalo.style.setProperty("--retraso", (-Math.random() * duracion).toFixed(1) + "s");
      petalo.style.setProperty("--deriva", (60 + Math.random() * 140).toFixed(0) + "px");
      var vaiven = document.createElement("span");
      vaiven.className = "vaiven";
      vaiven.style.setProperty("--v", (2.4 + Math.random() * 2).toFixed(1) + "s");
      var hoja = document.createElement("span");
      hoja.className = "hoja " + TIPOS[i % TIPOS.length];
      hoja.style.setProperty("--t", (9 + Math.random() * 9).toFixed(0) + "px");
      hoja.style.setProperty("--g", (4 + Math.random() * 4).toFixed(1) + "s");
      vaiven.appendChild(hoja);
      petalo.appendChild(vaiven);
      lluvia.appendChild(petalo);
    }
  });

  /* ---------- El Telar Vivo: rombos que se tejen ---------- */
  function crearTelar(caja) {
    var cantidad = 100;   // más de lo que entra en pantalla; el sobrante se recorta
    var svg = nodoSvg("svg", {
      viewBox: "0 0 " + cantidad * 26 + " 28", preserveAspectRatio: "xMinYMid slice",
      "aria-hidden": "true", focusable: "false"
    });
    for (var i = 0; i < cantidad; i++) {
      var cx = i * 26 + 13;
      svg.appendChild(nodoSvg("polygon", {
        points: cx + ",2 " + (cx + 12) + ",14 " + cx + ",26 " + (cx - 12) + ",14",
        pathLength: 1,
        class: "rombo " + (i % 2 ? "impar" : "par"),
        style: "--i:" + Math.min(i, 60)
      }));
    }
    caja.appendChild(svg);
  }

  /* ---------- Ondas coral (como las de la carta impresa) ---------- */
  function crearOndas(svg) {
    // Tres líneas onduladas más largas que la pantalla; CSS las desplaza en bucle
    [8, 17, 26].forEach(function (y, fila) {
      var d = "M-160 " + y;
      for (var x = -160; x < 1640; x += 40) d += " q20 " + (fila % 2 ? 7 : -7) + " 40 0";
      svg.appendChild(nodoSvg("path", { d: d, class: "onda onda-" + fila }));
    });
  }
  document.querySelectorAll("svg[data-ondas]").forEach(crearOndas);

  /* ---------- Revelado escalonado y telares (también para contenido nuevo) ---------- */
  var observador = (!menosMovimiento && "IntersectionObserver" in window)
    ? new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add(e.target.hasAttribute("data-telar") ? "tejido" : "visible");
        observador.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" })
    : null;

  // Prepara y observa todo lo que haya dentro de "raiz". La carta lo llama cada vez que vuelve a pintar la lista.
  function observar(raiz) {
    raiz = raiz || document;
    raiz.querySelectorAll("[data-telar]").forEach(function (caja) {
      if (!caja.querySelector("svg")) crearTelar(caja);
    });
    raiz.querySelectorAll("[data-escalonar]").forEach(function (grupo) {
      Array.prototype.forEach.call(grupo.children, function (hijo, i) {
        hijo.setAttribute("data-revelar", "");
        hijo.style.setProperty("--i", i);
      });
    });
    var pendientes = raiz.querySelectorAll("[data-revelar]:not(.visible), [data-telar]:not(.tejido)");
    pendientes.forEach(function (el) {
      if (observador) observador.observe(el);
      else el.classList.add(el.hasAttribute("data-telar") ? "tejido" : "visible");
    });
    // Salvaguarda: si el navegador está ocupado y el observador tarda, lo que ya está en pantalla aparece igual
    if (observador) {
      setTimeout(function () {
        pendientes.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) {
            el.classList.add(el.hasAttribute("data-telar") ? "tejido" : "visible");
            observador.unobserve(el);
          }
        });
      }, 1200);
    }
  }
  A.observar = observar;
  observar(document);

  /* ---------- Motor de horario en vivo ---------- */
  function pintarEstado() {
    var e = A.estadoLocal();
    var texto = e.abierto
      ? "Abierto ahora en Chosica · El patio te espera"
      : "Cocina descansando · Abrimos a las 8:00 a. m.";
    document.querySelectorAll("[data-estado]").forEach(function (el) {
      el.classList.toggle("abierto", e.abierto);
      el.querySelector(".texto").textContent = texto;
      el.setAttribute("title", e.abierto ? "Hoy atendemos hasta las " + (e.cierre === 22 ? "10:00 p. m." : "6:00 p. m.") : "Horario: todos los días desde las 8:00 a. m.");
    });
  }

  /* ---------- Saludo según la hora ---------- */
  function pintarSaludo() {
    var el = document.getElementById("saludo");
    if (!el) return;
    var e = A.estadoLocal();
    var minutos = e.ahora.hora * 60 + e.ahora.minuto;
    var finDeSemanaNoche = e.ahora.dia === "viernes" || e.ahora.dia === "sabado";
    var texto;
    if (minutos >= 7 * 60 && minutos <= 11 * 60 + 30) texto = "¡Buenos días, Chosica! ¿Un desayuno campechano o un tamalito calientito?";
    else if (minutos > 11 * 60 + 30 && minutos <= 16 * 60 + 30) texto = "Bienvenido a Tierra de Oro. ¿Qué historia vamos a almorzar hoy?";
    else if (minutos > 16 * 60 + 30 && minutos < 22 * 60 && finDeSemanaNoche) texto = "Noche en el patio. Parrillas, cócteles y sabor criollo.";
    else if (minutos > 16 * 60 + 30 && minutos < 18 * 60) texto = "Tarde en el patio. Hoy atendemos hasta las 6:00 p. m.";
    else texto = "La cocina descansa. Te esperamos desde las 8:00 a. m.";
    el.textContent = texto;
  }

  /* ---------- Especiales de hoy (disponible_dias) ---------- */
  function soles(n) { return "S/ " + Number(n).toFixed(2); }

  function pintarEspeciales() {
    var seccion = document.getElementById("hoy");
    if (!seccion || !CATALOGO) return;
    var dia = A.ahoraLima().dia;
    var nombreDia = A.NOMBRES_DIA[dia] || dia;
    var deHoy = CATALOGO.productos.filter(function (p) {
      return p.disponible_dias.length && p.disponible_dias.indexOf(dia) !== -1;
    });
    if (!deHoy.length) { seccion.hidden = true; return; }

    document.getElementById("hoy-dia").textContent = nombreDia;
    var lista = document.getElementById("hoy-lista");
    lista.textContent = "";
    deHoy.forEach(function (p, i) {
      var a = document.createElement("a");
      a.className = "especial";
      a.href = "carta.html#cat=" + p.categoria;
      a.setAttribute("data-portal", "");
      a.setAttribute("data-revelar", "");
      a.style.setProperty("--i", i);
      var badge = document.createElement("span");
      badge.className = "badge-hoy";
      badge.textContent = "¡Especial de hoy " + nombreDia + "!";
      var h3 = document.createElement("h3");
      h3.textContent = p.nombre;
      var precio = document.createElement("div");
      precio.className = "precio";
      precio.textContent = p.variantes ? "desde " + soles(Math.min.apply(null, Object.values(p.variantes))) : soles(p.precio_pen);
      a.appendChild(badge);
      a.appendChild(h3);
      a.appendChild(precio);
      lista.appendChild(a);
      requestAnimationFrame(function () { a.classList.add("visible"); });
    });
    seccion.hidden = false;
  }

  /* ---------- Horario: resaltar la fila de hoy ---------- */
  function resaltarHoy() {
    var dia = A.ahoraLima().dia;
    document.querySelectorAll("[data-dias]").forEach(function (fila) {
      fila.classList.toggle("hoy", fila.getAttribute("data-dias").split(",").indexOf(dia) !== -1);
    });
  }

  /* ---------- El guiño de la llama en pantallas táctiles ---------- */
  document.querySelectorAll(".marca").forEach(function (marca) {
    marca.addEventListener("touchstart", function () {
      marca.classList.add("guino");
      setTimeout(function () { marca.classList.remove("guino"); }, 900);
    }, { passive: true });
  });

  pintarEstado();
  pintarSaludo();
  pintarEspeciales();
  resaltarHoy();
  // El estado y el saludo cambian solos con la hora (cada minuto)
  setInterval(function () { pintarEstado(); pintarSaludo(); }, 60000);
})();
