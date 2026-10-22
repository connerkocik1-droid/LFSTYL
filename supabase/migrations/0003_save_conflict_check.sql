-- Saves only when the client built on the latest copy: base is the server version the client last saw.
-- Returns {ok:true, updated_at} or {ok:false, conflict:true, updated_at} when another device saved first.
-- lfstyl_save (0002) stays for older clients.
create or replace function public.lfstyl_save_v2(token text, data jsonb, updated_at timestamptz, base timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare acct uuid := public.lfstyl_session_account(token); cur timestamptz;
begin
  if acct is null then return jsonb_build_object('ok', false); end if;
  select d.updated_at into cur from public.lfstyl_data d where d.account_id = acct for update;
  if found and (base is null or cur > base) then
    return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur);
  end if;
  insert into public.lfstyl_data as d (account_id, data, updated_at) values (acct, data, updated_at)
  on conflict (account_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'updated_at', updated_at);
end $$;

revoke execute on function public.lfstyl_save_v2(text, jsonb, timestamptz, timestamptz) from public;
grant execute on function public.lfstyl_save_v2(text, jsonb, timestamptz, timestamptz) to anon, authenticated;
