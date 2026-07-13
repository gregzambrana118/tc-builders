-- ============================================================
-- BuildBoard — Supabase schema
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor)
--
-- >>> BEFORE RUNNING: change the team code on the line marked
-- >>> "CHANGE ME" near the bottom. Anyone with this code + the
-- >>> app URL can create an account on your team.
-- ============================================================

-- ---------- tables ------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'member' check (role in ('admin','lead','member')),
  color int not null default 0,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  team_code text not null
);

create table public.role_permissions (
  role text not null check (role in ('lead','member')),
  perm text not null,
  allowed boolean not null default false,
  primary key (role, perm)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Not Started',
  location text not null default '',
  lead uuid references public.profiles(id) on delete set null,
  start_date date,
  target_date date,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_id uuid references public.projects(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'To Do',
  priority text not null default 'Medium',
  due_date date,
  notes text not null default '',
  depends_on uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.cost_sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references public.projects(id) on delete set null,
  categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  summary text not null,
  project_id uuid,
  created_at timestamptz not null default now()
);

create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- helper functions ---------------------------------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce(public.my_role() = 'admin', false)
      or coalesce((select allowed from public.role_permissions
                   where role = public.my_role() and perm = p), false)
$$;

-- ---------- new-user handling (team code + first admin) ------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  cnt int;
  code text;
begin
  select team_code into code from public.app_settings where id = 1;
  if coalesce(new.raw_user_meta_data->>'team_code','') is distinct from code then
    raise exception 'Invalid team code';
  end if;
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, name, role, color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email,'@',1)),
    case when cnt = 0 then 'admin' else 'member' end,
    cnt % 8
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- guard triggers ------------------------------------

-- Only team managers may change someone's role.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if new.role is distinct from old.role and not public.has_perm('team.manage') then
    raise exception 'Not allowed to change roles';
  end if;
  return new;
end
$$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Members editing their own task may only change status and notes.
create or replace function public.guard_task_update()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if not public.has_perm('tasks.editAny') then
    if new.title       is distinct from old.title
    or new.project_id  is distinct from old.project_id
    or new.assignee_id is distinct from old.assignee_id
    or new.priority    is distinct from old.priority
    or new.due_date    is distinct from old.due_date
    or new.depends_on  is distinct from old.depends_on then
      raise exception 'You can only update status and notes on your assigned task';
    end if;
  end if;
  return new;
end
$$;
create trigger guard_task_update before update on public.tasks
  for each row execute function public.guard_task_update();

-- keep cost_sheets.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger touch_cost_sheets before update on public.cost_sheets
  for each row execute function public.touch_updated_at();

-- ---------- row level security --------------------------------

alter table public.profiles         enable row level security;
alter table public.app_settings     enable row level security;
alter table public.role_permissions enable row level security;
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.cost_sheets      enable row level security;
alter table public.activity         enable row level security;
alter table public.task_photos      enable row level security;

-- profiles
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('team.manage'))
  with check (id = auth.uid() or public.has_perm('team.manage'));
create policy "profiles delete" on public.profiles for delete to authenticated
  using (public.has_perm('team.manage') and id <> auth.uid());

-- app_settings (admins can read the team code to share it)
create policy "settings read" on public.app_settings for select to authenticated
  using (public.my_role() = 'admin');
create policy "settings update" on public.app_settings for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- role_permissions
create policy "perms read"  on public.role_permissions for select to authenticated using (true);
create policy "perms write" on public.role_permissions for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- projects
create policy "projects read"   on public.projects for select to authenticated using (true);
create policy "projects insert" on public.projects for insert to authenticated
  with check (public.has_perm('projects.create'));
create policy "projects update" on public.projects for update to authenticated
  using (public.has_perm('projects.editAny') or lead = auth.uid());
create policy "projects delete" on public.projects for delete to authenticated
  using (public.has_perm('projects.delete'));

-- tasks
create policy "tasks read"   on public.tasks for select to authenticated using (true);
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (public.has_perm('tasks.create'));
create policy "tasks update" on public.tasks for update to authenticated
  using (public.has_perm('tasks.editAny') or assignee_id = auth.uid());
create policy "tasks delete" on public.tasks for delete to authenticated
  using (public.has_perm('tasks.editAny'));

-- cost sheets
create policy "sheets read"  on public.cost_sheets for select to authenticated using (true);
create policy "sheets write" on public.cost_sheets for all to authenticated
  using (public.has_perm('costs.manage')) with check (public.has_perm('costs.manage'));

-- activity
create policy "activity read"   on public.activity for select to authenticated using (true);
create policy "activity insert" on public.activity for insert to authenticated
  with check (actor = auth.uid());

-- task photos (metadata)
create policy "photos read"   on public.task_photos for select to authenticated using (true);
create policy "photos insert" on public.task_photos for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.tasks t
                where t.id = task_id
                  and (public.has_perm('tasks.editAny') or t.assignee_id = auth.uid()))
  );
create policy "photos delete" on public.task_photos for delete to authenticated
  using (uploaded_by = auth.uid() or public.has_perm('tasks.editAny'));

-- ---------- storage bucket for task photos --------------------

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

create policy "task photos read" on storage.objects for select
  using (bucket_id = 'task-photos');
create policy "task photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos');
create policy "task photos remove" on storage.objects for delete to authenticated
  using (bucket_id = 'task-photos' and owner = auth.uid());

-- ---------- realtime -------------------------------------------

alter publication supabase_realtime add table
  public.profiles, public.role_permissions, public.projects,
  public.tasks, public.cost_sheets, public.activity, public.task_photos;

-- ---------- seed data -------------------------------------------

-- >>> CHANGE ME: pick your own team code and share it only with your crew.
insert into public.app_settings (id, team_code) values (1, 'MHZ-Builders-2026');

insert into public.role_permissions (role, perm, allowed) values
  ('lead',   'projects.create', true),
  ('lead',   'projects.editAny', true),
  ('lead',   'projects.delete', false),
  ('lead',   'tasks.create', true),
  ('lead',   'tasks.editAny', true),
  ('lead',   'costs.manage', true),
  ('lead',   'team.manage', false),
  ('member', 'projects.create', false),
  ('member', 'projects.editAny', false),
  ('member', 'projects.delete', false),
  ('member', 'tasks.create', false),
  ('member', 'tasks.editAny', false),
  ('member', 'costs.manage', false),
  ('member', 'team.manage', false);
