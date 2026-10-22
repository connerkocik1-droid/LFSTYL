'use client';

import * as D from '@/lib/dates';
import { r2, sg, split, sum, u0, usd } from '@/lib/format';
import { CATN, R, TIER, gi, nextP, phaseInfo, pouchesToday, rvUn } from '@/lib/logic';
import type { View } from '@/lib/types';
import { BillList, Pips, PouchNum, scrollProps, useDays14 } from './tabs';
import { Check, Hero, Lens, Sec, useLf } from './ui';

const U = (t: string) => t.toUpperCase();

function Back() {
  const { s, upd } = useLf();
  const from = s.view && s.view.from;
  const label = '← ' + (from ? ({ goal: 'GOAL', project: 'PROJECT', review: 'REVIEW' } as Record<string, string>)[from.k] || 'BACK' : U(s.tab));
  return <button className="back" onClick={() => upd((x) => { x.view = x.view && x.view.from ? x.view.from : null; x.drag = null; })}>{label}</button>;
}

const stepBtn = { width: 44, height: 44, border: 0, borderRadius: 14, background: 'var(--fill)', color: 'var(--ink)', font: '500 18px/1 var(--f-mono)', cursor: 'pointer' } as const;

// ---------------------------------------------------------------- Project

export function ProjectView({ id }: { id: string }) {
  const { s, upd, startDrag } = useLf();
  const p = s.projects.find((x) => x.id === id);
  if (!p) return null;
  const goal = p.goal ? s.goals.find((g) => g.id === p.goal) || null : null;
  const d = s.drag && s.drag.pid === p.id ? s.drag : null;
  const n = sum(p.groups, (g) => 1 + (g.buy ? 1 : 0)), dn = sum(p.groups, (g) => (g.action.done ? 1 : 0) + (g.buy && g.buy.done ? 1 : 0));
  const total = r2(sum(p.groups, (g) => (g.buy ? (g.buy.done ? g.buy.actual! : g.buy.est) : 0))), paidT = r2(sum(p.groups, (g) => (g.buy && g.buy.done ? g.buy.actual! : 0)));
  const canBuy = p.groups.some((g) => !g.buy && !g.action.done);
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head">
        <div className="t">{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12.5, color: 'var(--ink2)' }}><span className="tdot" style={{ background: TIER[p.tier][1] }} /><span>{TIER[p.tier][0]}</span><span style={{ color: 'var(--ink3)' }}>·</span><span>{dn} of {n} steps done</span></div>
      </div>
      <div className="pane mx" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="lbl">TOTAL COST</span><span className="disp scan" style={{ fontSize: 52, lineHeight: 0.8 }}>{usd(total)}</span></div>
          <span style={{ font: '500 9.5px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)', textAlign: 'right' }}>{usd(paidT)} PAID · {usd(r2(total - paidT))} EST</span>
        </div>
        <div className="track"><div style={{ width: `${n ? (dn / n) * 100 : 0}%`, transition: 'width .4s' }} /></div>
        {goal ? (
          <button className="btn-fill" onClick={() => upd((x) => { x.view = { k: 'goal', id: goal.id, from: x.view }; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, padding: '0 14px', borderRadius: 14, font: '500 13.5px/1 var(--f-text)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="dia" /><span>Paid from {goal.name}</span></span>
            <span style={{ font: '500 10px/1 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink2)' }}>{usd(gi(s, goal).rem)} left →</span>
          </button>
        ) : <div style={{ fontSize: 13, color: 'var(--ink2)' }}>Not linked to a goal. Buy steps come out of this paycheck&apos;s budget.</div>}
      </div>
      <Sec l="STEPS" r="HOLD ⋮⋮ TO REORDER" />
      <div data-steps="1" className="pane mx" style={{ position: 'relative', padding: '4px 0' }}>
        {p.groups.map((g, i) => {
          let ty = 0;
          if (d) { if (i === d.from) ty = d.dy; else if (d.from < d.to && i > d.from && i <= d.to) ty = -d.h; else if (d.from > d.to && i >= d.to && i < d.from) ty = d.h; }
          const lifted = !!d && i === d.from, b = g.buy, a = g.action;
          const src = goal ? U(goal.name) : b && b.cat ? U(CATN[b.cat]) : 'ASKS AT CHECK-OFF';
          return (
            <div key={g.id} data-group="1" style={{ position: 'relative', borderRadius: 16, transform: `translateY(${r2(ty)}px) scale(${lifted ? 1.02 : 1})`, transition: d && !lifted ? 'transform .22s cubic-bezier(.2,.8,.3,1)' : 'none', zIndex: lifted ? 5 : 1, background: lifted ? 'var(--S-bg)' : 'transparent', backdropFilter: lifted ? 'var(--S-bf)' : 'none', WebkitBackdropFilter: lifted ? 'var(--S-bf)' : 'none', boxShadow: lifted ? 'var(--drag-sh)' : 'none' }}>
              {i > 0 && <div className="sep sep52" />}
              {b && (
                <>
                  <div className="link" />
                  <div className="row">
                    <Check done={b.done} square onClick={() => upd((x) => (b.done ? R.unbuy(x, p.id, g.id) : R.openPrice(x, p.id, g.id)))} label="Mark bought" />
                    <div style={{ minWidth: 0 }}>
                      <div className="title" style={{ textDecoration: b.done ? 'line-through' : 'none', color: b.done ? 'var(--ink3)' : 'var(--ink)' }}>{b.title}</div>
                      <div style={{ marginTop: 5, font: '500 9.5px/1.2 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{(b.done ? 'BOUGHT · FROM ' : 'BUY · FROM ') + src}</div>
                    </div>
                    <div style={{ textAlign: 'right', paddingRight: 30 }}>
                      <div style={{ fontSize: 15, lineHeight: 1, fontWeight: 600 }}>{usd(b.done ? b.actual! : b.est)}</div>
                      <div className="cap8" style={{ marginTop: 4 }}>{b.done ? 'PAID' : 'EST'}</div>
                    </div>
                  </div>
                </>
              )}
              <div className="row">
                <Check done={a.done} onClick={() => upd((x) => R.toggleAction(x, p.id, g.id))} label="Mark done" />
                <div style={{ minWidth: 0 }}>
                  <div className="title" style={{ textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--ink3)' : 'var(--ink)' }}>{a.title}</div>
                  <div style={{ marginTop: 5, font: '500 9.5px/1.2 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{a.done ? 'DONE' : a.due ? 'DUE ' + U(D.wdm(a.due)) : 'NO DATE'}</div>
                </div>
                <button onPointerDown={(e) => startDrag(e, p.id, i)} aria-label="Drag to reorder" style={{ width: 44, height: 44, margin: '-11px -12px -11px 0', padding: 0, border: 0, background: 'none', cursor: 'grab', touchAction: 'none', display: 'grid', placeItems: 'center' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 4px)', gap: 3 }}>{Array.from({ length: 6 }, (_, k) => <span key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ink3)' }} />)}</div>
                </button>
              </div>
            </div>
          );
        })}
        {!p.groups.length && <div style={{ padding: '22px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No steps yet. Add an action, then attach what you need to buy for it.</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 14px 0' }}>
        <button className="btn-fill" onClick={() => upd((x) => R.openStep(x, 'project', 'action'))} style={{ height: 50, borderRadius: 16, font: '600 14px/1 var(--f-text)' }}>+ Action</button>
        <button className="btn-fill" onClick={() => canBuy && upd((x) => R.openStep(x, 'project', 'buy'))} style={{ height: 50, borderRadius: 16, font: '600 14px/1 var(--f-text)', opacity: canBuy ? 1 : 0.4 }}>+ Buy step</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Goal

export function GoalView({ id }: { id: string }) {
  const { s, upd } = useLf();
  const g = s.goals.find((x) => x.id === id);
  if (!g) return null;
  const info = gi(s, g), proj = g.kind === 'proj' ? s.projects.find((p) => p.goal === g.id) : null;
  const hl: [string, number, string?][] = g.kind === 'proj' ? s.expenses.filter((e) => e.goal === g.id).map((e) => [e.date, -e.amt, e.note + (e.proj ? ' · ' + e.proj : '')]) : g.hist;
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">{g.name}</div><div className="cap8" style={{ marginTop: 10 }}>{g.kind === 'proj' ? 'PROJECT BUDGET · PURCHASES COUNT' : g.event ? 'TRIP BUDGET · CONTRIBUTIONS COUNT' : 'SAVINGS · CONTRIBUTIONS COUNT'}</div></div>
      <Lens radius={30} inset={6} innerRadius={24} className="mx">
        <div style={{ padding: '17px 20px 18px' }}>
          <div className="lbl">{g.kind === 'proj' ? 'LEFT TO SPEND' : 'REMAINING'}</div>
          <Hero v={split(info.rem)} style={{ marginTop: 12 }} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink2)' }}>of {usd(g.target)} · {Math.round(info.pct)}%</div>
          <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: 'var(--fill2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${info.pct}%`, borderRadius: 3, background: 'var(--ink)' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            {[['PER PAYCHECK', g.per ? usd(g.per, 0) : '—'], [g.kind === 'proj' ? 'SPENT' : 'SAVED', u0(info.have)], ['STATUS', g.status === 'done' ? 'DONE' : info.rem <= 0 ? 'REACHED' : 'ACTIVE']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ font: '500 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{l}</span><span style={{ font: '600 16px/1 var(--f-text)' }}>{v}</span></div>
            ))}
          </div>
        </div>
      </Lens>
      {proj && (
        <button className="pane" onClick={() => upd((x) => { x.view = { k: 'project', id: proj.id, from: x.view }; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'calc(100% - 28px)', margin: '12px 14px 0', minHeight: 56, padding: '0 16px 0 18px', border: 0, color: 'var(--ink)', cursor: 'pointer' }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}><span className="cap8">LINKED PROJECT</span><span style={{ font: '500 15px/1 var(--f-text)' }}>{proj.name}</span></span>
          <span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink2)' }}>→</span>
        </button>
      )}
      <Sec l="HISTORY" r={hl.length} />
      <div className="pane list">
        {hl.map(([d, a, l], i) => (
          <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 16px 8px 18px' }}>
            {i > 0 && <div className="sep" />}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={{ fontSize: 14.5, fontWeight: 500 }}>{l || 'Paycheck contribution'}</span><span className="cap">{U(D.dm(d))}</span></span>
            <span style={{ font: '600 15px/1 var(--f-text)', flex: 'none' }}>{(a < 0 ? '−' : '+') + usd(Math.abs(a))}</span>
          </div>
        ))}
        {!hl.length && <div style={{ padding: '20px 18px', fontSize: 14, color: 'var(--ink2)' }}>Nothing yet.</div>}
      </div>
      {g.status !== 'done' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '22px 14px 0' }}>
          <button className="btn-fill" onClick={() => upd((x) => R.closeGoal(x, g.id))} style={{ width: '100%', height: 52, borderRadius: 16, font: '600 15px/1 var(--f-text)' }}>Close goal</button>
          <span className="cap8">{g.per ? `FREES ${usd(g.per, 0)} A PAYCHECK` : 'NO PAYCHECK CONTRIBUTION TO FREE'}</span>
        </div>
      ) : <div style={{ margin: '22px 22px 0', font: '500 10px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink2)' }}>COMPLETED · {g.doneTo}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Wean-off

export function WeanView() {
  const { s, upd } = useLf();
  const pi = phaseInfo(s), lim = pi.limit, pn = pouchesToday(s), pOver = pn > lim, days = useDays14();
  const past = days.slice(0, 13);
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Wean-off</div><div className="cap8" style={{ marginTop: 10 }}>NICOTINE · PHASE {pi.idx + 1} OF {pi.n} · ENDS {U(D.dm(pi.ph.end))}</div></div>
      <Lens radius={30} inset={6} innerRadius={24} className="mx">
        <div style={{ padding: '17px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between' }}><span>TODAY · {pi.mg}</span><span>{pOver ? `${pn - lim} OVER` : `${lim - pn} LEFT TODAY`}</span></div>
          <div className="disp" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 0.8, overflow: 'hidden' }}><span style={{ fontSize: 132 }}><PouchNum n={pn} over={pOver} /></span><span style={{ fontSize: 56, color: 'var(--ink3)', marginLeft: 4 }}>/{lim}</span></div>
          <Pips n={pn} lim={lim} w={40} h={6} gap={4} />
          {pOver && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--crit)' }}>Over today&apos;s limit. Logged anyway.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
            <button className="btn-fill" aria-label="Remove one pouch" onClick={() => upd((x) => R.pouch(x, -1))} style={{ height: 56, borderRadius: 18, font: '700 24px/1 var(--f-disp)' }}>−1</button>
            <button className="btn" onClick={() => upd((x) => R.pouch(x, 1))} style={{ height: 56, font: '800 24px/1 var(--f-disp)', textTransform: 'uppercase' }}>+1 pouch</button>
          </div>
        </div>
      </Lens>
      <Sec l="LAST 14 DAYS" r={`${past.filter((d) => d.t <= d.l).length} OF 13 DAYS AT OR UNDER`} />
      <div className="pane mx" style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {days.map((d) => (
            <div key={d.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <div style={{ position: 'relative', width: '100%', height: 84, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ position: 'absolute', left: -2, right: -2, bottom: (d.l / 10) * 84, height: 1.5, background: 'var(--ink3)' }} />
                <div style={{ width: '100%', height: Math.min(84, (d.t / 10) * 84), borderRadius: 3, background: d.over ? 'var(--crit)' : 'var(--ink)', opacity: d.over || d.today ? 1 : 0.45 }} />
              </div>
              <span style={{ font: '500 9px/1 var(--f-mono)', color: 'var(--ink3)' }}>{d.lbl}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>LINE = THAT DAY&apos;S LIMIT · RED = OVER</div>
      </div>
      <div className="lbl" style={{ padding: '0 22px', margin: '24px 0 10px' }}>PLAN</div>
      <div className="pane mx" style={{ padding: '4px 0' }}>
        {s.phases.map((ph, i) => {
          const st = i < pi.idx ? 'past' : i === pi.idx ? 'cur' : 'fut';
          const sameM = ph.start.slice(0, 7) === ph.end.slice(0, 7);
          return (
            <div key={ph.start} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', columnGap: 14, alignItems: 'center', minHeight: 62, padding: '10px 16px 10px 18px' }}>
              {i < s.phases.length - 1 && <div style={{ position: 'absolute', left: 25, top: 39, width: 2, height: 46, background: 'var(--line)' }} />}
              <div style={{ position: 'relative', width: 16, height: 16, borderRadius: '50%', ...(st === 'past' ? { background: 'var(--ink3)' } : st === 'cur' ? { background: 'var(--ink)', boxShadow: '0 0 0 4px var(--fill2)' } : { boxShadow: 'inset 0 0 0 1.5px var(--ink3)' }) }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="cap8">PHASE {i + 1}</span><span style={{ fontSize: 15, fontWeight: 500 }}>{(sameM ? D.dayOfMonth(ph.start) : D.dm(ph.start)) + ' – ' + D.dm(ph.end)}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span style={{ font: '600 15px/1 var(--f-text)' }}>{ph.limit} / day</span><span className="cap8">{ph.mg}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Paycheck review

export function ReviewView() {
  const { s, m, upd } = useLf();
  if (!s.rv) return null;
  const n = nextP(s), un = rvUn(s), ps = split(n.pay), rv = s.rv;
  return (
    <>
      <div className="screen push" {...scrollProps} style={{ paddingBottom: 'calc(var(--bb) + 106px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px 0 10px' }}>
          <button className="back" style={{ margin: 0 }} onClick={() => upd((x) => { x.view = null; x.rv = null; })}>× LATER</button>
          <span className="lbl">PAYCHECK REVIEW</span>
        </div>
        <div style={{ padding: '8px 22px 18px' }}>
          <div className="lbl" style={{ color: 'var(--ink3)' }}>{n.range}</div>
          <Hero v={{ S: '$', D: ps.D, C: ps.C }} d={96} sc={40} style={{ marginTop: 14 }} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink2)' }}>{n.srcName + (n.extras.length ? ' + ' + n.extras.map((e) => e.n).join(' + ') : '') + ' · prefilled from last period'}</div>
        </div>
        <div className="sec lbl" style={{ margin: '6px 0 10px' }}>
          <span>TAKEN OFF THE TOP · {usd(sum(n.bills, (b) => b.a))}</span>
          <button onClick={() => upd((x) => { x.view = { k: 'setup', from: x.view as View }; })} style={{ height: 44, margin: '-17px -12px -17px 0', padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>EDIT</button>
        </div>
        <BillList bills={n.bills} h={48} />
        <div style={{ padding: '10px 22px 0', font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>BILL CHANGES APPLY FROM THE NEXT PAYCHECK</div>
        <Sec l="CATEGORIES" r="± $10" style={{ marginTop: 22 }} />
        <div className="pane list">
          {m.cats.map((c, i) => (
            <div key={c.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 64, padding: '8px 10px 8px 18px' }}>
              {i > 0 && <div className="sep" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</span>
                <span className="cap" style={c.left < -0.004 ? { fontWeight: 600, color: 'var(--crit)' } : undefined}>{sg(c.left)} {c.left < 0 ? 'CARRIED OVER' : 'ROLLS OVER'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
                <button aria-label="Less" style={stepBtn} onClick={() => upd((x) => R.rvStep(x, 'cats', c.id, -10))}>−</button>
                <span style={{ minWidth: 62, textAlign: 'center', font: '600 16px/1 var(--f-text)' }}>{usd(rv.cats[c.id] || 0, 0)}</span>
                <button aria-label="More" style={stepBtn} onClick={() => upd((x) => R.rvStep(x, 'cats', c.id, 10))}>+</button>
              </div>
            </div>
          ))}
        </div>
        <Sec l="GOALS" r="± $5" style={{ marginTop: 22 }} />
        <div className="pane list">
          {Object.keys(rv.goals).map((id, i) => {
            const g = s.goals.find((x) => x.id === id)!, a = rv.goals[id], rem = g.kind === 'save' ? r2(g.target - g.saved) : null;
            return (
              <div key={id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 64, padding: '8px 10px 8px 18px' }}>
                {i > 0 && <div className="sep" />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 500 }}><span className="dia" />{g.name}</span>
                  <span className="cap">{rem == null ? 'FROM A FINISHED GOAL' : a >= rem - 0.004 ? 'FINAL · COMPLETES THE GOAL' : `${usd(rem - a, 0)} TO GO AFTER`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
                  <button aria-label="Less" style={stepBtn} onClick={() => upd((x) => R.rvStep(x, 'goals', id, -5))}>−</button>
                  <span style={{ minWidth: 62, textAlign: 'center', font: '600 16px/1 var(--f-text)' }}>{u0(a)}</span>
                  <button aria-label="More" style={stepBtn} onClick={() => upd((x) => R.rvStep(x, 'goals', id, 5))}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Lens radius={30} inset={5} innerRadius={25} sheen="bar" style={{ position: 'absolute', left: 14, right: 14, bottom: 'var(--bb)', height: 78, zIndex: 20 }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 12px 0 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ font: '500 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)' }}>UNASSIGNED</span>
            <span className="disp" style={{ fontSize: 34, lineHeight: 0.8, color: un < 0 ? 'var(--crit)' : undefined }}>{usd(un)}</span>
          </div>
          <button className="btn" onClick={() => upd((x) => R.confirmReview(x))} style={{ width: 'auto', padding: '0 28px', borderRadius: 20, opacity: un >= 0 ? 1 : 0.35 }}>Confirm</button>
        </div>
      </Lens>
    </>
  );
}

// ---------------------------------------------------------------- Income and bills

export function SetupView() {
  const { s, upd } = useLf();
  const src = s.incomes[0], nx = nextP(s), nxB = sum(nx.bills, (b) => b.a);
  const moT = sum(s.billsDef, (b) => b.amt * ({ weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, yearly: 1 / 12 }[b.freq] || 1));
  const addBtn = { height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' } as const;
  const rowBtn = { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '10px 16px 10px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' } as const;
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Income and bills</div><div style={{ marginTop: 10, font: '500 9.5px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)', textWrap: 'pretty' }}>CHANGES APPLY FROM THE PAYCHECK ON {U(D.wdm(src.next))}. THE CURRENT PERIOD STAYS AS IT IS.</div></div>
      <div className="pane mx" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><span className="lbl">NEXT PAYCHECK</span><span className="cap">{nx.range}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {[['PAY', u0(nx.pay)], ['BILLS', u0(nxB)], ['AFTER BILLS', u0(r2(nx.pay - nxB))]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={{ font: '500 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{l}</span><span className="disp" style={{ fontSize: 30, lineHeight: 0.85 }}>{v}</span></div>
          ))}
        </div>
        <span style={{ font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{nx.bills.length + (nx.bills.length === 1 ? ' BILL COMES' : ' BILLS COME') + ' OFF THE TOP, THEN CATEGORIES AND GOALS'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}><span className="lbl">INCOME</span><button style={addBtn} onClick={() => upd((x) => R.openEd(x, 'inc', null))}>+ ADD</button></div>
      <div className="pane list">
        {s.incomes.map((i, k) => (
          <button key={i.id} style={rowBtn} onClick={() => upd((x) => R.openEd(x, 'inc', i.id))}>
            {k > 0 && <span className="sep" />}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ font: '500 15px/1.2 var(--f-text)' }}>{i.name}</span>
              <span className="cap">{D.SL[i.sched] + ' · NEXT ' + U(D.wdm(i.next))}</span>
              {k === 0 && <span style={{ font: '600 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink2)' }}>STARTS EACH BUDGET PERIOD</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}><span style={{ font: '600 16px/1 var(--f-text)' }}>{usd(i.amt)}</span><span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span></span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}>
        <span className="lbl">FIXED BILLS</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span className="cap">{s.billsDef.length} · {usd(moT, 0)} / MO</span><button style={addBtn} onClick={() => upd((x) => R.openEd(x, 'bill', null))}>+ ADD</button></span>
      </div>
      <div className="pane list">
        {s.billsDef.slice().sort((a, b) => (a.due < b.due ? -1 : 1)).map((b, k) => (
          <button key={b.id} style={rowBtn} onClick={() => upd((x) => R.openEd(x, 'bill', b.id))}>
            {k > 0 && <span className="sep" />}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={{ font: '500 15px/1.2 var(--f-text)' }}>{b.name}</span><span className="cap">{D.SL[b.freq] + ' · NEXT ' + U(D.dm(b.due))}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}><span style={{ font: '600 16px/1 var(--f-text)' }}>{usd(b.amt)}</span><span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
