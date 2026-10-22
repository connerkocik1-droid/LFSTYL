import type { Data, UI } from './types';

/** The day the sample data was written for. Demo screens pin "today" to it. */
export const SEED_TODAY = '2026-10-21';

const B = (a: [string, number, string][]) => a.map(([n, amt, d]) => ({ n, a: amt, d }));

export const seedData = (): Data => ({
  period: {
    id: 'p1', label: '13 – 26 OCT', start: '2026-10-13', end: '2026-10-26', pay: 1840, extra: 0,
    bills: B([['Car payment', 280, '2026-10-14'], ['Internet', 60, '2026-10-15'], ['Car insurance', 96, '2026-10-18'], ['Gym', 35, '2026-10-20'], ['Phone', 44, '2026-10-22'], ['Student loan', 245, '2026-10-25']]),
    cats: [{ id: 'groc', alloc: 260, roll: 8.7 }, { id: 'gas', alloc: 120, roll: 1.1 }, { id: 'eat', alloc: 100, roll: -12.6 }, { id: 'house', alloc: 60, roll: 18.1 }, { id: 'fun', alloc: 70, roll: 6 }],
    goals: [{ id: 'roth', a: 100 }, { id: 'tires', a: 85 }, { id: 'japan', a: 60 }],
  },
  incomes: [{ id: 'i1', name: 'Primary job', amt: 1840, sched: 'biweekly', next: '2026-10-27' }],
  billsDef: [
    { id: 'b1', name: 'Rent', amt: 780, freq: 'monthly', due: '2026-11-01' },
    { id: 'b2', name: 'Streaming', amt: 16, freq: 'monthly', due: '2026-11-03' },
    { id: 'b3', name: 'Electric', amt: 84, freq: 'monthly', due: '2026-11-05' },
    { id: 'b4', name: 'Car payment', amt: 280, freq: 'monthly', due: '2026-11-14' },
    { id: 'b5', name: 'Internet', amt: 60, freq: 'monthly', due: '2026-11-15' },
    { id: 'b6', name: 'Car insurance', amt: 96, freq: 'monthly', due: '2026-11-18' },
    { id: 'b7', name: 'Gym', amt: 35, freq: 'monthly', due: '2026-11-20' },
    { id: 'b8', name: 'Phone', amt: 44, freq: 'monthly', due: '2026-11-22' },
    { id: 'b9', name: 'Student loan', amt: 245, freq: 'monthly', due: '2026-11-25' },
  ],
  history: [{ label: '29 SEP – 12 OCT', pay: 1840, bills: 812, spent: 588.7, goals: 418, left: 21.3, cats: [['Groceries', 260, 251.3], ['Gas', 120, 118.9], ['Eating out', 100, 112.6], ['Household', 60, 41.9], ['Fun', 70, 64]] }],
  expenses: [
    { id: 'e1', amt: 48.1, cat: 'gas', note: 'Shell', date: '2026-10-20', per: 'p1' },
    { id: 'e2', amt: 62.4, cat: 'groc', note: "Trader Joe's", date: '2026-10-19', per: 'p1' },
    { id: 'e3', amt: 16.4, cat: 'eat', note: 'Tacos El Gordo', date: '2026-10-18', per: 'p1' },
    { id: 'e4', amt: 44.6, cat: 'gas', note: 'Chevron', date: '2026-10-17', per: 'p1' },
    { id: 'e5', amt: 12, cat: 'eat', note: 'Coffee', date: '2026-10-16', per: 'p1' },
    { id: 'e6', amt: 34.99, cat: null, goal: 'car', note: 'Buy wiper blades', proj: 'Fix The Car Up', date: '2026-10-15', per: 'p1', src: 'buy' },
    { id: 'e7', amt: 11.8, cat: 'house', note: 'Hardware store', date: '2026-10-15', per: 'p1' },
    { id: 'e8', amt: 85.8, cat: 'groc', note: 'Costco', date: '2026-10-14', per: 'p1' },
    { id: 'e9', amt: 41.5, cat: 'gas', note: 'Shell', date: '2026-10-13', per: 'p1' },
  ],
  goals: [
    { id: 'roth', name: 'Roth IRA 2026', kind: 'save', target: 7000, saved: 5420, per: 100, hist: [['2026-10-13', 100], ['2026-09-29', 100], ['2026-09-15', 100], ['2026-09-01', 100]] },
    { id: 'tires', name: 'New tires', kind: 'save', target: 720, saved: 635, per: 85, hist: [['2026-10-13', 85], ['2026-09-29', 85], ['2026-09-15', 85], ['2026-09-01', 85], ['2026-08-18', 85], ['2026-08-04', 210, 'Opening deposit']] },
    { id: 'japan', name: 'Japan trip', kind: 'save', target: 3200, saved: 1180, per: 60, event: 'Japan · Mar 2027', hist: [['2026-10-13', 60], ['2026-09-29', 233, 'Extra contribution'], ['2026-09-15', 60]] },
    { id: 'car', name: 'Car repairs', kind: 'proj', target: 600, saved: 0, per: 0, hist: [] },
  ],
  projects: [
    { id: 'car', name: 'Fix The Car Up', tier: 'P', goal: 'car', groups: [
      { id: 'g1', action: { title: 'Install new battery', due: '2026-10-23', done: false }, buy: { title: 'Buy battery', est: 189, actual: null, done: false } },
      { id: 'g2', action: { title: 'Change oil and filter', due: '2026-10-25', done: false }, buy: { title: 'Buy oil + filter', est: 64, actual: null, done: false } },
      { id: 'g4', action: { title: 'Get alignment checked', due: null, done: false }, buy: null },
      { id: 'g3', action: { title: 'Replace wiper blades', due: null, done: true }, buy: { title: 'Buy wiper blades', est: 38, actual: 34.99, done: true } },
    ] },
    { id: 'office', name: 'Home office', tier: 'W', goal: null, groups: [
      { id: 'g5', action: { title: 'Mount monitor', due: '2026-11-01', done: false }, buy: { title: 'Buy monitor arm', est: 79, actual: null, done: false, cat: 'house' } },
      { id: 'g6', action: { title: 'Run cables under desk', due: null, done: false }, buy: { title: 'Buy cable tray', est: 24, actual: null, done: false, cat: 'house' } },
    ] },
  ],
  tasks: [
    { id: 't1', title: 'Renew car registration', tier: 'F', due: '2026-10-19', touched: '2026-10-10', done: false },
    { id: 't2', title: 'Submit October timesheet', tier: 'W', due: '2026-10-22', touched: '2026-10-10', done: false },
    { id: 't3', title: 'Cancel streaming trial', tier: 'F', due: '2026-10-31', touched: '2026-10-10', done: false },
    { id: 't4', title: 'Prep Q4 planning deck', tier: 'W', due: '2026-11-03', touched: '2026-10-10', done: false },
    { id: 't5', title: 'Call dentist about the crown', tier: 'P', due: null, touched: '2026-10-03', done: false },
    { id: 't6', title: 'Return library books', tier: 'P', due: null, touched: '2026-10-18', done: false },
    { id: 't7', title: 'Look into renters insurance', tier: 'F', due: null, touched: '2026-10-12', done: false },
    { id: 't8', title: 'Pay parking ticket', tier: 'F', due: '2026-10-16', touched: '2026-10-16', done: true },
  ],
  pouchLog: {
    '2026-10-08': 7, '2026-10-09': 8, '2026-10-10': 9, '2026-10-11': 7, '2026-10-12': 8, '2026-10-13': 6, '2026-10-14': 7,
    '2026-10-15': 6, '2026-10-16': 5, '2026-10-17': 6, '2026-10-18': 6, '2026-10-19': 5, '2026-10-20': 6, '2026-10-21': 5,
  },
  phases: [
    { start: '2026-09-22', end: '2026-10-12', limit: 8, mg: '6 MG' },
    { start: '2026-10-13', end: '2026-11-04', limit: 6, mg: '4 MG' },
    { start: '2026-11-05', end: '2026-11-25', limit: 4, mg: '3 MG' },
    { start: '2026-11-26', end: '2026-12-16', limit: 2, mg: '1.5 MG' },
  ],
  weighIns: [189.6, 189.4, 188.9, 189.1, 188.4, 188.2, 187.9, 187.4, 187.6, 186.9, 186.4].map((w, i) => [`2026-${i < 4 ? '09' : '10'}-${String(i < 4 ? 21 + i * 3 : (i - 4) * 3 + 3).padStart(2, '0')}`, w] as [string, number]),
  weightTarget: 175,
  payPending: false,
  pendingDone: null,
  boost: {},
  lastCat: 'house',
  seq: 100,
});

/** A brand-new account: nothing but the five budget categories, all at $0. The first period runs
 *  open-ended from today until the first income source's pay date. */
export const emptyData = (today: string): Data => ({
  period: { id: 'p0', label: 'FROM ' + dmU(today), start: today, end: today, pay: 0, extra: 0, bills: [],
    cats: (['groc', 'gas', 'eat', 'house', 'fun'] as const).map((id) => ({ id, alloc: 0, roll: 0 })), goals: [] },
  incomes: [], billsDef: [], subs: [], history: [], expenses: [], goals: [], projects: [], tasks: [],
  pouchLog: {}, phases: [], weighIns: [], weightTarget: 0, nicotineOn: true,
  payPending: false, pendingDone: null, boost: {}, lastCat: 'groc', seq: 100,
});

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dmU = (iso: string) => Number(iso.slice(8, 10)) + ' ' + MON[Number(iso.slice(5, 7)) - 1];

export const freshUI = (today: string): UI => ({
  today,
  tab: 'today', view: null, sheet: null, toast: null,
  draft: { amt: '', cat: null, note: '', y: false },
  np: { name: '', tier: 'P', mode: 'skip', goal: null, gName: '', gTarget: '' },
  st: { mode: 'project', kind: 'action', title: '', est: '', forA: null, cat: 'house', due: 'none', tier: 'P' },
  pr: null, dn: null, pl: null, rv: null, ed: null, ph: null, sb: null, gd: null, cd: null, xe: null, xd: null, ie: null, tb: null, td: null, pd: null, wd: null, dd: null, unlocked: false,
  moff: 0, ftier: 'all', fdone: false, lib: 'docs', drag: null,
});

export const DATA_KEYS: (keyof Data)[] = ['period', 'incomes', 'billsDef', 'subs', 'plan', 'catNames', 'docs', 'history', 'expenses', 'goals', 'projects', 'tasks', 'pouchLog', 'phases', 'weighIns', 'weightTarget', 'nicotineOn', 'payPending', 'pendingDone', 'boost', 'lastCat', 'seq'];
