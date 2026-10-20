// Every template whose name slot can hold the human player must read correctly in second person.
// It is rendered the way the UI renders it (newsletter / voiceLine / t with the "You" variant).
import { describe, expect, it } from 'vitest';
import en from '../../src/ui/copy/en.json';
import events from '../../src/ui/copy/events.json';
import voices from '../../src/ui/copy/bots/voices.json';
import { newsletter, t, voiceLine } from '../../src/ui/i18n';

const BANNED = ['You tops', 'You acts', 'You earns', 'You gets', 'You is'];
// Third-person verb right after "You" (for example "You wants", "You has", "You seems").
const THIRD_PERSON = /\bYou (?!are\b|were\b|was\b)[a-z]+s\b/;
const NAME_SLOTS = /\{(name|target|donor|to|proposer)\}/;

// Slots the human can never fill, so no second-person variant is needed:
// the human never accuses themselves (the engine rejects it), never gets the luck survey about
// themselves, and is never a bot guessing.
const NEVER_HUMAN = new Set(['talk.human.ACCUSE', 'levels.2.pollDecide', 'run.botGuessLine', 'play.summary.guess', 'play.summary.guessWrong', 'play.reactions.botReacted']);

const vars = { name: 'You', target: 'You', donor: 'You', to: 'Dot', proposer: 'You', cardName: 'Egoist', option: 'Safety Net' };

function check(text: string, where: string) {
  for (const b of BANNED) expect(text, `${where}: "${text}"`).not.toContain(b);
  expect(text, `${where}: "${text}"`).not.toMatch(THIRD_PERSON);
}

function walk(o: unknown, path: string, out: Array<[string, string]>) {
  if (typeof o === 'string') out.push([path, o]);
  else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k, out);
}

describe('second-person grammar when the human fills a name slot', () => {
  it('news headlines', () => {
    const banks = events.newsletter as Record<string, string[]>;
    let n = 0;
    for (const [key, bank] of Object.entries(banks)) {
      if (key.endsWith('.you')) continue;
      bank.forEach((tpl, i) => {
        if (!NAME_SLOTS.test(tpl)) return;
        check(newsletter(key, i, { ...vars, t: 40, premium: 22, events: 2, delta: '0.04', pi: '0.34', F: 40, passed: 1 }, true), `newsletter.${key}[${i}]`);
        n++;
      });
    }
    expect(n).toBeGreaterThan(0);
  });

  it('bot lines about the human', () => {
    let n = 0;
    for (const [bot, types] of Object.entries(voices as Record<string, Record<string, string[]>>)) {
      for (const [type, bank] of Object.entries(types)) {
        if (type.endsWith('_YOU')) continue;
        bank.forEach((tpl, i) => {
          if (!NAME_SLOTS.test(tpl)) return;
          check(voiceLine(bot, type, i, vars, true), `voices.${bot}.${type}[${i}]`);
          n++;
        });
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('interface text', () => {
    const all: Array<[string, string]> = [];
    walk(en, '', all);
    const keys = new Set(all.map(([k]) => k));
    let n = 0;
    for (const [key, tpl] of all) {
      if (!NAME_SLOTS.test(tpl) || NEVER_HUMAN.has(key) || key.endsWith('You')) continue;
      // Use the "You" variant where the UI has one (for example levels.5.amendDecideYou).
      const youKey = keys.has(`${key}You`) ? `${key}You` : key;
      check(t(youKey, vars), youKey);
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it('every "You" variant bank lines up with its base bank', () => {
    const banks = events.newsletter as Record<string, string[]>;
    for (const key of Object.keys(banks).filter((k) => k.endsWith('.you'))) expect(banks[key.slice(0, -4)]).toBeDefined();
    for (const types of Object.values(voices as Record<string, Record<string, string[]>>))
      for (const type of Object.keys(types).filter((k) => k.endsWith('_YOU'))) expect(types[type.slice(0, -4)].length).toBe(types[type].length);
  });
});
