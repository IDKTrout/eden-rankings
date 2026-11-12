-- New events are kept off the public site until it has a page layout for them.
alter table public.events add column show_on_site boolean not null default false;
update public.events set show_on_site = true where id in ('abex', 'abex-test', 'rift', 'alna');
-- Only admins may switch an event onto the site (helpers can still add and edit events).
create or replace function private.guard_show_on_site() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if new.show_on_site is distinct from (case when tg_op = 'UPDATE' then old.show_on_site else false end)
     and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an admin can change whether an event is shown on the site.';
  end if;
  return new;
end $$;
create trigger events_guard_show_on_site before insert or update on public.events
  for each row execute function private.guard_show_on_site();
