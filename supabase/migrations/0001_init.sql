-- Event Rankings database: first version.
--
-- Event-agnostic: every ranking row from every event lives in `results`.
-- What a season measures (damage, floor, points) is described by its event.
--
-- Access:
--   * anyone (the public site) can read everything except the editor list and change log;
--   * editors (admins and helpers) can add and fix rows;
--   * only admins can delete rows or manage editors.
-- Every add, fix and delete is recorded in change_log.

-- ---------------------------------------------------------------- reference

create table public.regions (
  region       int primary key,
  first_server int not null,
  last_server  int not null,
  notes        text,
  check (first_server <= last_server)
);

create table public.groups (
  id         text primary key,                 -- 'eden', 'sin', ...
  name       text not null,
  short_name text not null,
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  notes      text
);

-- ---------------------------------------------------------------- guilds and players

create table public.guilds (
  id          text primary key,                -- game guild ID, or g### until it is known
  name        text not null,                   -- current name
  home_server int,
  group_id    text references public.groups (id) on update cascade on delete set null,
  inactive    boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index guilds_group_id_idx on public.guilds (group_id);

-- Every spelling a guild has appeared under in a ranking.
create table public.guild_names (
  name     text primary key,
  guild_id text not null references public.guilds (id) on update cascade on delete cascade,
  notes    text
);
create index guild_names_guild_id_idx on public.guild_names (guild_id);

create table public.players (
  id         text primary key,                 -- game player ID
  name       text not null,                    -- current name
  guild_id   text references public.guilds (id) on update cascade on delete set null,
  inactive   boolean not null default false,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_guild_id_idx on public.players (guild_id);

-- ---------------------------------------------------------------- events and seasons

create table public.events (
  id           text primary key,               -- 'abex', 'abex-test', 'rift', 'alna'
  name         text not null,                  -- 'AbEx', 'Temporal Rift', ...
  ranks        text not null check (ranks in ('guild', 'player')),
  score_label  text not null,                  -- 'Damage (M)', 'Floor', 'Points'
  has_brackets boolean not null default false,
  has_time     boolean not null default false, -- clear / last-attack time
  notes        text
);

create table public.seasons (
  id            text primary key,              -- 'abex-s4'
  event_id      text not null references public.events (id) on update cascade,
  season_number int,
  title         text not null,
  end_date      date,
  sort_order    int not null,                  -- order the seasons happened in
  max_score     numeric,                       -- AbEx max damage, when there is one
  compiled_by   text,
  thanks        text,
  source_url    text,
  notes         text
);
create index seasons_event_id_idx on public.seasons (event_id);

-- ---------------------------------------------------------------- results

create table public.results (
  id            bigint generated always as identity primary key,
  season_id     text not null references public.seasons (id) on update cascade,
  listed_name   text not null,                 -- name exactly as the ranking showed it
  guild_id      text references public.guilds (id) on update cascade,
  player_id     text references public.players (id) on update cascade,
  bracket       int,                           -- Alna bracket
  rank          int,                           -- rank in the ranking (or the bracket)
  score         numeric,                       -- damage in millions, floor, or points
  score_rounded boolean not null default false,-- the game showed a rounded number (13M)
  time_seconds  int,                           -- AbEx clear or last-attack time
  server        int,
  extra         jsonb not null default '{}',   -- event-specific fields (leader, essence, ...)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (guild_id is not null or player_id is not null)
);
create index results_season_id_idx on public.results (season_id);
create index results_guild_id_idx  on public.results (guild_id);
create index results_player_id_idx on public.results (player_id);
create unique index results_rank_unique
  on public.results (season_id, coalesce(bracket, 0), rank) where rank is not null;

-- ---------------------------------------------------------------- editors

create table public.editors (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  role       text not null check (role in ('admin', 'helper')),
  created_at timestamptz not null default now()
);

create or replace function public.is_editor() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.editors where user_id = (select auth.uid())) $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.editors where user_id = (select auth.uid()) and role = 'admin') $$;

revoke execute on function public.is_editor() from public, anon;
revoke execute on function public.is_admin()  from public, anon;
grant  execute on function public.is_editor() to authenticated;
grant  execute on function public.is_admin()  to authenticated;

-- ---------------------------------------------------------------- change log

create table public.change_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  action     text not null,                    -- INSERT, UPDATE, DELETE
  old_row    jsonb,
  new_row    jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index change_log_changed_at_idx on public.change_log (changed_at desc);

create or replace function public.log_change() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  insert into public.change_log (table_name, action, old_row, new_row)
  values (tg_table_name, tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
revoke execute on function public.log_change() from public, anon, authenticated;

create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
  as $$ begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['regions','groups','guilds','guild_names','players','events','seasons','results'] loop
    execute format('create trigger %I_log after insert or update or delete on public.%I for each row execute function public.log_change()', t, t);
  end loop;
  foreach t in array array['guilds','players','results'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security

do $$
declare t text;
begin
  foreach t in array array['regions','groups','guilds','guild_names','players','events','seasons','results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "Editors can add" on public.%I for insert to authenticated with check ((select public.is_editor()))', t);
    execute format('create policy "Editors can fix" on public.%I for update to authenticated using ((select public.is_editor())) with check ((select public.is_editor()))', t);
    execute format('create policy "Admins can delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

alter table public.editors enable row level security;
create policy "Editors see themselves, admins see all" on public.editors
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins add editors" on public.editors
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins change editors" on public.editors
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove editors" on public.editors
  for delete to authenticated using ((select public.is_admin()));

alter table public.change_log enable row level security;
create policy "Editors can read the log" on public.change_log
  for select to authenticated using ((select public.is_editor()));
-- No insert/update/delete policies: only the log_change trigger writes here.
