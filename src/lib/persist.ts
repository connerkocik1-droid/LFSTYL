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

export function loadLocal(): Saved | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    return v && v.data && v.data.period ? v : null;
  } catch {
    return null;
  }
}

export function saveLocal(v: Saved) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); } catch { /* storage full or blocked: keep running in memory */ }
}

let client: SupabaseClient | null | undefined;

/** Null unless both Supabase env vars are set at build time. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}

export async function loadRemote(sb: SupabaseClient, userId: string): Promise<Saved | null> {
  const { data, error } = await sb.from('lfstyl_state').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return { data: data.data as Data, at: new Date(data.updated_at as string).getTime() };
}

export async function saveRemote(sb: SupabaseClient, userId: string, v: Saved) {
  await sb.from('lfstyl_state').upsert({ user_id: userId, data: v.data, updated_at: new Date(v.at).toISOString() });
}
