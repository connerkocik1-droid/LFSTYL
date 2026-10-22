-- Daily reminders by web push. The lfstyl-push edge function (service role) is the only reader of these tables.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.lfstyl_push_subs (
  endpoint text primary key,
  account_id uuid not null references public.lfstyl_accounts (id) on delete cascade,
  sub jsonb not null,
  tz text not null default 'UTC',
  last_sent date,
  created_at timestamptz not null default now()
);
create index lfstyl_push_subs_account on public.lfstyl_push_subs (account_id);

-- Server-side settings: the VAPID key pair (created by the function on first use) and the cron secret.
create table public.lfstyl_push_config (key text primary key, value text not null);

alter table public.lfstyl_push_subs enable row level security;
alter table public.lfstyl_push_config enable row level security;
revoke all on public.lfstyl_push_subs, public.lfstyl_push_config from anon, authenticated;

insert into public.lfstyl_push_config (key, value) values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- Lets the function resolve a session token to an account (service role only).
grant execute on function public.lfstyl_session_account(text) to service_role;

-- Every hour; the function sends to each device at 9 AM in its own time zone.
select cron.schedule('lfstyl-push-hourly', '0 * * * *', $job$
  select net.http_post(
    url := 'https://pocxcrqwlacfomucrjpy.supabase.co/functions/v1/lfstyl-push',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := jsonb_build_object('action', 'run', 'secret', (select value from public.lfstyl_push_config where key = 'cron_secret'))
  )
$job$);
