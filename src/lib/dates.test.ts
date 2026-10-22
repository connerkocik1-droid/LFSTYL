import { describe, expect, it } from 'vitest';
import * as D from './dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(D.add('2026-10-31', 1)).toBe('2026-11-01');
    expect(D.add('2026-12-31', 1)).toBe('2027-01-01');
    expect(D.add('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('steps each pay schedule', () => {
    expect(D.step('2026-10-13', 'weekly')).toBe('2026-10-20');
    expect(D.step('2026-10-13', 'biweekly')).toBe('2026-10-27');
    expect(D.step('2026-10-03', 'semimonthly')).toBe('2026-10-15');
    expect(D.step('2026-10-15', 'semimonthly')).toBe('2026-11-01');
    expect(D.step('2026-10-20', 'semimonthly')).toBe('2026-11-01');
    expect(D.step('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  it('keeps monthly dates inside short months', () => {
    expect(D.step('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(D.step('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('counts whole days between dates', () => {
    expect(D.diff('2026-10-27', '2026-10-21')).toBe(6);
    expect(D.diff('2026-03-09', '2026-03-07')).toBe(2); // US clocks change on 8 March
    expect(D.diff('2026-10-21', '2026-10-27')).toBe(-6);
  });
});
