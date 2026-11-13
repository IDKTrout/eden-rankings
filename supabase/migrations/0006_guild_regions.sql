-- Guilds are placed by region only; servers are kept for players (Temporal Rift) only.
--   guilds.home_server  -> guilds.region
--   results.server on guild events (AbEx, Alna) -> results.region
-- Every stored guild server mapped to a region when this ran, so nothing was lost.

alter table public.guilds  add column region int references public.regions (region) on update cascade;
alter table public.results add column region int references public.regions (region) on update cascade;

-- A guild's region: from its home server, else from the server on its newest guild-event result.
update public.guilds g set region = x.region
  from public.regions x
 where g.home_server between x.first_server and x.last_server;

update public.guilds g set region = sub.region
  from (
    select distinct on (r.guild_id) r.guild_id, x.region
      from public.results r
      join public.seasons s on s.id = r.season_id
      join public.events  e on e.id = s.event_id
      join public.regions x on r.server between x.first_server and x.last_server
     where e.ranks = 'guild' and r.guild_id is not null
     order by r.guild_id, s.sort_order desc
  ) sub
 where g.id = sub.guild_id and g.region is null;

-- Guild-event rows: server becomes region.
update public.results r set region = x.region, server = null
  from public.regions x, public.seasons s, public.events e
 where s.id = r.season_id and e.id = s.event_id and e.ranks = 'guild'
   and r.server between x.first_server and x.last_server;

alter table public.guilds drop column home_server;

create index on public.guilds (region);
create index on public.results (region);
