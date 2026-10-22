import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DATA_KEYS } from './seed';
import type { Data, State } from './types';

const LOCAL_KEY = 'lfstyl:v1';

export interface Saved { data: Data; at: number }

export const pickData = (s: State): Data => {
  const out: Partial<Data> = {};
  DATA_KEYS.forEach((k) => { (out as Record<string, unknown>)[k] = s[k]; });
  return out as Data;
};

/** The device copy. With an account, each account gets its own copy. */
const localKey = (scope?: string) => (scope ? LOCAL_KEY + ':' + scope.toLowerCase() : LOCAL_KEY);

export function loadLocal(scope?: string): Saved | null {
  try {
    const raw = localStorage.getItem(localKey(scope));
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    return v && v.data && v.data.period ? v : null;
  } catch {
    return null;
  }
}

export function saveLocal(v: Saved, scope?: string) {
  try { localStorage.setItem(localKey(scope), JSON.stringify(v)); } catch { /* storage full or blocked: keep running in memory */ }
}

let client: SupabaseClient | null | undefined;

// The LFSTYL project. Both values are public (they ship to every browser). The tables are closed to
// them; the app only calls database functions that check a PIN or a session token. Env vars override
// these values, and setting either to "off" keeps data on the device only.
const DEFAULT_URL = 'https://pocxcrqwlacfomucrjpy.supabase.co';
const DEFAULT_KEY = 'sb_publishable_FSs6NU8AMJOt8Frysv1u2A_ULBqL9Pq';

/** Null when sync is turned off. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;
  if (url === 'off' || key === 'off') return (client = null);
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// ---------------------------------------------------------------- Accounts: name + 4-digit PIN

export interface Session { token: string; name: string }
const SESSION_KEY = 'lfstyl:session';

export function loadSession(): Session | null {
  try { const v = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return v && v.token ? v : null; } catch { return null; }
}
export function saveSession(v: Session | null) {
  try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY); } catch { /* blocked storage: stay signed in for this visit only */ }
}

type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

async function auth(fn: 'lfstyl_sign_up' | 'lfstyl_sign_in', first: string, last: string, pin: string): Promise<AuthResult> {
  const sb = supabase()!;
  const { data, error } = await sb.rpc(fn, { first_name: first, last_name: last, pin });
  if (error) return { ok: false, error: "Can't reach the server. Check your connection and try again." };
  const r = data as { ok: boolean; token?: string; name?: string; error?: string };
  return r.ok ? { ok: true, session: { token: r.token!, name: r.name! } } : { ok: false, error: r.error || 'Something went wrong.' };
}
export const signUp = (first: string, last: string, pin: string) => auth('lfstyl_sign_up', first, last, pin);
export const signIn = (first: string, last: string, pin: string) => auth('lfstyl_sign_in', first, last, pin);

/** The saved copy, null when there is none yet, or "signed-out" when the session is no longer valid. Throws when offline. */
export async function loadRemote(sb: SupabaseClient, token: string): Promise<Saved | null | 'signed-out'> {
  const { data, error } = await sb.rpc('lfstyl_load', { token });
  if (error) throw error;
  const r = data as { ok: boolean; data: Data | null; updated_at: string | null };
  if (!r.ok) return 'signed-out';
  return r.data && r.updated_at ? { data: r.data, at: new Date(r.updated_at).getTime() } : null;
}

export type SaveResult = { ok: true; at: number } | { ok: false; conflict: boolean };

/** Saves only on top of the server copy this device last saw (base); refuses if another device saved since. */
export async function saveRemote(sb: SupabaseClient, token: string, v: Saved, base: number | null): Promise<SaveResult> {
  const { data, error } = await sb.rpc('lfstyl_save_v2', { token, data: v.data, updated_at: new Date(v.at).toISOString(), base: base == null ? null : new Date(base).toISOString() });
  if (error) return { ok: false, conflict: false };
  const r = data as { ok: boolean; conflict?: boolean; updated_at?: string };
  return r.ok ? { ok: true, at: new Date(r.updated_at!).getTime() } : { ok: false, conflict: !!r.conflict };
}
