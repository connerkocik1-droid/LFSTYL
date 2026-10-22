// LFSTYL reminders by web push.
//   key          → the VAPID public key (created on first use, kept in lfstyl_push_config)
//   subscribe    → { token, sub, tz } saves this device's push subscription
//   unsubscribe  → { token, endpoint }
//   test         → { token, endpoint } sends today's summary (or a hello) to this device now
//   run          → { secret } hourly from pg_cron: at 9 AM local time, one summary per device
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function cfg(key: string) {
  const { data } = await sb.from('lfstyl_push_config').select('value').eq('key', key).maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

let vapidReady = '';
async function vapid() {
  if (vapidReady) return vapidReady;
  if (!(await cfg('vapid_public'))) {
    const k = webpush.generateVAPIDKeys();
    await sb.from('lfstyl_push_config').upsert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }], { onConflict: 'key', ignoreDuplicates: true });
  }
  const pub = (await cfg('vapid_public'))!, priv = (await cfg('vapid_private'))!;
  webpush.setVapidDetails('https://lfstyl.vercel.app', pub, priv);
  return (vapidReady = pub);
}

async function account(token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  const { data } = await sb.rpc('lfstyl_session_account', { token });
  return (data as string | null) ?? null;
}

// ---- dates (ISO days, same rules as the app)
const P = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const F = (d: Date) => d.toISOString().slice(0, 10);
const add = (iso: string, n: number) => { const d = P(iso); d.setUTCDate(d.getUTCDate() + n); return F(d); };
const addM = (iso: string, n: number) => { const d = P(iso), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, dim)); return F(d); };
const step = (iso: string, k: string) => {
  if (k === 'weekly') return add(iso, 7);
  if (k === 'biweekly') return add(iso, 14);
  if (k === 'yearly') return addM(iso, 12);
  if (k === 'semimonthly') { const d = P(iso); return d.getUTCDate() < 15 ? iso.slice(0, 8) + '15' : F(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))); }
  return addM(iso, 1);
};
const occursOn = (from: string, k: string, day: string) => { let d = from, n = 0; while (d < day && n < 400) { d = step(d, k); n++; } return d === day; };
const localDay = (tz: string, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const localHour = (tz: string, now = new Date()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// deno-lint-ignore no-explicit-any
type Data = any;

/** Today's reminder lines for one account. */
function summary(d: Data, today: string): string[] {
  const out: string[] = [], tomorrow = add(today, 1);
  const pay = d?.incomes?.[0];
  // Payday (or a paycheck still waiting for its review).
  if (pay && (pay.next <= today || d.payPending)) out.push('Payday · review and allocate your paycheck');
  const bills = (d?.billsDef || []).filter((b: Data) => occursOn(b.due, b.freq, tomorrow));
  if (bills.length) out.push(`Due tomorrow: ${bills.map((b: Data) => `${b.name} ${money(b.amt)}`).join(', ')}`);
  const subs = (d?.subs || []).filter((v: Data) => v.next === tomorrow);
  if (subs.length) out.push(`Charging tomorrow: ${subs.map((v: Data) => `${v.name} ${money(v.amt)}`).join(', ')}`);
  const tasks: { due: string }[] = [
    ...(d?.tasks || []).filter((t: Data) => !t.done && t.due),
    ...(d?.projects || []).flatMap((p: Data) => (p.groups || []).filter((g: Data) => !g.action.done && g.action.due).map((g: Data) => g.action)),
  ];
  const over = tasks.filter((t) => t.due < today).length, due = tasks.filter((t) => t.due === today).length;
  if (over || due) out.push([due && `${due} ${due === 1 ? 'task' : 'tasks'} due today`, over && `${over} overdue`].filter(Boolean).join(' · '));
  const docs = (d?.docs || []).filter((x: Data) => x.expires && [today, add(today, 7), add(today, 30)].includes(x.expires));
  for (const x of docs) out.push(x.expires === today ? `${x.title} expires today` : `${x.title} expires ${x.expires === add(today, 7) ? 'in a week' : 'in 30 days'}`);
  return out;
}

async function send(row: { endpoint: string; sub: unknown }, lines: string[]) {
  const body = JSON.stringify({ title: 'LFSTYL', body: lines.join('\n'), url: '/' });
  try {
    // deno-lint-ignore no-explicit-any
    await webpush.sendNotification(row.sub as any, body, { TTL: 60 * 60 * 6 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await sb.from('lfstyl_push_subs').delete().eq('endpoint', row.endpoint);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let b: Data = {};
  try { b = await req.json(); } catch { /* empty body */ }
  const action = b.action;

  if (action === 'key') return json({ ok: true, key: await vapid() });

  if (action === 'subscribe' || action === 'unsubscribe' || action === 'test') {
    const acct = await account(b.token);
    if (!acct) return json({ ok: false, error: 'Sign in again.' }, 401);
    if (action === 'subscribe') {
      if (!b.sub?.endpoint) return json({ ok: false, error: 'No subscription.' }, 400);
      await sb.from('lfstyl_push_subs').upsert({ endpoint: b.sub.endpoint, account_id: acct, sub: b.sub, tz: typeof b.tz === 'string' ? b.tz : 'UTC' }, { onConflict: 'endpoint' });
      return json({ ok: true });
    }
    if (action === 'unsubscribe') {
      await sb.from('lfstyl_push_subs').delete().eq('endpoint', b.endpoint).eq('account_id', acct);
      return json({ ok: true });
    }
    await vapid();
    const { data: row } = await sb.from('lfstyl_push_subs').select('endpoint, sub, tz').eq('endpoint', b.endpoint).eq('account_id', acct).maybeSingle();
    if (!row) return json({ ok: false, error: 'Reminders are not on for this device.' }, 404);
    const { data: st } = await sb.from('lfstyl_data').select('data').eq('account_id', acct).maybeSingle();
    const lines = summary(st?.data, localDay(row.tz));
    const sent = await send(row, lines.length ? lines : ['Reminders are on. You will get a summary at 9 AM on days with something due.']);
    return json({ ok: sent, lines });
  }

  if (action === 'run') {
    if (!b.secret || b.secret !== (await cfg('cron_secret'))) return json({ ok: false }, 403);
    await vapid();
    const { data: rows } = await sb.from('lfstyl_push_subs').select('endpoint, account_id, sub, tz, last_sent');
    const now = new Date(), cache = new Map<string, Data>();
    let sent = 0, checked = 0;
    for (const r of rows || []) {
      const today = localDay(r.tz, now);
      if (localHour(r.tz, now) !== 9 && !b.force) continue;
      if (r.last_sent === today && !b.force) continue;
      checked++;
      if (!cache.has(r.account_id)) { const { data: st } = await sb.from('lfstyl_data').select('data').eq('account_id', r.account_id).maybeSingle(); cache.set(r.account_id, st?.data); }
      const lines = summary(cache.get(r.account_id), today);
      if (lines.length && (await send(r, lines))) sent++;
      await sb.from('lfstyl_push_subs').update({ last_sent: today }).eq('endpoint', r.endpoint);
    }
    return json({ ok: true, checked, sent });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
});
