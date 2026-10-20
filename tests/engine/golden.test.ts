// Golden Study replay (Play mode spec, Section 0.2): Study mode is frozen. Every game below was recorded
// on main at a73559d (rules 262e9b5b2934d866) before any Play-mode work, by tests/engine/golden/record.ts.
// Each log must replay to exactly the same final state and the same final view for every human seat.
// If this fails, Study mode changed: fix the change, never re-record the fixture.
import { describe, expect, it } from 'vitest';
import { replay, visibleState } from '../../src/engine/engine';
import { sha, stateHash, type GoldenGame } from './golden/hash';
import fixture from './golden/study-golden.json';

const games = (fixture as unknown as { games: GoldenGame[] }).games;

describe('golden Study replays', () => {
  it('covers full runs, every single level, the screen flow, several humans and auto decisions', () => {
    expect(games.length).toBeGreaterThanOrEqual(18);
    expect(games.some((g) => g.log.some(({ action }) => action.type === 'SUBMIT_DECISION' && action.auto))).toBe(true);
  });
  for (const g of games) {
    it(`${g.name} replays to the recorded state and views`, () => {
      const s = replay(g.log);
      expect(s.phase.kind).toBe('END');
      expect(stateHash(s)).toBe(g.stateHash);
      for (const v of g.viewers) expect(sha(visibleState(s, v)), v).toBe(g.viewHashes[v]);
    }, 60_000);
  }
});
