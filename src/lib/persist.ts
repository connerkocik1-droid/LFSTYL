import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DATA_KEYS } from './seed';
import type { Data, Expense, State } from './types';

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

// ---------------------------------------------------------------- Library files

export interface FileApi {
  put: (id: string, mime: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  get: (id: string) => Promise<{ ok: boolean; mime?: string; body?: string; error?: string }>;
  remove: (id: string) => Promise<void>;
  /** Checks the account PIN again, for the locked Logins folder. */
  checkPin: (pin: string) => Promise<boolean>;
}

export function fileApi(sb: SupabaseClient, sess: Session): FileApi {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, { token: sess.token, ...args });
    if (error) return { ok: false, error: "Can't reach the server. Check your connection." };
    return data as { ok: boolean; error?: string; mime?: string; body?: string };
  };
  return {
    put: (id, mime, body) => call('lfstyl_file_put', { id, mime, body }),
    get: (id) => call('lfstyl_file_get', { id }),
    remove: async (id) => { await call('lfstyl_file_remove', { id }); },
    checkPin: async (pin) => {
      const sp = sess.name.indexOf(' ');
      const r = await signIn(sp > 0 ? sess.name.slice(0, sp) : sess.name, sp > 0 ? sess.name.slice(sp + 1) : '', pin);
      return r.ok;
    },
  };
}

// ---------------------------------------------------------------- Expense archive

export interface ArchiveApi {
  /** Stores old expenses on the server. Saving one twice is harmless. */
  put: (items: Expense[]) => Promise<boolean>;
  /** Every archived expense, newest first. */
  get: () => Promise<Expense[] | null>;
}

export function archiveApi(sb: SupabaseClient, sess: Session): ArchiveApi {
  return {
    put: async (items) => {
      const { data, error } = await sb.rpc('lfstyl_archive_put', { token: sess.token, items: items.slice(0, 2000) });
      return !error && !!(data as { ok: boolean }).ok;
    },
    get: async () => {
      const { data, error } = await sb.rpc('lfstyl_archive_get', { token: sess.token });
      const r = data as { ok: boolean; items?: Expense[] } | null;
      return !error && r && r.ok ? r.items || [] : null;
    },
  };
}

// ---------------------------------------------------------------- Reminders (web push)

export interface PushApi {
  /** 'unsupported' until the app is on the home screen (iPhone) or the browser has no push. */
  status: () => Promise<'on' | 'off' | 'unsupported' | 'blocked'>;
  enable: () => Promise<{ ok: boolean; error?: string }>;
  disable: () => Promise<void>;
  test: () => Promise<{ ok: boolean; error?: string }>;
}

const b64url = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushApi(sb: SupabaseClient, sess: Session): PushApi {
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await sb.functions.invoke('lfstyl-push', { body });
    if (error) return { ok: false, error: "Can't reach the reminder service." } as { ok: boolean; error?: string; key?: string };
    return data as { ok: boolean; error?: string; key?: string };
  };
  const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const reg = () => navigator.serviceWorker.ready;
  return {
    status: async () => {
      if (!supported()) return 'unsupported';
      if (Notification.permission === 'denied') return 'blocked';
      const sub = await (await reg()).pushManager.getSubscription();
      return sub ? 'on' : 'off';
    },
    enable: async () => {
      if (!supported()) return { ok: false, error: 'Add LFSTYL to your Home Screen first, then turn reminders on from there.' };
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, error: 'Notifications are blocked. Allow them for LFSTYL in Settings.' };
      const k = await call({ action: 'key' });
      if (!k.ok || !k.key) return { ok: false, error: k.error || "Can't reach the reminder service." };
      const r = await reg();
      const sub = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64url(k.key) }));
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const s = await call({ action: 'subscribe', token: sess.token, sub: sub.toJSON(), tz });
      return s.ok ? { ok: true } : { ok: false, error: s.error };
    },
    disable: async () => {
      if (!supported()) return;
      const sub = await (await reg()).pushManager.getSubscription();
      if (!sub) return;
      await call({ action: 'unsubscribe', token: sess.token, endpoint: sub.endpoint });
      await sub.unsubscribe();
    },
    test: async () => {
      if (!supported()) return { ok: false, error: 'Reminders are not on.' };
      const sub = await (await reg()).pushManager.getSubscription();
      if (!sub) return { ok: false, error: 'Reminders are not on.' };
      return call({ action: 'test', token: sess.token, endpoint: sub.endpoint });
    },
  };
}
