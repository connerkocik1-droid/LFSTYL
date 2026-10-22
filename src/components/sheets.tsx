'use client';

import type { ReactNode } from 'react';
import * as D from '@/lib/dates';
import { r2, u0, usd } from '@/lib/format';
import { CATN, R, TIER, gi, nicotineOn, phaseInfo, pouchesToday, subStep } from '@/lib/logic';
import type { CatId, State, Tier } from '@/lib/types';
import { Keypad, useLf } from './ui';

const U = (t: string) => t.toUpperCase();

function Sheet({ gap = 14, children }: { gap?: number; children: ReactNode }) {
  return <div className="sheet" role="dialog" aria-modal="true" style={{ gap }}><div className="grab" />{children}</div>;
}

/** Typed amount with a blinking caret. */
function Amount({ prefix, d = 88, p = 40, h = 78, ch = 62 }: { prefix: string; d?: number; p?: number; h?: number; ch?: number }) {
  const { s } = useLf();
  const amt = s.sheet === 'price' && s.pr ? s.pr.amt : s.draft.amt;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: h, opacity: amt || s.sheet === 'price' ? 1 : 0.35 }}>
      <div className="hero scan"><span style={{ fontSize: p, margin: '4px 3px 0 0' }}>{prefix}</span><span style={{ fontSize: d }}>{amt || '0'}</span></div>
      <span className="caret" style={{ height: ch, margin: '0 0 4px 5px' }} />
    </div>
  );
}

function CatPicks({ sel, onPick }: { sel: CatId | null; onPick: (x: State, id: CatId) => void }) {
  const { m, upd } = useLf();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
      {m.cats.map((c) => (
        <button key={c.id} className={'pick' + (sel === c.id ? ' on' : '')} style={{ height: 52 }} onClick={() => upd((x) => onPick(x, c.id))}>
          <span className="n">{c.name}</span>
          <span className={'m' + (sel !== c.id && c.left < -0.004 ? ' neg' : '')}>{usd(c.left)} left</span>
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string>({ items, sel, onPick, cols }: { items: [T, ReactNode, string?][]; sel: T | null; onPick: (id: T) => void; cols?: number }) {
  return (
    <div style={cols ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 } : { display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([id, label, dot]) => (
        <button key={id} className={'chip' + (sel === id ? ' on' : '')} onClick={() => onPick(id)}>{dot && <span className="dot" style={{ background: dot }} />}{label}</button>
      ))}
    </div>
  );
}

const tiers = (): [Tier, string, string][] => (['P', 'F', 'W'] as Tier[]).map((t) => [t, TIER[t][0], TIER[t][1]]);

function Opts({ opts, sel, onPick, h = 56 }: { opts: { id: string; name: string; meta: string }[]; sel: string | null; onPick: (id: string) => void; h?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {opts.map((x) => (
        <button key={x.id} className={'pick' + (sel === x.id ? ' on' : '')} style={{ minHeight: h, gap: 6, padding: '8px 12px' }} onClick={() => onPick(x.id)}>
          <span style={{ font: '600 14px/1.1 var(--f-text)' }}>{x.name}</span>
          <span className="m" style={{ letterSpacing: '.04em' }}>{x.meta}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Quick add

function AddSheet() {
  const { s, upd } = useLf();
  const lim = phaseInfo(s)?.limit ?? null, of = (n: number) => (lim == null ? `${n}` : `${n} of ${lim}`);
  const tile = { height: 84, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', textAlign: 'left' } as const;
  const T = (t: string, sub: string) => <><span className="disp up" style={{ fontSize: 28, lineHeight: 0.86 }}>{t}</span><span className="cap">{sub}</span></>;
  return (
    <Sheet>
      <span className="lbl">QUICK ADD</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn" onClick={() => upd((x) => { x.sheet = 'expense'; x.draft = { amt: '', cat: null, note: '', y: false }; })} style={{ gridColumn: 'span 2', height: 100, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px 15px', textAlign: 'left' }}>
          <span className="disp up" style={{ fontSize: 40, lineHeight: 0.82 }}>Expense</span>
          <span style={{ font: '500 10px/1 var(--f-mono)', letterSpacing: '.08em' }}>AMOUNT · CATEGORY · DONE</span>
        </button>
        <button className="btn-fill" style={tile} onClick={() => upd((x) => { x.sheet = 'income'; x.draft = { amt: '', cat: null, note: '', y: false }; })}>{T('Income', 'LANDS IN UNASSIGNED')}</button>
        {nicotineOn(s) && <button className="btn-fill" style={tile} onClick={() => upd((x) => { R.pouch(x, 1); x.sheet = null; x.toast = { t: `Pouch logged · ${of(pouchesToday(x))} today` }; })}>{T('Pouch +1', `${of(pouchesToday(s))} TODAY`.toUpperCase())}</button>}
        <button className="btn-fill" style={tile} onClick={() => upd((x) => { x.sheet = 'np'; })}>{T('Project', 'STEPS + BUY STEPS')}</button>
        <button className="btn-fill" style={nicotineOn(s) ? tile : { ...tile, gridColumn: 'span 2' }} onClick={() => upd((x) => R.openStep(x, 'task', 'action'))}>{T('Task', 'ONE TO-DO')}</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Expense / income

function NoteField({ ph }: { ph: string }) {
  const { s, patch } = useLf();
  return <input className="field" value={s.draft.note} placeholder={ph} onChange={(e) => { const v = e.target.value; patch((x) => ({ draft: { ...x.draft, note: v } })); }} />;
}

function ExpenseSheet() {
  const { s, upd } = useLf();
  const amt = parseFloat(s.draft.amt) || 0, ok = amt > 0 && !!s.draft.cat;
  return (
    <Sheet>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20 }}>
        <span className="lbl">LOG EXPENSE</span>
        <button onClick={() => upd((x) => { x.draft.y = !x.draft.y; })} style={{ height: 44, marginRight: -10, padding: '0 10px', border: 0, background: 'none', color: 'var(--ink)', font: '600 10.5px/1 var(--f-mono)', letterSpacing: '.1em', cursor: 'pointer' }}>{s.draft.y ? 'YESTERDAY ▾' : 'TODAY ▾'}</button>
      </div>
      <Amount prefix="$" />
      <CatPicks sel={s.draft.cat} onPick={(x, id) => { x.draft.cat = id; }} />
      <NoteField ph="Note (optional)" />
      <Keypad />
      <button className={'btn' + (ok ? '' : ' dim')} onClick={() => upd((x) => R.logExpense(x))}>{ok ? `Log ${usd(amt)} · ${CATN[s.draft.cat!]}` : amt > 0 ? 'Pick a category' : 'Type an amount'}</button>
    </Sheet>
  );
}

function IncomeSheet() {
  const { s, upd } = useLf();
  const amt = parseFloat(s.draft.amt) || 0;
  return (
    <Sheet>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20 }}><span className="lbl">ADD INCOME</span><span className="lbl" style={{ color: 'var(--ink3)' }}>TODAY</span></div>
      <Amount prefix="+$" />
      <NoteField ph="Where it's from" />
      <Keypad />
      <button className={'btn' + (amt > 0 ? '' : ' dim')} onClick={() => upd((x) => R.addIncome(x))}>{amt > 0 ? `Add ${usd(amt)} to Unassigned` : 'Type an amount'}</button>
    </Sheet>
  );
}

function PlaceSheet({ close }: { close: () => void }) {
  const { s, m, upd } = useLf();
  const pl = s.pl!;
  const opts = [...m.cats.map((c) => ({ id: 'c:' + c.id, name: c.name, meta: usd(c.left) + ' LEFT' })), ...s.goals.filter((g) => g.kind === 'save' && g.status !== 'done').map((g) => ({ id: 'g:' + g.id, name: g.name, meta: usd(gi(s, g).rem, 0) + ' TO GO' }))];
  const sel = opts.find((x) => x.id === pl.to);
  return (
    <Sheet>
      <span className="lbl">IN UNASSIGNED · {pl.src}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="disp scan" style={{ fontSize: 64, lineHeight: 0.8 }}>{usd(pl.amt)}</span>
        <span style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink2)', textWrap: 'pretty' }}>Put it somewhere now, or leave it in Unassigned for later.</span>
      </div>
      <Opts opts={opts} sel={pl.to} onPick={(id) => upd((x) => { x.pl!.to = id; })} />
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10 }}>
        <button className="btn-fill" onClick={close} style={{ height: 54, borderRadius: 18, font: '600 15px/1 var(--f-text)' }}>Later</button>
        <button className={'btn' + (sel ? '' : ' dim')} onClick={() => upd((x) => R.place(x))}>{sel ? `Put ${usd(pl.amt)} into ${sel.name}` : 'Pick where it goes'}</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- New project

function NewProjectSheet() {
  const { s, upd, patch } = useLf();
  const np = s.np, projGoals = s.goals.filter((g) => g.kind === 'proj' && g.status !== 'done');
  const ok = !!np.name.trim() && (np.mode === 'skip' || (np.mode === 'goal' && !!np.goal) || (np.mode === 'new' && !!np.gName.trim() && parseFloat(np.gTarget) > 0));
  const set = (k: 'name' | 'gName' | 'gTarget') => (e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; patch((x) => ({ np: { ...x.np, [k]: v } })); };
  const modes: ['skip' | 'goal' | 'new', string, string][] = [['skip', "This paycheck's budget", 'Buy steps come out of a category you pick'], ['goal', 'An existing goal', 'Buy steps come out of that goal'], ['new', 'A new goal', 'Name it and set a budget']];
  return (
    <Sheet>
      <span className="lbl">NEW PROJECT</span>
      <input className="field" value={np.name} onChange={set('name')} placeholder="Name, e.g. Fix The Car Up" style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 19px/1 var(--f-text)' }} />
      <Chips items={tiers()} sel={np.tier} cols={3} onPick={(t) => upd((x) => { x.np.tier = t; })} />
      <span className="lbl" style={{ marginTop: 4 }}>PAID FROM</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {modes.map(([id, title, sub]) => {
          const on = np.mode === id;
          return (
            <button key={id} onClick={() => upd((x) => { x.np.mode = id; })} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 58, padding: '8px 14px', border: 0, borderRadius: 16, background: on ? 'var(--fill2)' : 'var(--fill)', boxShadow: on ? 'inset 0 0 0 1.5px var(--ink)' : 'inset 0 0 0 1px var(--line)', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, flex: 'none', borderRadius: '50%', boxShadow: on ? 'inset 0 0 0 5px var(--ink)' : 'inset 0 0 0 1.5px var(--ink3)' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ font: '600 14.5px/1.1 var(--f-text)' }}>{title}</span><span style={{ font: '400 12px/1.2 var(--f-text)', color: 'var(--ink2)' }}>{sub}</span></span>
            </button>
          );
        })}
      </div>
      {np.mode === 'goal' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {projGoals.map((g) => (
            <button key={g.id} className={'chip' + (np.goal === g.id ? ' on' : '')} onClick={() => upd((x) => { x.np.goal = g.id; })}>
              <span className="dia" style={{ background: np.goal === g.id ? 'var(--inv)' : 'var(--ink)' }} /><span>{g.name} · {usd(gi(s, g).rem)} left</span>
            </button>
          ))}
          {!projGoals.length && <span style={{ fontSize: 13, color: 'var(--ink2)' }}>No project budgets yet. Pick A new goal instead.</span>}
        </div>
      )}
      {np.mode === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 8 }}>
          <input className="field" value={np.gName} onChange={set('gName')} placeholder="Goal name" style={{ height: 48 }} />
          <input className="field" value={np.gTarget} onChange={set('gTarget')} placeholder="$ Budget" inputMode="decimal" style={{ height: 48, fontWeight: 600 }} />
        </div>
      )}
      <button className={'btn' + (ok ? '' : ' dim')} onClick={() => upd((x) => R.createProject(x))}>Create project</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Add step / task

function StepSheet() {
  const { s, m, upd, patch } = useLf();
  const st = s.st, stP = st.mode === 'project' && s.view && s.view.k === 'project' ? s.projects.find((p) => p.id === (s.view as { id: string }).id) || null : null;
  const isBuy = st.mode === 'project' && st.kind === 'buy';
  const goal = stP && stP.goal ? s.goals.find((g) => g.id === stP.goal) : null;
  const forG = stP ? stP.groups.filter((g) => !g.buy && !g.action.done) : [];
  const ok = !!st.title.trim() && (!isBuy || (parseFloat(st.est) >= 0 && !!forG.find((g) => g.id === st.forA)));
  const set = (k: 'title' | 'est') => (e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; patch((x) => ({ st: { ...x.st, [k]: v } })); };
  return (
    <Sheet>
      <span className="lbl">{st.mode === 'task' ? 'NEW TASK' : 'ADD STEP · ' + (stP ? U(stP.name) : '')}</span>
      {st.mode === 'project' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3, borderRadius: 24, background: 'var(--fill)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          {([['action', 'Action'], ['buy', 'Buy step']] as const).map(([id, label]) => {
            const on = st.kind === id;
            return <button key={id} onClick={() => upd((x) => { x.st.kind = id; if (id === 'buy' && !x.st.forA && forG.length) x.st.forA = forG[forG.length - 1].id; })} style={{ height: 42, border: 0, borderRadius: 21, background: on ? 'var(--ink)' : 'none', color: on ? 'var(--inv)' : 'var(--ink2)', font: `${on ? 600 : 500} 13.5px/1 var(--f-text)`, cursor: 'pointer' }}>{label}</button>;
          })}
        </div>
      )}
      <input className="field" value={st.title} onChange={set('title')} placeholder={isBuy ? 'What to buy' : st.mode === 'task' ? 'What needs doing' : 'What to do'} style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 18px/1 var(--f-text)' }} />
      {isBuy && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="lbl" style={{ flex: 1 }}>ESTIMATED PRICE</span>
            <div style={{ position: 'relative', width: 140 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', font: '600 16px/1 var(--f-text)', color: 'var(--ink3)' }}>$</span>
              <input className="field" value={st.est} onChange={set('est')} placeholder="0" inputMode="decimal" style={{ height: 48, padding: '0 14px 0 28px', font: '600 16px/1 var(--f-text)', textAlign: 'right' }} />
            </div>
          </div>
          <span className="lbl">ATTACHES ABOVE</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {forG.map((g) => <button key={g.id} className={'chip' + (st.forA === g.id ? ' on' : '')} onClick={() => upd((x) => { x.st.forA = g.id; })}>{g.action.title}</button>)}
            {!forG.length && <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Add an action first. Each buy step attaches to one action.</span>}
          </div>
          {goal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, padding: '0 14px', borderRadius: 14, background: 'var(--fill)', fontSize: 13.5 }}><span className="dia" /><span>Comes out of {goal.name} when bought</span></div>
          ) : (
            <>
              <span className="lbl">COMES OUT OF</span>
              <Chips items={m.cats.map((c) => [c.id, c.name] as [CatId, string])} sel={st.cat} onPick={(id) => upd((x) => { x.st.cat = id; })} />
            </>
          )}
        </>
      )}
      {!isBuy && (
        <>
          <span className="lbl">DUE</span>
          <Chips items={[['none', 'No date'], ['tom', 'Tomorrow'], ['week', 'This week'], ['next', 'Next week']]} sel={st.due} onPick={(id) => upd((x) => { x.st.due = id; })} />
        </>
      )}
      {st.mode === 'task' && <Chips items={tiers()} sel={st.tier} cols={3} onPick={(t) => upd((x) => { x.st.tier = t; })} />}
      <button className={'btn' + (ok ? '' : ' dim')} onClick={() => upd((x) => R.addStep(x))}>{st.mode === 'task' ? 'Add task' : isBuy ? 'Attach buy step' : 'Add action'}</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Mark bought

function PriceSheet() {
  const { s, m, upd } = useLf();
  const pr = s.pr!, p = s.projects.find((x) => x.id === pr.pid)!, g = p.groups.find((x) => x.id === pr.gid)!;
  const goal = p.goal ? s.goals.find((x) => x.id === p.goal) : null, amt = parseFloat(pr.amt) || 0;
  const rem = goal ? gi(s, goal).rem : 0, cc = m.cats.find((c) => c.id === pr.cat), after = cc ? r2(cc.left - amt) : 0;
  return (
    <Sheet gap={13}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="lbl">MARK BOUGHT</span><span className="cap8" style={{ fontSize: 10.5 }}>EST {usd(g.buy!.est)}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="disp up" style={{ fontSize: 30, lineHeight: 0.88 }}>{g.buy!.title}</span><span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{p.name}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Amount prefix="$" d={80} p={36} h={70} ch={56} />
        <span className="cap8">{pr.fresh ? 'PREFILLED WITH THE ESTIMATE · TYPE TO CHANGE' : 'ACTUAL PRICE'}</span>
      </div>
      {goal ? (
        <div className="btn-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 58, padding: '8px 14px 8px 16px', borderRadius: 16, cursor: 'default' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="cap8">FROM GOAL · NOT THIS PAYCHECK</span><span style={{ display: 'flex', alignItems: 'center', gap: 9, font: '600 15px/1 var(--f-text)' }}><span className="dia" />{goal.name}</span></span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span className="cap">{usd(rem)} LEFT →</span><span style={{ font: '600 15px/1 var(--f-text)', color: rem - amt < 0 ? 'var(--crit)' : undefined }}>{usd(r2(rem - amt))}</span></span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="lbl">FROM THIS PAYCHECK</span>
            {cc && <span style={{ font: `${after < 0 ? 600 : 500} 10px/1 var(--f-mono)`, letterSpacing: '.04em', color: after < 0 ? 'var(--crit)' : 'var(--ink2)' }}>{cc.name}: {usd(cc.left)} left → {usd(after)}</span>}
          </div>
          <CatPicks sel={pr.cat} onPick={(x, id) => { x.pr!.cat = id; }} />
        </>
      )}
      <Keypad compact />
      <button className="btn" onClick={() => upd((x) => R.markBought(x))}>Mark bought · {usd(amt)}</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Goal complete

function DoneSheet() {
  const { s, m, upd } = useLf();
  const dn = s.dn!, g = s.goals.find((x) => x.id === dn.gid)!, info = gi(s, g), per = g.per;
  if (dn.stage === 1) {
    return (
      <Sheet gap={16}>
        <span className="lbl">GOAL COMPLETE</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 4px' }}>
          <span className="disp up" style={{ fontSize: 48, lineHeight: 0.86 }}>{g.name}</span>
          <span className="disp scan" style={{ fontSize: 104, lineHeight: 0.8 }}>{u0(info.have)}</span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>
            {dn.manual && info.rem > 0 ? `Closed with ${usd(info.rem, 0)} still to go.` : `Reached ${usd(g.target, 0)}. Saved over ${g.hist.length} deposits.`}{' '}
            {per ? `${usd(per, 0)} a paycheck is free again. Nothing moves until you pick where it goes.` : 'It had no paycheck contribution, so nothing is freed.'}
          </span>
        </div>
        <button className="btn" onClick={() => upd((x) => { if (per) x.dn!.stage = 2; else { x.dn!.to = 'u'; R.doneConfirm(x); } })}>{per ? `Place ${usd(per, 0)} a paycheck` : 'Finish'}</button>
      </Sheet>
    );
  }
  const opts = [
    { id: 'sav', name: 'Savings account', meta: 'NEW LINE IN REVIEW' },
    ...s.goals.filter((x) => x.kind === 'save' && x.status !== 'done' && x.id !== g.id).map((x) => ({ id: 'g:' + x.id, name: x.name, meta: `${usd(x.per, 0)} → ${usd(x.per + per, 0)}` })),
    ...m.cats.map((c) => ({ id: 'c:' + c.id, name: c.name, meta: `${usd(c.alloc, 0)} → ${usd(c.alloc + per, 0)}` })),
    { id: 'u', name: 'Unassigned', meta: 'PLACE IT EACH TIME' },
  ];
  const sel = opts.find((x) => x.id === dn.to);
  return (
    <Sheet>
      <span className="lbl">FREED FROM {g.name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span className="disp scan" style={{ fontSize: 64, lineHeight: 0.8 }}>{usd(per, 0)}</span><span className="lbl" style={{ letterSpacing: '.08em' }}>A PAYCHECK</span></span>
        <span style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink2)', textWrap: 'pretty' }}>Where should it go from your next paycheck on? Future reviews prefill with this.</span>
      </div>
      <Opts opts={opts} sel={dn.to} h={54} onPick={(id) => upd((x) => { x.dn!.to = id; })} />
      <button className={'btn' + (sel ? '' : ' dim')} onClick={() => upd((x) => R.doneConfirm(x))}>{sel ? `Send ${usd(per, 0)} to ${sel.name}` : 'Pick where it goes'}</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Income / bill edit

function EdSheet() {
  const { s, dark, upd, patch } = useLf();
  const e = s.ed!, isInc = e.kind === 'inc', src = s.incomes[0];
  const amt = parseFloat(String(e.amt).replace(/[$,]/g, '')) || 0, valid = /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''), isPrim = isInc && (!src || e.id === src.id);
  let preview = '', note = '';
  if (valid && isInc) {
    const d2 = D.step(e.date, e.sched), d3 = D.step(d2, e.sched);
    preview = 'NEXT ' + U(D.wdm(e.date)) + ' · ' + U(D.wdm(d2)) + ' · ' + U(D.wdm(d3));
    note = isPrim ? 'This source starts each budget period. Changes apply from this paycheck on.' : 'Added to whichever budget period its pay date falls in.';
  }
  if (valid && !isInc && !src) {
    preview = 'DUE ' + U(D.wdm(e.date));
    note = 'Once your pay is set up, each bill comes off the top of the paycheck it falls in, before categories and goals.';
  }
  if (valid && !isInc && src) {
    const ns = src.next;
    let d = e.date, k = 0;
    while (d < ns && k < 60) { d = D.step(d, e.sched); k++; }
    let pp = ns; k = 0;
    while (D.step(pp, src.sched) <= d && k < 60) { pp = D.step(pp, src.sched); k++; }
    preview = 'COMES OFF THE PAYCHECK ON ' + U(D.wdm(pp));
    note = e.date < ns ? 'Due ' + D.wdm(e.date) + ', before your next paycheck, so that one is not in a budget. From ' + D.wdm(d) + ' on it comes off the top.' : 'Due ' + D.wdm(d) + '. It comes off the top of that paycheck, before categories and goals.';
  }
  const ok = !!e.name.trim() && amt > 0 && valid && (!isInc || e.date >= s.today);
  const opts: [D.Sched, string][] = isInc ? [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['semimonthly', '1st and 15th'], ['monthly', 'Monthly']] : [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
  const set = (k: 'name' | 'amt' | 'date') => (ev: React.ChangeEvent<HTMLInputElement>) => { const v = ev.target.value; patch((x) => ({ ed: { ...x.ed!, [k]: v } })); };
  const fieldL = { font: '500 9.5px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' } as const;
  return (
    <Sheet>
      <span className="lbl">{(e.id ? 'EDIT ' : 'NEW ') + (isInc ? 'INCOME' : 'BILL')}</span>
      <input className="field" value={e.name} onChange={set('name')} placeholder={isInc ? 'Name, e.g. Primary job' : 'Name, e.g. Rent'} style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 18px/1 var(--f-text)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldL}>AMOUNT</span>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', font: '600 15px/1 var(--f-text)', color: 'var(--ink3)' }}>$</span>
            <input className="field" value={e.amt} onChange={set('amt')} placeholder="0" inputMode="decimal" style={{ height: 48, padding: '0 14px 0 28px', fontWeight: 600 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldL}>{isInc ? 'NEXT PAY DATE' : 'NEXT DUE DATE'}</span>
          <input className="field" type="date" value={e.date} onChange={set('date')} style={{ height: 48, padding: '0 12px', fontWeight: 600, colorScheme: dark ? 'dark' : 'light' }} />
        </div>
      </div>
      <span className="lbl">{isInc ? 'PAID' : 'REPEATS'}</span>
      <Chips items={opts} sel={e.sched} cols={2} onPick={(id) => upd((x) => { x.ed!.sched = id; })} />
      {preview && (
        <div style={{ padding: '13px 14px', borderRadius: 14, background: 'var(--fill)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: '600 10px/1.4 var(--f-mono)', letterSpacing: '.06em' }}>{preview}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>{note}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {!!e.id && !isPrim && <button className="btn-fill" onClick={() => upd((x) => R.delEd(x))} style={{ height: 54, padding: '0 20px', borderRadius: 18, font: '600 15px/1 var(--f-text)' }}>Delete</button>}
        <button className={'btn' + (ok ? '' : ' dim')} style={{ flex: 1 }} onClick={() => upd((x) => R.saveEd(x))}>{e.id ? 'Save' : isInc ? 'Add income' : 'Add bill'}</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Wean-off phase

function PhaseSheet() {
  const { s, dark, upd, patch } = useLf();
  const p = s.ph!, limit = parseInt(p.limit, 10), iso = /^\d{4}-\d{2}-\d{2}$/;
  const datesOk = iso.test(p.start) && iso.test(p.end) && p.end >= p.start;
  const ok = datesOk && limit >= 0;
  const days = datesOk ? D.diff(p.end, p.start) + 1 : 0;
  const set = (k: 'start' | 'end' | 'limit' | 'mg') => (ev: React.ChangeEvent<HTMLInputElement>) => { const v = ev.target.value; patch((x) => ({ ph: { ...x.ph!, [k]: v } })); };
  const fieldL = { font: '500 9.5px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' } as const;
  const box = (label: string, input: ReactNode) => <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}><span style={fieldL}>{label}</span>{input}</div>;
  const dateIn = { height: 48, padding: '0 12px', fontWeight: 600, colorScheme: dark ? 'dark' : 'light' } as const;
  const n = p.idx != null ? p.idx + 1 : s.phases.length + 1;
  return (
    <Sheet>
      <span className="lbl">{p.idx != null ? `EDIT PHASE ${n}` : `NEW PHASE · ${n}`}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        {box('STARTS', <input className="field" type="date" value={p.start} onChange={set('start')} style={dateIn} />)}
        {box('ENDS', <input className="field" type="date" value={p.end} onChange={set('end')} style={dateIn} />)}
        {box('POUCHES A DAY', <input className="field" value={p.limit} onChange={set('limit')} placeholder="6" inputMode="numeric" style={{ height: 48, fontWeight: 600 }} />)}
        {box('STRENGTH (MG)', <input className="field" value={p.mg} onChange={set('mg')} placeholder="4" inputMode="decimal" style={{ height: 48, fontWeight: 600 }} />)}
      </div>
      <div style={{ padding: '13px 14px', borderRadius: 14, background: 'var(--fill)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '600 10px/1.4 var(--f-mono)', letterSpacing: '.06em', color: datesOk ? 'var(--ink)' : 'var(--crit)' }}>
          {!datesOk ? 'THE END DATE MUST BE ON OR AFTER THE START' : `${days} ${days === 1 ? 'DAY' : 'DAYS'} · ${U(D.dm(p.start))} – ${U(D.dm(p.end))}`}
        </span>
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>Each day in this phase, your pouch count is measured against this limit. Going over is shown, not blocked.</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {p.idx != null && <button className="btn-fill" onClick={() => upd((x) => R.delPhase(x))} style={{ height: 54, padding: '0 20px', borderRadius: 18, font: '600 15px/1 var(--f-text)' }}>Delete</button>}
        <button className={'btn' + (ok ? '' : ' dim')} style={{ flex: 1 }} onClick={() => upd((x) => R.savePhase(x))}>{p.idx != null ? 'Save phase' : 'Add phase'}</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Subscription

function SubSheet() {
  const { s, m, dark, upd, patch } = useLf();
  const e = s.sb!, amt = parseFloat(String(e.amt).replace(/[$,]/g, '')) || 0, valid = /^\d{4}-\d{2}-\d{2}$/.test(e.next);
  const past = valid && !e.id && e.next < s.today;
  const ok = !!e.name.trim() && amt > 0 && valid && !past;
  const set = (k: 'name' | 'amt' | 'next') => (ev: React.ChangeEvent<HTMLInputElement>) => { const v = ev.target.value; patch((x) => ({ sb: { ...x.sb!, [k]: v } })); };
  const fieldL = { font: '500 9.5px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--ink3)' } as const;
  let preview = '';
  if (valid) { const d2 = subStep(e.next, e.freq), d3 = subStep(d2, e.freq); preview = 'CHARGES ' + U(D.dm(e.next)) + ' · ' + U(D.dm(d2)) + ' · ' + U(D.dm(d3)); }
  return (
    <Sheet>
      <span className="lbl">{e.id ? 'EDIT SUBSCRIPTION' : 'NEW SUBSCRIPTION'}</span>
      <input className="field" value={e.name} onChange={set('name')} placeholder="Name, e.g. Netflix" style={{ height: 54, borderRadius: 16, padding: '0 16px', font: '600 18px/1 var(--f-text)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldL}>AMOUNT</span>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', font: '600 15px/1 var(--f-text)', color: 'var(--ink3)' }}>$</span>
            <input className="field" value={e.amt} onChange={set('amt')} placeholder="0" inputMode="decimal" style={{ height: 48, padding: '0 14px 0 28px', fontWeight: 600 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldL}>NEXT CHARGE</span>
          <input className="field" type="date" value={e.next} onChange={set('next')} style={{ height: 48, padding: '0 12px', fontWeight: 600, colorScheme: dark ? 'dark' : 'light' }} />
        </div>
      </div>
      <span className="lbl">REPEATS</span>
      <Chips items={[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]} sel={e.freq} cols={3} onPick={(id) => upd((x) => { x.sb!.freq = id; })} />
      <span className="lbl">COMES OUT OF</span>
      <Chips items={m.cats.map((c) => [c.id, c.name] as [CatId, string])} sel={e.cat} onPick={(id) => upd((x) => { x.sb!.cat = id; })} />
      {(preview || past) && (
        <div style={{ padding: '13px 14px', borderRadius: 14, background: 'var(--fill)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: '600 10px/1.4 var(--f-mono)', letterSpacing: '.06em', color: past ? 'var(--crit)' : 'var(--ink)' }}>{past ? 'PICK TODAY OR A LATER DATE' : preview}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>{e.next === s.today ? "Today's charge is logged as soon as you save." : 'Each charge is logged as an expense on its date, even if the app is closed that day.'}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {!!e.id && <button className="btn-fill" onClick={() => upd((x) => R.delSub(x))} style={{ height: 54, padding: '0 20px', borderRadius: 18, font: '600 15px/1 var(--f-text)' }}>Delete</button>}
        <button className={'btn' + (ok ? '' : ' dim')} style={{ flex: 1 }} onClick={() => upd((x) => R.saveSub(x))}>{e.id ? 'Save' : 'Add subscription'}</button>
      </div>
    </Sheet>
  );
}

export function Sheets() {
  const { s, upd } = useLf();
  const sh = s.sheet;
  if (!sh) return null;
  const close = () => upd((x) => { if (x.sheet === 'place' && x.pl) x.toast = { t: `${usd(x.pl.amt)} waiting in Unassigned` }; x.sheet = null; x.pr = null; x.pl = null; x.ed = null; x.ph = null; x.sb = null; });
  return (
    <>
      <div className="scrim" onClick={close} />
      {sh === 'add' && <AddSheet />}
      {sh === 'expense' && <ExpenseSheet />}
      {sh === 'income' && <IncomeSheet />}
      {sh === 'place' && s.pl && <PlaceSheet close={close} />}
      {sh === 'np' && <NewProjectSheet />}
      {sh === 'step' && <StepSheet />}
      {sh === 'price' && s.pr && <PriceSheet />}
      {sh === 'done' && s.dn && <DoneSheet />}
      {sh === 'ed' && s.ed && <EdSheet />}
      {sh === 'phase' && s.ph && <PhaseSheet />}
      {sh === 'sub' && s.sb && <SubSheet />}
    </>
  );
}
