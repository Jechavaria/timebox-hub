-- TimeBox Hub · Migración 0003 · Asegurar todas las columnas del esquema y recargar caché
-- Ejecutar en Supabase > SQL Editor para garantizar que todas las tablas tengan todas sus columnas.

begin;

-- 1. Columnas de schedule_blocks
alter table public.schedule_blocks
  add column if not exists master_task_id uuid references public.master_tasks (id) on delete set null,
  add column if not exists area_id uuid references public.areas (id) on delete set null,
  add column if not exists title text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists scheduled_date date not null default current_date,
  add column if not exists start_time time,
  add column if not exists planned_duration_minutes integer not null default 30,
  add column if not exists actual_duration_minutes integer,
  add column if not exists is_completed boolean not null default false,
  add column if not exists is_routine boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- 2. Columnas de master_tasks
alter table public.master_tasks
  add column if not exists description text not null default '',
  add column if not exists estimated_duration_minutes integer not null default 30,
  add column if not exists priority_order integer not null default 0,
  add column if not exists is_completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- 3. Columnas de areas
alter table public.areas
  add column if not exists color text not null default '#6366f1',
  add column if not exists position integer not null default 0,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- 4. Columnas de task_files
alter table public.task_files
  add column if not exists file_name text not null default '',
  add column if not exists file_url text not null default '',
  add column if not exists file_size integer not null default 0,
  add column if not exists file_type text not null default '',
  add column if not exists uploaded_at timestamptz not null default now();

-- 5. Ajustar restricciones de duración para permitir 0 min (tareas sin estimar)
alter table public.master_tasks drop constraint if exists master_tasks_estimated_duration_minutes_check;
alter table public.master_tasks add constraint master_tasks_estimated_duration_minutes_check check (estimated_duration_minutes between 0 and 1440);

commit;

-- 6. Recargar la memoria caché de PostgREST en Supabase
notify pgrst, 'reload schema';
