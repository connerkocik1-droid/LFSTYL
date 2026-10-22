-- Accounts are a first and last name plus a 4-digit PIN; email comes later.
-- The tables are closed to the API. The app only calls the functions below,
-- which check the PIN or a session token before touching anything.

-- 0001's email-based lfstyl_state table is unused from here on.

create table public.lfstyl_accounts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  name_key text not null unique,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.lfstyl_sessions (
  token_hash text primary key,
  account_id uuid not null references public.lfstyl_accounts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.lfstyl_data (
  account_id uuid primary key references public.lfstyl_accounts (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lfstyl_accounts enable row level security;
alter table public.lfstyl_sessions enable row level security;
alter table public.lfstyl_data enable row level security;
revoke all on public.lfstyl_accounts, public.lfstyl_sessions, public.lfstyl_data from anon, authenticated;

create index lfstyl_sessions_account on public.lfstyl_sessions (account_id);

create or replace function public.lfstyl_name_key(first_name text, last_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(trim(first_name), '\s+', ' ', 'g')) || ' ' || lower(regexp_replace(trim(last_name), '\s+', ' ', 'g'))
$$;

create or replace function public.lfstyl_new_session(acct uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.lfstyl_sessions (token_hash, account_id) values (encode(extensions.digest(tok, 'sha256'), 'hex'), acct);
  return tok;
end $$;

create or replace function public.lfstyl_session_account(token text) returns uuid
language sql stable security definer set search_path = '' as $$
  select account_id from public.lfstyl_sessions where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
$$;

-- Returns {ok, token, name} or {ok:false, error}.
create or replace function public.lfstyl_sign_up(first_name text, last_name text, pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid; k text;
begin
  if coalesce(trim(first_name), '') = '' or coalesce(trim(last_name), '') = '' then return jsonb_build_object('ok', false, 'error', 'Enter your first and last name.'); end if;
  if coalesce(pin, '') !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'error', 'Your PIN must be 4 digits.'); end if;
  k := public.lfstyl_name_key(first_name, last_name);
  if exists (select 1 from public.lfstyl_accounts acc where acc.name_key = k) then return jsonb_build_object('ok', false, 'error', 'An account with that name already exists. Sign in instead.'); end if;
  insert into public.lfstyl_accounts (first_name, last_name, name_key, pin_hash)
  values (trim(first_name), trim(last_name), k, extensions.crypt(pin, extensions.gen_salt('bf', 10))) returning id into acct;
  return jsonb_build_object('ok', true, 'token', public.lfstyl_new_session(acct), 'name', trim(first_name) || ' ' || trim(last_name));
end $$;

-- Five wrong PINs lock the account for 15 minutes.
create or replace function public.lfstyl_sign_in(first_name text, last_name text, pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare a public.lfstyl_accounts;
begin
  select * into a from public.lfstyl_accounts acc where acc.name_key = public.lfstyl_name_key(first_name, last_name);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'No account with that name. Check the spelling or create one.'); end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong PINs. Try again in ' || ceil(extract(epoch from a.locked_until - now()) / 60)::int || ' min.');
  end if;
  if a.pin_hash <> extensions.crypt(coalesce(pin, ''), a.pin_hash) then
    update public.lfstyl_accounts acc set failed_attempts = acc.failed_attempts + 1,
      locked_until = case when acc.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where acc.id = a.id;
    return jsonb_build_object('ok', false, 'error', case when a.failed_attempts + 1 >= 5 then 'Too many wrong PINs. Try again in 15 min.' else 'Wrong PIN.' end);
  end if;
  update public.lfstyl_accounts acc set failed_attempts = 0, locked_until = null where acc.id = a.id;
  return jsonb_build_object('ok', true, 'token', public.lfstyl_new_session(a.id), 'name', a.first_name || ' ' || a.last_name);
end $$;

-- Returns {ok, data, updated_at} (data null when nothing is saved yet) or {ok:false} for a bad session.
create or replace function public.lfstyl_load(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare acct uuid := public.lfstyl_session_account(token); d public.lfstyl_data;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  select * into d from public.lfstyl_data where account_id = acct;
  return jsonb_build_object('ok', true, 'data', d.data, 'updated_at', d.updated_at);
end $$;

create or replace function public.lfstyl_save(token text, data jsonb, updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token);
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  insert into public.lfstyl_data as d (account_id, data, updated_at) values (acct, data, updated_at)
  on conflict (account_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end $$;

-- Only the entry points are callable from the app.
revoke execute on function public.lfstyl_new_session(uuid), public.lfstyl_session_account(text), public.lfstyl_name_key(text, text) from public, anon, authenticated;
revoke execute on function public.lfstyl_sign_up(text, text, text), public.lfstyl_sign_in(text, text, text), public.lfstyl_load(text), public.lfstyl_save(text, jsonb, timestamptz) from public;
grant execute on function public.lfstyl_sign_up(text, text, text), public.lfstyl_sign_in(text, text, text), public.lfstyl_load(text), public.lfstyl_save(text, jsonb, timestamptz) to anon, authenticated;
