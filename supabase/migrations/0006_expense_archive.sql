-- Old expenses move here so the saved data stays small. Only reachable through the functions below.
create table public.lfstyl_expense_archive (
  account_id uuid not null references public.lfstyl_accounts (id) on delete cascade,
  id text not null,
  date date not null,
  item jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (account_id, id)
);
alter table public.lfstyl_expense_archive enable row level security;
revoke all on public.lfstyl_expense_archive from anon, authenticated;

-- items is an array of expenses. Saving one again replaces it, so a retry is harmless.
create or replace function public.lfstyl_archive_put(token text, items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token); n int;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 2000 then return jsonb_build_object('ok', false, 'error', 'Bad archive.'); end if;
  insert into public.lfstyl_expense_archive as a (account_id, id, date, item)
  select acct, x->>'id', (x->>'date')::date, x from jsonb_array_elements(items) x
  where x->>'id' is not null and x->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
  on conflict on constraint lfstyl_expense_archive_pkey do update set item = excluded.item, date = excluded.date;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'saved', n);
end $$;

-- Every archived expense, newest first.
create or replace function public.lfstyl_archive_get(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token);
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'items', coalesce((select jsonb_agg(a.item order by a.date desc, a.id) from public.lfstyl_expense_archive a where a.account_id = acct), '[]'::jsonb));
end $$;

revoke execute on function public.lfstyl_archive_put(text, jsonb), public.lfstyl_archive_get(text) from public;
grant execute on function public.lfstyl_archive_put(text, jsonb), public.lfstyl_archive_get(text) to anon, authenticated;
