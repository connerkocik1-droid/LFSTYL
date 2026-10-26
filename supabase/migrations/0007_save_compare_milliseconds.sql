-- The app keeps save times to the millisecond. Compare at that precision so a time written with
-- microseconds (e.g. now() from SQL) doesn't look newer than the copy the app loaded, which made
-- every save from the app look like a conflict.
create or replace function public.lfstyl_save_v2(token text, data jsonb, updated_at timestamptz, base timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token); cur timestamptz;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  select d.updated_at into cur from public.lfstyl_data d where d.account_id = acct for update;
  if found and (base is null or date_trunc('milliseconds', cur) > date_trunc('milliseconds', base)) then
    return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur);
  end if;
  insert into public.lfstyl_data as d (account_id, data, updated_at) values (acct, data, date_trunc('milliseconds', updated_at))
  on conflict (account_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'updated_at', date_trunc('milliseconds', updated_at));
end $$;

update public.lfstyl_data set updated_at = date_trunc('milliseconds', updated_at) where updated_at <> date_trunc('milliseconds', updated_at);
