'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { localToday } from '@/lib/dates';
import { DEMOS, buildDemo, checkPayday } from '@/lib/logic';
import { loadLocal, loadRemote, loadSession, pickData, saveLocal, saveRemote, saveSession, signIn, signUp, supabase, type Saved, type Session } from '@/lib/persist';
import { emptyData, freshUI } from '@/lib/seed';
import type { State } from '@/lib/types';
import LfApp, { Background, type TimeOfDay } from './LfApp';

const timeOfDay = (): TimeOfDay => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : h >= 17 && h < 21 ? 'Evening' : 'Night';
};

function useMedia(q: string, fallback: boolean) {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    const mq = window.matchMedia(q);
    setV(mq.matches);
    const on = () => setV(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return v;
}

/** Keeps "today" and the time of day current, including after the app comes back from the background. */
function useClock() {
  const [now, setNow] = useState({ today: localToday(), time: timeOfDay() });
  useEffect(() => {
    const tick = () => setNow((p) => { const n = { today: localToday(), time: timeOfDay() }; return n.today === p.today && n.time === p.time ? p : n; });
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

const fromSaved = (v: Saved | null, today: string): State => {
  const s: State = { ...(v ? v.data : emptyData(today)), ...freshUI(today) };
  checkPayday(s);
  return s;
};

type Phase = { k: 'loading' } | { k: 'signin' } | { k: 'ready'; state: State; token: string | null; scope?: string } | { k: 'demo'; state: State; scroll?: number };

export default function Boot() {
  const prefersDark = useMedia('(prefers-color-scheme: dark)', true);
  const reduced = useMedia('(prefers-reduced-motion: reduce)', false);
  const clock = useClock();
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [forced, setForced] = useState<'dark' | 'light' | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const th = q.get('theme');
    if (th === 'dark' || th === 'light') setForced(th);
    const demo = q.get('demo');
    if (demo && (DEMOS as readonly string[]).includes(demo)) {
      setPhase({ k: 'demo', state: buildDemo(demo), scroll: Number(q.get('scroll')) || undefined });
      return;
    }
    const sb = supabase();
    if (!sb) { setPhase({ k: 'ready', state: fromSaved(loadLocal(), localToday()), token: null }); return; }
    const sess = loadSession();
    if (sess) start(sess); else setPhase({ k: 'signin' });
  }, []);

  /** Opens the app for a signed-in account, using whichever copy of the data is newer. */
  const start = async (sess: Session) => {
    const sb = supabase()!, local = loadLocal(sess.name);
    let remote: Saved | null = null;
    try {
      const r = await loadRemote(sb, sess.token);
      if (r === 'signed-out') { saveSession(null); setPhase({ k: 'signin' }); return; }
      remote = r;
    } catch { /* offline: open with what is on the device */ }
    const best = remote && (!local || remote.at >= local.at) ? remote : local;
    setPhase({ k: 'ready', state: fromSaved(best, localToday()), token: sess.token, scope: sess.name });
  };

  // Save on every change: locally right away, to Supabase shortly after.
  const lastJson = useRef('');
  const remoteT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = phase.k === 'ready' ? phase.token : null, scope = phase.k === 'ready' ? phase.scope : undefined;
  const onChange = useCallback((s: State) => {
    const data = pickData(s), json = JSON.stringify(data);
    if (json === lastJson.current) return;
    const first = !lastJson.current;
    lastJson.current = json;
    if (first && loadLocal(scope)) return; // nothing changed yet; keep the stored timestamp
    const v: Saved = { data, at: Date.now() };
    saveLocal(v, scope);
    const sb = supabase();
    if (sb && token) {
      if (remoteT.current) clearTimeout(remoteT.current);
      remoteT.current = setTimeout(() => { saveRemote(sb, token, v).catch(() => {}); }, 800);
    }
  }, [token, scope]);

  const dark = forced ? forced === 'dark' : prefersDark;
  if (phase.k === 'loading') return <div className={'lf' + (dark ? '' : ' light')}><Background dark={dark} health="Healthy" time={clock.time} drift={false} /></div>;
  if (phase.k === 'signin') return <Account dark={dark} time={clock.time} onDone={(sess) => { saveSession(sess); setPhase({ k: 'loading' }); start(sess); }} />;
  if (phase.k === 'demo') return <LfApp initial={phase.state} dark={dark} time={clock.time} drift={!reduced} scrollTo={phase.scroll} />;
  const initial = clock.today > phase.state.today ? { ...phase.state, today: clock.today } : phase.state;
  return <LfApp initial={initial} dark={dark} time={clock.time} drift={!reduced} onChange={onChange} />;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Create an account (first name, last name, 4-digit PIN entered twice) or sign in with name and PIN. */
function Account({ dark, time, onDone }: { dark: boolean; time: TimeOfDay; onDone: (s: Session) => void }) {
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const named = !!first.trim() && !!last.trim();

  const submit = async (p: string) => {
    if (!named) { setErr('Enter your first and last name.'); setPin(''); return; }
    if (mode === 'create' && firstPin == null) { setFirstPin(p); setPin(''); setErr(''); return; }
    if (mode === 'create' && firstPin !== p) { setFirstPin(null); setPin(''); setErr("The PINs didn't match. Choose your PIN again."); return; }
    setBusy(true); setErr('');
    const r = mode === 'create' ? await signUp(first, last, p) : await signIn(first, last, p);
    setBusy(false);
    if (r.ok) { onDone(r.session); return; }
    setErr(r.error); setPin('');
    if (mode === 'create') setFirstPin(null);
  };
  const press = (k: string) => {
    if (busy || !k) return;
    if (k === 'del') { setPin((v) => v.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next); setErr('');
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };
  const switchMode = () => { setMode(mode === 'create' ? 'signin' : 'create'); setPin(''); setFirstPin(null); setErr(''); };
  const pinLabel = mode === 'signin' ? 'PIN' : firstPin == null ? 'CHOOSE A 4-DIGIT PIN' : 'ENTER IT AGAIN';
  const nameField = { height: 54, borderRadius: 16, padding: '0 16px', font: '600 17px/1 var(--f-text)' } as const;

  return (
    <div className={'lf' + (dark ? '' : ' light')}>
      <Background dark={dark} health="Healthy" time={time} drift />
      <div className="boot" style={{ gap: 12 }}>
        <span className="disp up scan" style={{ fontSize: 88, lineHeight: 0.8 }}>LFSTYL</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)', marginBottom: 4 }}>{mode === 'create' ? 'Create your account. Your PIN keeps your data private and lets you sign in on another device.' : 'Welcome back. Sign in with your name and PIN.'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="field" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" autoComplete="given-name" autoCapitalize="words" style={nameField} />
          <input className="field" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" autoComplete="family-name" autoCapitalize="words" style={nameField} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="lbl">{pinLabel}</span>
          <div style={{ display: 'flex', gap: 12 }} aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? 'var(--ink)' : 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--ink3)' }} />)}
          </div>
        </div>
        <span style={{ minHeight: 18, fontSize: 13, fontWeight: 600, color: 'var(--crit)' }}>{busy ? <span style={{ color: 'var(--ink2)', fontWeight: 500 }}>One moment…</span> : err}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {KEYS.map((k, i) => k
            ? <button key={i} className="key" aria-label={k === 'del' ? 'Delete' : k} onClick={() => press(k)}>{k === 'del' ? '⌫' : k}</button>
            : <span key={i} />)}
        </div>
        <button className="back" style={{ alignSelf: 'center', margin: 0 }} onClick={switchMode}>{mode === 'create' ? 'I ALREADY HAVE AN ACCOUNT' : 'CREATE AN ACCOUNT'}</button>
      </div>
    </div>
  );
}
