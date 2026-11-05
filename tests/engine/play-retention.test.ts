// Retention without dark patterns (RUNPLAN T8, D-157).
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, dailySeed, istanbulDay } from '../../src/ui/play/retention';
import en from '../../src/ui/copy/en.json';

describe('Daily Life and achievements', () => {
  it('uses the Europe/Istanbul day for the daily seed', () => {
    // 22:30 UTC on 4 November is already 5 November in Istanbul (UTC+3).
    expect(istanbulDay(new Date('2026-11-04T22:30:00Z'))).toBe('2026-11-05');
    expect(istanbulDay(new Date('2026-11-04T20:30:00Z'))).toBe('2026-11-04');
    expect(dailySeed('2026-11-05')).toBe('daily-2026-11-05');
  });
  it('has at most 12 achievements, each named and explained, none about playing more', () => {
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(12);
    const a = (en as unknown as { play: { ach: Record<string, { name: string; desc: string }> } }).play.ach;
    for (const k of ACHIEVEMENTS) {
      expect(a[k].name.length).toBeGreaterThan(0);
      expect(a[k].desc).not.toMatch(/\b(times|in a row|streak|daily|every day)\b/i);
    }
  });
});
