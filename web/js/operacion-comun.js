/* =========================================================
   ALPAQORI · operacion-comun.js
   Piezas compartidas por las pantallas de operación:
   logo de la llama, navegación del personal y aviso del
   modo demostración.
   ========================================================= */
(function () {
  'use strict';

  /* La llama con sombrero, la misma del sello de la portada (versión compacta). */
  const LOGO = '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle cx="100" cy="100" r="98" fill="#EE6C5E"/><circle cx="100" cy="100" r="84" fill="none" stroke="#FBF6EF" stroke-width="10"/><g fill="#FBF6EF" stroke="#EE6C5E" stroke-width="4" stroke-linejoin="round"><path d="M80 178 L87 104 L85 93 L91 82 L104 78 L123 84 L149 100 L152 110 L142 116 L121 118 L115 127 L113 178 Z"/><path d="M86 86 L72 56 L97 75 Z"/><path d="M93 73 L96 50 L122 46 L128 68 Z"/><path d="M74 79 L138 68 L140 76 L77 87 Z"/></g></svg>';

  document.querySelectorAll('[data-logo]').forEach((marca) => {
    marca.insertAdjacentHTML('afterbegin', LOGO);
    marca.setAttribute('aria-label', 'Alpaqori');
  });

  const PANTALLAS = [
    ['personal', 'personal.html', 'Inicio'],
    ['cocina', 'cocina.html', 'Cocina'],
    ['caja', 'caja.html', 'Caja'],
    ['qr', 'mesas-qr.html', 'QR de mesas']
  ];
  const actual = document.body.dataset.pantalla;
  document.querySelectorAll('[data-per-nav]').forEach((nav) => {
    nav.innerHTML = PANTALLAS.map(([id, url, nombre]) =>
      `<a href="${url}"${id === actual ? ' aria-current="page"' : ''}>${nombre}</a>`
    ).join('');
  });

  /* Sin Supabase todo vive en este navegador: se avisa para no confundir una prueba con la operación real. */
  const P = window.AlpaqoriPedidos;
  if (P && !P.remoto) {
    document.querySelectorAll('[data-aviso-demo], [data-solo-demo]').forEach((n) => { n.hidden = false; });
  }
})();
