'use client';

import { useEffect, useState } from 'react';
import * as D from '@/lib/dates';
import { num, r2, sg, split, sum, u0, usd } from '@/lib/format';
import { CATN, FOLDERS, R, TIER, catName, dueInstallments, paycheckLeft, periodFrom, planCatOn, expiryState, freedPer, safeToSpend, gi, goalPer, installments, idleDays, limitOn, nextP, nicotineOn, paychecksLeft, phaseInfo, planCat, pouchesToday, subMonthly, taskRel } from '@/lib/logic';
import type { Doc, Goal, State } from '@/lib/types';
import { Check, Hero, Lens, LensButton, MoneyBars, Sec, Switch, useLf } from './ui';

const U = (t: string) => t.toUpperCase();

function onScroll(e: React.UIEvent<HTMLDivElement>) {
  const root = e.currentTarget.closest('.lf') as HTMLElement | null;
  if (root) root.style.setProperty('--sy', Math.min(40, e.currentTarget.scrollTop / 10).toFixed(1));
}
export const scrollProps = { onScroll, 'data-scroll': '1' };

/** Pouch counter pips: on / off / over the limit. */
export function Pips({ n, lim, w, h, gap }: { n: number; lim: number; w: number; h: number; gap: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      {Array.from({ length: Math.max(lim, n) }, (_, i) => (
        <div key={i} style={{ width: w, height: h, borderRadius: h / 2.5, background: i >= lim ? 'var(--crit)' : 'var(--ink)', opacity: i >= lim || i < n ? 1 : 0.2 }} />
      ))}
    </div>
  );
}

/** Animated pouch count; turns critical over the limit. */
export function PouchNum({ n, over }: { n: number; over: boolean }) {
  return <span key={n} style={{ display: 'inline-block', animation: 'lfTick .45s cubic-bezier(.2,1.5,.4,1)', color: over ? 'var(--crit)' : 'var(--ink)' }}>{n}</span>;
}

// ---------------------------------------------------------------- Today

interface Rec { key: string; title: string; reason: string; crit: boolean; isBuy: boolean; tc: string; tn: string; price?: string; check: () => void; open?: () => void }

function useRecs(): Rec[] {
  const { s, upd } = useLf();
  const relL = (r: number, due: string) => (r < 0 ? `OVERDUE ${-r}D` : r === 0 ? 'DUE TODAY' : r === 1 ? 'DUE TOMORROW' : 'DUE ' + U(r <= 6 ? D.wd(due) : D.wdm(due)));
  const out: Rec[] = [];
  const tasks = s.tasks.filter((t) => !t.done);
  const tr = (t: State['tasks'][number], reason: string, crit: boolean): Rec => ({ key: t.id, title: t.title, reason, crit, isBuy: false, tc: TIER[t.tier][1], tn: TIER[t.tier][0], check: () => upd((x) => R.toggleTask(x, t.id)), open: () => upd((x) => R.openTask(x, 'task', t.id)) });
  type Item = { rel: number; t?: State['tasks'][number]; p?: State['projects'][number]; g?: State['projects'][number]['groups'][number] };
  const items: Item[] = [];
  tasks.forEach((t) => { const rel = taskRel(s, t.due); if (rel != null && rel <= 3) items.push({ rel, t }); });
  s.projects.forEach((p) => p.groups.forEach((g) => { const rel = taskRel(s, g.action.due); if (!g.action.done && rel != null && rel <= 3) items.push({ rel, p, g }); }));
  items.sort((a, b) => a.rel - b.rel).forEach((o) => {
    if (o.t) { out.push(tr(o.t, relL(o.rel, o.t.due!), o.rel < 0)); return; }
    const p = o.p!, g = o.g!, open = () => upd((x) => { x.view = { k: 'project', id: p.id }; });
    if (g.buy && !g.buy.done) out.push({ key: g.id + 'b', title: g.buy.title, reason: 'BUY FIRST', crit: false, isBuy: true, tc: TIER[p.tier][1], tn: p.name, price: u0(g.buy.est), check: () => upd((x) => R.openPrice(x, p.id, g.id)), open });
    out.push({ key: g.id, title: g.action.title, reason: relL(o.rel, g.action.due!), crit: o.rel < 0, isBuy: false, tc: TIER[p.tier][1], tn: p.name, check: () => upd((x) => R.toggleAction(x, p.id, g.id)), open });
  });
  tasks.filter((t) => t.due == null && idleDays(s, t.touched) >= 14).sort((a, b) => idleDays(s, b.touched) - idleDays(s, a.touched)).slice(0, 2)
    .forEach((t) => out.push(tr(t, `UNTOUCHED ${idleDays(s, t.touched)}D`, false)));
  return out;
}

/** This paycheck's installments waiting to be marked paid, each with a Paid button. */
export function DueList({ style }: { style?: React.CSSProperties }) {
  const { s, upd } = useLf();
  const due = dueInstallments(s);
  if (!due.length) return null;
  return (
    <div className="pane list" style={style}>
      {due.map((pg, i) => {
        const g = s.goals.find((x) => x.id === pg.id)!;
        return (
          <div key={pg.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 62, padding: '8px 10px 8px 18px' }}>
            {i > 0 && <div className="sep" />}
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 500 }}><span className="dia" />{g.name}</span>
              <span className="cap">{`INSTALLMENT ${usd(pg.due!)} · NOT PAID YET`}</span>
            </span>
            <button className="btn" onClick={() => upd((x) => R.payInstallment(x, pg.id))} aria-label={`Mark ${g.name} installment paid`} style={{ width: 'auto', height: 44, padding: '0 18px', borderRadius: 14, font: '600 14px/1 var(--f-text)', flex: 'none' }}>Paid</button>
          </div>
        );
      })}
    </div>
  );
}

export function Today() {
  const { s, m, upd, shown } = useLf();
  const nx = nextP(s), daysTo = s.incomes.length ? Math.max(0, D.diff(s.incomes[0].next, s.today)) : null;
  const pd = s.pendingDone ? s.goals.find((g) => g.id === s.pendingDone) : null;
  const pi = phaseInfo(s), lim = pi ? pi.limit : null, pn = pouchesToday(s), pOver = lim != null && pn > lim;
  const ov = m.over.slice().sort((a, b) => a.left - b.left);
  const recs = useRecs();
  const goMoney = () => upd((x) => { x.tab = 'money'; x.view = null; x.moff = 0; });
  const hero = split(shown), safe = safeToSpend(s, m.left);
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab" style={{ paddingRight: 8 }}><span className="t">Today</span><span style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}><span className="mono" style={{ font: '500 11px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)', paddingBottom: 4 }}>{U(D.wdm(s.today))}</span><button aria-label="Settings" onClick={() => upd((x) => { x.view = { k: 'settings' }; })} style={{ width: 44, height: 32, margin: '0 0 -6px', padding: 0, border: 0, background: 'none', color: 'var(--ink2)', font: '700 16px/1 var(--f-mono)', letterSpacing: '.05em', cursor: 'pointer' }}>···</button></span></div>

      {s.payPending && nx && (
        <div className="pane" style={{ margin: '0 14px 12px', padding: '16px 16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'lfPop .45s cubic-bezier(.2,1.2,.3,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span className="lbl">PAYCHECK IN</span>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{nx.srcName + (nx.extras.length ? ' + ' + nx.extras.map((e) => e.n).join(' + ') : '') + ' · ' + D.SL[nx.srcSched].toLowerCase()}</span>
            </div>
            <span className="disp" style={{ fontSize: 44, lineHeight: 0.82 }}>{usd(nx.pay)}</span>
          </div>
          <button className="btn" style={{ height: 52, borderRadius: 16 }} onClick={() => upd((x) => R.openReview(x))}>Review and allocate</button>
        </div>
      )}

      {dueInstallments(s).length > 0 && (
        <>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 22px', margin: '0 0 8px' }}><span>INSTALLMENTS DUE</span><button onClick={() => upd((x) => { x.tab = 'money'; x.view = null; })} style={{ margin: '-14px -12px -14px 0', height: 40, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>ALL →</button></div>
          <DueList style={{ margin: '0 14px 12px' }} />
        </>
      )}

      {pd && s.sheet !== 'done' && (() => {
        const g = gi(s, pd);
        return (
          <div className="pane" style={{ margin: '0 14px 12px', padding: '16px 16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'lfPop .45s cubic-bezier(.2,1.2,.3,1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="lbl">GOAL COMPLETE</span>
              <span className="disp up" style={{ fontSize: 34, lineHeight: 0.86 }}>{pd.name}</span>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{`${u0(g.have)} saved` + (freedPer(s, pd) ? ` · ${usd(freedPer(s, pd), 0)} a paycheck freed` : '')}</span>
            </div>
            <button className="btn" style={{ height: 52, borderRadius: 16 }} onClick={() => upd((x) => R.openDone(x, x.pendingDone))}>{freedPer(s, pd) ? `Place ${usd(freedPer(s, pd), 0)} a paycheck` : 'Finish'}</button>
          </div>
        );
      })()}

      <Lens radius={30} inset={6} innerRadius={24} className="mx" style={{ cursor: 'pointer' }} onClick={goMoney}>
        <div style={{ padding: '17px 20px 16px' }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>LEFT THIS PAYCHECK</span><span>{daysTo == null ? 'NO PAY SET UP' : daysTo ? `${daysTo} DAYS TO PAYDAY` : 'PAYDAY'}</span></div>
          <Hero v={hero} style={{ marginTop: 12 }} />
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.3, color: 'var(--ink2)' }}>{`of ${usd(m.p.pay + m.p.extra)}` + (Math.abs(m.rollT) > 0.004 ? ` · ${sg(m.rollT)} rolled over` : '')}</div>
          {safe && m.p.pay + m.p.extra > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--fill)' }}>
              <span className="lbl">SAFE TO SPEND TODAY</span>
              <span style={{ font: '600 17px/1 var(--f-text)', color: m.left < 0 ? 'var(--crit)' : undefined }}>{m.left < 0 ? usd(m.left) + ' over' : usd(safe.perDay)}<span className="cap" style={{ marginLeft: 6 }}>{m.left < 0 ? '' : `/ DAY · ${safe.days}D`}</span></span>
            </div>
          )}
          <MoneyBars b={m.billsT} sp={m.spentT} g={m.goalsT} l={m.left} lgL={'LEFT ' + num(shown)} />
        </div>
      </Lens>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 14px 0' }}>
        {nicotineOn(s) && <div className="pane" onClick={() => upd((x) => { x.view = { k: 'wean' }; })} style={{ minHeight: 150, cursor: 'pointer', padding: '14px 12px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 4 }}><span>POUCHES</span><span>{pi ? pi.mg : ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div className="disp" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 0.86, overflow: 'hidden' }}><span style={{ fontSize: 60 }}><PouchNum n={pn} over={pOver} /></span>{lim != null && <span style={{ fontSize: 30, color: 'var(--ink3)', marginLeft: 2 }}>/{lim}</span>}</div>
            <LensButton size={54} inset={5} label="Add one pouch" onClick={(e) => { e.stopPropagation(); upd((x) => R.pouch(x, 1)); }}>
              <span className="disp" style={{ position: 'relative', fontSize: 24, lineHeight: 1 }}>+1</span>
            </LensButton>
          </div>
          {lim != null && <Pips n={pn} lim={lim} w={14} h={5} gap={3} />}
          <div style={{ font: `${pOver ? 600 : 500} 9.5px/1 var(--f-mono)`, letterSpacing: '.08em', color: pOver ? 'var(--crit)' : 'var(--ink3)' }}>{!pi ? 'TODAY · NO PLAN YET' : pOver ? `${pn - lim!} OVER TODAY'S LIMIT` : `PHASE ${pi.idx + 1} · ENDS ${U(D.dm(pi.ph.end))}`}</div>
        </div>}
        <div className="pane" onClick={daysTo == null && !ov.length ? () => upd((x) => { x.tab = 'money'; x.view = { k: 'setup' }; }) : goMoney} style={{ minHeight: 150, cursor: 'pointer', padding: '14px 12px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, gridColumn: nicotineOn(s) ? undefined : 'span 2' }}>
          <div className="lbl">{ov.length ? 'OVER BUDGET' : daysTo == null ? 'GET STARTED' : 'ON TRACK'}</div>
          <div>
            <div className="disp up" style={{ fontSize: 34, lineHeight: 0.86 }}>{ov.length ? ov[0].name : daysTo == null ? 'Set up pay' : `${daysTo} days`}</div>
            {ov.length ? <div style={{ marginTop: 7, fontSize: 14, fontWeight: 600, color: 'var(--crit)' }}>{usd(-ov[0].left) + ' over'}</div> : <div style={{ marginTop: 7, fontSize: 13, color: 'var(--ink2)' }}>{daysTo == null ? 'Add your income and bills' : 'until the next paycheck'}</div>}
          </div>
          <div style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>{ov.length > 1 ? `+${ov.length - 1} MORE OVER` : `${usd(m.unassigned)} UNASSIGNED`}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 22px', margin: '24px 0 10px' }}>
        <span className="disp up" style={{ fontSize: 26, lineHeight: 1 }}>Next up</span>
        <span className="lbl">{recs.length} · BY URGENCY</span>
      </div>
      <div className="pane mx" style={{ padding: '4px 0' }}>
        {recs.map((r, i) => (
          <div key={r.key} className="row">
            {i > 0 && !recs[i - 1].isBuy && <div className="sep sep52" />}
            {r.isBuy && <div className="link" />}
            <Check done={false} square={r.isBuy} onClick={r.check} label="Check off" />
            <div onClick={r.open} style={{ minWidth: 0, cursor: r.open ? 'pointer' : undefined }}>
              <div className="title">{r.title}</div>
              <div className="meta">
                <span className={'reason' + (r.crit ? ' crit' : '')}>{r.reason}</span>
                <span className="tdot" style={{ background: r.tc }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tn}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.price && <><div style={{ fontSize: 15, lineHeight: 1, fontWeight: 600 }}>{r.price}</div><div className="cap8" style={{ marginTop: 4 }}>EST</div></>}
            </div>
          </div>
        ))}
        {!recs.length && <div style={{ padding: '22px 18px', fontSize: 14, color: 'var(--ink2)' }}>Nothing urgent. Pick something from Tasks.</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Tasks

export function Tasks() {
  const { s, upd } = useLf();
  const openCount = s.tasks.filter((t) => !t.done).length;
  const projs = s.projects.filter((p) => s.ftier === 'all' || p.tier === s.ftier);
  const vis = s.tasks.filter((t) => (s.ftier === 'all' || t.tier === s.ftier) && t.done === s.fdone);
  const rel = (t: State['tasks'][number]) => taskRel(s, t.due);
  const groups = ([['OVERDUE', (r: number | null) => r != null && r < 0], ['THIS WEEK', (r: number | null) => r != null && r >= 0 && r <= 6], ['LATER', (r: number | null) => r != null && r > 6], ['OPEN-ENDED', (r: number | null) => r == null]] as const)
    .map(([title, f]) => ({ title, items: vis.filter((t) => f(rel(t))) })).filter((g) => g.items.length);
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab" style={{ paddingRight: 18 }}>
        <span className="t">Tasks</span>
        <div className="seg">
          <button className={s.fdone ? '' : 'on'} onClick={() => upd((x) => { x.fdone = false; })}>OPEN {openCount}</button>
          <button className={s.fdone ? 'on' : ''} onClick={() => upd((x) => { x.fdone = true; })}>DONE</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 14px', flexWrap: 'wrap' }}>
        {([['all', 'All'], ['P', 'Personal'], ['F', 'Financial'], ['W', 'Work']] as const).map(([id, label]) => (
          <button key={id} className={'chip' + (s.ftier === id ? ' on' : '')} onClick={() => upd((x) => { x.ftier = id; })}>
            {id !== 'all' && <span className="dot" style={{ background: TIER[id][1] }} />}{label}
          </button>
        ))}
      </div>
      {projs.length > 0 && (
        <>
          <Sec l="PROJECTS" r={projs.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px' }}>
            {projs.map((p) => {
              const n = sum(p.groups, (g) => 1 + (g.buy ? 1 : 0)), d = sum(p.groups, (g) => (g.action.done ? 1 : 0) + (g.buy && g.buy.done ? 1 : 0));
              const total = sum(p.groups, (g) => (g.buy ? (g.buy.done ? g.buy.actual! : g.buy.est) : 0)), goal = p.goal ? s.goals.find((g) => g.id === p.goal) : null;
              return (
                <div key={p.id} className="pane" onClick={() => upd((x) => { x.view = { k: 'project', id: p.id }; })} style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      <span className="disp up" style={{ fontSize: 26, lineHeight: 0.9 }}>{p.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink2)' }}><span className="tdot" style={{ background: TIER[p.tier][1] }} /><span>{TIER[p.tier][0]} · {goal ? 'from ' + goal.name : 'from paycheck budget'}</span></span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
                      <span className="disp" style={{ fontSize: 30, lineHeight: 0.85 }}>{usd(total)}</span>
                      <span className="cap8">TOTAL COST</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="track" style={{ flex: 1 }}><div style={{ width: `${n ? (d / n) * 100 : 0}%` }} /></div>
                    <span className="reason">{d} OF {n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {groups.map((tg) => (
        <div key={tg.title}>
          <Sec l={tg.title} r={tg.items.length} />
          <div className="pane mx" style={{ position: 'relative', padding: '4px 0' }}>
            {tg.items.map((t, i) => {
              const r = rel(t), crit = !t.done && r != null && r < 0, idle = idleDays(s, t.touched);
              const reason = t.done ? 'DONE' : crit ? `OVERDUE ${-r!}D` : t.due ? 'DUE ' + U(D.wdm(t.due)) : idle >= 14 ? `UNTOUCHED ${idle}D` : 'NO DATE';
              return (
                <div key={t.id} className="row" style={{ gridTemplateColumns: '22px minmax(0,1fr)', minHeight: 60 }}>
                  {i > 0 && <div className="sep sep52" />}
                  <Check done={t.done} onClick={() => upd((x) => R.toggleTask(x, t.id))} label="Toggle done" />
                  <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => upd((x) => R.openTask(x, 'task', t.id))}>
                    <div className="title" style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--ink3)' : 'var(--ink)' }}>{t.title}</div>
                    <div className="meta"><span className={'reason' + (crit ? ' crit' : '')}>{reason}</span><span className="tdot" style={{ background: TIER[t.tier][1] }} /><span>{TIER[t.tier][0]}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.length && <div style={{ padding: '28px 22px', fontSize: 14, color: 'var(--ink2)' }}>No tasks here.</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Money

let swipeX: number | null = null;

export function Money() {
  const { s, m, upd, shown } = useLf();
  const hist = s.history, cur = s.moff === 0, src = s.incomes[0];
  const canPrev = -s.moff < hist.length, canNext = s.moff < 0;
  const prev = () => canPrev && upd((x) => { x.moff -= 1; }), next = () => canNext && upd((x) => { x.moff += 1; });
  const h = cur ? null : hist[-s.moff - 1];
  const gName = (id: string) => (s.goals.find((g) => g.id === id) || { name: '' }).name;
  const cats = cur
    ? m.cats.map((c) => ({ name: c.name, sub: `${num(c.spent)} OF ${num(c.avail)}` + (Math.abs(c.roll) > 0.004 ? ` · ${sg(c.roll)} ${c.roll < 0 ? 'CARRIED' : 'ROLLED'}` : ''), left: c.left, pct: Math.min(100, (c.spent / Math.max(c.avail, 0.01)) * 100) }))
    : h!.cats.map(([name, av, sp]) => ({ name, sub: `${num(sp)} OF ${num(av)}`, left: r2(av - sp), pct: Math.min(100, (sp / av) * 100) }));
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab" style={{ padding: '8px 10px 14px 22px' }}>
        <span className="t">Money</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={prev} aria-label="Earlier period" style={{ width: 44, height: 44, border: 0, background: 'none', color: 'var(--ink)', font: '500 16px/1 var(--f-mono)', cursor: 'pointer', opacity: canPrev ? 1 : 0.3 }}>‹</button>
          <span className="mono" style={{ font: '500 11px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)' }}>{cur ? m.p.label : h!.label}</span>
          <button onClick={next} aria-label="Later period" style={{ width: 44, height: 44, border: 0, background: 'none', color: 'var(--ink)', font: '500 16px/1 var(--f-mono)', cursor: 'pointer', opacity: canNext ? 1 : 0.3 }}>›</button>
        </div>
      </div>
      <div onPointerDown={(e) => { swipeX = e.clientX; }} onPointerUp={(e) => { if (swipeX == null) return; const dx = e.clientX - swipeX; swipeX = null; if (dx > 50) prev(); if (dx < -50) next(); }} style={{ touchAction: 'pan-y' }}>
        <Lens radius={30} inset={6} innerRadius={24} className="mx">
          <div style={{ padding: '17px 20px 16px' }}>
            <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{cur ? 'LEFT THIS PAYCHECK' : 'ENDED WITH'}</span><span>PAY {usd(cur ? m.p.pay + m.p.extra : h!.pay, 0)}</span></div>
            <Hero v={split(cur ? shown : h!.left)} style={{ marginTop: 12 }} />
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.3, color: 'var(--ink2)' }}>{cur ? (Math.abs(m.rollT) > 0.004 ? `${sg(m.rollT)} rolled over · ` : '') + (src ? `next pay ${D.wdm(src.next)}` : 'Add your pay under Income and bills') : 'Category money rolled into the next period'}</div>
            {cur ? <MoneyBars b={m.billsT} sp={m.spentT} g={m.goalsT} l={m.left} lgL={'LEFT ' + num(shown)} /> : <MoneyBars b={h!.bills} sp={h!.spent} g={h!.goals} l={h!.left} lgL={'LEFT ' + num(h!.left)} />}
          </div>
        </Lens>
      </div>
      {cur && (
        <div className="pane" style={{ margin: '12px 14px 0', padding: '14px 14px 14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="lbl">UNASSIGNED</span>
            <span className="disp" style={{ fontSize: 36, lineHeight: 0.85 }}>{usd(m.unassigned)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(m.allocT > 0 || m.p.goals.length > 0) && <button className="btn-fill" onClick={() => upd((x) => { x.tb = {}; x.sheet = 'take'; })} style={{ height: 44, padding: '0 14px', borderRadius: 14, font: '600 13.5px/1 var(--f-text)' }}>Take back</button>}
            <button className="btn-fill" onClick={() => m.unassigned > 0 && upd((x) => R.openPlace(x, m.unassigned))} style={{ height: 44, padding: '0 16px', borderRadius: 14, font: '600 13.5px/1 var(--f-text)', opacity: m.unassigned > 0 ? 1 : 0.35 }}>Place it</button>
          </div>
        </div>
      )}
      {cur && m.p.pay === 0 && !(m.p.extras || []).length && (
        <div className="pane" style={{ margin: '12px 14px 0', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="lbl">BEFORE YOUR FIRST PAYCHECK</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>Add the money you have now, then place it in categories so spending before payday has a budget.</span>
          <button className="btn" style={{ height: 48, borderRadius: 16 }} onClick={() => upd((x) => { x.sheet = 'income'; x.draft = { amt: '', cat: null, note: 'Money on hand', y: false }; })}>Add money on hand</button>
        </div>
      )}
      {cur && (m.p.extras || []).length > 0 && (
        <>
          <Sec l="EXTRA INCOME" r={usd(m.p.extra)} />
          <div className="pane list">
            {(m.p.extras || []).map((e, i) => (
              <button key={e.id} onClick={() => upd((x) => R.openIncomeEntry(x, e.id))} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, padding: '8px 16px 8px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                {i > 0 && <span className="sep" />}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 500 }}>{e.src}</span><span className="cap">{U(D.dm(e.date))}</span></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}><span style={{ font: '600 15px/1 var(--f-text)' }}>+{usd(e.amt)}</span><span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink3)' }}>›</span></span>
              </button>
            ))}
          </div>
        </>
      )}
      <Sec l="CATEGORIES" r="LEFT" />
      <div className="pane list">
        {cats.map((c, i) => (
          <div key={c.name} style={{ position: 'relative', padding: '13px 16px 14px 18px' }}>
            {i > 0 && <div className="sep" />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</span><span className="cap">{c.sub}</span></div>
              <span style={{ font: '600 18px/1 var(--f-text)', color: c.left < -0.004 ? 'var(--crit)' : undefined }}>{usd(c.left)}</span>
            </div>
            <div className="track" style={{ marginTop: 10 }}><div style={{ width: `${c.pct}%`, background: c.left < -0.004 ? 'var(--crit)' : 'var(--ink)' }} /></div>
          </div>
        ))}
      </div>
      {cur ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '22px 0 4px' }}>
            <span className="lbl">BUDGET · BY PAYCHECK</span>
            {src && <span style={{ display: 'flex' }}>
              <button onClick={() => upd((x) => R.openCat(x, null))} style={{ height: 44, padding: '0 10px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ ITEM</button>
              <button onClick={() => upd((x) => R.openGoal(x, null))} style={{ height: 44, padding: '0 10px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ GOAL</button>
            </span>}
          </div>
          {src ? <BudgetTable /> : <div className="pane mx" style={{ padding: '16px 18px', color: 'var(--ink2)', fontSize: 14, lineHeight: 1.45 }}>Add your pay below to plan each paycheck here: your budget items and goals, side by side.</div>}
          {m.p.bills.length > 0 && <><Sec l="TAKEN OFF THE TOP" r={usd(m.billsT)} />
          <BillList bills={m.p.bills} h={50} /></>}
          <button className="btn-fill" onClick={() => upd((x) => { x.view = { k: 'setup' }; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'calc(100% - 28px)', margin: '22px 14px 0', minHeight: 54, padding: '0 16px 0 18px', borderRadius: 16 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}><span style={{ font: '600 14.5px/1 var(--f-text)' }}>Income and bills</span><span className="cap">{src ? 'PAY ' + usd(src.amt, 0) + ' ' + D.SL[src.sched] + ' · ' + s.billsDef.length + ' BILLS' : 'SET UP YOUR PAY AND BILLS'}</span></span>
            <span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink2)' }}>→</span>
          </button>
          <button className="btn-fill" onClick={() => upd((x) => { x.view = { k: 'subs' }; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'calc(100% - 28px)', margin: '8px 14px 0', minHeight: 54, padding: '0 16px 0 18px', borderRadius: 16 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}><span style={{ font: '600 14.5px/1 var(--f-text)' }}>Subscriptions</span><span className="cap">{(s.subs || []).length ? `${(s.subs || []).length} · ${usd(sum(s.subs || [], subMonthly), 0)} / MO · LOGGED AUTOMATICALLY` : 'RECURRING CHARGES, LOGGED AUTOMATICALLY'}</span></span>
            <span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink2)' }}>→</span>
          </button>
          <Sec l="EXPENSES" r={m.exp.length} />
          <div className="pane list">
            {m.exp.map((e, i) => (
              <div key={e.id} role="button" aria-label={`${e.note}, ${usd(e.amt)}`} onClick={() => upd((x) => R.openExp(x, e.id))} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 16px 10px 18px', cursor: 'pointer' }}>
                {i > 0 && <div className="sep" />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{e.note}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="cap">{U(D.dm(e.date)) + (e.proj ? ' · ' + U(e.proj) : '') + (e.src === 'sub' ? ' · SUBSCRIPTION' : '')}</span>
                    {e.goal && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 8px', borderRadius: 10, boxShadow: 'inset 0 0 0 1px var(--ink3)', font: '600 9.5px/1 var(--f-mono)', letterSpacing: '.06em' }}><span className="dia" style={{ width: 5, height: 5 }} />{U(gName(e.goal))}</span>}
                    {e.cat && <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{catName(s, e.cat)}</span>}
                  </span>
                </div>
                <span style={{ font: '600 16px/1 var(--f-text)', flex: 'none' }}>{usd(e.amt)}</span>
              </div>
            ))}
            {!m.exp.length && <div style={{ padding: '20px 18px', fontSize: 14, color: 'var(--ink2)' }}>No expenses yet this period.</div>}
          </div>
        </>
      ) : (
        <div style={{ padding: '16px 22px', font: '500 10px/1.5 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>PAST PERIOD · READ ONLY · SWIPE OR TAP › FOR NEWER</div>
      )}
    </div>
  );
}

export function BillList({ bills, h }: { bills: { n: string; a: number; d: string }[]; h: number }) {
  return (
    <div className="pane list">
      {bills.map((b, i) => (
        <div key={b.n + b.d} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: h, padding: '0 16px 0 18px' }}>
          {i > 0 && <div className="sep" />}
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 15 }}>{b.n}<span className="cap">{U(D.dm(b.d))}</span></span>
          <span style={{ font: '500 15px/1 var(--f-text)' }}>{usd(b.a)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Goals

/** Pouches per day for the last 14 days (13 past days and today). */
export function useDays14() {
  const { s } = useLf();
  return Array.from({ length: 14 }, (_, k) => {
    const iso = D.add(s.today, k - 13), t = s.pouchLog[iso] || 0, l = limitOn(s, iso), today = k === 13;
    return { iso, lbl: D.dayOfMonth(iso), t, l, today, over: l != null && t > l };
  });
}

/** A table cell's dollar field. Clearing a cell you set puts it back on the automatic amount. */
function CellField({ value, edited, label, onCommit }: { value: number; edited: boolean; label: string; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => {
    const raw = v.replace(/[$,\s]/g, '');
    if (!raw) { if (edited) onCommit(null); else setV(String(value)); return; }
    const n = r2(parseFloat(raw) || 0);
    if (n !== value) onCommit(n);
  };
  return (
    <input aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} inputMode="decimal"
      className={'gt-in' + (edited ? ' set' : '')} />
  );
}

/** The budget, paycheck by paycheck: a row per paycheck, a column per budget item and per savings goal. Every amount
 *  can be changed; under each date is what that paycheck has left after bills, budget items and goals. */
function BudgetTable() {
  const { s, m, upd } = useLf();
  const [limit, setLimit] = useState(26);
  const src = s.incomes[0];
  const cats = s.period.cats;
  const plans = s.goals.filter((g) => g.kind === 'save' && g.status !== 'done').map((g) => ({ g, plan: installments(s, g) }));
  const acctPer = sum(s.goals.filter((g) => g.kind === 'acct' && g.status !== 'done'), (g) => g.per);
  const horizon = plans.reduce((h, { g, plan }) => { const e = g.pace ? (plan.finish && plan.finish > g.pace.dueBy ? plan.finish : g.pace.dueBy) : plan.finish || (plan.rows.length ? plan.rows[plan.rows.length - 1].date : ''); return e > h ? e : h; }, src.next);
  const all: string[] = [];
  // At least 6 rows, so the budget always looks ahead and a goal without an amount yet can be planned by hand.
  for (let d = src.next, k = 0; (d <= horizon || k < 6) && k < 260; d = D.step(d, src.sched), k++) all.push(d);
  const dates = all.slice(0, limit);
  const cell = (g: Goal, plan: ReturnType<typeof installments>, d: string) => {
    if (plan.waiting || (plan.start && d < plan.start)) return { amt: 0, edited: false, open: false };
    const r = plan.rows.find((x) => x.date === d);
    if (r) return { amt: r.amt, edited: r.edited, open: true };
    return { amt: 0, edited: g.inst?.[d] != null, open: g.pace ? d <= g.pace.dueBy : !plan.finish || d <= plan.finish };
  };
  const pgs = plans.map(({ g }) => s.period.goals.find((x) => x.id === g.id));
  // What each goal still needs, row by row.
  const bal = plans.map(({ g }, i) => r2(Math.max(0, g.target - g.saved - (pgs[i]?.due || 0))));
  const nowBal = bal.slice();
  const leftCap = (n: number) => <span className={'gt-sub' + (n < -0.004 ? ' gt-short' : '')}>{n < -0.004 ? `${u0(-n)} OVER` : `${u0(n)} LEFT`}</span>;
  const goalOf = (id: string) => s.goals.find((x) => x.id === id);
  return (
    <>
      <div className="pane gt-wrap">
        <table className="gt">
          <thead>
            <tr>
              <th className="gt-d">PAYCHECK</th>
              <th>AFTER<br />BILLS</th>
              {cats.map((c) => (
                <th key={c.id} className="gt-cat">
                  <button onClick={() => upd((x) => R.openCat(x, c.id))}>{catName(s, c.id)}</button>
                  <span className="gt-sub">{usd(planCat(s, c.id), 0)} USUALLY</span>
                  <button className="gt-link" onClick={() => upd((x) => R.openFill(x, 'cat', c.id))}>SET SEVERAL</button>
                </th>
              ))}
              {plans.map(({ g, plan }) => (
                <th key={g.id}>
                  <button onClick={() => upd((x) => { x.view = { k: 'goal', id: g.id }; })}>{g.name}</button>
                  <span className="gt-sub">{u0(Math.max(0, g.target - g.saved))} TO GO</span>
                  {g.after && <span className="gt-sub">{plan.waiting ? `AFTER ${U(goalOf(g.after)?.name || 'GOAL')}` : `FROM ${U(D.dm(plan.start!))} ${plan.start!.slice(2, 4)}`}</span>}
                  {!plan.waiting && <button className="gt-link" onClick={() => upd((x) => R.openFill(x, 'goal', g.id))}>SET SEVERAL</button>}
                  {plan.rows.some((r) => r.edited) && <button className="gt-link" onClick={() => upd((x) => R.resetInstallments(x, g.id))} aria-label={`Put ${g.name} back on automatic`}>↺ AUTO</button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="gt-now">
              <td className="gt-d"><b>Current</b><span>{U(D.dm(s.period.start))} {s.period.start.slice(0, 4)}</span>{leftCap(m.unassigned)}</td>
              <td>{u0(m.p.pay + m.p.extra - m.billsT)}</td>
              {m.cats.map((c) => (
                <td key={c.id}><CellField label={`${c.name} this paycheck`} value={c.alloc} edited={false} onCommit={(v) => upd((x) => R.setAlloc(x, c.id, v ?? c.alloc))} /><span className={'gt-sub' + (c.left < -0.004 ? ' gt-short' : '')}>{c.left < -0.004 ? `${u0(-c.left)} OVER` : `${u0(c.left)} TO SPEND`}</span></td>
              ))}
              {plans.map(({ g }, i) => {
                const pg = pgs[i];
                return <td key={g.id}>{!pg ? <span className="gt-na">—</span> : (pg.due || 0) > 0
                  ? <><CellField label={`${g.name} this paycheck`} value={pg.due!} edited={false} onCommit={(v) => upd((x) => R.setDue(x, g.id, v ?? pg.due!))} /><span className="gt-sub">{nowBal[i] > 0.004 ? `${u0(nowBal[i])} TO GO` : 'DONE'}</span><button className="gt-link" onClick={() => upd((x) => R.payInstallment(x, g.id))} aria-label={`Mark ${g.name} installment paid`}>MARK PAID</button></>
                  : <><span className="gt-ok">✓ {u0(pg.a)}</span><span className="gt-sub">PAID</span></>}</td>;
              })}
            </tr>
            {dates.map((d) => {
              const n = periodFrom(s, d), cells = plans.map(({ g, plan }) => cell(g, plan, d)), t = sum(cells, (c) => c.amt);
              return (
                <tr key={d}>
                  <td className="gt-d"><b>{D.dm(d)}</b><span>{D.wd(d).toUpperCase()} {d.slice(0, 4)}</span>{leftCap(paycheckLeft(s, d, t + acctPer))}</td>
                  <td>{u0(r2(n.pay - sum(n.bills, (b) => b.a)))}</td>
                  {cats.map((c) => <td key={c.id}><CellField label={`${catName(s, c.id)} ${D.dmy(d)}`} value={planCatOn(s, c.id, d)} edited={s.plan?.byDate?.[d]?.[c.id] != null} onCommit={(v) => upd((x) => R.setCatOn(x, c.id, d, v))} /></td>)}
                  {plans.map(({ g }, i) => {
                    if (!cells[i].open) return <td key={g.id}><span className="gt-na">—</span></td>;
                    bal[i] = r2(Math.max(0, bal[i] - cells[i].amt));
                    return <td key={g.id}><CellField label={`${g.name} ${D.dmy(d)}`} value={cells[i].amt} edited={cells[i].edited} onCommit={(v) => upd((x) => R.setInstallment(x, g.id, d, v))} /><span className="gt-sub">{bal[i] > 0.004 ? `${u0(bal[i])} TO GO` : 'DONE'}</span></td>;
                  })}
                </tr>
              );
            })}
          </tbody>
          {plans.length > 0 && (
            <tfoot>
              <tr>
                <td className="gt-d"><b>Done</b></td>
                <td colSpan={1 + cats.length} />
                {plans.map(({ g, plan }) => <td key={g.id}><span className={plan.short > 0.004 && g.pace && !plan.waiting ? 'gt-short' : ''}>{plan.waiting ? 'WAITING' : plan.short > 0.004 && g.pace ? <>{u0(plan.short)}<br />SHORT</> : plan.finish ? <>{D.dm(plan.finish)}<br />{plan.finish.slice(0, 4)}</> : '—'}</span></td>)}
              </tr>
              <tr>
                <td className="gt-d"><b>Frees</b></td>
                <td colSpan={1 + cats.length} />
                {plans.map(({ g, plan }) => <td key={g.id}><span>{plan.freeFrom ? <>+{u0(plan.frees)}<br />{D.dm(plan.freeFrom)} {plan.freeFrom.slice(2, 4)}</> : '—'}</span></td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {all.length > dates.length && <button className="btn-fill" onClick={() => setLimit(limit + 26)} style={{ width: 'calc(100% - 28px)', margin: '10px 14px 0', height: 48, borderRadius: 16, font: '600 14px/1 var(--f-text)' }}>Show {Math.min(26, all.length - dates.length)} more paychecks</button>}
      <div style={{ padding: '10px 22px 0', font: '500 9.5px/1.55 var(--f-mono)', letterSpacing: '.05em', color: 'var(--ink3)', textWrap: 'pretty' }}>
        UNDER EACH DATE: WHAT THAT PAYCHECK HAS LEFT AFTER BILLS, BUDGET ITEMS AND GOALS. TAP AN AMOUNT TO CHANGE ONE PAYCHECK, OR SET SEVERAL TO LOCK AN AMOUNT FOR A RUN OF PAYCHECKS. DEADLINE GOALS REBALANCE THE REST. HIGHLIGHTED = SET FOR THAT PAYCHECK; CLEAR IT TO GO BACK. TAP A NAME TO RENAME, MERGE OR EDIT IT.
      </div>
    </>
  );
}

export function Goals() {
  const { s, upd } = useLf();
  const pi = phaseInfo(s), pn = pouchesToday(s), days = useDays14();
  const wv = s.weighIns.slice(-11).map(([, w]) => w), lo = Math.min(...wv), hi = Math.max(...wv), last = wv[wv.length - 1];
  const wPts = wv.map((w, i) => `${((i / Math.max(1, wv.length - 1)) * 120).toFixed(1)},${(((hi - w) / Math.max(0.1, hi - lo)) * 20 + 1).toFixed(1)}`).join(' ');
  const w30 = s.weighIns.filter(([d]) => d >= D.add(s.today, -30));
  const delta = w30.length > 1 ? r2(w30[w30.length - 1][1] - w30[0][1]) : 0;
  const live = s.goals.filter((g) => g.status !== 'done' && g.kind !== 'acct');
  const doneG = s.goals.filter((g) => g.status === 'done');
  // With pay set up, savings goals are planned on the table; project budgets stay as cards.
  const table = s.incomes.length > 0 && live.some((g) => g.kind === 'save');
  const cards = table ? live.filter((g) => g.kind !== 'save') : live;
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab"><span className="t">Goals</span><span className="mono" style={{ font: '500 11px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)', paddingBottom: 4 }}>{usd(sum(s.goals.filter((g) => g.status !== 'done'), (g) => goalPer(s, g)), 0)} / PAYCHECK</span></div>
      <div className="lbl" style={{ padding: '0 22px', margin: '6px 0 10px' }}>LIFESTYLE</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px' }}>
        {nicotineOn(s) && <div className="pane" onClick={() => upd((x) => { x.view = { k: 'wean' }; })} style={{ padding: '15px 14px 14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>Nicotine wean-off</span>
          <span className="disp" style={{ fontSize: 44, lineHeight: 0.82 }}>{pi ? `${pn}/${pi.limit}` : pn}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
            {days.map((d) => <div key={d.iso} style={{ flex: 1, height: Math.min(22, (d.t / 10) * 22), borderRadius: 1, background: d.over ? 'var(--crit)' : 'var(--ink)', opacity: d.over || d.today ? 1 : 0.5 }} />)}
          </div>
          <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{pi ? `PHASE ${pi.idx + 1} OF ${pi.n} · ${pi.mg}` : 'POUCHES TODAY · NO PLAN YET'}</span>
        </div>}
        <div className="pane" onClick={() => upd((x) => { x.view = { k: 'weight' }; })} style={{ padding: '15px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', gridColumn: nicotineOn(s) ? undefined : 'span 2' }}>
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>Weight</span>
          {wv.length ? (
            <>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}><span className="disp" style={{ fontSize: 44, lineHeight: 0.82 }}>{last.toFixed(1)}</span><span className="mono" style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink2)' }}>LB</span></span>
              <svg width="100%" height="22" viewBox="0 0 120 22" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}><polyline points={wPts} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
              <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{s.weightTarget ? `TARGET ${s.weightTarget} · ` : ''}{delta <= 0 ? '−' : '+'}{Math.abs(delta).toFixed(1)} IN 30D</span>
            </>
          ) : (
            <>
              <span className="disp" style={{ fontSize: 44, lineHeight: 0.82, color: 'var(--ink3)' }}>—</span>
              <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>NO WEIGH-INS YET</span>
            </>
          )}
        </div>
      </div>
      {!nicotineOn(s) && (
        <div className="pane mx" style={{ marginTop: 10, padding: '12px 16px 12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 15, fontWeight: 500 }}>Nicotine wean-off</span><span className="cap">HIDDEN · TURN ON TO TRACK POUCHES</span></span>
          <Switch on={false} label="Track nicotine" onChange={(on) => upd((x) => R.setNicotine(x, on))} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 0 22px', margin: '14px 0 0' }}>
        <span className="lbl">MONEY</span>
        <span style={{ display: 'flex' }}>
          <button onClick={() => upd((x) => R.openGoal(x, null))} style={{ height: 44, padding: '0 12px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>+ NEW GOAL</button>
        </span>
      </div>
      {table && (
        <div className="pane list" style={{ margin: '0 14px' }}>
          {live.filter((g) => g.kind === 'save').map((g, i) => {
            const plan = installments(s, g), info = gi(s, g);
            return (
              <button key={g.id} onClick={() => upd((x) => { x.view = { k: 'goal', id: g.id }; })} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '8px 16px 8px 18px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                {i > 0 && <span className="sep" />}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 500 }}><span className="dia" />{g.name}</span>
                  <span className="cap">{plan.waiting ? `AFTER ${U(s.goals.find((x) => x.id === g.after)?.name || 'GOAL')}` : plan.finish ? `DONE ${U(D.dmy(plan.finish))}` + (g.after && plan.start ? ` · FROM ${U(D.dmy(plan.start))}` : '') : plan.short > 0.004 ? `${u0(plan.short)} SHORT` : 'NO INSTALLMENTS'}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: 'none' }}><span style={{ font: '600 15px/1 var(--f-text)' }}>{u0(info.rem)}</span><span className="cap">TO GO</span></span>
              </button>
            );
          })}
          <button onClick={() => upd((x) => { x.tab = 'money'; x.view = null; })} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minHeight: 52, padding: '0 16px 0 18px', border: 0, background: 'none', color: 'var(--ink)', cursor: 'pointer' }}><span className="sep" /><span className="cap8">PLAN EACH PAYCHECK ON THE BUDGET TABLE</span><span style={{ font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.08em' }}>MONEY →</span></button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px', marginTop: table && cards.length ? 14 : 0 }}>
        {cards.map((g) => {
          const info = gi(s, g), proj = g.kind === 'proj' ? s.projects.find((p) => p.goal === g.id) : null;
          return (
            <div key={g.id} className="pane" onClick={() => upd((x) => { x.view = { k: 'goal', id: g.id }; })} style={{ padding: '16px 16px 15px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 500 }}>{g.name}</span>
                  <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{g.kind === 'proj' ? 'PROJECT BUDGET' + (proj ? ' · ' + U(proj.name) : '') : g.event ? 'TRIP BUDGET · ' + U(g.event) : 'SAVINGS'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
                  <span className="disp" style={{ fontSize: 34, lineHeight: 0.85 }}>{u0(info.rem)}</span>
                  <span className="cap8">{g.kind === 'proj' ? 'LEFT TO SPEND' : 'TO GO'}</span>
                </div>
              </div>
              <div className="track"><div style={{ width: `${info.pct}%` }} /></div>
              <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{g.kind === 'proj' ? `${usd(info.have)} spent of ${usd(g.target, 0)} · funded up front` : `${usd(g.saved, 0)} of ${usd(g.target, 0)} · ${goalPer(s, g) ? usd(goalPer(s, g), 0) + ' a paycheck' : 'no paycheck contribution'}${g.pace && s.incomes.length ? ` · ${paychecksLeft(s, g.pace.dueBy)} left` : ''}${(() => { const f = installments(s, g).finish; return f && info.rem > 0 ? ` · done ${D.dmy(f)}` : ''; })()}`}</span>
            </div>
          );
        })}
        {!live.length && <div className="pane" style={{ padding: '20px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No money goals yet. Tap + NEW GOAL for something to save toward, like a trip, and set how many paychecks you have to get there.</div>}
      </div>
      {doneG.length > 0 && (
        <>
          <div className="lbl" style={{ padding: '0 22px', margin: '24px 0 10px' }}>COMPLETED</div>
          <div className="pane list">
            {doneG.map((g, i) => (
              <div key={g.id} onClick={() => upd((x) => { x.view = { k: 'goal', id: g.id }; })} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 16px 13px 18px', cursor: 'pointer' }}>
                {i > 0 && <div className="sep" />}
                <span style={{ fontSize: 15, fontWeight: 500 }}>{g.name}</span>
                <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>DONE {U(D.dm(g.doneOn!))} · {g.doneTo}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Library

export function Library() {
  const { s, upd, files } = useLf();
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab" style={{ paddingRight: 18 }}>
        <span className="t">Library</span>
        <div className="seg">
          <button className={s.lib === 'docs' ? 'on' : ''} onClick={() => upd((x) => { x.lib = 'docs'; })}>DOCS</button>
          <button className={s.lib === 'events' ? 'on' : ''} onClick={() => upd((x) => { x.lib = 'events'; })}>EVENTS</button>
        </div>
      </div>
      {s.lib === 'docs' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px' }}>
            {FOLDERS.map((f) => {
              const docs = (s.docs || []).filter((d) => d.folder === f);
              const urgent = docs.filter((d) => ['expired', 'soon'].includes(expiryState(s, d.expires))).sort((x, y) => (x.expires! < y.expires! ? -1 : 1))[0];
              const st = urgent ? expiryState(s, urgent.expires) : 'none';
              const lock = f === 'Logins';
              return (
                <button key={f} className="pane" onClick={() => upd((x) => { if (lock && files && !x.unlocked) { x.sheet = 'pin'; return; } x.view = { k: 'folder', name: f }; })} style={{ minHeight: 104, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', gap: 10, border: 0, color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                  <span className="disp up" style={{ fontSize: 26, lineHeight: 0.9 }}>{f}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {lock && files
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '600 9.5px/1 var(--f-mono)', letterSpacing: '.06em' }}><span style={{ width: 9, height: 7, borderRadius: 2, background: 'var(--ink)', boxShadow: '0 -4px 0 -1px var(--ink3)' }} />{s.unlocked ? 'UNLOCKED' : 'LOCKED · PIN'}{docs.length ? ` · ${docs.length}` : ''}</span>
                      : <span className="cap">{docs.length ? `${docs.length} ${docs.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}` : 'EMPTY'}</span>}
                    {urgent && <span className="cap" style={{ fontWeight: 600, color: st === 'expired' ? 'var(--crit)' : 'var(--warn)' }}>{U(urgent.title)} {st === 'expired' ? 'EXPIRED' : 'EXPIRES ' + U(D.dm(urgent.expires!))}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {(s.docs || []).filter((d) => d.folder !== 'Logins').length > 0 && (
            <>
              <div className="lbl" style={{ padding: '0 22px', margin: '24px 0 10px' }}>RECENT</div>
              <div className="pane list">
                {(s.docs || []).filter((d) => d.folder !== 'Logins').slice(0, 4).map((d, i) => <DocRow key={d.id} d={d} first={i === 0} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="pane mx" style={{ padding: '20px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No events yet. A trip or occasion will bundle its checklist, budget, bookings and documents here.</div>
      )}
    </div>
  );
}

/** A document in a list: a preview (photo) or file-type tile, the title and what's in it. */
export function DocRow({ d, first }: { d: Doc; first: boolean }) {
  const { s, upd } = useLf();
  const f = d.files[0], st = expiryState(s, d.expires);
  const meta = [d.folder.toUpperCase(), d.files.length ? `${d.files.length} ${d.files.length === 1 ? 'FILE' : 'FILES'}` : 'NO FILES', d.expires ? (st === 'expired' ? 'EXPIRED ' : 'EXPIRES ') + U(D.dm(d.expires)) : 'ADDED ' + U(D.dm(d.added))].join(' · ');
  return (
    <button onClick={() => upd((x) => { x.view = { k: 'doc', id: d.id, from: x.view }; })} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 16px', border: 0, background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
      {!first && <div className="sep" style={{ left: 70 }} />}
      <div style={{ width: 40, height: 50, flex: 'none', borderRadius: 6, overflow: 'hidden', background: f?.thumb ? `center / cover no-repeat url(${f.thumb})` : 'repeating-linear-gradient(135deg, var(--fill2) 0 4px, transparent 4px 8px)', boxShadow: 'inset 0 0 0 1px var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5, font: '600 8px/1 var(--f-mono)', color: 'var(--ink3)' }}>{f?.thumb ? '' : f ? (f.mime.includes('pdf') ? 'PDF' : 'FILE') : 'DOC'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{d.title}</span>
        <span className="cap" style={{ color: st === 'expired' ? 'var(--crit)' : st === 'soon' ? 'var(--warn)' : undefined, fontWeight: st === 'expired' || st === 'soon' ? 600 : 500 }}>{meta}</span>
      </div>
    </button>
  );
}
