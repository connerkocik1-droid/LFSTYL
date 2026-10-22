import { describe, expect, it } from 'vitest';
import { R, archivable, catchUp, expensesCsv, chargeSubs, goalPer, initial, money, nextP, paychecksLeft, paydays, rvUn, safeToSpend } from './logic';
import { SEED_TODAY, freshUI, seedData } from './seed';
import type { Goal, State } from './types';

/** The sample account, on the sample data's day. */
const demo = (): State => ({ ...seedData(), ...freshUI(SEED_TODAY) });

/** A new account paid $1,000 every two weeks, with this paycheck already in. */
function paid(): State {
  const s = initial('2026-10-22');
  s.incomes.push({ id: 'i1', name: 'Job', amt: 1000, sched: 'biweekly', next: '2026-11-06' });
  s.period.pay = 1000;
  return s;
}

const goal = (v: Partial<Goal> = {}): Goal => ({ id: 'trip', name: 'Japan trip', kind: 'save', target: 3200, saved: 1180, per: 0, hist: [], ...v });

describe('money', () => {
  it('works out the sample paycheck', () => {
    const m = money(demo());
    expect(m.billsT).toBe(760);
    expect(m.allocT).toBe(610);
    expect(m.goalsT).toBe(245);
    expect(m.unassigned).toBe(225);
    expect(m.spentT).toBe(322.6);
    expect(m.rollT).toBe(21.3);
    expect(m.left).toBe(533.7);
  });

  it('flags a category that went over', () => {
    const m = money(demo());
    expect(m.cats.find((c) => c.id === 'gas')!.left).toBe(-13.1);
    expect(m.over.map((c) => c.id)).toEqual(['gas']);
    expect(m.health).toBe('Tight');
  });

  it('leaves project purchases out of category spending', () => {
    const m = money(demo());
    expect(m.exp.some((e) => e.goal === 'car')).toBe(true);
    expect(m.spentT).toBe(322.6);
  });

  it('does not call a new account over budget', () => {
    const s = initial('2026-10-22');
    s.draft = { amt: '20', cat: 'groc', note: '', y: false };
    R.logExpense(s);
    const m = money(s);
    expect(m.unassigned).toBe(0);
    expect(m.over).toEqual([]);
    expect(m.health).toBe('Healthy');
  });

  it('starts a new account empty', () => {
    const s = initial('2026-10-22');
    expect([s.expenses, s.goals, s.projects, s.tasks, s.incomes, s.billsDef, s.history]).toEqual([[], [], [], [], [], [], []]);
    expect(s.period.cats.every((c) => c.alloc === 0)).toBe(true);
  });
});

describe('next paycheck', () => {
  it('is null without an income', () => {
    expect(nextP(initial('2026-10-22'))).toBeNull();
  });

  it('collects the bills due before the paycheck after it', () => {
    const n = nextP(demo())!;
    expect([n.start, n.end, n.pay]).toEqual(['2026-10-27', '2026-11-09', 1840]);
    expect(n.bills.map((b) => b.n)).toEqual(['Rent', 'Streaming', 'Electric']);
    expect(n.label).toBe('27 OCT – 9 NOV');
  });

  it('adds a second income that pays inside the period', () => {
    const s = demo();
    s.incomes.push({ id: 'i2', name: 'Side job', amt: 200, sched: 'monthly', next: '2026-11-02' });
    expect(nextP(s)!.pay).toBe(2040);
  });
});

describe('paced goals', () => {
  it('splits what is left over the paychecks until the due date', () => {
    const s = paid(), g = goal({ pace: { dueBy: paydays(paid(), 10)[9] } });
    expect(paychecksLeft(s, g.pace!.dueBy)).toBe(10);
    expect(goalPer(s, g)).toBe(202); // 2,020 over 10 paychecks
  });

  it('rounds up to whole dollars so the goal is met on time', () => {
    const s = paid(), g = goal({ target: 1000, saved: 0, pace: { dueBy: paydays(s, 3)[2] } });
    expect(goalPer(s, g)).toBe(334);
  });

  it('asks for the rest at once when the due date has passed', () => {
    const s = paid(), g = goal({ pace: { dueBy: '2026-10-01' } });
    expect(paychecksLeft(s, '2026-10-01')).toBe(1);
    expect(goalPer(s, g)).toBe(2020);
  });

  it('recalculates after an extra contribution', () => {
    const s = paid(), g = goal({ pace: { dueBy: paydays(s, 10)[9] } });
    s.goals.push(g);
    R.openPlace(s, 1000);
    s.pl!.split = { 'g:trip': '1000' };
    R.place(s);
    expect(g.saved).toBe(2180);
    expect(goalPer(s, g)).toBe(102);
  });

  it('uses the fixed amount for goals that are not paced, and nothing once done', () => {
    const s = paid();
    expect(goalPer(s, goal({ per: 75 }))).toBe(75);
    expect(goalPer(s, goal({ per: 75, status: 'done' }))).toBe(0);
  });

  it('creates a paced goal from the goal sheet', () => {
    const s = paid();
    R.openGoal(s, null);
    Object.assign(s.gd!, { name: 'Japan trip', target: '3200', saved: '1180', mode: 'pace', n: '10' });
    R.saveGoal(s);
    const g = s.goals[0];
    expect(g.pace!.dueBy).toBe(paydays(s, 10)[9]);
    expect(g.per).toBe(202);
    expect(g.hist[0]).toEqual(['2026-10-22', 1180, 'Already saved']);
  });
});

describe('placing unassigned money', () => {
  it('splits across categories and goals and leaves the rest unassigned', () => {
    const s = paid();
    s.goals.push(goal());
    R.openPlace(s, 300);
    s.pl!.split = { 'c:groc': '100', 'g:trip': '150' };
    R.place(s);
    expect(s.period.cats.find((c) => c.id === 'groc')!.alloc).toBe(100);
    expect(s.goals[0].saved).toBe(1330);
    expect(s.period.goals).toEqual([{ id: 'trip', a: 150 }]);
    expect(money(s).unassigned).toBe(750);
  });

  it('refuses to place more than there is', () => {
    const s = paid();
    R.openPlace(s, 300);
    s.pl!.split = { 'c:groc': '200', 'c:gas': '101' };
    R.place(s);
    expect(money(s).unassigned).toBe(1000);
    expect(s.sheet).toBe('place');
  });

  it('places extra income as its own entry', () => {
    const s = paid();
    s.draft = { amt: '200', cat: null, note: 'Sold bike', y: false };
    R.addIncome(s);
    expect(s.period.extra).toBe(200);
    expect(s.period.extras!.map((e) => e.src)).toEqual(['Sold bike']);
    expect(money(s).unassigned).toBe(1200);
  });

  it('takes money back from categories and goals', () => {
    const s = paid();
    s.goals.push(goal());
    R.openPlace(s, 300);
    s.pl!.split = { 'c:groc': '100', 'g:trip': '150' };
    R.place(s);
    s.tb = { 'c:groc': '50', 'g:trip': '150' };
    R.takeBack(s);
    expect(s.period.cats.find((c) => c.id === 'groc')!.alloc).toBe(50);
    expect(s.goals[0].saved).toBe(1180);
    expect(s.period.goals).toEqual([]);
    expect(money(s).unassigned).toBe(950);
  });

  it('takes nothing back when any amount is too much', () => {
    const s = paid();
    R.openPlace(s, 100);
    s.pl!.split = { 'c:groc': '100' };
    R.place(s);
    s.tb = { 'c:groc': '40', 'c:gas': '1' };
    R.takeBack(s);
    expect(s.period.cats.find((c) => c.id === 'groc')!.alloc).toBe(100);
  });
});

describe('editing income and expenses', () => {
  it('removes an extra income entry', () => {
    const s = paid();
    s.draft = { amt: '2000', cat: null, note: 'Oops', y: false };
    R.addIncome(s);
    R.openIncomeEntry(s, s.period.extras![0].id);
    R.saveIncomeEntry(s, true);
    expect(s.period.extra).toBe(0);
    expect(money(s).unassigned).toBe(1000);
  });

  it('will not remove income that is already placed', () => {
    const s = initial('2026-10-22');
    s.draft = { amt: '500', cat: null, note: 'Gift', y: false };
    R.addIncome(s);
    s.pl!.split = { 'c:fun': '400' };
    R.place(s);
    R.openIncomeEntry(s, s.period.extras![0].id);
    R.saveIncomeEntry(s, true);
    expect(s.period.extra).toBe(500);
  });

  it('turns a single combined extra from an older save into an entry', () => {
    const s = paid();
    s.period.extra = 2000;
    delete s.period.extras;
    catchUp(s);
    expect(s.period.extras).toEqual([{ id: 'n0', amt: 2000, src: 'Extra income', date: s.period.start }]);
  });

  it('edits and deletes an expense', () => {
    const s = demo();
    R.openExp(s, 'e1');
    s.xd!.amt = '50';
    R.saveExpense(s);
    expect(money(s).cats.find((c) => c.id === 'gas')!.spent).toBe(136.1);
    R.delExpense(s, 'e1');
    expect(money(s).cats.find((c) => c.id === 'gas')!.spent).toBe(86.1);
  });

  it('unmarks a bought step when its purchase is deleted', () => {
    const s = demo();
    R.delExpense(s, 'e6');
    const g3 = s.projects[0].groups.find((g) => g.id === 'g3')!;
    expect(g3.buy!.done).toBe(false);
  });
});

describe('subscriptions', () => {
  it('logs every charge that came due, including missed ones', () => {
    const s = paid();
    s.subs = [{ id: 's1', name: 'Music', amt: 10.99, freq: 'monthly', next: '2026-09-22', cat: 'fun' }];
    chargeSubs(s);
    expect(s.expenses.map((e) => e.date)).toEqual(['2026-10-22', '2026-09-22']);
    expect(s.expenses.every((e) => e.per === s.period.id && e.src === 'sub')).toBe(true);
    expect(s.subs[0].next).toBe('2026-11-22');
    chargeSubs(s);
    expect(s.expenses).toHaveLength(2);
  });

  it('does not charge before the date', () => {
    const s = paid();
    s.subs = [{ id: 's1', name: 'Music', amt: 10.99, freq: 'yearly', next: '2026-10-23', cat: 'fun' }];
    chargeSubs(s);
    expect(s.expenses).toHaveLength(0);
  });
});

describe('paycheck review', () => {
  function review() {
    const s = demo();
    s.today = '2026-10-27';
    catchUp(s);
    expect(s.payPending).toBe(true);
    R.openReview(s);
    return s;
  }

  it('starts from the plan and what each goal takes', () => {
    const s = review();
    expect(s.rv!.cats).toEqual({ groc: 260, gas: 120, eat: 100, house: 60, fun: 70 });
    expect(s.rv!.goals).toEqual({ roth: 100, tires: 85, japan: 60 });
    expect(rvUn(s)).toBe(105);
  });

  it('caps a goal at what is left to save', () => {
    const s = review();
    R.rvStep(s, 'goals', 'tires', 50);
    expect(s.rv!.goals.tires).toBe(85);
  });

  it('closes the period and starts the next one', () => {
    const s = review(), before = money(s);
    R.confirmReview(s);
    expect(s.history[0]).toMatchObject({ label: '13 – 26 OCT', pay: 1840, left: before.left, spent: 322.6 });
    expect(s.period).toMatchObject({ id: 'p2026-10-27', start: '2026-10-27', end: '2026-11-09', pay: 1840, extra: 0 });
    expect(s.period.cats.find((c) => c.id === 'gas')).toEqual({ id: 'gas', alloc: 120, roll: -13.1 });
    expect(s.goals.find((g) => g.id === 'roth')!.saved).toBe(5520);
    expect(s.incomes[0].next).toBe('2026-11-10');
    expect(s.payPending).toBe(false);
    expect(s.pendingDone).toBe('tires');
    expect(money(s).unassigned).toBe(105);
    expect(money(s).spentT).toBe(0);
  });

  it('will not confirm a plan that spends more than the paycheck', () => {
    const s = review();
    R.rvStep(s, 'cats', 'fun', 200);
    expect(rvUn(s)).toBe(-95);
    R.confirmReview(s);
    expect(s.period.id).toBe('p1');
  });
});

describe('safe to spend', () => {
  it('spreads what is left over the days to payday', () => {
    expect(safeToSpend(demo(), 533.7)).toEqual({ perDay: 88.95, days: 6 });
  });

  it('never goes below zero', () => {
    expect(safeToSpend(demo(), -50)!.perDay).toBe(0);
  });
});

describe('archive', () => {
  it('picks old expenses from earlier periods but keeps project purchases', () => {
    const s = demo();
    s.expenses.push(
      { id: 'old', amt: 5, cat: 'eat', note: 'Coffee', date: '2026-07-01', per: 'p-old' },
      { id: 'recent', amt: 5, cat: 'eat', note: 'Coffee', date: '2026-09-20', per: 'p-prev' },
      { id: 'oldbuy', amt: 9, cat: null, goal: 'car', note: 'Fuses', proj: 'Fix The Car Up', date: '2026-07-01', per: 'p-old', src: 'buy' },
    );
    expect(archivable(s).map((e) => e.id)).toEqual(['old']);
  });

  it('never picks an expense from the current period', () => {
    const s = demo();
    s.expenses.push({ id: 'backdated', amt: 5, cat: 'eat', note: 'Coffee', date: '2026-01-01', per: 'p1' });
    expect(archivable(s)).toEqual([]);
  });
});

describe('export', () => {
  it('writes current and archived expenses once each, newest first', () => {
    const s = demo();
    s.expenses[0].note = 'Shell, "Main St"';
    const csv = expensesCsv(s, [{ id: 'a1', amt: 5, cat: 'eat', note: 'Coffee', date: '2026-07-01', per: 'p-old' }, { ...s.expenses[1] }]).trim().split('\n');
    expect(csv[0]).toBe('Date,Amount,Category,Note,Project,Goal');
    expect(csv).toHaveLength(1 + s.expenses.length + 1);
    expect(csv[1]).toBe('2026-10-20,48.10,Gas,"Shell, ""Main St""",,');
    expect(csv[csv.length - 1]).toBe('2026-07-01,5.00,Eating out,Coffee,,');
    expect(csv).toContain('2026-10-15,34.99,,Buy wiper blades,Fix The Car Up,Car repairs');
  });
});
