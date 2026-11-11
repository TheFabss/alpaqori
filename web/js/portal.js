/* ==========================================================
   El Portal: cruzar el zaguán hacia el patio (index → carta)
   - Salida: un rombo coral nace desde el punto del clic y cubre la pantalla (0.5 s, ease-telar).
   - Llegada: la capa coral se abre con un hueco en rombo y brotan flores del patio en las esquinas.
   - No usa @view-transition: congelaba la pantalla en celulares lentos. La capa coral cubre el salto.
   - Con "reducir movimiento" se navega directo, sin capas.
   Se carga en index.html y carta.html. Enlaces que lo usan: <a href="carta.html" data-portal>
   ========================================================== */
(function () {
  var CLAVE = "alpaqori-portal";
  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function guardar(valor) {
    try { sessionStorage.setItem(CLAVE, valor); } catch (e) { /* modo privado: el portal solo anima la salida */ }
  }
  function leerYBorrar() {
    try {
      var v = sessionStorage.getItem(CLAVE);
      sessionStorage.removeItem(CLAVE);
      return v;
    } catch (e) { return null; }
  }

  function capa(clase) {
    var c = document.createElement("div");
    c.className = "portal-capa " + clase;
    c.setAttribute("aria-hidden", "true");
    // Sello de la llama en el centro mientras se cruza el portal
    c.innerHTML = '<div class="sello-portal recorte" data-recorte="0.375,0.163,0.25,0.245" data-fijo><img src="images/1.png" alt=""></div>';
    var img = c.querySelector("img");
    var r = [0.375, 0.163, 0.25, 0.245];
    img.style.width = (100 / r[2]) + "%";
    img.style.left = (-r[0] / r[2] * 100) + "%";
    img.style.top = (-r[1] / r[3] * 100) + "%";
    document.body.appendChild(c);
    return c;
  }

  /* ---------- Salida ---------- */
  document.addEventListener("click", function (e) {
    var enlace = e.target.closest("a[data-portal]");
    if (!enlace || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var destino = enlace.href;
    // Mismo documento (por ejemplo carta.html#cat=sopas estando ya en la carta): navegación normal
    if (enlace.pathname === location.pathname) return;
    e.preventDefault();
    if (menosMovimiento) { location.href = destino; return; }

    var caja = enlace.getBoundingClientRect();
    var x = e.clientX || caja.left + caja.width / 2;
    var y = e.clientY || caja.top + caja.height / 2;
    var c = capa("salida");
    c.style.setProperty("--x", x + "px");
    c.style.setProperty("--y", y + "px");
    guardar("1");
    // Doble frame: el navegador pinta el rombo en 0 antes de animarlo
    requestAnimationFrame(function () { requestAnimationFrame(function () { c.classList.add("abrir"); }); });
    setTimeout(function () { location.href = destino; }, 540);
  });

  // Al volver con "atrás" el navegador puede restaurar la página con la capa puesta: se quita
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) document.querySelectorAll(".portal-capa.salida").forEach(function (c) { c.remove(); });
  });

  /* ---------- Llegada ---------- */
  var FLORES = '<svg viewBox="0 0 150 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M40 170 C42 130 30 110 18 92" stroke="#5E7A3A" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M60 170 C62 120 72 96 92 78" stroke="#5E7A3A" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M50 170 C50 140 52 118 50 60" stroke="#5E7A3A" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="30" cy="140" rx="20" ry="9" fill="#6E8C45" transform="rotate(-30 30 140)"/>' +
    '<ellipse cx="78" cy="132" rx="20" ry="9" fill="#6E8C45" transform="rotate(25 78 132)"/>' +
    '<g fill="#EE6C5E"><circle cx="18" cy="86" r="11"/><circle cx="9" cy="78" r="9"/><circle cx="27" cy="76" r="9"/><circle cx="18" cy="70" r="8"/></g>' +
    '<g fill="#F49A8C"><circle cx="94" cy="72" r="12"/><circle cx="84" cy="62" r="9"/><circle cx="104" cy="62" r="9"/><circle cx="94" cy="54" r="8"/></g>' +
    '<g fill="#C9A45C"><circle cx="50" cy="52" r="12"/><circle cx="40" cy="42" r="9"/><circle cx="60" cy="42" r="9"/><circle cx="50" cy="33" r="8"/></g>' +
    '<g fill="#FBF6EF"><circle cx="18" cy="78" r="3"/><circle cx="94" cy="63" r="3"/><circle cx="50" cy="43" r="3"/></g>' +
    '</svg>';

  if (leerYBorrar() === "1" && !menosMovimiento) {
    var llegada = capa("entrada");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { llegada.classList.add("revelar"); });
    });
    ["izq", "der"].forEach(function (lado) {
      var f = document.createElement("div");
      f.className = "flores-portal " + lado;
      f.innerHTML = FLORES;
      document.body.appendChild(f);
      setTimeout(function () { f.remove(); }, 2600);
    });
    setTimeout(function () { llegada.remove(); }, 1000);
  }
})();
