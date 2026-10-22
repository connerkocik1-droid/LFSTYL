'use client';

import { useEffect, useState } from 'react';
import * as D from '@/lib/dates';
import { r2, sg, split, sum, u0, usd } from '@/lib/format';
import { ARCHIVE_AFTER_DAYS, CATN, R, TIER, catName, expensesCsv, expiryState, freedPer, gi, goalPer, nextP, paychecksLeft, phaseInfo, planCat, pouchesToday, rvUn, subMonthly, subStep } from '@/lib/logic';
import type { Folder, View } from '@/lib/types';
import { b64ToBlob, kb, prepareFile } from '@/lib/files';
import { BillList, DocRow, Pips, PouchNum, scrollProps, useDays14 } from './tabs';
import { Check, Hero, Lens, Sec, Switch, useLf } from './ui';

const U = (t: string) => t.toUpperCase();

function Back() {
  const { s, upd } = useLf();
  const from = s.view && s.view.from;
  const label = '← ' + (from ? (from.k === 'folder' ? U(from.name) : ({ goal: 'GOAL', project: 'PROJECT', review: 'REVIEW', doc: 'DOCUMENT', settings: 'SETTINGS' } as Record<string, string>)[from.k] || 'BACK') : U(s.tab));
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10 }}>
        <Back />
        <button onClick={() => upd((x) => R.openProj(x, p.id))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>EDIT</button>
      </div>
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
          const src = goal ? U(goal.name) : b && b.cat ? U(catName(s, b.cat)) : 'ASKS AT CHECK-OFF';
          return (
            <div key={g.id} data-group="1" style={{ position: 'relative', borderRadius: 16, transform: `translateY(${r2(ty)}px) scale(${lifted ? 1.02 : 1})`, transition: d && !lifted ? 'transform .22s cubic-bezier(.2,.8,.3,1)' : 'none', zIndex: lifted ? 5 : 1, background: lifted ? 'var(--S-bg)' : 'transparent', backdropFilter: lifted ? 'var(--S-bf)' : 'none', WebkitBackdropFilter: lifted ? 'var(--S-bf)' : 'none', boxShadow: lifted ? 'var(--drag-sh)' : 'none' }}>
              {i > 0 && <div className="sep sep52" />}
              {b && (
                <>
                  <div className="link" />
                  <div className="row">
                    <Check done={b.done} square onClick={() => upd((x) => (b.done ? R.unbuy(x, p.id, g.id) : R.openPrice(x, p.id, g.id)))} label="Mark bought" />
                    <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => upd((x) => R.openTask(x, 'buy', g.id, p.id))}>
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
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => upd((x) => R.openTask(x, 'action', g.id, p.id))}>
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
            {[['PER PAYCHECK', goalPer(s, g) ? usd(goalPer(s, g), 0) : '—'], [g.kind === 'proj' ? 'SPENT' : 'SAVED', u0(info.have)], ['STATUS', g.status === 'done' ? 'DONE' : info.rem <= 0 ? 'REACHED' : 'ACTIVE']].map(([l, v]) => (
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
            <button className="btn-fill" onClick={() => upd((x) => R.openGoal(x, g.id))} style={{ height: 52, borderRadius: 16, font: '600 15px/1 var(--f-text)' }}>Edit goal</button>
            <button className="btn-fill" onClick={() => upd((x) => R.closeGoal(x, g.id))} style={{ height: 52, borderRadius: 16, font: '600 15px/1 var(--f-text)' }}>Close goal</button>
          </div>
          <span className="cap8">{g.pace && s.incomes.length ? `${paychecksLeft(s, g.pace.dueBy)} PAYCHECKS LEFT · DUE BY ${U(D.dm(g.pace.dueBy))} · RECALCULATED EACH PAYCHECK` : freedPer(s, g) ? `FREES ${usd(freedPer(s, g), 0)} A PAYCHECK WHEN CLOSED` : 'NO PAYCHECK CONTRIBUTION'}</span>
        </div>
      ) : <div style={{ margin: '22px 22px 0', font: '500 10px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink2)' }}>COMPLETED · {g.doneTo}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Wean-off

export function WeanView() {
  const { s, upd } = useLf();
  const pi = phaseInfo(s), lim = pi ? pi.limit : null, pn = pouchesToday(s), pOver = lim != null && pn > lim, days = useDays14();
  const past = days.slice(0, 13);
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Wean-off</div><div className="cap8" style={{ marginTop: 10 }}>{pi ? `NICOTINE · PHASE ${pi.idx + 1} OF ${pi.n} · ENDS ${U(D.dm(pi.ph.end))}` : 'NICOTINE · NO PLAN YET'}</div></div>
      <Lens radius={30} inset={6} innerRadius={24} className="mx">
        <div style={{ padding: '17px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{pi ? `TODAY · ${pi.mg}` : 'TODAY'}</span><span>{lim == null ? '' : pOver ? `${pn - lim} OVER` : `${lim - pn} LEFT TODAY`}</span></div>
          <div className="disp" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 0.8, overflow: 'hidden' }}><span style={{ fontSize: 132 }}><PouchNum n={pn} over={pOver} /></span>{lim != null && <span style={{ fontSize: 56, color: 'var(--ink3)', marginLeft: 4 }}>/{lim}</span>}</div>
          {lim != null && <Pips n={pn} lim={lim} w={40} h={6} gap={4} />}
          {pOver && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--crit)' }}>Over today&apos;s limit. Logged anyway.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10 }}>
            <button className="btn-fill" aria-label="Remove one pouch" onClick={() => upd((x) => R.pouch(x, -1))} style={{ height: 56, borderRadius: 18, font: '700 24px/1 var(--f-disp)' }}>−1</button>
            <button className="btn" onClick={() => upd((x) => R.pouch(x, 1))} style={{ height: 56, font: '800 24px/1 var(--f-disp)', textTransform: 'uppercase' }}>+1 pouch</button>
          </div>
        </div>
      </Lens>
      <Sec l="LAST 14 DAYS" r={past.some((d) => d.l != null) ? `${past.filter((d) => d.l != null && d.t <= d.l).length} OF ${past.filter((d) => d.l != null).length} DAYS AT OR UNDER` : ''} />
      <div className="pane mx" style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {days.map((d) => (
            <div key={d.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <div style={{ position: 'relative', width: '100%', height: 84, display: 'flex', alignItems: 'flex-end' }}>
                {d.l != null && <div style={{ position: 'absolute', left: -2, right: -2, bottom: (d.l / 10) * 84, height: 1.5, background: 'var(--ink3)' }} />}
                <div style={{ width: '100%', height: Math.min(84, (d.t / 10) * 84), borderRadius: 3, background: d.over ? 'var(--crit)' : 'var(--ink)', opacity: d.over || d.today ? 1 : 0.45 }} />
              </div>
              <span style={{ font: '500 9px/1 var(--f-mono)', color: 'var(--ink3)' }}>{d.lbl}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{pi ? <>LINE = THAT DAY&apos;S LIMIT · RED = OVER</> : 'POUCHES PER DAY'}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}>
        <span className="lbl">PLAN</span>
        <button onClick={() => upd((x) => R.openPhase(x, null))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ ADD PHASE</button>
      </div>
      <div className="pane mx" style={{ padding: '4px 0' }}>
        {s.phases.map((ph, i) => {
          const st = i < pi!.idx ? 'past' : i === pi!.idx ? 'cur' : 'fut';
          const sameM = ph.start.slice(0, 7) === ph.end.slice(0, 7);
          return (
            <button key={ph.start + i} onClick={() => upd((x) => R.openPhase(x, i))} aria-label={`Edit phase ${i + 1}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', columnGap: 14, alignItems: 'center', width: '100%', minHeight: 62, padding: '10px 16px 10px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
              {i < s.phases.length - 1 && <div style={{ position: 'absolute', left: 25, top: 39, width: 2, height: 46, background: 'var(--line)' }} />}
              <div style={{ position: 'relative', width: 16, height: 16, borderRadius: '50%', ...(st === 'past' ? { background: 'var(--ink3)' } : st === 'cur' ? { background: 'var(--ink)', boxShadow: '0 0 0 4px var(--fill2)' } : { boxShadow: 'inset 0 0 0 1.5px var(--ink3)' }) }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="cap8">PHASE {i + 1}</span><span style={{ fontSize: 15, fontWeight: 500 }}>{(sameM ? D.dayOfMonth(ph.start) : D.dm(ph.start)) + ' – ' + D.dm(ph.end)}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span style={{ font: '600 15px/1 var(--f-text)' }}>{ph.limit} / day</span><span className="cap8">{ph.mg || '—'}</span></div>
            </button>
          );
        })}
        {!pi && <div style={{ padding: '18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No plan yet. Tap + ADD PHASE to set dates, a daily limit and a strength for each step down. You can log pouches in the meantime.</div>}
      </div>
      <div className="pane mx" style={{ marginTop: 12, padding: '12px 16px 12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 500 }}>Track nicotine</span><span className="cap">SHOWS ON TODAY, GOALS AND QUICK ADD</span></span>
        <Switch on label="Track nicotine" onChange={(on) => upd((x) => R.setNicotine(x, on))} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Paycheck review

export function ReviewView() {
  const { s, m, upd } = useLf();
  if (!s.rv) return null;
  const n = nextP(s), rv = s.rv;
  if (!n) return null;
  const un = rvUn(s), ps = split(n.pay);
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
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink2)' }}>{n.srcName + (n.extras.length ? ' + ' + n.extras.map((e) => e.n).join(' + ') : '') + (s.plan ? ' · prefilled from your budget plan' : ' · prefilled from last period')}</div>
        </div>
        <div className="sec lbl" style={{ margin: '6px 0 10px' }}>
          <span>TAKEN OFF THE TOP · {usd(sum(n.bills, (b) => b.a))}</span>
          <button onClick={() => upd((x) => { x.view = { k: 'setup', from: x.view as View }; })} style={{ height: 44, margin: '-17px -12px -17px 0', padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>EDIT</button>
        </div>
        {n.bills.length > 0 ? <BillList bills={n.bills} h={48} /> : <div className="pane list" style={{ padding: '16px 18px', fontSize: 14, color: 'var(--ink2)' }}>No bills this paycheck.</div>}
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
  const src = s.incomes[0], nx = nextP(s), nxB = nx ? sum(nx.bills, (b) => b.a) : 0;
  const moT = sum(s.billsDef, (b) => b.amt * ({ weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, yearly: 1 / 12 }[b.freq] || 1));
  const addBtn = { height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' } as const;
  const rowBtn = { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '10px 16px 10px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' } as const;
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Income and bills</div><div style={{ marginTop: 10, font: '500 9.5px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)', textWrap: 'pretty' }}>{src ? `CHANGES APPLY FROM THE PAYCHECK ON ${U(D.wdm(src.next))}. THE CURRENT PERIOD STAYS AS IT IS.` : 'ADD YOUR PAY TO START BUDGETING. YOUR FIRST PERIOD RUNS UNTIL ITS FIRST PAY DATE.'}</div></div>
      {nx && <div className="pane mx" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><span className="lbl">NEXT PAYCHECK</span><span className="cap">{nx.range}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {[['PAY', u0(nx.pay)], ['BILLS', u0(nxB)], ['AFTER BILLS', u0(r2(nx.pay - nxB))]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={{ font: '500 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{l}</span><span className="disp" style={{ fontSize: 30, lineHeight: 0.85 }}>{v}</span></div>
          ))}
        </div>
        <span style={{ font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{nx.bills.length + (nx.bills.length === 1 ? ' BILL COMES' : ' BILLS COME') + ' OFF THE TOP, THEN CATEGORIES AND GOALS'}</span>
      </div>}
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
        {!s.incomes.length && <div style={{ padding: '18px', fontSize: 14, color: 'var(--ink2)' }}>No income yet. Tap + ADD to set up your pay.</div>}
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
        {!s.billsDef.length && <div style={{ padding: '18px', fontSize: 14, color: 'var(--ink2)' }}>No bills yet.</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Subscriptions

export function SubsView() {
  const { s, upd } = useLf();
  const subs = (s.subs || []).slice().sort((a, b) => (a.next < b.next ? -1 : 1));
  const horizon = D.add(s.today, 30);
  let soon = 0, soonN = 0;
  subs.forEach((v) => { let d = v.next, k = 0; while (d < horizon && k < 60) { soon += v.amt; soonN++; d = subStep(d, v.freq); k++; } });
  const mo = sum(subs, subMonthly);
  const rowBtn = { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '10px 16px 10px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' } as const;
  const FREQ = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Subscriptions</div><div style={{ marginTop: 10, font: '500 9.5px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)', textWrap: 'pretty' }}>EACH CHARGE IS LOGGED AS AN EXPENSE ON ITS DATE, OUT OF THE CATEGORY YOU PICK.</div></div>
      <div className="pane mx" style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {[['A MONTH', u0(r2(mo))], ['A YEAR', u0(r2(mo * 12))], ['NEXT 30 DAYS', u0(r2(soon))]].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={{ font: '500 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{l}</span><span className="disp" style={{ fontSize: 30, lineHeight: 0.85 }}>{v}</span></div>
        ))}
        <span style={{ gridColumn: 'span 3', font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{soonN} {soonN === 1 ? 'CHARGE' : 'CHARGES'} IN THE NEXT 30 DAYS</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}>
        <span className="lbl">YOUR SUBSCRIPTIONS</span>
        <button onClick={() => upd((x) => R.openSub(x, null))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ ADD</button>
      </div>
      <div className="pane list">
        {subs.map((v, k) => (
          <button key={v.id} style={rowBtn} onClick={() => upd((x) => R.openSub(x, v.id))}>
            {k > 0 && <span className="sep" />}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={{ font: '500 15px/1.2 var(--f-text)' }}>{v.name}</span><span className="cap">{FREQ[v.freq] + ' · NEXT ' + U(D.dm(v.next)) + ' · ' + U(catName(s, v.cat))}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}><span style={{ font: '600 16px/1 var(--f-text)' }}>{usd(v.amt)}</span><span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span></span>
          </button>
        ))}
        {!subs.length && <div style={{ padding: '18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No subscriptions yet. Tap + ADD for things like streaming, apps or memberships.</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Budget plan

/** A dollar field that commits when you leave it, so typing "12." isn't cut short. */
function AmountField({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [v, setV] = useState(value ? String(value) : '');
  useEffect(() => { setV(value ? String(value) : ''); }, [value]);
  const commit = () => { const n = parseFloat(v.replace(/[$,]/g, '')) || 0; if (n !== value) onCommit(n); };
  return (
    <div style={{ position: 'relative', width: 116, flex: 'none' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', font: '600 15px/1 var(--f-text)', color: 'var(--ink3)' }}>$</span>
      <input className="field" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="0" inputMode="decimal" style={{ height: 44, padding: '0 12px 0 24px', textAlign: 'right', font: '600 16px/1 var(--f-text)' }} />
    </div>
  );
}

export function PlanView() {
  const { s, m, upd } = useLf();
  const nx = nextP(s), bills = nx ? sum(nx.bills, (b) => b.a) : 0;
  const goals = s.goals.filter((g) => (g.kind === 'save' || g.kind === 'acct') && g.status !== 'done');
  const catT = sum(m.cats, (c) => planCat(s, c.id));
  const goalT = sum(goals, (g) => Math.min(goalPer(s, g), g.kind === 'save' ? Math.max(0, r2(g.target - g.saved)) : Infinity));
  const un = r2((nx ? nx.pay : 0) - bills - catT - goalT);
  const differs = m.cats.some((c) => planCat(s, c.id) !== c.alloc);
  const row = { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 64, padding: '8px 12px 8px 18px' } as const;
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Budget plan</div><div style={{ marginTop: 10, font: '500 9.5px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)', textWrap: 'pretty' }}>{nx ? `HOW EACH PAYCHECK IS SPLIT. YOUR REVIEW ON ${U(D.wdm(nx.start))} STARTS FROM THIS.` : 'HOW EACH PAYCHECK IS SPLIT. ADD YOUR PAY UNDER INCOME AND BILLS TO SEE WHAT IS LEFT.'}</div></div>
      <div className="pane mx" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {[['PAY', nx ? u0(nx.pay) : '—'], ['BILLS', u0(bills)], ['UNASSIGNED', nx ? u0(un) : '—']].map(([l, v], i) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={{ font: '500 9px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{l}</span><span className="disp" style={{ fontSize: 30, lineHeight: 0.85, color: i === 2 && nx && un < 0 ? 'var(--crit)' : undefined }}>{v}</span></div>
          ))}
        </div>
        <span style={{ font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: nx && un < 0 ? 'var(--crit)' : 'var(--ink3)' }}>{nx && un < 0 ? `${usd(-un, 0)} MORE THAN THE PAYCHECK · LOWER A CATEGORY OR GOAL` : `CATEGORIES ${usd(catT, 0)} · GOALS ${usd(goalT, 0)} A PAYCHECK`}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}>
        <span className="lbl">BUDGET ITEMS · EACH PAYCHECK</span>
        <button onClick={() => upd((x) => R.openCat(x, null))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ ADD ITEM</button>
      </div>
      <div className="pane list">
        {m.cats.map((c, i) => (
          <div key={c.id} style={row}>
            {i > 0 && <div className="sep" />}
            <button onClick={() => upd((x) => R.openCat(x, c.id))} aria-label={`Edit ${c.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1, padding: 0, border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}><span style={{ fontSize: 15, fontWeight: 500 }}>{c.name} <span style={{ font: '500 13px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span></span><span className="cap">{`THIS PAYCHECK ${usd(c.alloc, 0)}`}</span></button>
            <AmountField label={`${c.name} each paycheck`} value={planCat(s, c.id)} onCommit={(v) => upd((x) => R.setPlanCat(x, c.id, v))} />
          </div>
        ))}
        {!m.cats.length && <div style={{ padding: '18px', fontSize: 14, color: 'var(--ink2)' }}>No budget items. Tap + ADD ITEM.</div>}
      </div>
      {m.p.pay + m.p.extra > 0 && differs && (
        <button className="btn-fill" onClick={() => upd((x) => R.applyPlanNow(x))} style={{ width: 'calc(100% - 28px)', margin: '10px 14px 0', height: 50, borderRadius: 16, font: '600 14px/1 var(--f-text)' }}>Use these amounts for this paycheck too</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '20px 0 4px' }}>
        <span className="lbl">GOALS</span>
        <button onClick={() => upd((x) => R.openGoal(x, null))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ NEW GOAL</button>
      </div>
      <div className="pane list">
        {goals.map((g, i) => {
          const paced = !!g.pace && s.incomes.length > 0;
          return (
            <button key={g.id} onClick={() => g.kind === 'save' && upd((x) => R.openGoal(x, g.id))} style={{ ...row, width: '100%', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: g.kind === 'save' ? 'pointer' : 'default' }}>
              {i > 0 && <span className="sep" />}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 500 }}><span className="dia" />{g.name}</span>
                <span className="cap">{g.kind === 'acct' ? 'FROM A FINISHED GOAL' : paced ? `AUTO · ${paychecksLeft(s, g.pace!.dueBy)} PAYCHECKS LEFT · ${usd(Math.max(0, g.target - g.saved), 0)} TO GO` : `FIXED · ${usd(Math.max(0, g.target - g.saved), 0)} TO GO`}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}><span style={{ font: '600 16px/1 var(--f-text)' }}>{usd(goalPer(s, g), 0)}</span>{g.kind === 'save' && <span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span>}</span>
            </button>
          );
        })}
        {!goals.length && <div style={{ padding: '18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No goals yet. Tap + NEW GOAL, set the target and how many paychecks you have, and the amount per paycheck is worked out for you.</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Weight

export function WeightView() {
  const { s, upd } = useLf();
  const all = s.weighIns, last = all[all.length - 1];
  const w30 = all.filter(([d]) => d >= D.add(s.today, -30)), delta = w30.length > 1 ? r2(w30[w30.length - 1][1] - w30[0][1]) : null;
  const pts = all.slice(-60), vals = pts.map(([, w]) => w).concat(s.weightTarget ? [s.weightTarget] : []);
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1, W = 320, H = 120;
  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2), y = (w: number) => ((hi - w) / Math.max(0.1, hi - lo)) * H;
  const [tgt, setTgt] = useState(s.weightTarget ? String(s.weightTarget) : '');
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Weight</div><div className="cap8" style={{ marginTop: 10 }}>{last ? `${all.length} WEIGH-INS · LAST ${U(D.dm(last[0]))}` : 'NO WEIGH-INS YET'}</div></div>
      <Lens radius={30} inset={6} innerRadius={24} className="mx">
        <div style={{ padding: '17px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between' }}><span>LATEST</span><span>{delta == null ? '' : `${delta <= 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)} LB IN 30 DAYS`}</span></div>
          <div className="disp scan" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 0.8 }}><span style={{ fontSize: 100 }}>{last ? last[1].toFixed(1) : '—'}</span><span style={{ fontSize: 36, marginLeft: 6 }}>LB</span></div>
          {s.weightTarget > 0 && last && <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{Math.abs(r2(last[1] - s.weightTarget)).toFixed(1)} lb {last[1] > s.weightTarget ? 'to lose' : last[1] < s.weightTarget ? 'to gain' : '· at target'} to reach {s.weightTarget}</span>}
          <button className="btn" onClick={() => upd((x) => R.openWeigh(x))} style={{ height: 52, borderRadius: 16 }}>Log weigh-in</button>
        </div>
      </Lens>
      {pts.length > 1 && (
        <>
          <Sec l="TREND" r={`${pts.length} WEIGH-INS`} />
          <div className="pane mx" style={{ padding: '16px 16px 12px' }}>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
              {s.weightTarget > 0 && <line x1="0" x2={W} y1={y(s.weightTarget)} y2={y(s.weightTarget)} stroke="var(--ink3)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
              <polyline points={pts.map(([, w], i) => `${x(i).toFixed(1)},${y(w).toFixed(1)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, font: '500 9px/1.4 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}><span>{U(D.dm(pts[0][0]))}</span><span>{s.weightTarget ? 'DASHED = TARGET' : ''}</span><span>{U(D.dm(pts[pts.length - 1][0]))}</span></div>
          </div>
        </>
      )}
      <div className="pane mx" style={{ marginTop: 12, padding: '10px 12px 10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 500 }}>Target</span><span className="cap">THE WEIGHT YOU&apos;RE WORKING TOWARD</span></span>
        <div style={{ position: 'relative', width: 116 }}>
          <input className="field" aria-label="Target weight" value={tgt} onChange={(e) => setTgt(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => upd((x) => R.setWeightTarget(x, parseFloat(tgt) || 0))} placeholder="—" inputMode="decimal" style={{ height: 44, padding: '0 38px 0 12px', textAlign: 'right', font: '600 16px/1 var(--f-text)' }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', font: '500 10px/1 var(--f-mono)', color: 'var(--ink3)' }}>LB</span>
        </div>
      </div>
      {all.length > 0 && (
        <>
          <Sec l="LOG" r={all.length} />
          <div className="pane list">
            {all.slice().reverse().slice(0, 60).map(([d, w], i) => (
              <div key={d} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, padding: '0 6px 0 18px' }}>
                {i > 0 && <div className="sep" />}
                <span className="cap">{U(D.wdm(d))}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ font: '600 15px/1 var(--f-text)' }}>{w.toFixed(1)} lb</span><button aria-label={`Remove weigh-in on ${D.dm(d)}`} onClick={() => upd((x) => R.delWeigh(x, d))} style={{ width: 40, height: 40, border: 0, background: 'none', color: 'var(--ink3)', font: '500 16px/1 var(--f-mono)', cursor: 'pointer' }}>×</button></span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Settings

export function SettingsView() {
  const { s, upd, account, signOut, push } = useLf();
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 62, padding: '10px 16px 10px 18px', position: 'relative' } as const;
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">Settings</div>{account && <div className="cap8" style={{ marginTop: 10 }}>SIGNED IN AS {U(account)}</div>}</div>
      <div className="pane list">
        <div style={row}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 500 }}>Track nicotine</span><span className="cap">POUCH COUNTER ON TODAY, GOALS AND QUICK ADD</span></span>
          <Switch on={s.nicotineOn !== false} label="Track nicotine" onChange={(on) => upd((x) => R.setNicotine(x, on))} />
        </div>
      </div>
      {push && <Reminders />}
      <Sec l="SHORTCUTS" />
      <div className="pane mx" style={{ padding: '14px 18px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink2)' }}>
        These links open LFSTYL straight to an action. On iPhone, add one to the Shortcuts app with <b>Open URL</b> and put it on your home screen. On Android, long-press the app icon.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, font: '500 11px/1.4 var(--f-mono)', color: 'var(--ink)' }}>
          {[['Log expense', 'expense'], ['Pouch +1', 'pouch'], ['Add task', 'task'], ['Add income', 'income']].map(([l, k]) => <span key={k}>{l} · {typeof window !== 'undefined' ? window.location.origin : ''}/?do={k}</span>)}
        </div>
      </div>
      <Export />
      {signOut && (
        <button className="btn-fill" onClick={signOut} style={{ width: 'calc(100% - 28px)', margin: '22px 14px 0', height: 52, borderRadius: 16, font: '600 15px/1 var(--f-text)' }}>Sign out</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Library: folder and document

export function FolderView({ name }: { name: Folder }) {
  const { s, upd } = useLf();
  const docs = (s.docs || []).filter((d) => d.folder === name);
  return (
    <div className="screen push" {...scrollProps}>
      <Back />
      <div className="v-head"><div className="t">{name}</div><div className="cap8" style={{ marginTop: 10 }}>{docs.length} {docs.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}{name === 'Logins' ? ' · LOCKED WITH YOUR PIN' : ''}</div></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px', margin: '-6px 0 4px' }}>
        <button onClick={() => upd((x) => R.openDoc(x, null, name))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ ADD DOCUMENT</button>
      </div>
      <div className="pane list">
        {docs.map((d, i) => <DocRow key={d.id} d={d} first={i === 0} />)}
        {!docs.length && <div style={{ padding: '18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>Nothing here yet. Tap + ADD DOCUMENT, then add photos or PDFs to it.</div>}
      </div>
    </div>
  );
}

export function DocView({ id }: { id: string }) {
  const { s, upd, files } = useLf();
  const d = (s.docs || []).find((x) => x.id === id);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<{ url: string; mime: string; name: string } | null>(null);
  useEffect(() => () => { if (open) URL.revokeObjectURL(open.url); }, [open]);
  if (!d) return null;
  const st = expiryState(s, d.expires);

  const add = async (list: FileList | null) => {
    if (!list || !files) return;
    setErr('');
    for (const f of Array.from(list)) {
      setBusy((n) => n + 1);
      try {
        const p = await prepareFile(f), fid = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const r = await files.put(fid, p.mime, p.body);
        if (!r.ok) throw new Error(r.error || "Couldn't upload " + f.name);
        upd((x) => R.addDocFile(x, d.id, { id: fid, name: f.name, mime: p.mime, size: p.size, thumb: p.thumb, added: x.today }));
      } catch (e) { setErr((e as Error).message || "Couldn't add " + f.name); }
      setBusy((n) => n - 1);
    }
  };
  const view = async (fid: string, name: string) => {
    if (!files) return;
    setErr('');
    const r = await files.get(fid);
    if (!r.ok || !r.body) { setErr(r.error || "Couldn't open the file."); return; }
    setOpen({ url: URL.createObjectURL(b64ToBlob(r.body, r.mime!)), mime: r.mime!, name });
  };
  const remove = (fid: string) => { upd((x) => R.removeDocFile(x, d.id, fid)); files?.remove(fid); };
  const del = () => { const ids = d.files.map((f) => f.id); upd((x) => R.delDoc(x, d.id)); ids.forEach((fid) => files?.remove(fid)); };

  return (
    <div className="screen push" {...scrollProps}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10 }}>
        <Back />
        <button onClick={() => upd((x) => R.openDoc(x, d.id))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>EDIT</button>
      </div>
      <div className="v-head">
        <div className="t">{d.title}</div>
        <div className="cap8" style={{ marginTop: 10 }}>{U(d.folder)} · ADDED {U(D.dm(d.added))}</div>
      </div>
      {d.expires && (
        <div className="pane mx" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="lbl">{st === 'expired' ? 'EXPIRED' : 'EXPIRES'}</span>
          <span style={{ font: '600 15px/1 var(--f-text)', color: st === 'expired' ? 'var(--crit)' : st === 'soon' ? 'var(--warn)' : undefined }}>{D.wdm(d.expires)} {st !== 'expired' && <span className="cap">· IN {D.diff(d.expires, s.today)}D</span>}</span>
        </div>
      )}
      {d.notes && <div className="pane mx" style={{ marginTop: 12, padding: '14px 18px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', WebkitUserSelect: 'text', userSelect: 'text' }}>{d.notes}</div>}
      <Sec l="FILES" r={d.files.length} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 14px' }}>
        {d.files.map((f) => (
          <div key={f.id} style={{ position: 'relative' }}>
            <button onClick={() => view(f.id, f.name)} aria-label={`Open ${f.name}`} style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14, border: 0, padding: 0, cursor: 'pointer', background: f.thumb ? `center / cover no-repeat url(${f.thumb})` : 'repeating-linear-gradient(135deg, var(--fill2) 0 4px, transparent 4px 8px)', boxShadow: 'inset 0 0 0 1px var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, color: 'var(--ink3)', font: '600 9px/1 var(--f-mono)' }}>{f.thumb ? '' : f.mime.includes('pdf') ? 'PDF' : 'FILE'}</button>
            <button onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`} style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 0, background: 'var(--scrim)', color: '#fff', font: '500 14px/1 var(--f-mono)', cursor: 'pointer' }}>×</button>
            <div className="cap" style={{ marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kb(f.size)}</div>
          </div>
        ))}
        <label style={{ aspectRatio: '3 / 4', borderRadius: 14, background: 'var(--fill)', boxShadow: 'inset 0 0 0 1px var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: files ? 'pointer' : 'not-allowed', opacity: files ? 1 : 0.4, color: 'var(--ink)' }}>
          <span style={{ font: '500 26px/1 var(--f-mono)' }}>{busy ? '…' : '+'}</span>
          <span className="cap" style={{ textAlign: 'center' }}>{busy ? 'UPLOADING' : 'PHOTO OR PDF'}</span>
          <input type="file" accept="image/*,application/pdf" multiple disabled={!files || !!busy} onChange={(e) => { add(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
        </label>
      </div>
      {!files && <div className="cap" style={{ padding: '10px 22px 0' }}>FILES NEED AN ACCOUNT WITH SYNC TURNED ON</div>}
      {err && <div style={{ padding: '10px 22px 0', fontSize: 13, fontWeight: 600, color: 'var(--crit)' }}>{err}</div>}
      <button className="btn-fill" onClick={del} style={{ width: 'calc(100% - 28px)', margin: '22px 14px 0', height: 50, borderRadius: 16, font: '600 14px/1 var(--f-text)' }}>Delete document</button>
      {open && (
        <div role="dialog" aria-label={open.name} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.92)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--top) + 4px) 10px 8px 18px', color: '#fff' }}>
            <span style={{ font: '500 11px/1.3 var(--f-mono)', letterSpacing: '.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{U(open.name)}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              <a href={open.url} download={open.name} target="_blank" rel="noreferrer" style={{ height: 44, padding: '0 12px', display: 'grid', placeItems: 'center', color: '#fff', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', textDecoration: 'none' }}>OPEN</a>
              <button onClick={() => setOpen(null)} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: '#fff', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>CLOSE</button>
            </span>
          </div>
          {open.mime.startsWith('image/')
            ? <img src={open.url} alt={open.name} style={{ flex: 1, minHeight: 0, objectFit: 'contain', width: '100%' }} />
            : <iframe src={open.url} title={open.name} style={{ flex: 1, border: 0, background: '#fff' }} />}
        </div>
      )}
    </div>
  );
}

/** Downloads every expense as a spreadsheet, including the ones archived on the server. */
function Export() {
  const { s, archive } = useLf();
  const [msg, setMsg] = useState('');
  const run = async () => {
    setMsg('Preparing…');
    const old = archive ? await archive.get() : [];
    if (old == null) { setMsg("Can't reach the server for older expenses. Check your connection."); return; }
    const url = URL.createObjectURL(new Blob([expensesCsv(s, old)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `lfstyl-expenses-${s.today}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMsg('');
  };
  return (
    <>
      <Sec l="YOUR DATA" />
      <div className="pane list">
        <button onClick={run} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 6, width: '100%', minHeight: 62, padding: '10px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Export expenses</span>
          <span className="cap" style={{ lineHeight: 1.4 }}>EVERY EXPENSE AS A SPREADSHEET (CSV){archive ? ` · OLDER THAN ${ARCHIVE_AFTER_DAYS} DAYS ARE KEPT ON THE SERVER` : ''}</span>
        </button>
      </div>
      {msg && <div style={{ padding: '10px 22px 0', fontSize: 13, lineHeight: 1.4, color: msg.startsWith('Prep') ? 'var(--ink2)' : 'var(--crit)' }}>{msg}</div>}
    </>
  );
}

/** The Reminders switch: one summary at 9 AM on days with something due. */
function Reminders() {
  const { push } = useLf();
  const [st, setSt] = useState<'on' | 'off' | 'unsupported' | 'blocked' | 'busy'>('busy');
  const [msg, setMsg] = useState('');
  useEffect(() => { push!.status().then(setSt).catch(() => setSt('unsupported')); }, [push]);
  const toggle = async (on: boolean) => {
    setMsg(''); setSt('busy');
    if (on) { const r = await push!.enable(); if (!r.ok) setMsg(r.error || "Couldn't turn reminders on."); }
    else await push!.disable();
    setSt(await push!.status());
  };
  const test = async () => { setMsg('Sending…'); const r = await push!.test(); setMsg(r.ok ? 'Sent. It should arrive in a few seconds.' : r.error || "Couldn't send."); };
  const note = st === 'unsupported' ? 'ON IPHONE, ADD LFSTYL TO YOUR HOME SCREEN AND OPEN IT FROM THERE' : st === 'blocked' ? 'NOTIFICATIONS ARE BLOCKED FOR LFSTYL IN YOUR PHONE SETTINGS' : 'PAYDAY, BILLS, SUBSCRIPTIONS, TASKS AND EXPIRING DOCUMENTS · 9 AM';
  return (
    <>
      <Sec l="REMINDERS" />
      <div className="pane list">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 62, padding: '10px 16px 10px 18px' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 500 }}>Daily reminders</span><span className="cap" style={{ lineHeight: 1.4 }}>{note}</span></span>
          <Switch on={st === 'on'} label="Daily reminders" onChange={(on) => (st === 'busy' || st === 'unsupported' ? undefined : toggle(on))} />
        </div>
        {st === 'on' && (
          <button onClick={test} style={{ position: 'relative', width: '100%', minHeight: 50, padding: '0 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', font: '600 14px/1 var(--f-text)', cursor: 'pointer' }}><span className="sep" />Send a test reminder</button>
        )}
      </div>
      {msg && <div style={{ padding: '10px 22px 0', fontSize: 13, lineHeight: 1.4, color: msg.startsWith('Sen') ? 'var(--ink2)' : 'var(--crit)' }}>{msg}</div>}
    </>
  );
}
