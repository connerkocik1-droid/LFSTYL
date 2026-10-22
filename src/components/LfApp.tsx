'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clone } from '@/lib/format';
import { R, catchUp, money, pouchesToday } from '@/lib/logic';
import type { State, Tab } from '@/lib/types';
import { Sheets } from './sheets';
import { Goals, Library, Money, Tasks, Today } from './tabs';
import { Ctx, Lens, LensButton, type LfCtx } from './ui';
import { GoalView, PlanView, ProjectView, ReviewView, SettingsView, SetupView, SubsView, WeanView, WeightView } from './views';

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

/** Slow-drifting color fields. The top two follow the time of day; the lowest one follows budget health. */
export function Background({ dark, health, time, drift }: { dark: boolean; health: 'Healthy' | 'Tight' | 'Over'; time: TimeOfDay; drift: boolean }) {
  const T = { Morning: [55, 205, 235], Afternoon: [90, 195, 215], Evening: [40, 338, 285], Night: [268, 195, 258] };
  const H = { Healthy: 160, Tight: 80, Over: 27 };
  const [a, b, base] = T[time];
  const L = dark ? [0.5, 0.46, 0.52, 0.42] : [0.83, 0.84, 0.85, 0.89];
  const Ch = dark ? [0.17, 0.16, 0.16, 0.13] : [0.12, 0.11, 0.13, 0.08];
  const blob = (i: number, hue: number, size: number, x: number, y: number, dur: number) => {
    const c = (al: number) => `oklch(${L[i]} ${Ch[i]} ${hue} / ${al})`;
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: `radial-gradient(closest-side, ${c(1)}, ${c(0.6)} 42%, ${c(0)})`, transition: 'background 1.2s ease', animation: drift ? `lfDrift${i + 1} ${dur}s ease-in-out infinite alternate` : 'none' }} />;
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: dark ? `linear-gradient(180deg, oklch(0.21 0.04 ${base}), oklch(0.13 0.03 ${base}))` : `linear-gradient(180deg, oklch(0.965 0.012 ${base}), oklch(0.93 0.02 ${base}))` }}>
      {blob(0, a, 520, -170, -150, 26)}
      {blob(3, b + 30, 380, 170, -70, 34)}
      {blob(1, b, 560, 80, 240, 31)}
      {blob(2, H[health], 580, -210, 500, 23)}
      <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(180deg, rgba(0,0,0,${dark ? 0.22 : 0.05}) 0 1px, rgba(0,0,0,0) 1px 3px)` }} />
    </div>
  );
}

const TABS: [Tab, string][] = [['today', 'TODAY'], ['tasks', 'TASKS'], ['money', 'MONEY'], ['goals', 'GOALS'], ['library', 'LIBRARY']];

export default function LfApp({ initial, dark, time, drift, onChange, scrollTo, account, onSignOut, action }: {
  initial: State; dark: boolean; time: TimeOfDay; drift: boolean;
  onChange?: (s: State) => void;
  account?: string;
  onSignOut?: () => void;
  /** Opened from a shortcut link (?do=…): start that action. */
  action?: string | null;
  /** Start scrolled down this far (demo screens). */
  scrollTo?: number;
}) {
  const [s, setS] = useState<State>(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  const m = useMemo(() => money(s), [s]);

  const upd = useCallback((fn: (x: State) => void) => {
    setS((prev) => {
      const x = clone(prev);
      fn(x);
      if (x.toast && !x.toast.id) x.toast.id = Date.now() + Math.random();
      return x;
    });
  }, []);
  const patch = useCallback((fn: (x: State) => Partial<State>) => setS((prev) => ({ ...prev, ...fn(prev) })), []);

  // A new "today" from outside (midnight, app resumed) flows in without touching anything else.
  useEffect(() => {
    if (initial.today !== s.today && initial.today > s.today) {
      upd((x) => { x.today = initial.today; catchUp(x); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.today]);

  useEffect(() => { onChange?.(s); }, [s, onChange]);

  // Shortcut links: ?do=expense | income | task | pouch
  useEffect(() => {
    if (!action) return;
    const blank = { amt: '', cat: null, note: '', y: false };
    if (action === 'expense') upd((x) => { x.sheet = 'expense'; x.draft = blank; });
    if (action === 'income') upd((x) => { x.sheet = 'income'; x.draft = blank; });
    if (action === 'task') upd((x) => R.openStep(x, 'task', 'action'));
    if (action === 'pouch') upd((x) => { R.pouch(x, 1); x.toast = { t: `Pouch logged · ${pouchesToday(x)} today` }; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  // Toasts dismiss themselves.
  const toastId = s.toast?.id;
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => setS((x) => (x.toast && x.toast.id === toastId ? { ...x, toast: null } : x)), 3600);
    return () => clearTimeout(t);
  }, [toastId]);

  // "Left this paycheck" ticks to its new value.
  const [shown, setShown] = useState(m.left);
  const shownRef = useRef(m.left);
  useEffect(() => {
    const from = shownRef.current, to = m.left;
    if (Math.abs(from - to) < 0.004) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650), v = k >= 1 ? to : from + (to - from) * (1 - Math.pow(1 - k, 3));
      shownRef.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [m.left]);

  useEffect(() => {
    if (!scrollTo) return;
    const t = setTimeout(() => { const sc = rootRef.current?.querySelector('[data-scroll]'); if (sc) sc.scrollTop = scrollTo; }, 80);
    return () => clearTimeout(t);
  }, [scrollTo]);

  // Hold ⋮⋮ and drag. A step group (buy step + its action) moves as one, so a buy step never lands below its action.
  const startDrag = useCallback((e: React.PointerEvent, pid: string, i: number) => {
    e.preventDefault(); e.stopPropagation();
    const host = (e.currentTarget as HTMLElement).closest('[data-steps]');
    if (!host) return;
    const els = Array.from(host.querySelectorAll<HTMLElement>('[data-group]'));
    const rects = els.map((el) => el.getBoundingClientRect());
    const scale = rects[i].height / (els[i].offsetHeight || 1) || 1;
    const y0 = e.clientY;
    const calc = (cy: number) => {
      const dyC = cy - y0, c = rects[i].top + rects[i].height / 2 + dyC;
      let to = i;
      rects.forEach((r, k) => { const mid = r.top + r.height / 2; if (k < i && c < mid) to = Math.min(to, k); if (k > i && c > mid) to = Math.max(to, k); });
      return { pid, from: i, to, dy: dyC / scale, h: rects[i].height / scale };
    };
    let last = calc(y0);
    setS((x) => ({ ...x, drag: last }));
    const mv = (ev: PointerEvent) => { last = calc(ev.clientY); setS((x) => ({ ...x, drag: last })); };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      upd((x) => {
        x.drag = null;
        if (last.to !== last.from) { const p = x.projects.find((y) => y.id === pid)!; const [g] = p.groups.splice(last.from, 1); p.groups.splice(last.to, 0, g); }
      });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }, [upd]);

  const onPtr = (e: React.PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    el.style.setProperty('--tx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--ty', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };

  const ctx: LfCtx = { s, m, upd, patch, dark, shown, startDrag, account, signOut: onSignOut };
  const v = s.view;
  const t = s.toast;

  return (
    <Ctx.Provider value={ctx}>
      <div ref={rootRef} className={'lf' + (dark ? '' : ' light')} onPointerMove={onPtr}>
        <Background dark={dark} health={m.health} time={time} drift={drift} />

        {!v && s.tab === 'today' && <Today />}
        {!v && s.tab === 'tasks' && <Tasks />}
        {!v && s.tab === 'money' && <Money />}
        {!v && s.tab === 'goals' && <Goals />}
        {!v && s.tab === 'library' && <Library />}
        {v?.k === 'project' && <ProjectView key={v.id} id={v.id} />}
        {v?.k === 'goal' && <GoalView key={v.id} id={v.id} />}
        {v?.k === 'wean' && <WeanView />}
        {v?.k === 'review' && <ReviewView />}
        {v?.k === 'setup' && <SetupView />}
        {v?.k === 'subs' && <SubsView />}
        {v?.k === 'plan' && <PlanView />}
        {v?.k === 'weight' && <WeightView />}
        {v?.k === 'settings' && <SettingsView />}

        {v?.k !== 'review' && (
          <nav style={{ position: 'absolute', left: 14, right: 14, bottom: 'var(--bb)', height: 62, display: 'flex', gap: 10, zIndex: 20 }}>
            <Lens radius={31} inset={5} innerRadius={26} sheen="bar" style={{ flex: 1 }}>
              <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', alignItems: 'center', padding: '0 6px' }}>
                {TABS.map(([id, label]) => {
                  const on = s.tab === id;
                  return (
                    <button key={id} aria-current={on ? 'page' : undefined} onClick={() => upd((x) => { x.tab = id; x.view = null; x.moff = 0; x.drag = null; })}
                      style={{ width: '100%', height: 48, border: 0, padding: 0, borderRadius: 24, background: on ? 'var(--fill)' : 'none', boxShadow: on ? 'inset 0 0 0 1px var(--line)' : 'none', color: on ? 'var(--ink)' : 'var(--ink2)', font: `${on ? 600 : 500} 9.5px/1 var(--f-mono)`, letterSpacing: '.06em', cursor: 'pointer' }}>{label}</button>
                  );
                })}
              </div>
            </Lens>
            <LensButton size={62} inset={5} label="Quick add" onClick={() => upd((x) => { x.sheet = 'add'; })}>
              <span style={{ position: 'absolute', left: '50%', top: '50%', width: 22, height: 2.5, margin: '-1.25px 0 0 -11px', borderRadius: 2, background: 'var(--ink)' }} />
              <span style={{ position: 'absolute', left: '50%', top: '50%', width: 2.5, height: 22, margin: '-11px 0 0 -1.25px', borderRadius: 2, background: 'var(--ink)' }} />
            </LensButton>
          </nav>
        )}

        {t && (
          <div role="status" style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(var(--bb) + 78px)', zIndex: 35, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <Lens key={t.id} radius={24} inset={4} innerRadius={20} sheen="none" style={{ pointerEvents: 'auto', animation: 'lfPop .4s cubic-bezier(.2,1.3,.3,1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 48, padding: '0 6px 0 18px', fontSize: 13.5, fontWeight: 500 }}>
                <span style={{ paddingRight: 12 }}>{t.t}</span>
                {(t.undo || t.undoTask) && (
                  <button onClick={() => upd((x) => {
                    const tt = x.toast;
                    if (!tt) return;
                    if (tt.undo) x.expenses = x.expenses.filter((e) => e.id !== tt.undo);
                    if (tt.undoTask) { const k = x.tasks.find((y) => y.id === tt.undoTask); if (k) k.done = false; }
                    x.toast = null;
                  })} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>UNDO</button>
                )}
              </div>
            </Lens>
          </div>
        )}

        <Sheets />
      </div>
    </Ctx.Provider>
  );
}

