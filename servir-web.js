/* Servidor local para probar la web:  node servir-web.js  →  http://localhost:5173 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, 'web');
const PUERTO = Number(process.env.PORT) || 5173;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const ruta = decodeURIComponent(req.url.split('?')[0]);
  const archivo = path.join(RAIZ, ruta === '/' ? 'index.html' : ruta);
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    // Sin caché: al probar cambios, el navegador siempre carga la última versión
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(datos);
  });
}).listen(PUERTO, () => console.log(`Web de Alpaqori en http://localhost:${PUERTO}`));
