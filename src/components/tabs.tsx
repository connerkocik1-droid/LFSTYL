'use client';

import * as D from '@/lib/dates';
import { num, r2, sg, split, sum, u0, usd } from '@/lib/format';
import { CATN, R, TIER, gi, idleDays, limitOn, nextP, phaseInfo, pouchesToday, taskRel } from '@/lib/logic';
import type { State } from '@/lib/types';
import { Check, Hero, Lens, LensButton, MoneyBars, Sec, useLf } from './ui';

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
  const tr = (t: State['tasks'][number], reason: string, crit: boolean): Rec => ({ key: t.id, title: t.title, reason, crit, isBuy: false, tc: TIER[t.tier][1], tn: TIER[t.tier][0], check: () => upd((x) => R.toggleTask(x, t.id)) });
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

export function Today() {
  const { s, m, upd, shown } = useLf();
  const nx = nextP(s), daysTo = s.incomes.length ? Math.max(0, D.diff(s.incomes[0].next, s.today)) : null;
  const pd = s.pendingDone ? s.goals.find((g) => g.id === s.pendingDone) : null;
  const pi = phaseInfo(s), lim = pi ? pi.limit : null, pn = pouchesToday(s), pOver = lim != null && pn > lim;
  const ov = m.over.slice().sort((a, b) => a.left - b.left);
  const recs = useRecs();
  const goMoney = () => upd((x) => { x.tab = 'money'; x.view = null; x.moff = 0; });
  const hero = split(shown);
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab"><span className="t">Today</span><span className="mono" style={{ font: '500 11px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)', paddingBottom: 4 }}>{U(D.wdm(s.today))}</span></div>

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

      {pd && s.sheet !== 'done' && (() => {
        const g = gi(s, pd);
        return (
          <div className="pane" style={{ margin: '0 14px 12px', padding: '16px 16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'lfPop .45s cubic-bezier(.2,1.2,.3,1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="lbl">GOAL COMPLETE</span>
              <span className="disp up" style={{ fontSize: 34, lineHeight: 0.86 }}>{pd.name}</span>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{`${u0(g.have)} saved` + (pd.per ? ` · ${usd(pd.per, 0)} a paycheck freed` : '')}</span>
            </div>
            <button className="btn" style={{ height: 52, borderRadius: 16 }} onClick={() => upd((x) => R.openDone(x, x.pendingDone))}>{pd.per ? `Place ${usd(pd.per, 0)} a paycheck` : 'Finish'}</button>
          </div>
        );
      })()}

      <Lens radius={30} inset={6} innerRadius={24} className="mx" style={{ cursor: 'pointer' }} onClick={goMoney}>
        <div style={{ padding: '17px 20px 16px' }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>LEFT THIS PAYCHECK</span><span>{daysTo == null ? 'NO PAY SET UP' : daysTo ? `${daysTo} DAYS TO PAYDAY` : 'PAYDAY'}</span></div>
          <Hero v={hero} style={{ marginTop: 12 }} />
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.3, color: 'var(--ink2)' }}>{`of ${usd(m.p.pay + m.p.extra)}` + (Math.abs(m.rollT) > 0.004 ? ` · ${sg(m.rollT)} rolled over` : '')}</div>
          <MoneyBars b={m.billsT} sp={m.spentT} g={m.goalsT} l={m.left} lgL={'LEFT ' + num(shown)} />
        </div>
      </Lens>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 14px 0' }}>
        <div className="pane" onClick={() => upd((x) => { x.view = { k: 'wean' }; })} style={{ minHeight: 150, cursor: 'pointer', padding: '14px 12px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
          <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 4 }}><span>POUCHES</span><span>{pi ? pi.mg : ''}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div className="disp" style={{ display: 'flex', alignItems: 'baseline', lineHeight: 0.86, overflow: 'hidden' }}><span style={{ fontSize: 60 }}><PouchNum n={pn} over={pOver} /></span>{lim != null && <span style={{ fontSize: 30, color: 'var(--ink3)', marginLeft: 2 }}>/{lim}</span>}</div>
            <LensButton size={54} inset={5} label="Add one pouch" onClick={(e) => { e.stopPropagation(); upd((x) => R.pouch(x, 1)); }}>
              <span className="disp" style={{ position: 'relative', fontSize: 24, lineHeight: 1 }}>+1</span>
            </LensButton>
          </div>
          {lim != null && <Pips n={pn} lim={lim} w={14} h={5} gap={3} />}
          <div style={{ font: `${pOver ? 600 : 500} 9.5px/1 var(--f-mono)`, letterSpacing: '.08em', color: pOver ? 'var(--crit)' : 'var(--ink3)' }}>{!pi ? 'TODAY · NO PLAN YET' : pOver ? `${pn - lim!} OVER TODAY'S LIMIT` : `PHASE ${pi.idx + 1} · ENDS ${U(D.dm(pi.ph.end))}`}</div>
        </div>
        <div className="pane" onClick={daysTo == null && !ov.length ? () => upd((x) => { x.tab = 'money'; x.view = { k: 'setup' }; }) : goMoney} style={{ minHeight: 150, cursor: 'pointer', padding: '14px 12px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
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
                  <div style={{ minWidth: 0 }}>
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
          <button className="btn-fill" onClick={() => m.unassigned > 0 && upd((x) => R.openPlace(x, m.unassigned))} style={{ height: 44, padding: '0 18px', borderRadius: 14, font: '600 13.5px/1 var(--f-text)', opacity: m.unassigned > 0 ? 1 : 0.35 }}>Place it</button>
        </div>
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
          {m.p.goals.length > 0 && <><Sec l="GOAL CONTRIBUTIONS" r={usd(m.goalsT)} />
          <div className="pane list">
            {m.p.goals.map((pg, i) => (
              <div key={pg.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, padding: '0 16px 0 18px' }}>
                {i > 0 && <div className="sep" />}
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15 }}><span className="dia" />{gName(pg.id)}</span>
                <span style={{ font: '600 15px/1 var(--f-text)' }}>{usd(pg.a)}</span>
              </div>
            ))}
          </div></>}
          {m.p.bills.length > 0 && <><Sec l="TAKEN OFF THE TOP" r={usd(m.billsT)} />
          <BillList bills={m.p.bills} h={50} /></>}
          <button className="btn-fill" onClick={() => upd((x) => { x.view = { k: 'setup' }; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'calc(100% - 28px)', margin: '10px 14px 0', minHeight: 54, padding: '0 16px 0 18px', borderRadius: 16 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}><span style={{ font: '600 14.5px/1 var(--f-text)' }}>Income and bills</span><span className="cap">{src ? 'PAY ' + usd(src.amt, 0) + ' ' + D.SL[src.sched] + ' · ' + s.billsDef.length + ' BILLS' : 'SET UP YOUR PAY AND BILLS'}</span></span>
            <span style={{ font: '500 14px/1 var(--f-mono)', color: 'var(--ink2)' }}>→</span>
          </button>
          <Sec l="EXPENSES" r={m.exp.length} />
          <div className="pane list">
            {m.exp.map((e, i) => (
              <div key={e.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 16px 10px 18px' }}>
                {i > 0 && <div className="sep" />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{e.note}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="cap">{U(D.dm(e.date)) + (e.proj ? ' · ' + U(e.proj) : '')}</span>
                    {e.goal && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 8px', borderRadius: 10, boxShadow: 'inset 0 0 0 1px var(--ink3)', font: '600 9.5px/1 var(--f-mono)', letterSpacing: '.06em' }}><span className="dia" style={{ width: 5, height: 5 }} />{U(gName(e.goal))}</span>}
                    {e.cat && <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{CATN[e.cat]}</span>}
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

export function Goals() {
  const { s, upd } = useLf();
  const pi = phaseInfo(s), pn = pouchesToday(s), days = useDays14();
  const wv = s.weighIns.slice(-11).map(([, w]) => w), lo = Math.min(...wv), hi = Math.max(...wv), last = wv[wv.length - 1];
  const wPts = wv.map((w, i) => `${((i / Math.max(1, wv.length - 1)) * 120).toFixed(1)},${(((hi - w) / Math.max(0.1, hi - lo)) * 20 + 1).toFixed(1)}`).join(' ');
  const w30 = s.weighIns.filter(([d]) => d >= D.add(s.today, -30));
  const delta = w30.length > 1 ? r2(w30[w30.length - 1][1] - w30[0][1]) : 0;
  const live = s.goals.filter((g) => g.status !== 'done' && g.kind !== 'acct');
  const doneG = s.goals.filter((g) => g.status === 'done');
  return (
    <div className="screen" {...scrollProps}>
      <div className="h-tab"><span className="t">Goals</span><span className="mono" style={{ font: '500 11px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--ink2)', paddingBottom: 4 }}>{usd(sum(s.goals.filter((g) => g.status !== 'done'), (g) => g.per), 0)} / PAYCHECK</span></div>
      <div className="lbl" style={{ padding: '0 22px', margin: '6px 0 10px' }}>LIFESTYLE</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px' }}>
        <div className="pane" onClick={() => upd((x) => { x.view = { k: 'wean' }; })} style={{ padding: '15px 14px 14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>Nicotine wean-off</span>
          <span className="disp" style={{ fontSize: 44, lineHeight: 0.82 }}>{pi ? `${pn}/${pi.limit}` : pn}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
            {days.map((d) => <div key={d.iso} style={{ flex: 1, height: Math.min(22, (d.t / 10) * 22), borderRadius: 1, background: d.over ? 'var(--crit)' : 'var(--ink)', opacity: d.over || d.today ? 1 : 0.5 }} />)}
          </div>
          <span style={{ font: '500 9.5px/1.3 var(--f-mono)', letterSpacing: '.06em', color: 'var(--ink3)' }}>{pi ? `PHASE ${pi.idx + 1} OF ${pi.n} · ${pi.mg}` : 'POUCHES TODAY · NO PLAN YET'}</span>
        </div>
        <div className="pane" style={{ padding: '15px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      <div className="lbl" style={{ padding: '0 22px', margin: '24px 0 10px' }}>MONEY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px' }}>
        {live.map((g) => {
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
              <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{g.kind === 'proj' ? `${usd(info.have)} spent of ${usd(g.target, 0)} · funded up front` : `${usd(g.saved, 0)} of ${usd(g.target, 0)} · ${g.per ? usd(g.per, 0) + ' a paycheck' : 'no paycheck contribution'}`}</span>
            </div>
          );
        })}
        {!live.length && <div className="pane" style={{ padding: '20px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No money goals yet. Tap + and start a project to create a budget goal for it.</div>}
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

// The brief's fixed folders. Adding files isn't built yet, so they start empty.
const FOLDERS: { name: string; lines: { t: string; tone?: 'warn' | 'lock' }[] }[] = [
  { name: 'Insurance', lines: [{ t: 'NO FILES' }] },
  { name: 'Car', lines: [{ t: 'NO FILES' }] },
  { name: 'Medical', lines: [{ t: 'NO FILES' }] },
  { name: 'IDs', lines: [{ t: 'NO FILES' }] },
  { name: 'Logins', lines: [{ t: 'LOCKED · FACE ID', tone: 'lock' }] },
  { name: 'Other', lines: [{ t: 'NO FILES' }] },
];

export function Library() {
  const { s, upd } = useLf();
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
            {FOLDERS.map((f) => (
              <div key={f.name} className="pane" style={{ minHeight: 104, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                <span className="disp up" style={{ fontSize: 26, lineHeight: 0.9 }}>{f.name}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {f.lines.map((l) => l.tone === 'lock'
                    ? <span key={l.t} style={{ display: 'flex', alignItems: 'center', gap: 7, font: '600 9.5px/1 var(--f-mono)', letterSpacing: '.06em' }}><span style={{ width: 9, height: 7, borderRadius: 2, background: 'var(--ink)', boxShadow: '0 -4px 0 -1px var(--ink3)' }} />{l.t}</span>
                    : <span key={l.t} className="cap" style={l.tone === 'warn' ? { fontWeight: 600, color: 'var(--warn)' } : undefined}>{l.t}</span>)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pane mx" style={{ padding: '20px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)' }}>No events yet. A trip or occasion will bundle its checklist, budget, bookings and documents here.</div>
      )}
    </div>
  );
}
