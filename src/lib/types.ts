import type { Sched } from './dates';

export type Tier = 'P' | 'F' | 'W';
export type CatId = 'groc' | 'gas' | 'eat' | 'house' | 'fun';

export interface PeriodCat { id: CatId; alloc: number; roll: number }
export interface PeriodBill { n: string; a: number; d: string }
export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
  pay: number;
  extra: number;
  bills: PeriodBill[];
  cats: PeriodCat[];
  goals: { id: string; a: number }[];
}

export interface Income { id: string; name: string; amt: number; sched: Sched; next: string }
export interface BillDef { id: string; name: string; amt: number; freq: Sched; due: string }

export interface PastPeriod {
  label: string;
  pay: number;
  bills: number;
  spent: number;
  goals: number;
  left: number;
  cats: [string, number, number][];
}

export interface Expense {
  id: string;
  amt: number;
  cat: CatId | null;
  goal?: string | null;
  note: string;
  proj?: string;
  date: string;
  per: string;
  src?: 'buy';
}

/** [date, amount, label] — label defaults to "Paycheck contribution". */
export type GoalEntry = [string, number, string?];

export interface Goal {
  id: string;
  name: string;
  kind: 'save' | 'proj' | 'acct';
  target: number;
  saved: number;
  per: number;
  hist: GoalEntry[];
  event?: string;
  status?: 'done';
  doneOn?: string;
  doneTo?: string;
}

export interface Action { title: string; due: string | null; done: boolean }
export interface Buy { title: string; est: number; actual: number | null; done: boolean; cat?: CatId | null }
export interface Group { id: string; action: Action; buy: Buy | null }
export interface Project { id: string; name: string; tier: Tier; goal: string | null; groups: Group[] }

export interface Task { id: string; title: string; tier: Tier; due: string | null; touched: string; done: boolean }

export interface Phase { start: string; end: string; limit: number; mg: string }

/** Everything that is saved. */
export interface Data {
  period: Period;
  incomes: Income[];
  billsDef: BillDef[];
  history: PastPeriod[];
  expenses: Expense[];
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  pouchLog: Record<string, number>;
  phases: Phase[];
  weighIns: [string, number][];
  weightTarget: number;
  payPending: boolean;
  pendingDone: string | null;
  boost: { cats?: Partial<Record<CatId, number>> };
  lastCat: CatId;
  seq: number;
}

export type Tab = 'today' | 'tasks' | 'money' | 'goals' | 'library';
export type View =
  | { k: 'project'; id: string; from?: View | null }
  | { k: 'goal'; id: string; from?: View | null }
  | { k: 'wean'; from?: View | null }
  | { k: 'review'; from?: View | null }
  | { k: 'setup'; from?: View | null };
export type Sheet = 'add' | 'expense' | 'income' | 'place' | 'np' | 'step' | 'price' | 'done' | 'ed';

export interface Toast { t: string; undo?: string; undoTask?: string; id?: number }
export interface Draft { amt: string; cat: CatId | null; note: string; y: boolean }
export interface NpDraft { name: string; tier: Tier; mode: 'skip' | 'goal' | 'new'; goal: string | null; gName: string; gTarget: string }
export interface StDraft { mode: 'project' | 'task'; kind: 'action' | 'buy'; title: string; est: string; forA: string | null; cat: CatId; due: 'none' | 'tom' | 'week' | 'next'; tier: Tier }
export interface PriceDraft { pid: string; gid: string; amt: string; fresh: boolean; cat: CatId }
export interface DoneDraft { gid: string; stage: 1 | 2; to: string | null; manual?: boolean }
export interface PlaceDraft { amt: number; to: string | null; src: string }
export interface ReviewDraft { cats: Partial<Record<CatId, number>>; goals: Record<string, number> }
export interface EdDraft { kind: 'inc' | 'bill'; id: string | null; name: string; amt: string; sched: Sched; date: string }
export interface Drag { pid: string; from: number; to: number; dy: number; h: number }

/** Screen state that is not saved. */
export interface UI {
  today: string;
  tab: Tab;
  view: View | null;
  sheet: Sheet | null;
  toast: Toast | null;
  draft: Draft;
  np: NpDraft;
  st: StDraft;
  pr: PriceDraft | null;
  dn: DoneDraft | null;
  pl: PlaceDraft | null;
  rv: ReviewDraft | null;
  ed: EdDraft | null;
  moff: number;
  ftier: 'all' | Tier;
  fdone: boolean;
  lib: 'docs' | 'events';
  drag: Drag | null;
}

export type State = Data & UI;
