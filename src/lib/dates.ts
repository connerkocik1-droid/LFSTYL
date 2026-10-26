// All dates are ISO calendar days (YYYY-MM-DD), handled in UTC so no time zone shifts them.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type Sched = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'yearly';

export const p = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fm = (dt: Date) => dt.toISOString().slice(0, 10);

export const add = (iso: string, n: number) => {
  const d = p(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fm(d);
};

const addM = (iso: string, n: number) => {
  const d = p(iso), day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim));
  return fm(d);
};

/** The next occurrence after `iso` on schedule `k`. */
export const step = (iso: string, k: Sched) => {
  if (k === 'weekly') return add(iso, 7);
  if (k === 'biweekly') return add(iso, 14);
  if (k === 'yearly') return addM(iso, 12);
  if (k === 'semimonthly') {
    const d = p(iso);
    return d.getUTCDate() < 15 ? iso.slice(0, 8) + '15' : fm(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  }
  return addM(iso, 1);
};

/** Whole days from b to a. */
export const diff = (a: string, b: string) => Math.round((p(a).getTime() - p(b).getTime()) / 864e5);

/** "21 Oct" */
export const dm = (iso: string) => {
  const d = p(iso);
  return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
};

/** "Wed 21 Oct" */
export const wdm = (iso: string) => WD[p(iso).getUTCDay()] + ' ' + dm(iso);

/** "21 Oct 2026" */
export const dmy = (iso: string) => dm(iso) + ' ' + p(iso).getUTCFullYear();

/** "Wed 21 Oct 2026" */
export const wdmy = (iso: string) => WD[p(iso).getUTCDay()] + ' ' + dmy(iso);

export const wd = (iso: string) => WD[p(iso).getUTCDay()];

export const dayOfMonth = (iso: string) => p(iso).getUTCDate();

/** "14 – 28 Mar 2027" style range used for events. */
export const rangeY = (a: string, b: string) => {
  const A = p(a), B = p(b);
  const sameM = A.getUTCMonth() === B.getUTCMonth() && A.getUTCFullYear() === B.getUTCFullYear();
  return (sameM ? A.getUTCDate() : dm(a)) + ' – ' + dm(b) + ' ' + B.getUTCFullYear();
};

/** Today as an ISO day in the device's local time zone. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const SL: Record<Sched, string> = {
  weekly: 'WEEKLY',
  biweekly: 'EVERY 2 WEEKS',
  semimonthly: '1ST AND 15TH',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
};
