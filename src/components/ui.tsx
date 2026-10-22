'use client';

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { R, type Money } from '@/lib/logic';
import type { FileApi, PushApi } from '@/lib/persist';
import type { State } from '@/lib/types';

export interface LfCtx {
  s: State;
  m: Money;
  /** Apply a change to a copy of the state. */
  upd: (fn: (x: State) => void) => void;
  /** Cheap update for text inputs (no deep copy). */
  patch: (fn: (x: State) => Partial<State>) => void;
  dark: boolean;
  /** "Left this paycheck" as currently shown, while it ticks toward the new value. */
  shown: number;
  startDrag: (e: React.PointerEvent, pid: string, i: number) => void;
  /** The signed-in account's name, when there is one. */
  account?: string;
  signOut?: () => void;
  /** Library file storage for the signed-in account (absent in demo and device-only mode). */
  files?: FileApi;
  /** Reminders for this device (absent without an account). */
  push?: PushApi;
}

export const Ctx = createContext<LfCtx | null>(null);
export const useLf = () => useContext(Ctx)!;

const SHEEN = {
  hero: 'radial-gradient(120% 90% at calc(20% + var(--tx, 0) * 40%) calc(-20% + var(--ty, 0) * 30% + var(--sy, 0) * 1%), rgba(255,255,255,var(--L-sheen)), rgba(255,255,255,0) 58%), var(--L-bg)',
  bar: 'radial-gradient(90% 120% at calc(20% + var(--tx, 0) * 60%) calc(-30% + var(--ty, 0) * 30%), rgba(255,255,255,var(--L-sheen)), rgba(255,255,255,0) 60%), var(--L-bg)',
  round: 'radial-gradient(120% 90% at calc(25% + var(--tx, 0) * 40%) calc(-10% + var(--ty, 0) * 30%), rgba(255,255,255,var(--L-sheen)), rgba(255,255,255,0) 60%), var(--L-bg)',
  none: 'var(--L-bg)',
};

/** Thick glass: a refracting rim, a frosted center, and a highlight that follows the pointer. */
export function Lens({ radius, inset, innerRadius, sheen = 'hero', style, className, onClick, children }: {
  radius: number | string; inset: number; innerRadius: number | string; sheen?: keyof typeof SHEEN;
  style?: CSSProperties; className?: string; onClick?: () => void; children?: ReactNode;
}) {
  return (
    <div className={'lens ' + (className || '')} style={{ borderRadius: radius, ...style }} onClick={onClick}>
      <div className="l-rim" />
      <div className="l-bf" style={{ inset, borderRadius: innerRadius }} />
      <div className="l-sh" style={{ background: SHEEN[sheen] }} />
      <div className="l-body" style={{ height: '100%' }}>{children}</div>
    </div>
  );
}

/** The glass round button used for + and +1. */
export function LensButton({ size, inset, label, onClick, children }: { size: number; inset: number; label: string; onClick: (e: React.MouseEvent) => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="press" style={{ position: 'relative', flex: 'none', width: size, height: size, padding: 0, border: 0, background: 'none', borderRadius: '50%', cursor: 'pointer', color: 'var(--ink)' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backdropFilter: 'var(--L-rim)', WebkitBackdropFilter: 'var(--L-rim)' }} />
      <div style={{ position: 'absolute', inset, borderRadius: '50%', backdropFilter: 'var(--L-bf)', WebkitBackdropFilter: 'var(--L-bf)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'var(--L-sh)', background: SHEEN.round }} />
      {children}
    </button>
  );
}

/** Big scanlined money number: $ 1,234 .56 */
export function Hero({ v, d = 100, sc = 42, style }: { v: { S: string; D: string; C: string }; d?: number; sc?: number; style?: CSSProperties }) {
  return (
    <div className="hero scan" style={style}>
      <span className="s" style={{ fontSize: sc }}>{v.S}</span>
      <span className="d" style={{ fontSize: d }}>{v.D}</span>
      <span className="c" style={{ fontSize: sc }}>{v.C}</span>
    </div>
  );
}

/** Where the paycheck went: bills, spent, goals, left. */
export function MoneyBars({ b, sp, g, l, lgL }: { b: number; sp: number; g: number; l: number; lgL: string }) {
  const n2 = (n: number) => Math.abs(Math.round(n * 100) / 100 % 1) < 0.004 ? Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <div className="bars">
        <div style={{ flex: b, opacity: 0.16 }} />
        <div style={{ flex: sp, opacity: 0.34 }} />
        <div style={{ flex: g, opacity: 0.55 }} />
        <div style={{ flex: Math.max(0, l) }} />
      </div>
      <div className="legend"><span>BILLS {n2(b)}</span><span>SPENT {n2(sp)}</span><span>GOALS {n2(g)}</span><span style={{ color: 'var(--ink)' }}>{lgL}</span></div>
    </>
  );
}

export function Sec({ l, r, style }: { l: ReactNode; r?: ReactNode; style?: CSSProperties }) {
  return <div className="sec lbl" style={style}><span>{l}</span>{r != null && <span>{r}</span>}</div>;
}

export function Check({ done, square, onClick, label }: { done: boolean; square?: boolean; onClick: () => void; label: string }) {
  return (
    <button className="check" onClick={onClick} aria-label={label}>
      {done ? <div className="ring done" style={{ borderRadius: square ? 7 : '50%' }}><div className="tick" /></div> : <div className={'ring' + (square ? ' sq' : '')}>{square ? '$' : null}</div>}
    </button>
  );
}

export function Keypad({ compact }: { compact?: boolean }) {
  const { upd } = useLf();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {keys.map((k) => (
        <button key={k} className="key" style={compact ? { height: 46, fontSize: 24 } : undefined} aria-label={k === 'del' ? 'Delete' : k} onClick={() => upd((x) => R.key(x, k))}>{k === 'del' ? '⌫' : k}</button>
      ))}
    </div>
  );
}

/** On/off switch in the app's style. */
export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ position: 'relative', flex: 'none', width: 52, height: 32, padding: 0, border: 0, borderRadius: 16, background: on ? 'var(--ink)' : 'var(--fill2)', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 26, height: 26, borderRadius: '50%', background: on ? 'var(--inv)' : 'var(--ink)', transition: 'left .25s cubic-bezier(.2,1.3,.4,1)' }} />
    </button>
  );
}
