/* Utilidades compartidas por index.html y carta.html */
(function () {
  var CFG = window.ALPAQORI_CONFIG;

  /* Recortes de foto: las imágenes disponibles son capturas de pantalla (Instagram, Facebook, qcarta).
     data-recorte="x,y,ancho,alto" en fracciones de la imagen (0 a 1) muestra solo esa zona.
     Cuando haya fotos originales, basta con quitar data-recorte y usar un <img> normal. */
  function aplicarRecorte(caja) {
    var img = caja.querySelector("img");
    var r = caja.getAttribute("data-recorte").split(",").map(Number);
    function ajustar() {
      var anchoReal = r[2] * img.naturalWidth;
      var altoReal = r[3] * img.naturalHeight;
      if (!caja.hasAttribute("data-fijo")) caja.style.aspectRatio = anchoReal + " / " + altoReal;
      img.style.width = (100 / r[2]) + "%";
      img.style.left = (-r[0] / r[2] * 100) + "%";
      img.style.top = (-r[1] / r[3] * 100) + "%";
      caja.classList.add("listo");
    }
    if (img.complete && img.naturalWidth) ajustar();
    else img.addEventListener("load", ajustar);
  }

  document.querySelectorAll("[data-recorte]").forEach(aplicarRecorte);

  /* Enlaces de WhatsApp: data-wa="texto del mensaje" */
  function enlaceWhatsApp(texto) {
    return "https://wa.me/" + CFG.whatsappNumero + "?text=" + encodeURIComponent(texto);
  }

  document.querySelectorAll("[data-wa]").forEach(function (a) {
    a.href = enlaceWhatsApp(a.getAttribute("data-wa"));
    a.target = "_blank";
    a.rel = "noopener";
  });

  /* Textos que vienen de la configuración: data-config="direccion" */
  document.querySelectorAll("[data-config]").forEach(function (el) {
    var valor = CFG[el.getAttribute("data-config")];
    if (el.tagName === "A") el.href = valor;
    else el.textContent = valor;
  });

  /* Hora de Chosica (UTC-5), sin depender de la zona horaria del celular */
  function ahoraLima() {
    var partes = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima", weekday: "long", hour: "numeric", minute: "numeric", hourCycle: "h23"
    }).formatToParts(new Date());
    function valor(tipo) {
      var p = partes.find(function (x) { return x.type === tipo; });
      return p ? p.value : "";
    }
    var dia = valor("weekday").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return { dia: dia, hora: Number(valor("hour")), minuto: Number(valor("minute")) };
  }

  /* Horario oficial: todos los días 8:00–18:00; viernes y sábado hasta las 22:00 */
  function estadoLocal() {
    var a = ahoraLima();
    var cierre = (a.dia === "viernes" || a.dia === "sabado") ? 22 : 18;
    return { abierto: a.hora >= 8 && a.hora < cierre, cierre: cierre, ahora: a };
  }

  var NOMBRES_DIA = { lunes: "lunes", martes: "martes", miercoles: "miércoles", jueves: "jueves", viernes: "viernes", sabado: "sábado", domingo: "domingo" };

  window.ALPAQORI = {
    enlaceWhatsApp: enlaceWhatsApp, ahoraLima: ahoraLima, estadoLocal: estadoLocal, NOMBRES_DIA: NOMBRES_DIA,
    // Abre WhatsApp en la misma pestaña (no lo bloquean los navegadores aunque ocurra tras la animación)
    irAWhatsApp: function (url) { location.href = url; }
  };
})();
