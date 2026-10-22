export const r2 = (n: number) => Math.round(n * 100) / 100;

export const sum = <T,>(a: T[], f?: (x: T) => number) =>
  a.reduce((t, x) => t + (f ? f(x) : (x as unknown as number)), 0);

export const num = (n: number, d = 2) =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const usd = (n: number, d = 2) => (n < -0.004 ? '−' : '') + '$' + num(n, d);

const whole = (n: number) => Math.abs(r2(n) % 1) < 0.004;

/** Dollars, dropping cents when they are zero. */
export const u0 = (n: number) => usd(n, whole(n) ? 0 : 2);

export const n2 = (n: number) => num(n, whole(n) ? 0 : 2);

/** Signed amount: +12.00 / −4.10 */
export const sg = (n: number) => (n < -0.004 ? '−' : '+') + num(n);

/** Splits an amount into sign+$, dollars and .cents for the big display numbers. */
export const split = (n: number) => {
  const [d, c] = num(n).split('.');
  return { S: (n < -0.004 ? '−' : '') + '$', D: d, C: '.' + c };
};

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
