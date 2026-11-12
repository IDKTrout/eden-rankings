-- Move the role checks out of the public API (they were callable at /rest/v1/rpc/...).
-- Policies refer to the functions by ID, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_editor() set schema private;
alter function public.is_admin() set schema private;
