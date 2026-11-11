-- ALPAQORI · 04 · Personal autorizado para cocina, caja e inicio del personal.
-- 1) En Supabase > Authentication > Users > Add user, crea la cuenta (correo y contraseña)
--    y marca "Auto Confirm User".
-- 2) Escribe aquí ese mismo correo y ejecuta. Repite por cada trabajador.
insert into public.personal (email, rol) values
  ('correo-del-personal@ejemplo.com', 'personal')
on conflict (email) do nothing;
