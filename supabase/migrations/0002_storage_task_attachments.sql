-- TimeBox Hub · Migración 0002 · Bucket privado de adjuntos y aislamiento por usuario.
-- Ejecutar después de 0001_core_schema.sql desde Supabase > SQL Editor.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'task-attachments',
  'task-attachments',
  false,
  52428800,
  null
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = null;

-- Permitir tareas sin estimación de tiempo (0 minutos) en la vista general
alter table public.master_tasks drop constraint if exists master_tasks_estimated_duration_minutes_check;
alter table public.master_tasks add constraint master_tasks_estimated_duration_minutes_check check (estimated_duration_minutes between 0 and 1440);

-- En Supabase, storage.objects ya tiene RLS habilitado por defecto y su propietario es supabase_storage_admin.
-- No se debe ejecutar "alter table storage.objects enable row level security;" porque genera el error 42501.

drop policy if exists "task_attachments_select_own" on storage.objects;
create policy "task_attachments_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "task_attachments_insert_own" on storage.objects;
create policy "task_attachments_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "task_attachments_update_own" on storage.objects;
create policy "task_attachments_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "task_attachments_delete_own" on storage.objects;
create policy "task_attachments_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
