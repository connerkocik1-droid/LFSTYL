-- Library files (photos, PDFs). Only reachable through the functions below, which check the session token.
create table public.lfstyl_files (
  account_id uuid not null references public.lfstyl_accounts (id) on delete cascade,
  id text not null,
  mime text not null,
  size int not null,
  body bytea not null,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (account_id, id)
);
alter table public.lfstyl_files enable row level security;
revoke all on public.lfstyl_files from anon, authenticated;

-- body is base64. Files are capped at 8 MB.
create or replace function public.lfstyl_file_put(token text, id text, mime text, body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token); b bytea;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  b := decode(body, 'base64');
  if length(b) > 8 * 1024 * 1024 then return jsonb_build_object('ok', false, 'error', 'File is larger than 8 MB.'); end if;
  insert into public.lfstyl_files as f (account_id, id, mime, size, body) values (acct, id, mime, length(b), b)
  on conflict on constraint lfstyl_files_pkey do update set mime = excluded.mime, size = excluded.size, body = excluded.body, removed = false;
  return jsonb_build_object('ok', true, 'size', length(b));
end $$;

create or replace function public.lfstyl_file_get(token text, id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token); f public.lfstyl_files;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  select * into f from public.lfstyl_files x where x.account_id = acct and x.id = id and not x.removed;
  if f.id is null then return jsonb_build_object('ok', false, 'error', 'File not found.'); end if;
  return jsonb_build_object('ok', true, 'mime', f.mime, 'body', encode(f.body, 'base64'));
end $$;

-- Removing wipes the file's contents and marks it removed.
create or replace function public.lfstyl_file_remove(token text, id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token);
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  update public.lfstyl_files x set body = ''::bytea, size = 0, removed = true where x.account_id = acct and x.id = id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.lfstyl_file_put(text, text, text, text), public.lfstyl_file_get(text, text), public.lfstyl_file_remove(text, text) from public;
grant execute on function public.lfstyl_file_put(text, text, text, text), public.lfstyl_file_get(text, text), public.lfstyl_file_remove(text, text) to anon, authenticated;
