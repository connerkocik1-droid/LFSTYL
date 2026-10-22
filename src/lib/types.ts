import type { Sched } from './dates';

export type Tier = 'P' | 'F' | 'W';
/** The five starter categories use groc, gas, eat, house and fun; ones you add get generated ids. */
export type CatId = string;

export interface PeriodCat { id: CatId; alloc: number; roll: number }
export interface PeriodBill { n: string; a: number; d: string }
export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
  pay: number;
  /** Total extra income this period; always the sum of extras. */
  extra: number;
  /** Each extra income entry (missing in saves from before they were editable). */
  extras?: { id: string; amt: number; src: string; date: string }[];
  bills: PeriodBill[];
  cats: PeriodCat[];
  goals: { id: string; a: number }[];
}

export interface Income { id: string; name: string; amt: number; sched: Sched; next: string }
export interface BillDef { id: string; name: string; amt: number; freq: Sched; due: string }

/** A recurring expense. Each charge is logged as an expense on its date. */
export interface Sub { id: string; name: string; amt: number; freq: 'weekly' | 'monthly' | 'yearly'; next: string; cat: CatId }

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
  src?: 'buy' | 'sub';
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
  /** Paced goals spread what's left over the paychecks until dueBy (a pay date), recalculated every paycheck. */
  pace?: { dueBy: string };
  status?: 'done';
  doneOn?: string;
  doneTo?: string;
}

export interface Action { title: string; due: string | null; done: boolean; notes?: string }
export interface Buy { title: string; est: number; actual: number | null; done: boolean; cat?: CatId | null }
export interface Group { id: string; action: Action; buy: Buy | null }
export interface Project { id: string; name: string; tier: Tier; goal: string | null; groups: Group[] }

export interface Task { id: string; title: string; tier: Tier; due: string | null; touched: string; done: boolean; notes?: string }

export interface Phase { start: string; end: string; limit: number; mg: string }

/** Everything that is saved. */
export interface Data {
  period: Period;
  incomes: Income[];
  billsDef: BillDef[];
  /** Missing in saves from before subscriptions existed. */
  subs?: Sub[];
  /** Standing budget: how much of each paycheck goes to each category. Paycheck reviews start from it. */
  plan?: { cats: Partial<Record<CatId, number>> };
  /** Names for categories you added or renamed. */
  catNames?: Record<CatId, string>;
  history: PastPeriod[];
  expenses: Expense[];
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  pouchLog: Record<string, number>;
  phases: Phase[];
  weighIns: [string, number][];
  weightTarget: number;
  /** Nicotine tracking shown on Today, Goals and quick add. Missing in older saves means on. */
  nicotineOn?: boolean;
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
  | { k: 'setup'; from?: View | null }
  | { k: 'subs'; from?: View | null }
  | { k: 'plan'; from?: View | null }
  | { k: 'weight'; from?: View | null }
  | { k: 'settings'; from?: View | null };
export type Sheet = 'add' | 'expense' | 'income' | 'place' | 'np' | 'step' | 'price' | 'done' | 'ed' | 'phase' | 'sub' | 'goal' | 'cat' | 'exp' | 'inc' | 'take' | 'task' | 'proj' | 'weigh';

export interface Toast { t: string; undo?: string; undoTask?: string; id?: number }
export interface Draft { amt: string; cat: CatId | null; note: string; y: boolean }
export interface NpDraft { name: string; tier: Tier; mode: 'skip' | 'goal' | 'new'; goal: string | null; gName: string; gTarget: string }
export interface StDraft { mode: 'project' | 'task'; kind: 'action' | 'buy'; title: string; est: string; forA: string | null; cat: CatId; due: 'none' | 'tom' | 'week' | 'next'; tier: Tier }
export interface PriceDraft { pid: string; gid: string; amt: string; fresh: boolean; cat: CatId }
export interface DoneDraft { gid: string; stage: 1 | 2; to: string | null; manual?: boolean }
/** split maps a destination (c:<category> or g:<goal>) to the typed amount. */
export interface PlaceDraft { amt: number; split: Record<string, string>; src: string }
export interface ReviewDraft { cats: Partial<Record<CatId, number>>; goals: Record<string, number> }
export interface EdDraft { kind: 'inc' | 'bill'; id: string | null; name: string; amt: string; sched: Sched; date: string }
/** idx is the phase being edited, or null for a new one. */
export interface PhaseDraft { idx: number | null; start: string; end: string; limit: string; mg: string }
export interface SubDraft { id: string | null; name: string; amt: string; freq: Sub['freq']; next: string; cat: CatId }
export interface GoalDraft { id: string | null; name: string; target: string; saved: string; mode: 'pace' | 'fixed'; n: string; per: string }
export interface CatDraft { id: string | null; name: string; amt: string }
/** Editing a task, a project action or a project buy step. */
export interface TaskDraft { kind: 'task' | 'action' | 'buy'; id: string; pid?: string; title: string; tier: Tier; due: string; notes: string; est: string; cat: CatId | null }
export interface ProjDraft { id: string; name: string; tier: Tier }
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
  ph: PhaseDraft | null;
  sb: SubDraft | null;
  gd: GoalDraft | null;
  cd: CatDraft | null;
  /** The expense open for deleting. */
  xe: string | null;
  /** Draft for the expense being edited. */
  xd: { id: string; amt: string; note: string; date: string; cat: CatId | null } | null;
  /** Draft for the extra income entry being edited. */
  ie: { id: string; amt: string; src: string } | null;
  /** Amounts to move back to Unassigned, keyed like the place split. */
  tb: Record<string, string> | null;
  td: TaskDraft | null;
  pd: ProjDraft | null;
  /** Weigh-in being entered: weight and date. */
  wd: { w: string; date: string } | null;
  moff: number;
  ftier: 'all' | Tier;
  fdone: boolean;
  lib: 'docs' | 'events';
  drag: Drag | null;
}

export type State = Data & UI;
