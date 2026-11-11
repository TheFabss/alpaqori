-- ALPAQORI · 05 · Pedidos del bot de WhatsApp (delivery y recojo) en cocina y caja.
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- El bot inserta con la clave secreta (service_role) desde su .env; los clientes no pueden usar este origen.

alter table public.pedidos drop constraint if exists pedidos_origen_check;
alter table public.pedidos add constraint pedidos_origen_check
  check (origen in ('qr', 'celular', 'whatsapp'));
