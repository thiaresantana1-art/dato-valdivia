-- Dato Valdivia: políticas de seguridad para Supabase
-- 1) Reemplaza TU_CORREO_ADMIN por el correo exacto de la cuenta administradora creada en Authentication > Users.
-- 2) Ejecuta esta consulta en SQL Editor.
alter table public.lugares enable row level security;

drop policy if exists "Publico puede consultar lugares" on public.lugares;
drop policy if exists "Admin puede insertar lugares" on public.lugares;
drop policy if exists "Admin puede actualizar lugares" on public.lugares;
drop policy if exists "Admin puede eliminar lugares" on public.lugares;

create policy "Publico puede consultar lugares"
on public.lugares for select to anon, authenticated using (true);

create policy "Admin puede insertar lugares"
on public.lugares for insert to authenticated
with check ((auth.jwt() ->> 'email') = 'TU_CORREO_ADMIN');

create policy "Admin puede actualizar lugares"
on public.lugares for update to authenticated
using ((auth.jwt() ->> 'email') = 'TU_CORREO_ADMIN')
with check ((auth.jwt() ->> 'email') = 'TU_CORREO_ADMIN');

create policy "Admin puede eliminar lugares"
on public.lugares for delete to authenticated
using ((auth.jwt() ->> 'email') = 'TU_CORREO_ADMIN');
