/* Regenera web/js/catalogo.js desde catalogo.json (la fuente única de precios).
   Úsalo cada vez que cambies catalogo.json:  node generar-catalogo.js */
const fs = require('fs');
const path = require('path');

const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo.json'), 'utf8'));
const destino = path.join(__dirname, 'web', 'js', 'catalogo.js');
fs.writeFileSync(destino, '/* Generado desde catalogo.json con generar-catalogo.js. No editar a mano. */\nwindow.ALPAQORI_CATALOGO = ' + JSON.stringify(catalogo, null, 2) + ';\n');
console.log(`web/js/catalogo.js actualizado (${catalogo.productos.length} productos)`);

/* Precios oficiales para Supabase: el servidor recalcula cada pedido de mesa con esta tabla.
   Después de cambiar precios, pega supabase/02-precios.sql en el SQL Editor de Supabase. */
const sql = (t) => `'${String(t).replace(/'/g, "''")}'`;
const filas = [];
catalogo.productos.forEach((p) => {
  if (p.variantes) {
    Object.entries(p.variantes).forEach(([v, precio]) => filas.push(`  (${sql(p.id)}, ${sql(v)}, ${sql(p.nombre)}, ${Number(precio)})`));
  } else if (typeof p.precio_pen === 'number') {
    filas.push(`  (${sql(p.id)}, '', ${sql(p.nombre)}, ${p.precio_pen})`);
  }
});
if (typeof catalogo.menu_del_dia.precio_pen === 'number') {
  filas.push(`  ('menu-del-dia', '', 'Menú del día', ${catalogo.menu_del_dia.precio_pen})`);
}
const destinoSql = path.join(__dirname, 'supabase', '02-precios.sql');
fs.mkdirSync(path.dirname(destinoSql), { recursive: true });
fs.writeFileSync(destinoSql, `-- Generado por generar-catalogo.js desde catalogo.json. No editar a mano.
-- Inserta o actualiza cada precio (no borra filas).
insert into public.precios (plato_id, variante, nombre, precio) values
${filas.join(',\n')}
on conflict (plato_id, variante) do update set nombre = excluded.nombre, precio = excluded.precio;
`);
console.log(`supabase/02-precios.sql actualizado (${filas.length} precios)`);
