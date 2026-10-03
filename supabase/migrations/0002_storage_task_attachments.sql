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
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/markdown',
    'text/plain',
    'image/jpeg',
    'image/png',
    'audio/mpeg',
    'audio/mp4'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
