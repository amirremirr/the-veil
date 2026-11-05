// Playtest kit (RUNPLAN F1, D-166).
import { describe, expect, it } from 'vitest';
import { compact, decodeResults, encodeResults, playtestOn, startLog, currentLog, type PlaytestLog } from '../../src/ui/playtest';

const sample: PlaytestLog = {
  v: 1,
  cfg: { n: 4, d: 'NORMAL', seed: 'playtest-1', mode: 'EPISODE', ep: 3 },
  startedAt: 0,
  firstDecisionMs: 23456,
  screens: Array.from({ length: 30 }, (_, i) => ({ k: `ep3:DECIDE:${['CLAIM', 'CHOICE', 'REGIME'][i % 3]}`, ms: 1000 + i * 137 })),
  menuTaps: 2,
  backTaps: 0,
  replayFast: true,
  summaryAt: 9,
  acts: { lied: 1, barred: 2, gave: 1, peeked: 0 },
  survey: { oneSentence: 'You buy insurance and lie about how risky you are, then everyone finds out.', why: 'Mostly risky people stayed in, so SafeHands charged more for everyone left.', cared: 'read', surprised: 'lie', changed: 'little', again: 'yes', withWhom: 'friend', unclear: 'no', missionChanged: 'bit' },
};

describe('playtest kit', () => {
  it('round-trips a results code exactly and keeps it near 600 characters', async () => {
    const rec = compact(sample);
    const code = await encodeResults(rec);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThanOrEqual(650);
    expect(await decodeResults(code)).toEqual(rec);
  });
  it('holds no other player private information (only own timings, own choices, the survey)', () => {
    const rec = compact(sample) as Record<string, unknown>;
    expect(Object.keys(rec).sort()).toEqual(['a', 'b', 'c', 'f', 'm', 'q', 'r', 's', 't', 'v']);
    const text = JSON.stringify(rec);
    for (const w of ['riskType', 'worry', 'values', 'types', 'talent', 'income', 'trained', 'EGOIST', 'RAWLSIAN', 'chet', 'marigold', 'ugo', 'dot']) expect(text).not.toContain(w);
  });
  it('is off by default: no log is started', () => {
    expect(playtestOn()).toBe(false);
    startLog({ n: 4, d: 'NORMAL', seed: 'x', mode: 'EPISODE', ep: 3 });
    expect(currentLog()).toBeNull();
  });
});
