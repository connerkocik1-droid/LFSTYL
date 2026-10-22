-- LFSTYL keeps each user's app data as one JSON document.
create table if not exists public.lfstyl_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lfstyl_state enable row level security;

create policy "Read own state" on public.lfstyl_state
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Insert own state" on public.lfstyl_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Update own state" on public.lfstyl_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
