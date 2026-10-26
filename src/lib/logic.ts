import * as D from './dates';
import { r2, sum, usd } from './format';
import { SEED_TODAY, emptyData, freshUI, seedData } from './seed';
import type { CatId, DocFile, Expense, Folder, Goal, Phase, State, Sub, Tier } from './types';

const MONTH = (iso: string) => iso.slice(0, 7);
/** "13 – 26 OCT" or "28 OCT – 10 NOV" */
export const periodLabel = (start: string, end: string) =>
  (MONTH(start) === MONTH(end) ? D.dayOfMonth(start) + ' – ' + D.dm(end) : D.dm(start) + ' – ' + D.dm(end)).toUpperCase();

export const CATN: Record<string, string> = { groc: 'Groceries', gas: 'Gas', eat: 'Eating out', house: 'Household', fun: 'Fun' };
/** A category's name: yours if you added or renamed it, otherwise the starter name. */
export const catName = (s: State, id: CatId) => s.catNames?.[id] ?? CATN[id] ?? 'Category';

export const TIER: Record<Tier, [string, string]> = { P: ['Personal', 'var(--tP)'], F: ['Financial', 'var(--tF)'], W: ['Work', 'var(--tW)'] };

/** Money in the current paycheck period. */
export function money(s: State) {
  const p = s.period;
  const exp = s.expenses.filter((e) => e.per === p.id);
  const cats = p.cats.map((c) => {
    const spent = r2(sum(exp.filter((e) => e.cat === c.id), (e) => e.amt));
    const avail = r2(c.alloc + c.roll);
    return { id: c.id, name: catName(s, c.id), alloc: c.alloc, roll: c.roll, spent, avail, left: r2(avail - spent) };
  });
  const billsT = sum(p.bills, (b) => b.a), allocT = sum(cats, (c) => c.alloc), rollT = r2(sum(cats, (c) => c.roll));
  const spentT = r2(sum(cats, (c) => c.spent)), goalsT = r2(sum(p.goals, (g) => g.a));
  const unassigned = r2(p.pay + p.extra - billsT - allocT - goalsT);
  const left = r2(allocT + rollT - spentT + unassigned);
  // Before the first paycheck is set up there is no budget to be over.
  const unbudgeted = p.pay + p.extra === 0 && allocT === 0;
  const over = unbudgeted ? [] : cats.filter((c) => c.left < -0.004);
  const health: 'Over' | 'Tight' | 'Healthy' = unbudgeted ? 'Healthy' : left < 0 ? 'Over' : over.length ? 'Tight' : 'Healthy';
  return { p, exp, cats, billsT, allocT, rollT, spentT, goalsT, unassigned, left, over, health };
}
export type Money = ReturnType<typeof money>;

/** Goal progress. Savings goals count contributions; project goals count purchases. */
export function gi(s: State, g: Goal) {
  if (g.kind === 'proj') {
    const used = r2(sum(s.expenses.filter((e) => e.goal === g.id), (e) => e.amt));
    return { have: used, rem: r2(g.target - used), pct: Math.min(100, (used / g.target) * 100) };
  }
  if (g.kind === 'acct') return { have: g.saved, rem: 0, pct: 0 };
  return { have: g.saved, rem: r2(Math.max(0, g.target - g.saved)), pct: Math.min(100, (g.saved / g.target) * 100) };
}

/** The next budget period, built from the income and bill settings. Null until an income source is set up. */
export function nextP(s: State) {
  const src = s.incomes[0];
  if (!src) return null;
  const start = src.next, nxt = D.step(start, src.sched), end = D.add(nxt, -1);
  const occ = (from: string, k: D.Sched, a: string, b: string) => {
    const out: string[] = [];
    let d = from, n = 0;
    while (d <= b && n < 80) { if (d >= a) out.push(d); d = D.step(d, k); n++; }
    return out;
  };
  const extras = s.incomes.slice(1).flatMap((i) => occ(i.next, i.sched, start, end).map((d) => ({ n: i.name, a: i.amt, d })));
  const bills = s.billsDef.flatMap((b) => occ(b.due, b.freq, start, end).map((d) => ({ n: b.name, a: b.amt, d }))).sort((x, y) => (x.d < y.d ? -1 : 1));
  const U = (t: string) => t.toUpperCase(), sameM = start.slice(0, 7) === end.slice(0, 7);
  return {
    id: 'p' + start, start, end, nxt, pay: r2(src.amt + sum(extras, (e) => e.a)), srcName: src.name, srcSched: src.sched, extras, bills,
    label: U(sameM ? D.p(start).getUTCDate() + ' – ' + D.dm(end) : D.dm(start) + ' – ' + D.dm(end)),
    range: U(D.wdm(start) + ' – ' + D.wdm(end)),
  };
}

export function rvUn(s: State) {
  const n = nextP(s)!;
  return r2(n.pay - sum(n.bills, (b) => b.a) - sum(Object.values(s.rv!.cats) as number[]) - sum(Object.values(s.rv!.goals)));
}

export const nicotineOn = (s: State) => s.nicotineOn !== false;

/** The next n pay dates from the primary income, starting with the upcoming one. */
export function paydays(s: State, n: number) {
  const src = s.incomes[0], out: string[] = [];
  if (!src) return out;
  let d = src.next;
  for (let k = 0; k < n; k++) { out.push(d); d = D.step(d, src.sched); }
  return out;
}

/** Paychecks from the upcoming one through dueBy (at least 1, so an overdue goal asks for the rest now). */
export function paychecksLeft(s: State, dueBy: string) {
  const src = s.incomes[0];
  if (!src) return 0;
  let d = src.next, n = 0;
  while (d <= dueBy && n < 520) { n++; d = D.step(d, src.sched); }
  return Math.max(1, n);
}

export interface Installment { date: string; amt: number; edited: boolean }

/** A savings goal's upcoming installments, one per paycheck from the next payday, until it's reached.
 *  Amounts you set stay as set; a paced goal spreads the rest evenly (whole dollars) over its other paychecks.
 *  This paycheck's unpaid installment counts as on its way, unless lapse (it won't be paid before the review). */
export function installments(s: State, g: Goal, lapse = false) {
  const rows: Installment[] = [];
  const src = s.incomes[0], pg = s.period.goals.find((x) => x.id === g.id), due = lapse ? 0 : r2(pg?.due || 0);
  const out = { rows, due, finish: null as string | null, freeFrom: null as string | null, short: 0, frees: 0 };
  if (g.kind !== 'save' || g.status === 'done' || !src) return out;
  const ov = g.inst || {};
  let left = r2(Math.max(0, g.target - g.saved - due));
  if (g.pace) {
    const dates = paydays(s, paychecksLeft(s, g.pace.dueBy)), free = dates.filter((d) => ov[d] == null);
    const each = free.length ? Math.ceil(Math.max(0, left - sum(dates.filter((d) => ov[d] != null), (d) => ov[d])) / free.length) : 0;
    for (const d of dates) {
      if (left <= 0.004) break;
      const a = r2(Math.min(ov[d] ?? each, left));
      rows.push({ date: d, amt: a, edited: ov[d] != null }); left = r2(left - a);
    }
  } else {
    const later = (d: string) => Object.keys(ov).some((k) => k > d);
    let d = src.next;
    for (let k = 0; k < 520 && left > 0.004; k++, d = D.step(d, src.sched)) {
      const a = r2(Math.min(ov[d] ?? g.per, left));
      if (a <= 0 && ov[d] == null && !later(d)) break;
      rows.push({ date: d, amt: a, edited: ov[d] != null }); left = r2(left - a);
    }
  }
  out.short = left;
  const last = [...rows].reverse().find((r) => r.amt > 0);
  if (left <= 0.004) {
    out.finish = last ? last.date : due > 0 ? s.period.start : null;
    out.freeFrom = last ? D.step(last.date, src.sched) : due > 0 ? src.next : null;
  }
  // What a paycheck gets back when it's done: the usual installment (the most common amount; the last is often a remainder).
  const amts = rows.filter((r) => r.amt > 0).map((r) => r.amt), count = new Map<number, number>();
  amts.forEach((a) => count.set(a, (count.get(a) || 0) + 1));
  out.frees = amts.length ? [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] : due;
  return out;
}

/** What a goal takes from the next paycheck. lapse: as the paycheck review sees it. */
export function goalPer(s: State, g: Goal, lapse = false) {
  if (g.status === 'done') return 0;
  if (g.kind === 'save' && s.incomes.length) return installments(s, g, lapse).rows.find((r) => r.date === s.incomes[0].next)?.amt ?? 0;
  return g.per;
}

/** This paycheck's installments that are set aside but not marked paid yet. */
export const dueInstallments = (s: State) => s.period.goals.filter((pg) => (pg.due || 0) > 0.004 && s.goals.some((g) => g.id === pg.id));

/** The per-paycheck amount a finished goal frees up. */
export const freedPer = (s: State, g: Goal) => goalPer(s, g) || g.per;

/** This paycheck's plan for a category: the standing budget, else last period's amount. */
export const planCat = (s: State, id: CatId) => s.plan?.cats[id] ?? s.period.cats.find((c) => c.id === id)?.alloc ?? 0;

/** The wean-off phase for a day. Null until a plan exists. */
export function phaseInfo(s: State, iso = s.today) {
  if (!s.phases.length) return null;
  const i = s.phases.findIndex((ph) => iso >= ph.start && iso <= ph.end);
  const idx = i >= 0 ? i : iso < s.phases[0].start ? 0 : s.phases.length - 1;
  const ph: Phase = s.phases[idx];
  return { idx, n: s.phases.length, ph, limit: ph.limit, mg: ph.mg };
}
/** That day's limit, or null for a day outside the plan. */
export const limitOn = (s: State, iso: string) => s.phases.find((ph) => iso >= ph.start && iso <= ph.end)?.limit ?? null;
export const pouchesToday = (s: State) => s.pouchLog[s.today] || 0;

const relOf = (s: State, due: string | null) => (due ? D.diff(due, s.today) : null);
export const taskRel = relOf;
export const idleDays = (s: State, touched: string) => Math.max(0, D.diff(s.today, touched));

const newDraft = () => ({ amt: '', cat: null, note: '', y: false });

/** Every state change. Each mutates a fresh copy of the state. */
export const R = {
  key(s: State, k: string) {
    const tgt = s.sheet === 'price' && s.pr ? s.pr : s.draft;
    let v = tgt.amt;
    if (s.sheet === 'price' && s.pr && s.pr.fresh) { v = ''; s.pr.fresh = false; }
    if (k === 'del') v = v.slice(0, -1);
    else if (k === '.') { if (!v.includes('.')) v = (v || '0') + '.'; }
    else {
      if (/\.\d\d$/.test(v) || v.replace('.', '').length >= 6) { tgt.amt = v; return; }
      if (v === '0') v = '';
      v += k;
    }
    tgt.amt = v;
  },
  logExpense(s: State) {
    const amt = parseFloat(s.draft.amt), cat = s.draft.cat;
    if (!(amt > 0) || !cat) return;
    const id = 'x' + s.seq++;
    s.expenses.unshift({ id, amt, cat, note: s.draft.note.trim() || catName(s, cat), date: s.draft.y ? D.add(s.today, -1) : s.today, per: s.period.id });
    s.lastCat = cat; s.sheet = null; s.draft = newDraft();
    s.toast = { t: `Logged ${usd(amt)} · ${catName(s, cat)}`, undo: id };
  },
  addIncome(s: State) {
    const amt = parseFloat(s.draft.amt);
    if (!(amt > 0)) return;
    const src = s.draft.note.trim() || 'Extra income';
    s.period.extras = [...(s.period.extras || []), { id: 'n' + s.seq++, amt, src, date: s.today }];
    s.period.extra = r2(sum(s.period.extras, (e) => e.amt));
    s.pl = { amt, split: {}, src };
    s.draft = newDraft(); s.sheet = 'place';
  },
  openPlace(s: State, amt: number) { s.pl = { amt, split: {}, src: 'Unassigned' }; s.sheet = 'place'; },
  /** Places unassigned money across any number of categories and goals; whatever isn't placed stays unassigned. */
  place(s: State) {
    if (!s.pl) return;
    const parts = Object.entries(s.pl.split).map(([to, v]) => [to, r2(parseFloat(v) || 0)] as const).filter(([, a]) => a > 0);
    const total = r2(parts.reduce((t, [, a]) => t + a, 0));
    if (!parts.length || total > s.pl.amt + 0.004) return;
    for (const [to, amt] of parts) {
      if (to.startsWith('c:')) {
        const c = s.period.cats.find((x) => x.id === to.slice(2));
        if (c) c.alloc = r2(c.alloc + amt);
      } else {
        const g = s.goals.find((x) => x.id === to.slice(2));
        if (!g) continue;
        g.saved = r2(g.saved + amt); g.hist.unshift([s.today, amt, 'Extra contribution']);
        const pg = s.period.goals.find((x) => x.id === g.id);
        if (pg) pg.a = r2(pg.a + amt); else s.period.goals.push({ id: g.id, a: amt });
        if (g.kind === 'save' && g.saved >= g.target - 0.004) s.pendingDone = g.id;
      }
    }
    const rest = r2(s.pl.amt - total), first = parts[0][0];
    const where = parts.length === 1 ? (first.startsWith('c:') ? catName(s, first.slice(2)) : s.goals.find((x) => x.id === first.slice(2))?.name) : `${parts.length} places`;
    s.toast = { t: `${usd(total)} placed in ${where}` + (rest > 0.004 ? ` · ${usd(rest)} still unassigned` : '') };
    s.pl = null; s.sheet = null;
  },
  openPrice(s: State, pid: string, gid: string) {
    const p = s.projects.find((x) => x.id === pid)!, g = p.groups.find((x) => x.id === gid)!;
    s.pr = { pid, gid, amt: g.buy!.est.toFixed(2), fresh: true, cat: g.buy!.cat || s.lastCat }; s.sheet = 'price';
  },
  markBought(s: State) {
    if (!s.pr) return;
    const { pid, gid, cat } = s.pr, amt = parseFloat(s.pr.amt);
    if (!(amt >= 0)) return;
    const p = s.projects.find((x) => x.id === pid)!, g = p.groups.find((x) => x.id === gid)!;
    const goal = p.goal ? s.goals.find((x) => x.id === p.goal) || null : null;
    const buy = g.buy!;
    buy.done = true; buy.actual = amt;
    s.expenses.unshift({ id: 'x' + s.seq++, amt, cat: goal ? null : cat, goal: goal ? goal.id : null, note: buy.title, proj: p.name, date: s.today, per: s.period.id, src: 'buy' });
    if (!goal) { buy.cat = cat; s.lastCat = cat; }
    s.toast = { t: `Bought · ${usd(amt)} from ${goal ? goal.name : catName(s, cat)}` };
    s.pr = null; s.sheet = null;
    if (goal && goal.status !== 'done' && gi(s, goal).rem <= 0) s.pendingDone = goal.id;
  },
  unbuy(s: State, pid: string, gid: string) {
    const p = s.projects.find((x) => x.id === pid)!, g = p.groups.find((x) => x.id === gid)!;
    const i = s.expenses.findIndex((e) => e.src === 'buy' && e.note === g.buy!.title && e.proj === p.name);
    if (i >= 0) s.expenses.splice(i, 1);
    g.buy!.done = false; g.buy!.actual = null;
  },
  toggleAction(s: State, pid: string, gid: string) {
    const g = s.projects.find((x) => x.id === pid)!.groups.find((x) => x.id === gid)!;
    g.action.done = !g.action.done;
  },
  toggleTask(s: State, id: string) {
    const t = s.tasks.find((x) => x.id === id)!;
    t.done = !t.done; t.touched = s.today;
    s.toast = t.done ? { t: 'Done · ' + t.title, undoTask: id } : null;
  },
  openReview(s: State) {
    const bc = s.boost.cats || {}, cats: Partial<Record<CatId, number>> = {}, goals: Record<string, number> = {};
    s.period.cats.forEach((c) => { cats[c.id] = planCat(s, c.id) + (bc[c.id] || 0); });
    s.goals.forEach((g) => {
      const per = goalPer(s, g, true);
      if (g.kind === 'save' && g.status !== 'done' && per > 0) goals[g.id] = Math.min(per, r2(g.target - g.saved));
      if (g.kind === 'acct' && per > 0) goals[g.id] = per;
    });
    s.rv = { cats, goals }; s.view = { k: 'review' }; s.sheet = null;
  },
  rvStep(s: State, kind: 'cats' | 'goals', id: string, d: number) {
    const o = s.rv![kind] as Record<string, number>;
    let v = Math.max(0, (o[id] || 0) + d);
    if (kind === 'goals') { const g = s.goals.find((x) => x.id === id)!; if (g.kind === 'save') v = Math.min(v, r2(g.target - g.saved)); }
    o[id] = r2(v);
  },
  confirmReview(s: State) {
    const un = rvUn(s);
    if (un < 0) return;
    const m = money(s), n = nextP(s)!, rv = s.rv!;
    // Installments never marked paid go back; the goal's plan spreads them over the paychecks left.
    const paidT = r2(sum(s.period.goals, (pg) => pg.a - (pg.due || 0)));
    s.history.unshift({ label: s.period.label, pay: s.period.pay + s.period.extra, bills: m.billsT, spent: m.spentT, goals: paidT, left: m.left, cats: m.cats.map((c) => [c.name, c.avail, c.spent]) });
    const lefts: Partial<Record<CatId, number>> = {};
    m.cats.forEach((c) => { lefts[c.id] = c.left; });
    s.period = {
      id: n.id, label: n.label, start: n.start, end: n.end, pay: n.pay, extra: 0, extras: [], bills: n.bills.map((b) => ({ n: b.n, a: b.a, d: b.d })),
      cats: s.period.cats.map((c) => ({ id: c.id, alloc: rv.cats[c.id] || 0, roll: r2(lefts[c.id] || 0) })),
      goals: Object.keys(rv.goals).filter((id) => rv.goals[id] > 0).map((id) => {
        const g = s.goals.find((x) => x.id === id);
        // Savings installments wait for Paid; a finished goal's amount (savings account) counts right away.
        if (g && g.kind === 'save') { if (g.pace) g.per = rv.goals[id]; return { id, a: rv.goals[id], due: rv.goals[id] }; }
        if (g) { g.saved = r2(g.saved + rv.goals[id]); g.hist.unshift([n.start, rv.goals[id]]); }
        return { id, a: rv.goals[id] };
      }),
    };
    s.incomes.forEach((i) => { let k = 0; while (i.next <= n.end && k < 60) { i.next = D.step(i.next, i.sched); k++; } });
    s.goals.forEach((g) => { if (g.inst) for (const d of Object.keys(g.inst)) if (d < s.incomes[0].next) delete g.inst[d]; });
    if (s.today < n.start) s.today = n.start;
    Object.assign(s, { boost: {}, payPending: false, view: null, tab: 'today', rv: null, moff: 0 });
    const done = s.goals.find((g) => g.kind === 'save' && g.status !== 'done' && g.saved >= g.target - 0.004);
    if (done) s.pendingDone = done.id;
    s.toast = { t: `Paycheck placed · ${usd(un)} unassigned` };
    checkPayday(s);
  },
  openDone(s: State, gid: string | null) { if (!gid) return; s.dn = { gid, stage: 1, to: null }; s.sheet = 'done'; },
  closeGoal(s: State, gid: string) { s.pendingDone = gid; s.dn = { gid, stage: 1, to: null, manual: true }; s.sheet = 'done'; },
  doneConfirm(s: State) {
    if (!s.dn || !s.dn.to) return;
    const g = s.goals.find((x) => x.id === s.dn!.gid)!, amt = freedPer(s, g), to = s.dn.to;
    let label = 'Unassigned';
    if (to === 'sav') {
      let a = s.goals.find((x) => x.id === 'savings');
      if (!a) { a = { id: 'savings', name: 'Savings account', kind: 'acct', target: 0, saved: 0, per: 0, hist: [] }; s.goals.push(a); }
      a.per += amt; label = a.name;
    } else if (to.startsWith('g:')) { const t = s.goals.find((x) => x.id === to.slice(2))!; t.per = goalPer(s, t) + amt; delete t.pace; label = t.name; }
    else if (to.startsWith('c:')) { const id = to.slice(2); s.boost.cats = s.boost.cats || {}; s.boost.cats[id] = (s.boost.cats[id] || 0) + amt; label = catName(s, id); }
    const pg = s.period.goals.find((x) => x.id === g.id);
    if (pg && pg.due) { pg.a = r2(pg.a - pg.due); pg.due = 0; s.period.goals = s.period.goals.filter((x) => x.a > 0.004); }
    g.status = 'done'; g.doneOn = s.today; g.doneTo = amt > 0 ? `${usd(amt, 0)} A PAYCHECK → ${label.toUpperCase()}` : 'CLOSED'; g.per = 0; delete g.pace;
    s.pendingDone = null; s.dn = null; s.sheet = null;
    s.toast = { t: amt > 0 ? `From next paycheck, ${usd(amt, 0)} goes to ${label}` : `${g.name} closed` };
  },
  createProject(s: State) {
    const np = s.np, name = np.name.trim();
    if (!name) return;
    const id = 'p' + s.seq++;
    let goal: string | null = null;
    if (np.mode === 'goal') { if (!np.goal) return; goal = np.goal; }
    if (np.mode === 'new') {
      const t = parseFloat(np.gTarget);
      if (!np.gName.trim() || !(t > 0)) return;
      goal = 'g' + s.seq++;
      s.goals.push({ id: goal, name: np.gName.trim(), kind: 'proj', target: t, saved: 0, per: 0, hist: [] });
    }
    s.projects.unshift({ id, name, tier: np.tier, goal, groups: [] });
    s.view = { k: 'project', id }; s.tab = 'tasks'; s.sheet = null;
    s.np = { name: '', tier: 'P', mode: 'skip', goal: null, gName: '', gTarget: '' };
  },
  openStep(s: State, mode: 'project' | 'task', kind: 'action' | 'buy') {
    const p = mode === 'project' && s.view && s.view.k === 'project' ? s.projects.find((x) => x.id === (s.view as { id: string }).id) : null;
    const free = p ? p.groups.filter((g) => !g.buy && !g.action.done) : [];
    s.st = { mode, kind, title: '', est: '', forA: free.length ? free[free.length - 1].id : null, cat: s.lastCat, due: 'none', tier: 'P' };
    s.sheet = 'step';
  },
  addStep(s: State) {
    const st = s.st, title = st.title.trim();
    if (!title) return;
    const due = dueFromChip(s.today, st.due);
    if (st.mode === 'task') {
      s.tasks.unshift({ id: 't' + s.seq++, title, tier: st.tier, due, touched: s.today, done: false });
      s.toast = { t: 'Task added · ' + title }; s.sheet = null; return;
    }
    if (!s.view || s.view.k !== 'project') return;
    const pid = s.view.id, p = s.projects.find((x) => x.id === pid)!;
    if (st.kind === 'action') p.groups.push({ id: 'g' + s.seq++, action: { title, due, done: false }, buy: null });
    else {
      const est = parseFloat(st.est), g = p.groups.find((x) => x.id === st.forA);
      if (!g || !(est >= 0)) return;
      g.buy = { title, est, actual: null, done: false, cat: p.goal ? null : st.cat };
    }
    s.sheet = null;
  },
  openEd(s: State, kind: 'inc' | 'bill', id: string | null) {
    if (kind === 'inc') {
      const i = id ? s.incomes.find((x) => x.id === id) : null;
      s.ed = { kind, id, name: i ? i.name : '', amt: i ? String(i.amt) : '', sched: i ? i.sched : 'monthly', date: i ? i.next : D.add(s.today, 7) };
    } else {
      const b = id ? s.billsDef.find((x) => x.id === id) : null;
      s.ed = { kind, id, name: b ? b.name : '', amt: b ? String(b.amt) : '', sched: b ? b.freq : 'monthly', date: b ? b.due : D.add(s.today, 14) };
    }
    s.sheet = 'ed';
  },
  saveEd(s: State) {
    const e = s.ed!, amt = r2(parseFloat(String(e.amt).replace(/[$,]/g, ''))), name = e.name.trim();
    if (!name || !(amt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) return;
    if (e.kind === 'inc') {
      if (e.date < s.today) return;
      const v = { name, amt, sched: e.sched, next: e.date };
      if (e.id) Object.assign(s.incomes.find((x) => x.id === e.id)!, v); else s.incomes.push({ id: 'i' + s.seq++, ...v });
      if (s.incomes.length === 1 && s.period.id === 'p0') { s.period.end = D.add(s.incomes[0].next, -1); s.period.label = periodLabel(s.period.start, s.period.end); }
    } else {
      const v = { name, amt, freq: e.sched, due: e.date };
      if (e.id) Object.assign(s.billsDef.find((x) => x.id === e.id)!, v); else s.billsDef.push({ id: 'b' + s.seq++, ...v });
    }
    s.toast = { t: s.incomes.length ? 'Saved · applies from ' + D.wdm(s.incomes[0].next) : 'Saved' }; s.ed = null; s.sheet = null;
  },
  delEd(s: State) {
    const e = s.ed!;
    if (e.kind === 'inc') { if (s.incomes.length > 1 && s.incomes[0].id === e.id) return; s.incomes = s.incomes.filter((x) => x.id !== e.id); }
    else s.billsDef = s.billsDef.filter((x) => x.id !== e.id);
    s.toast = { t: 'Removed ' + e.name }; s.ed = null; s.sheet = null;
  },
  openPhase(s: State, idx: number | null) {
    const ph = idx != null ? s.phases[idx] : null, last = s.phases[s.phases.length - 1];
    const start = ph ? ph.start : last && last.end >= s.today ? D.add(last.end, 1) : s.today;
    s.ph = ph
      ? { idx, start: ph.start, end: ph.end, limit: String(ph.limit), mg: ph.mg.replace(/\s*MG$/i, '') }
      : { idx: null, start, end: D.add(start, 20), limit: last ? String(Math.max(0, last.limit - 2)) : '', mg: '' };
    s.sheet = 'phase';
  },
  savePhase(s: State) {
    const p = s.ph!, limit = parseInt(p.limit, 10), iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(p.start) || !iso.test(p.end) || p.end < p.start || !(limit >= 0)) return;
    const mg = p.mg.trim();
    const v = { start: p.start, end: p.end, limit, mg: mg ? (/^[\d.]+$/.test(mg) ? mg + ' MG' : mg.toUpperCase()) : '' };
    if (p.idx != null) s.phases[p.idx] = v; else s.phases.push(v);
    s.phases.sort((a, b) => (a.start < b.start ? -1 : 1));
    s.ph = null; s.sheet = null;
    s.toast = { t: 'Plan saved' };
  },
  delPhase(s: State) {
    const p = s.ph!;
    if (p.idx != null) s.phases.splice(p.idx, 1);
    s.ph = null; s.sheet = null;
    s.toast = { t: 'Phase removed' };
  },
  openGoal(s: State, id: string | null) {
    const g = id ? s.goals.find((x) => x.id === id) : null;
    const canPace = s.incomes.length > 0;
    s.gd = g
      ? { id, name: g.name, target: String(g.target), saved: String(g.saved), mode: g.pace && canPace ? 'pace' : 'fixed', n: String(g.pace && canPace ? paychecksLeft(s, g.pace.dueBy) : 6), per: String(g.per || '') }
      : { id: null, name: '', target: '', saved: '', mode: canPace ? 'pace' : 'fixed', n: '6', per: '' };
    s.sheet = 'goal';
  },
  saveGoal(s: State) {
    const e = s.gd!, num = (v: string) => r2(parseFloat(String(v).replace(/[$,]/g, '')) || 0);
    const name = e.name.trim(), target = num(e.target), saved = num(e.saved), n = parseInt(e.n, 10), per = num(e.per);
    const g0 = e.id ? s.goals.find((x) => x.id === e.id)! : null, isSave = !g0 || g0.kind === 'save';
    if (!name || !(target > 0)) return;
    if (isSave && e.mode === 'pace' && (!s.incomes.length || !(n >= 1))) return;
    if (!g0) {
      const g: Goal = { id: 'g' + s.seq++, name, kind: 'save', target, saved, per: 0, hist: saved > 0 ? [[s.today, saved, 'Already saved']] : [] };
      s.goals.push(g);
      if (e.mode === 'pace') { g.pace = { dueBy: paydays(s, n)[n - 1] }; g.per = goalPer(s, g); } else g.per = per;
      s.toast = { t: `${name} added · ${usd(goalPer(s, g), 0)} a paycheck` };
    } else {
      g0.name = name; g0.target = target;
      if (isSave) {
        if (saved !== g0.saved) { g0.hist.unshift([s.today, r2(saved - g0.saved), 'Adjusted']); g0.saved = saved; }
        if (e.mode === 'pace') g0.pace = { dueBy: paydays(s, n)[n - 1] }; else { delete g0.pace; g0.per = per; }
      }
      s.toast = { t: isSave ? `Saved · ${usd(goalPer(s, g0), 0)} a paycheck` : 'Saved' };
    }
    s.gd = null; s.sheet = null;
  },
  /** Deletes an expense. A bought buy step goes back to unbought so its money isn't counted twice. */
  delExpense(s: State, id: string) {
    const e = s.expenses.find((x) => x.id === id);
    if (!e) return;
    if (e.src === 'buy') {
      for (const p of s.projects) for (const g of p.groups) if (g.buy && g.buy.done && g.buy.title === e.note && p.name === e.proj) { g.buy.done = false; g.buy.actual = null; }
    }
    s.expenses = s.expenses.filter((x) => x.id !== id);
    s.xe = null; s.xd = null; s.sheet = null;
    s.toast = { t: `Deleted ${e.note} · ${usd(e.amt)}` };
  },
  openExp(s: State, id: string) {
    const e = s.expenses.find((x) => x.id === id);
    if (!e) return;
    s.xe = id; s.xd = { id, amt: String(e.amt), note: e.note, date: e.date, cat: e.cat };
    s.sheet = 'exp';
  },
  saveExpense(s: State) {
    const d = s.xd!, e = s.expenses.find((x) => x.id === d.id), amt = r2(parseFloat(d.amt) || 0);
    if (!e || !(amt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return;
    if (e.src === 'buy') for (const p of s.projects) for (const g of p.groups) if (g.buy && g.buy.done && g.buy.title === e.note && p.name === e.proj) g.buy.actual = amt;
    e.amt = amt; e.date = d.date; if (e.src !== 'buy') e.note = d.note.trim() || e.note; if (e.cat && d.cat) e.cat = d.cat;
    s.xe = null; s.xd = null; s.sheet = null;
    s.toast = { t: `Saved ${e.note} · ${usd(amt)}` };
  },
  openIncomeEntry(s: State, id: string) {
    const e = (s.period.extras || []).find((x) => x.id === id);
    if (!e) return;
    s.ie = { id, amt: String(e.amt), src: e.src }; s.sheet = 'inc';
  },
  /** Changes or removes (amount 0) an extra income entry. Refused if it would leave Unassigned negative. */
  saveIncomeEntry(s: State, remove = false) {
    const d = s.ie!, list = s.period.extras || [], e = list.find((x) => x.id === d.id);
    if (!e) return;
    const amt = remove ? 0 : r2(parseFloat(d.amt) || 0);
    if (amt < 0 || money(s).unassigned + (amt - e.amt) < -0.004) return;
    if (amt === 0) s.period.extras = list.filter((x) => x.id !== e.id); else { e.amt = amt; e.src = d.src.trim() || e.src; }
    s.period.extra = r2(sum(s.period.extras || [], (x) => x.amt));
    s.ie = null; s.sheet = null;
    s.toast = { t: amt === 0 ? `Removed ${e.src}` : `Saved ${e.src} · ${usd(amt)}` };
  },
  /** Moves money placed in categories or goals this period back to Unassigned. */
  takeBack(s: State) {
    const parts = Object.entries(s.tb || {}).map(([to, v]) => [to, r2(parseFloat(v) || 0)] as const).filter(([, a]) => a > 0);
    if (!parts.length) return;
    let total = 0;
    for (const [to, amt] of parts) {
      if (to.startsWith('c:')) {
        const c = s.period.cats.find((x) => x.id === to.slice(2));
        if (!c || amt > c.alloc + 0.004) return;
      } else {
        const pg = s.period.goals.find((x) => x.id === to.slice(2));
        if (!pg || amt > pg.a + 0.004) return;
      }
    }
    for (const [to, amt] of parts) {
      if (to.startsWith('c:')) { const c = s.period.cats.find((x) => x.id === to.slice(2))!; c.alloc = r2(c.alloc - amt); }
      else {
        const pg = s.period.goals.find((x) => x.id === to.slice(2))!, g = s.goals.find((x) => x.id === pg.id);
        // The unpaid installment goes back first; only the rest comes out of what the goal has saved.
        const fromDue = Math.min(pg.due || 0, amt), fromSaved = r2(amt - fromDue);
        pg.a = r2(pg.a - amt);
        if (pg.due) pg.due = r2(pg.due - fromDue);
        if (g && fromSaved > 0) { g.saved = r2(g.saved - fromSaved); g.hist.unshift([s.today, -fromSaved, 'Moved back to Unassigned']); }
      }
      total = r2(total + amt);
    }
    s.period.goals = s.period.goals.filter((x) => x.a > 0.004);
    s.tb = null; s.sheet = null;
    s.toast = { t: `${usd(total)} moved back to Unassigned` };
  },
  /** Opens the edit sheet for a task (id) or a project step (pid + group id). */
  openTask(s: State, kind: 'task' | 'action' | 'buy', id: string, pid?: string) {
    if (kind === 'task') {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return;
      s.td = { kind, id, title: t.title, tier: t.tier, due: t.due || '', notes: t.notes || '', est: '', cat: null };
    } else {
      const p = s.projects.find((x) => x.id === pid), g = p?.groups.find((x) => x.id === id);
      if (!p || !g) return;
      s.td = kind === 'action'
        ? { kind, id, pid, title: g.action.title, tier: p.tier, due: g.action.due || '', notes: g.action.notes || '', est: '', cat: null }
        : { kind, id, pid, title: g.buy!.title, tier: p.tier, due: '', notes: '', est: String(g.buy!.est), cat: g.buy!.cat || null };
    }
    s.sheet = 'task';
  },
  saveTask(s: State) {
    const d = s.td!, title = d.title.trim(), due = /^\d{4}-\d{2}-\d{2}$/.test(d.due) ? d.due : null;
    if (!title) return;
    if (d.kind === 'task') {
      const t = s.tasks.find((x) => x.id === d.id);
      if (t) Object.assign(t, { title, tier: d.tier, due, notes: d.notes.trim(), touched: s.today });
    } else {
      const g = s.projects.find((x) => x.id === d.pid)?.groups.find((x) => x.id === d.id);
      if (!g) return;
      if (d.kind === 'action') Object.assign(g.action, { title, due, notes: d.notes.trim() });
      else if (g.buy) { const est = parseFloat(d.est); if (!(est >= 0)) return; Object.assign(g.buy, { title, est }); if (d.cat && g.buy.cat !== null) g.buy.cat = d.cat; }
    }
    s.td = null; s.sheet = null;
    s.toast = { t: 'Saved · ' + title };
  },
  /** Deletes a task, an action (with its buy step) or just a buy step. A bought buy step must be unmarked first. */
  delTask(s: State) {
    const d = s.td!;
    if (d.kind === 'task') s.tasks = s.tasks.filter((x) => x.id !== d.id);
    else {
      const p = s.projects.find((x) => x.id === d.pid), g = p?.groups.find((x) => x.id === d.id);
      if (!p || !g || (g.buy && g.buy.done)) return;
      if (d.kind === 'action') p.groups = p.groups.filter((x) => x.id !== d.id); else g.buy = null;
    }
    s.td = null; s.sheet = null;
    s.toast = { t: 'Deleted · ' + d.title };
  },
  openProj(s: State, id: string) {
    const p = s.projects.find((x) => x.id === id);
    if (!p) return;
    s.pd = { id, name: p.name, tier: p.tier }; s.sheet = 'proj';
  },
  saveProj(s: State) {
    const d = s.pd!, p = s.projects.find((x) => x.id === d.id), name = d.name.trim();
    if (!p || !name) return;
    for (const e of s.expenses) if (e.proj === p.name) e.proj = name;
    p.name = name; p.tier = d.tier;
    s.pd = null; s.sheet = null;
    s.toast = { t: 'Saved · ' + name };
  },
  /** Deletes a project. Its purchases stay in Expenses; a linked goal stays in Goals. */
  delProj(s: State) {
    const d = s.pd!;
    s.projects = s.projects.filter((x) => x.id !== d.id);
    s.pd = null; s.sheet = null;
    if (s.view && s.view.k === 'project' && s.view.id === d.id) s.view = null;
    s.toast = { t: 'Deleted project · ' + d.name };
  },
  openWeigh(s: State) { const last = s.weighIns[s.weighIns.length - 1]; s.wd = { w: last ? String(last[1]) : '', date: s.today }; s.sheet = 'weigh'; },
  saveWeigh(s: State) {
    const d = s.wd!, w = r2(parseFloat(d.w) || 0);
    if (!(w > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return;
    s.weighIns = [...s.weighIns.filter(([x]) => x !== d.date), [d.date, w] as [string, number]].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    s.wd = null; s.sheet = null;
    s.toast = { t: `Logged ${w} lb` };
  },
  delWeigh(s: State, date: string) { s.weighIns = s.weighIns.filter(([x]) => x !== date); s.toast = { t: 'Weigh-in removed' }; },
  setWeightTarget(s: State, v: number) { s.weightTarget = Math.max(0, r2(v)); },
  openDoc(s: State, id: string | null, folder: Folder = 'Other') {
    const d = id ? (s.docs || []).find((x) => x.id === id) : null;
    s.dd = d ? { id, title: d.title, folder: d.folder, notes: d.notes, expires: d.expires || '' } : { id: null, title: '', folder, notes: '', expires: '' };
    s.sheet = 'doc';
  },
  saveDoc(s: State) {
    const e = s.dd!, title = e.title.trim(), expires = /^\d{4}-\d{2}-\d{2}$/.test(e.expires) ? e.expires : null;
    if (!title) return;
    s.docs = s.docs || [];
    if (e.id) Object.assign(s.docs.find((x) => x.id === e.id)!, { title, folder: e.folder, notes: e.notes.trim(), expires });
    else {
      const id = 'd' + s.seq++;
      s.docs.unshift({ id, title, folder: e.folder, notes: e.notes.trim(), expires, files: [], added: s.today });
      s.view = { k: 'doc', id, from: s.view };
    }
    s.dd = null; s.sheet = null;
    s.toast = { t: 'Saved · ' + title };
  },
  addDocFile(s: State, docId: string, f: DocFile) { const d = (s.docs || []).find((x) => x.id === docId); if (d) d.files.push(f); },
  removeDocFile(s: State, docId: string, fileId: string) { const d = (s.docs || []).find((x) => x.id === docId); if (d) d.files = d.files.filter((x) => x.id !== fileId); },
  /** Removes a document from the list; the caller removes its files from the server. */
  delDoc(s: State, id: string) {
    const d = (s.docs || []).find((x) => x.id === id);
    s.docs = (s.docs || []).filter((x) => x.id !== id);
    if (s.view && s.view.k === 'doc' && s.view.id === id) s.view = s.view.from || null;
    s.toast = { t: 'Deleted · ' + (d ? d.title : 'document') };
  },
  openCat(s: State, id: string | null) {
    s.cd = id ? { id, name: catName(s, id), amt: String(planCat(s, id) || '') } : { id: null, name: '', amt: '' };
    s.sheet = 'cat';
  },
  saveCat(s: State) {
    const e = s.cd!, name = e.name.trim(), amt = Math.max(0, r2(parseFloat(String(e.amt).replace(/[$,]/g, '')) || 0));
    if (!name) return;
    s.catNames = s.catNames || {};
    s.plan = s.plan || { cats: {} };
    const id = e.id || 'c' + s.seq++;
    if (!e.id) s.period.cats.push({ id, alloc: 0, roll: 0 });
    s.catNames[id] = name;
    s.plan.cats[id] = amt;
    s.toast = { t: e.id ? 'Saved ' + name : `${name} added · ${usd(amt, 0)} a paycheck from your next paycheck` };
    s.cd = null; s.sheet = null;
  },
  /** Removes a category with no spending this period; its money goes back to Unassigned. */
  delCat(s: State) {
    const id = s.cd!.id;
    if (!id || s.expenses.some((x) => x.per === s.period.id && x.cat === id)) return;
    const name = catName(s, id);
    s.period.cats = s.period.cats.filter((c) => c.id !== id);
    if (s.plan) delete s.plan.cats[id];
    (s.subs || []).forEach((v) => { if (v.cat === id && s.period.cats[0]) v.cat = s.period.cats[0].id; });
    if (s.lastCat === id && s.period.cats[0]) s.lastCat = s.period.cats[0].id;
    s.toast = { t: 'Removed ' + name };
    s.cd = null; s.sheet = null;
  },
  setPlanCat(s: State, id: CatId, v: number) {
    s.plan = s.plan || { cats: {} };
    s.plan.cats[id] = Math.max(0, r2(v));
  },
  /** Put the plan's category amounts into the current period as well. */
  applyPlanNow(s: State) {
    s.period.cats.forEach((c) => { c.alloc = planCat(s, c.id); });
    s.toast = { t: 'This paycheck now matches your plan' };
  },
  openSub(s: State, id: string | null) {
    const v = id ? (s.subs || []).find((x) => x.id === id) : null;
    s.sb = v ? { id, name: v.name, amt: String(v.amt), freq: v.freq, next: v.next, cat: v.cat } : { id: null, name: '', amt: '', freq: 'monthly', next: s.today, cat: s.lastCat };
    s.sheet = 'sub';
  },
  saveSub(s: State) {
    const e = s.sb!, amt = r2(parseFloat(String(e.amt).replace(/[$,]/g, ''))), name = e.name.trim();
    if (!name || !(amt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(e.next) || (!e.id && e.next < s.today)) return;
    s.subs = s.subs || [];
    const v = { name, amt, freq: e.freq, next: e.next, cat: e.cat };
    if (e.id) Object.assign(s.subs.find((x) => x.id === e.id)!, v); else s.subs.push({ id: 's' + s.seq++, ...v });
    s.sb = null; s.sheet = null;
    s.toast = { t: 'Saved · next charge ' + D.wdm(v.next) };
    chargeSubs(s);
  },
  delSub(s: State) {
    const e = s.sb!;
    s.subs = (s.subs || []).filter((x) => x.id !== e.id);
    s.sb = null; s.sheet = null;
    s.toast = { t: 'Removed ' + e.name };
  },
  /** Marks this paycheck's installment paid: it counts toward the goal now. */
  payInstallment(s: State, gid: string) {
    const pg = s.period.goals.find((x) => x.id === gid), g = s.goals.find((x) => x.id === gid);
    if (!pg || !g || !(pg.due! > 0)) return;
    const amt = pg.due!;
    g.saved = r2(g.saved + amt); g.hist.unshift([s.today, amt, 'Installment paid']); pg.due = 0;
    const rem = r2(g.target - g.saved);
    s.toast = { t: `${g.name} · ${usd(amt)} paid` + (rem > 0.004 ? ` · ${usd(rem, 0)} to go` : '') };
    if (g.kind === 'save' && g.status !== 'done' && rem <= 0.004) s.pendingDone = g.id;
  },
  /** Pays the next installment now, out of Unassigned. */
  payNow(s: State, gid: string) {
    const g = s.goals.find((x) => x.id === gid);
    if (!g || g.kind !== 'save' || g.status === 'done') return;
    const amt = installments(s, g).rows.find((r) => r.amt > 0)?.amt || 0;
    if (!(amt > 0)) return;
    if (amt > money(s).unassigned + 0.004) { s.toast = { t: `Not enough unassigned · ${usd(money(s).unassigned)} left this paycheck` }; return; }
    const pg = s.period.goals.find((x) => x.id === gid);
    if (pg) pg.a = r2(pg.a + amt); else s.period.goals.push({ id: gid, a: amt });
    g.saved = r2(g.saved + amt); g.hist.unshift([s.today, amt, 'Installment paid early']);
    s.toast = { t: `${g.name} · ${usd(amt)} paid from Unassigned` };
    if (g.saved >= g.target - 0.004) s.pendingDone = g.id;
  },
  /** Changes this paycheck's unpaid installment. More comes out of Unassigned, less goes back to it. */
  setDue(s: State, gid: string, v: number) {
    const pg = s.period.goals.find((x) => x.id === gid);
    if (!pg || !(pg.due! > 0)) return;
    const amt = Math.max(0, r2(v)), d = r2(amt - pg.due!);
    if (d > money(s).unassigned + 0.004) { s.toast = { t: `Not enough unassigned · ${usd(money(s).unassigned)} left this paycheck` }; return; }
    pg.a = r2(pg.a + d); pg.due = amt;
    s.period.goals = s.period.goals.filter((x) => x.a > 0.004);
  },
  /** Sets one future installment (null puts it back on the automatic amount). */
  setInstallment(s: State, gid: string, date: string, v: number | null) {
    const g = s.goals.find((x) => x.id === gid);
    if (!g) return;
    g.inst = g.inst || {};
    if (v == null) delete g.inst[date]; else g.inst[date] = Math.max(0, r2(v));
  },
  resetInstallments(s: State, gid: string) {
    const g = s.goals.find((x) => x.id === gid);
    if (g) delete g.inst;
    s.toast = { t: 'Installments back to automatic' };
  },
  setNicotine(s: State, on: boolean) {
    s.nicotineOn = on;
    if (!on && s.view && s.view.k === 'wean') { s.view = null; s.tab = 'goals'; }
    s.toast = { t: on ? 'Nicotine tracking is on' : 'Nicotine tracking hidden · turn it back on in Goals' };
  },
  pouch(s: State, d: number) { s.pouchLog[s.today] = Math.max(0, (s.pouchLog[s.today] || 0) + d); },
};

/** Due dates offered by the step sheet's chips. */
export function dueFromChip(today: string, chip: 'none' | 'tom' | 'week' | 'next'): string | null {
  if (chip === 'tom') return D.add(today, 1);
  if (chip === 'week') { const wd = D.p(today).getUTCDay(); return D.add(today, wd < 5 ? 5 - wd : 7 - wd); }
  if (chip === 'next') return D.add(today, 7);
  return null;
}

const SUB_STEP: Record<Sub['freq'], D.Sched> = { weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' };
export const subStep = (iso: string, f: Sub['freq']) => D.step(iso, SUB_STEP[f]);
/** Average cost a month. */
export const subMonthly = (v: Sub) => v.amt * ({ weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[v.freq]);

/** Logs every subscription charge that has come due, including any missed while the app was closed. */
export function chargeSubs(s: State) {
  let n = 0, total = 0;
  for (const v of s.subs || []) {
    let k = 0;
    while (v.next <= s.today && k < 60) {
      s.expenses.unshift({ id: 'x' + s.seq++, amt: v.amt, cat: v.cat, note: v.name, date: v.next, per: s.period.id, src: 'sub' });
      n++; total = r2(total + v.amt); k++;
      v.next = subStep(v.next, v.freq);
    }
  }
  if (n) s.toast = { t: n === 1 ? `Subscription logged · ${usd(total)}` : `${n} subscription charges logged · ${usd(total)}`, id: Date.now() + Math.random() };
}

/** Everything that happens when a new day starts: subscription charges, then payday. */
export function catchUp(s: State) {
  // Saves from before income entries were editable keep one combined entry.
  if (!s.period.extras) s.period.extras = s.period.extra > 0 ? [{ id: 'n0', amt: s.period.extra, src: 'Extra income', date: s.period.start }] : [];
  chargeSubs(s);
  checkPayday(s);
}

/** Expenses this many days older than the current period move to the server archive. */
export const ARCHIVE_AFTER_DAYS = 60;

/** Expenses old enough to archive: from earlier periods and well before this one began. Project purchases
 *  stay, since goal progress and buy steps read them. */
export function archivable(s: Pick<State, 'period' | 'expenses'>) {
  const cutoff = D.add(s.period.start, -ARCHIVE_AFTER_DAYS);
  return s.expenses.filter((e) => e.per !== s.period.id && e.date < cutoff && !e.goal && e.src !== 'buy');
}

/** Every expense, archived ones included, as a CSV file, newest first. */
export function expensesCsv(s: State, archived: Expense[] = []) {
  const seen = new Set<string>(), rows: Expense[] = [];
  for (const e of [...s.expenses, ...archived]) if (!seen.has(e.id)) { seen.add(e.id); rows.push(e); }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const q = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const goalName = (id: string | null | undefined) => (id ? s.goals.find((g) => g.id === id)?.name ?? '' : '');
  return ['Date,Amount,Category,Note,Project,Goal', ...rows.map((e) => [e.date, e.amt.toFixed(2), e.cat ? catName(s, e.cat) : '', e.note, e.proj || '', goalName(e.goal)].map(q).join(','))].join('\n') + '\n';
}

export const FOLDERS: Folder[] = ['Insurance', 'Car', 'Medical', 'IDs', 'Logins', 'Other'];

/** How a document's expiry reads: none, ok, soon (within 60 days) or expired. */
export function expiryState(s: State, expires: string | null) {
  if (!expires) return 'none' as const;
  const d = D.diff(expires, s.today);
  return d < 0 ? 'expired' as const : d <= 60 ? 'soon' as const : 'ok' as const;
}

/** What you can spend per day until payday and still end the period at zero. Null without a pay schedule. */
export function safeToSpend(s: State, left: number) {
  if (!s.incomes.length) return null;
  const days = Math.max(1, D.diff(s.incomes[0].next, s.today));
  return { perDay: Math.max(0, Math.floor((left / days) * 100) / 100), days };
}

/** When payday arrives, Today shows the paycheck card. */
export function checkPayday(s: State) {
  if (!s.payPending && s.incomes.length && s.today >= s.incomes[0].next) s.payPending = true;
}

/** Demo screens, matching the design's flow canvas. "Today" is pinned to the sample data's day. */
export const DEMOS = ['today', 'tasks', 'money', 'goals', 'library', 'add', 'np', 'np-buy', 'np-drag', 'price-unlinked', 'price-linked', 'bought-proj', 'bought', 'paycheck', 'review', 'money-new', 'goal', 'goal-card', 'done1', 'done2', 'expense', 'expense-done', 'income', 'place', 'over', 'wean', 'setup', 'setup-inc', 'setup-bill', 'installments'] as const;

export function initial(today: string): State {
  const s: State = { ...emptyData(today), ...freshUI(today) };
  catchUp(s);
  return s;
}

export function buildDemo(start: string): State {
  const s: State = { ...seedData(), ...freshUI(SEED_TODAY) };
  const car = () => s.projects.find((p) => p.id === 'car')!;
  const payday = () => { const n = nextP(s)!; s.payPending = true; s.today = n.start; };
  const paid = () => { payday(); R.openReview(s); s.rv!.cats.gas = 130; R.confirmReview(s); s.toast = null; };
  switch (start) {
    case 'tasks': case 'money': case 'goals': case 'library': s.tab = start; break;
    case 'add': s.sheet = 'add'; break;
    case 'np': s.tab = 'tasks'; s.sheet = 'np'; Object.assign(s.np, { name: 'Fix The Car Up', tier: 'P', mode: 'new', gName: 'Car repairs', gTarget: '600' }); break;
    case 'np-buy':
      car().groups = [{ id: 'g1', action: { title: 'Install new battery', due: '2026-10-23', done: false }, buy: null }];
      s.tab = 'tasks'; s.view = { k: 'project', id: 'car' }; R.openStep(s, 'project', 'buy'); Object.assign(s.st, { title: 'Buy battery', est: '189' }); break;
    case 'np-drag': car().groups = car().groups.slice(0, 3); s.tab = 'tasks'; s.view = { k: 'project', id: 'car' }; s.drag = { pid: 'car', from: 1, to: 0, dy: -116, h: 124 }; break;
    case 'price-unlinked': s.tab = 'tasks'; s.view = { k: 'project', id: 'office' }; R.openPrice(s, 'office', 'g5'); s.pr!.amt = '74.99'; s.pr!.fresh = false; break;
    case 'price-linked': s.tab = 'tasks'; s.view = { k: 'project', id: 'car' }; R.openPrice(s, 'car', 'g1'); break;
    case 'bought-proj': R.openPrice(s, 'car', 'g1'); s.pr!.amt = '179.95'; R.markBought(s); s.tab = 'tasks'; s.view = { k: 'project', id: 'car' }; break;
    case 'bought': R.openPrice(s, 'car', 'g1'); s.pr!.amt = '179.95'; R.markBought(s); s.toast = null; s.tab = 'money'; break;
    case 'paycheck': payday(); break;
    case 'review': payday(); R.openReview(s); s.rv!.cats.gas = 130; break;
    case 'money-new': paid(); s.tab = 'money'; break;
    case 'goal': s.tab = 'goals'; s.view = { k: 'goal', id: 'tires' }; break;
    case 'goal-card': paid(); break;
    case 'installments': paid(); s.tab = 'goals'; s.view = { k: 'installments' }; break;
    case 'done1': paid(); R.openDone(s, s.pendingDone); break;
    case 'done2': paid(); R.openDone(s, s.pendingDone); s.dn!.stage = 2; s.dn!.to = 'g:roth'; break;
    case 'expense': s.sheet = 'expense'; Object.assign(s.draft, { amt: '12.50', cat: 'eat', note: 'Lunch with Sam' }); break;
    case 'expense-done': Object.assign(s.draft, { amt: '12.50', cat: 'eat', note: 'Lunch with Sam' }); R.logExpense(s); break;
    case 'income': s.sheet = 'income'; Object.assign(s.draft, { amt: '200', note: 'Sold old bike' }); break;
    case 'place': Object.assign(s.draft, { amt: '200', note: 'Sold old bike' }); R.addIncome(s); s.pl!.split = { 'g:japan': '200' }; break;
    case 'over': s.pouchLog[s.today] = 7; break;
    case 'wean': s.tab = 'goals'; s.view = { k: 'wean' }; break;
    case 'setup': s.tab = 'money'; s.view = { k: 'setup' }; break;
    case 'setup-inc': s.tab = 'money'; s.view = { k: 'setup' }; R.openEd(s, 'inc', 'i1'); s.ed!.amt = '1920'; break;
    case 'setup-bill': s.tab = 'money'; s.view = { k: 'setup' }; R.openEd(s, 'bill', null); Object.assign(s.ed!, { name: 'Car registration', amt: '148', sched: 'yearly', date: '2026-11-12' }); break;
    default: break;
  }
  return s;
}
