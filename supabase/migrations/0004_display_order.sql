-- Keep the sheet's display order: groups in a chosen order, spellings in the order they were first seen.
alter table public.groups add column sort_order int not null default 0;
update public.groups set sort_order = case id when 'eden' then 1 when 'sin' then 2 when 'fu' then 3 when 'elts' then 4 when 'storm' then 5 else 99 end;
alter table public.guild_names add column seen_order bigint generated always as identity;
