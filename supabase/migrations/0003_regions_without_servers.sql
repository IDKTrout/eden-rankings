-- A region can be listed before its server range is known (the site counts it as "not filled in yet").
alter table public.regions alter column first_server drop not null, alter column last_server drop not null;
insert into public.regions (region) values (25),(26),(27),(28),(33),(34),(38) on conflict do nothing;
