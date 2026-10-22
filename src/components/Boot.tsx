'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { localToday } from '@/lib/dates';
import { DEMOS, buildDemo, checkPayday } from '@/lib/logic';
import { loadLocal, loadRemote, pickData, saveLocal, saveRemote, supabase, type Saved } from '@/lib/persist';
import { freshUI, seedData } from '@/lib/seed';
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
  const s: State = { ...(v ? v.data : seedData()), ...freshUI(today) };
  checkPayday(s);
  return s;
};

type Phase = { k: 'loading' } | { k: 'signin' } | { k: 'ready'; state: State; userId: string | null } | { k: 'demo'; state: State; scroll?: number };

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
    if (!sb) { setPhase({ k: 'ready', state: fromSaved(loadLocal(), localToday()), userId: null }); return; }
    const start = async (session: Session | null) => {
      if (!session) { setPhase({ k: 'signin' }); return; }
      const local = loadLocal(), remote = await loadRemote(sb, session.user.id);
      const best = remote && (!local || remote.at >= local.at) ? remote : local;
      setPhase({ k: 'ready', state: fromSaved(best, localToday()), userId: session.user.id });
    };
    sb.auth.getSession().then(({ data }) => start(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') start(session); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Save on every change: locally right away, to Supabase shortly after.
  const lastJson = useRef('');
  const remoteT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = phase.k === 'ready' ? phase.userId : null;
  const onChange = useCallback((s: State) => {
    const data = pickData(s), json = JSON.stringify(data);
    if (json === lastJson.current) return;
    const first = !lastJson.current;
    lastJson.current = json;
    if (first && loadLocal()) return; // nothing changed yet; keep the stored timestamp
    const v: Saved = { data, at: Date.now() };
    saveLocal(v);
    const sb = supabase();
    if (sb && userId) {
      if (remoteT.current) clearTimeout(remoteT.current);
      remoteT.current = setTimeout(() => { saveRemote(sb, userId, v); }, 800);
    }
  }, [userId]);

  const dark = forced ? forced === 'dark' : prefersDark;
  if (phase.k === 'loading') return <div className={'lf' + (dark ? '' : ' light')}><Background dark={dark} health="Healthy" time={clock.time} drift={false} /></div>;
  if (phase.k === 'signin') return <SignIn dark={dark} time={clock.time} />;
  if (phase.k === 'demo') return <LfApp initial={phase.state} dark={dark} time={clock.time} drift={!reduced} scrollTo={phase.scroll} />;
  const initial = clock.today > phase.state.today ? { ...phase.state, today: clock.today } : phase.state;
  return <LfApp initial={initial} dark={dark} time={clock.time} drift={!reduced} onChange={onChange} />;
}

/** Email code sign-in, shown only when Supabase sync is configured. A code works inside the installed app, where a link would open the browser. */
function SignIn({ dark, time }: { dark: boolean; time: TimeOfDay }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sb = supabase()!;
  const send = async () => {
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };
  const verify = async () => {
    setBusy(true); setErr('');
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(error.message);
  };
  const ok = sent ? code.trim().length >= 6 : /.+@.+\..+/.test(email.trim());
  return (
    <div className={'lf' + (dark ? '' : ' light')}>
      <Background dark={dark} health="Healthy" time={time} drift />
      <div className="boot">
        <span className="disp up scan" style={{ fontSize: 96, lineHeight: 0.8 }}>LFSTYL</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)', marginBottom: 10 }}>{sent ? `Enter the code sent to ${email.trim()}.` : 'Sign in to sync your tasks, money and goals across devices.'}</span>
        {sent
          ? <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 19px/1 var(--f-text)', letterSpacing: '.2em' }} />
          : <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 17px/1 var(--f-text)' }} />}
        {err && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--crit)' }}>{err}</span>}
        <button className={'btn' + (ok && !busy ? '' : ' dim')} disabled={!ok || busy} onClick={sent ? verify : send}>{busy ? 'One moment…' : sent ? 'Sign in' : 'Email me a code'}</button>
        {sent && <button className="back" style={{ alignSelf: 'center', margin: 0 }} onClick={() => { setSent(false); setCode(''); }}>USE A DIFFERENT EMAIL</button>}
      </div>
    </div>
  );
}
