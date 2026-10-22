// Play copy rules (PLAY_MODE_SPEC.md Sections 1.2, 7.3 and 9): no em dashes, host lines of at most 15
// words, enough variants per key, second-person lines when the subject is the viewer, bureaucracy-only
// wheel slips. And reactions carry nothing but who reacted and how (Section 11).
import { describe, expect, it } from 'vitest';
import en from '../../src/ui/copy/en.json';
import host from '../../src/ui/copy/play/host.json';
import confessionals from '../../src/ui/copy/play/confessionals.json';
import wheel from '../../src/ui/copy/play/wheel.json';
import { OUTCOME_KEYS, botReactions, hostLine } from '../../src/ui/play/logic';
import { visibleState, createInitialState, step, HUMAN_ID } from '../../src/engine/engine';

const THIRD_PERSON = /\bYou (?!are\b|were\b|was\b)[a-z]+s\b/;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function strings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, out));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out));
  return out;
}

const banks = host as unknown as Record<string, string[] | string>;
const hostKeys = Object.keys(banks).filter((k) => !k.startsWith('_'));

describe('Play copy', () => {
  it('has no em dashes anywhere', () => {
    for (const s of [...strings((en as Record<string, unknown>).play), ...strings(host), ...strings(confessionals), ...strings(wheel)]) expect(s, s).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
  });
  it('host lines are at most 15 words, at least 6 per key, and .you banks line up', () => {
    for (const k of hostKeys) {
      const bank = banks[k] as string[];
      expect(bank.length, k).toBeGreaterThanOrEqual(6);
      for (const line of bank) expect(words(line), line).toBeLessThanOrEqual(15);
      if (k.endsWith('.you')) expect(bank.length).toBe((banks[k.slice(0, -4)] as string[]).length);
    }
  });
  it('every outcome key with a subject has a second-person bank that reads correctly', () => {
    for (const k of OUTCOME_KEYS.filter((x) => x !== 'quiet')) {
      expect(banks[`${k}.you`], k).toBeDefined();
      for (let i = 0; i < 6; i++) {
        const line = hostLine(k, i, { name: 'You' }, true);
        expect(line, line).not.toMatch(THIRD_PERSON);
        expect(line).not.toContain('{name}');
      }
    }
  });
  it('confessionals: at least 4 per bot per outcome key, and they name nobody', () => {
    const c = confessionals as unknown as Record<string, Record<string, string[]>>;
    for (const bot of ['chet', 'marigold', 'ugo', 'dot'])
      for (const k of OUTCOME_KEYS) {
        expect(c[bot][k]?.length ?? 0, `${bot}.${k}`).toBeGreaterThanOrEqual(4);
        for (const line of c[bot][k]) expect(line).not.toMatch(/\{\w+\}/);
      }
  });
  it('12 Wheel of Misfortune slips', () => expect(wheel.slips.length).toBe(12));
  it('every Episode 3 event card has a name, a story and a one-line effect', () => {
    const ev = (en as unknown as { play: { events: { L3: Record<string, { name: string; text: string; effect: string }> } } }).play.events.L3;
    for (const id of ['QUIET', 'STORM', 'GYM_SALE', 'PRICE_WAR', 'BREAKTHROUGH', 'PAPERWORK']) {
      expect(ev[id].name).toBeTruthy();
      expect(ev[id].effect).toBeTruthy();
    }
  });
});

describe('reactions', () => {
  it('a reaction holds only who reacted and how', () => {
    const s = createInitialState({ mode: 'EPISODE', level: 3, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'react' });
    step(s, { type: 'ADVANCE' });
    const v = visibleState(s, HUMAN_ID);
    let n = 0;
    for (let r = 0; r < 30; r++)
      for (const k of OUTCOME_KEYS) {
        const rs = botReactions({ ...v, round: r }, k);
        for (const x of rs) {
          expect(Object.keys(x).sort()).toEqual(['from', 'kind']);
          n++;
        }
      }
    expect(n).toBeGreaterThan(0);
  });
});

describe('nobody is told the mix (D-141)', () => {
  it('the private-cards line says so, and no Play string counts the high-risk players', async () => {
    const en = (await import('../../src/ui/copy/en.json')).default as { play: Record<string, unknown> };
    expect((en.play.myCards as Record<string, string>).unknown).toBe('Nobody knows how many players are high risk or Worriers. Not even the host.');
    const all = JSON.stringify(en.play);
    expect(all).not.toMatch(/of you (are|is) high risk/i);
    expect(all).not.toMatch(/Two of you/);
  });
});
