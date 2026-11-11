/* =========================================================
   ALPAQORI · mesas-qr.js
   Genera un QR por mesa que abre carta.html?mesa=N.
   ========================================================= */
(function () {
  'use strict';

  const CLAVE = 'alpaqori_qr_base';
  const $ = (id) => document.getElementById(id);
  const grid = $('qr-grid');
  const aviso = $('qr-aviso');
  const campo = $('qr-base');
  const cantidad = $('qr-cantidad');
  const imprimir = $('qr-imprimir');
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  /* Direcciones que solo existen en la laptop o en la red local: un celular no las abre. */
  function esLocal(url) {
    if (url.protocol === 'file:') return true;
    const h = url.hostname;
    return h === 'localhost' || h === '0.0.0.0' || h === '[::1]' || h.endsWith('.local')
      || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  }

  function leerGuardada() {
    try { return localStorage.getItem(CLAVE) || ''; } catch { return ''; }
  }

  /* Orden: ?base= en el enlace, la última guardada, o esta misma página si ya es pública. */
  const desdeEnlace = new URLSearchParams(location.search).get('base') || '';
  const actual = new URL('./', location.href);
  campo.value = desdeEnlace || leerGuardada() || (esLocal(actual) ? '' : actual.href);

  function baseValida() {
    let texto = campo.value.trim();
    if (!texto) return { error: 'Pega la dirección pública de la web (la publicada) para generar los QR.' };
    if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`;
    let url;
    try { url = new URL(texto); } catch { return { error: 'Esa dirección no es válida. Cópiala completa, por ejemplo https://tu-usuario.github.io/alpaqori/' }; }
    if (esLocal(url)) {
      return { error: `“${url.host}” es una dirección de esta computadora: un celular no puede abrirla. Usa la dirección de la web publicada.` };
    }
    if (url.protocol !== 'https:') return { error: 'Usa una dirección https: así el celular la abre sin avisos de seguridad.' };
    if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/, '');
    url.search = '';
    url.hash = '';
    return { url };
  }

  function pintar() {
    const { url, error } = baseValida();
    aviso.hidden = !error;
    aviso.textContent = error || '';
    imprimir.disabled = Boolean(error);
    if (error) {
      grid.innerHTML = '';
      return;
    }
    try { localStorage.setItem(CLAVE, url.href); } catch { /* sin almacenamiento */ }
    const total = Math.min(99, Math.max(1, Number(cantidad.value) || 1));
    grid.innerHTML = Array.from({ length: total }, (_, i) => {
      const mesa = i + 1;
      const destino = new URL(`carta.html?mesa=${mesa}`, url).href;
      const qr = window.qrcode(0, 'M');
      qr.addData(destino);
      qr.make();
      const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }).replace('<svg ', '<svg class="qr" role="img" aria-label="Código QR de la mesa ' + mesa + '" ');
      return `<article class="qr-tarjeta">
        <span class="op-marca">ALPAQORI</span>
        <h2>Mesa ${mesa}</h2>
        ${svg}
        <p>Escanea, pide y paga desde tu celular</p>
        <a class="qr-destino" href="${esc(destino)}" target="_blank" rel="noopener">${esc(destino.replace(/^https:\/\//, ''))}</a>
      </article>`;
    }).join('');
  }

  campo.addEventListener('input', pintar);
  cantidad.addEventListener('input', pintar);
  imprimir.addEventListener('click', () => window.print());
  pintar();
})();
