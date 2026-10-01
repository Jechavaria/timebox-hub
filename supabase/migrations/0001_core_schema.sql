-- TimeBox Hub · Migración 0001 · Esquema relacional, RLS, grants y Realtime.
-- Ejecutar completa en Supabase > SQL Editor. Es idempotente: puede repetirse sin duplicar objetos.

begin;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.master_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '',
  estimated_duration_minutes integer not null default 30
    check (estimated_duration_minutes between 1 and 1440),
  priority_order integer not null default 0,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- master_task_id y area_id quedan en NULL (SET NULL) al borrar la tarea o el ámbito para conservar
-- el historial y las métricas. Una rutina no pertenece a ninguna tarea maestra.
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  master_task_id uuid references public.master_tasks (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text not null default '',
  scheduled_date date not null,
  start_time time,
  planned_duration_minutes integer not null check (planned_duration_minutes between 1 and 1440),
  actual_duration_minutes integer
    check (actual_duration_minutes is null or actual_duration_minutes between 0 and 1440),
  is_completed boolean not null default false,
  is_routine boolean not null default false,
  created_at timestamptz not null default now(),
  constraint schedule_blocks_fits_in_day check (
    start_time is null
    or extract(hour from start_time) * 60 + extract(minute from start_time) + planned_duration_minutes <= 1440
  ),
  constraint schedule_blocks_routine_has_no_task check (not is_routine or master_task_id is null)
);

-- file_url guarda la ruta del objeto en el bucket privado task-attachments, nunca una URL pública.
create table if not exists public.task_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  master_task_id uuid not null references public.master_tasks (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_url text not null unique,
  file_size integer not null check (file_size >= 0),
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists areas_user_position_idx on public.areas (user_id, position);
create index if not exists master_tasks_user_idx on public.master_tasks (user_id);
create index if not exists master_tasks_area_priority_idx on public.master_tasks (area_id, priority_order);
create index if not exists schedule_blocks_user_date_idx on public.schedule_blocks (user_id, scheduled_date);
create index if not exists schedule_blocks_master_task_idx on public.schedule_blocks (master_task_id);
create index if not exists schedule_blocks_area_idx on public.schedule_blocks (area_id);
create index if not exists task_files_user_idx on public.task_files (user_id);
create index if not exists task_files_master_task_idx on public.task_files (master_task_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y modifica sus propias filas
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array['areas', 'master_tasks', 'schedule_blocks', 'task_files']
  loop
    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists %I on public.%I', tbl || '_select_own', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      tbl || '_select_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_insert_own', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      tbl || '_insert_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_update_own', tbl);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      tbl || '_update_own', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_delete_own', tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      tbl || '_delete_own', tbl
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Grants: la Data API exige permisos explícitos además de RLS. Sin acceso para anon.
-- ---------------------------------------------------------------------------

revoke all on public.areas, public.master_tasks, public.schedule_blocks, public.task_files from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.areas, public.master_tasks, public.schedule_blocks, public.task_files
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: REPLICA IDENTITY FULL permite filtrar por user_id también los eventos DELETE
-- ---------------------------------------------------------------------------

alter table public.areas replica identity full;
alter table public.master_tasks replica identity full;
alter table public.schedule_blocks replica identity full;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['areas', 'master_tasks', 'schedule_blocks']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end
$$;

commit;
