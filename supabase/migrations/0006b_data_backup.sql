-- Copies of saved data taken before changes made outside the app. Closed to the public keys.
create table public.lfstyl_data_backup (
  account_id uuid not null references public.lfstyl_accounts (id) on delete cascade,
  taken_at timestamptz not null default now(),
  reason text not null,
  data jsonb not null,
  primary key (account_id, taken_at)
);
alter table public.lfstyl_data_backup enable row level security;
revoke all on public.lfstyl_data_backup from anon, authenticated;
