import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_RE, VERSION_MESSAGES, cleanName, joinRulesError, makeCode, originAllowed, parseClientMessage } from '../../server/src/protocol';
import { compareRules } from '../../src/engine/version';
import en from '../../src/ui/copy/en.json';

const ORIGINS =
  'https://the-veil-mauve.vercel.app,https://the-veil-*-amirrezaakhavan2003-4212s-projects.vercel.app,http://localhost:*,http://127.0.0.1:*';
const ok = (m: object) => parseClientMessage(JSON.stringify(m));

describe('room protocol', () => {
  it('accepts well-formed messages', () => {
    expect(ok({ v: 1, type: 'JOIN', name: 'Ana' })).toEqual({ v: 1, type: 'JOIN', name: 'Ana' });
    expect(ok({ v: 1, type: 'START', mode: 'SINGLE_LEVEL', level: 3, difficulty: 'HARD' })).toMatchObject({ level: 3 });
    expect(ok({ v: 1, type: 'SEND_MESSAGE', msg: { type: 'SUPPORT', option: 'P2' } })).toMatchObject({ type: 'SEND_MESSAGE' });
    expect(ok({ v: 1, type: 'SUBMIT_DECISION', decision: { buy: true, gym: false } })).toMatchObject({ type: 'SUBMIT_DECISION' });
    expect(ok({ v: 1, type: 'SUBMIT_GUESSES', guesses: { chet: 'EGOIST' } })).toMatchObject({ type: 'SUBMIT_GUESSES' });
    expect(ok({ v: 1, type: 'READY' })).toEqual({ v: 1, type: 'READY' });
  });

  it('rejects anything else', () => {
    const bad = [
      { v: 2, type: 'READY' },
      { type: 'READY' },
      { v: 1, type: 'HACK' },
      { v: 1, type: 'READY', extra: 1 },
      // A client can never name its seat.
      { v: 1, type: 'SUBMIT_DECISION', decision: 'P1', from: 'p2' },
      { v: 1, type: 'SEND_MESSAGE', msg: { type: 'SUPPORT', option: 'P2' }, from: 'p2' },
      { v: 1, type: 'SEND_MESSAGE', msg: { type: 'FREE_TEXT', text: 'hi' } },
      { v: 1, type: 'SEND_MESSAGE', msg: { type: 'SUPPORT', option: 'a b c' } },
      { v: 1, type: 'START', mode: 'FULL_RUN', difficulty: 'NORMAL', level: 2 },
      { v: 1, type: 'START', mode: 'SINGLE_LEVEL', difficulty: 'NORMAL', level: 9 },
      { v: 1, type: 'JOIN', name: '' },
      { v: 1, type: 'JOIN', name: 'x'.repeat(21) },
      { v: 1, type: 'JOIN', name: 'Ana', token: 'short' },
      { v: 1, type: 'SUBMIT_GUESSES', guesses: { chet: 'KING' } },
      { v: 1, type: 'SUBMIT_DECISION', decision: { a: { b: { c: { d: { e: { f: 1 } } } } } } },
    ];
    for (const m of bad) expect(ok(m)).toEqual({ error: 'BAD_MESSAGE' });
    expect(parseClientMessage('not json')).toEqual({ error: 'BAD_MESSAGE' });
    expect(parseClientMessage(JSON.stringify({ v: 1, type: 'JOIN', name: 'A', pad: 'x'.repeat(5000) }))).toEqual({ error: 'TOO_LARGE' });
  });

  it('cleans names: control characters stripped, 1 to 20 characters', () => {
    expect(cleanName('  Ana\u0000‮  Lee\n')).toBe('Ana Lee');
    expect(cleanName('\u0007\u0008')).toBeNull();
    expect(cleanName('a'.repeat(20))).toHaveLength(20);
    expect(cleanName('a'.repeat(21))).toBeNull();
  });

  it('room codes are four letters without I, L, O or digits', () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILO0-9]/);
    let k = 0;
    for (let i = 0; i < 200; i++) expect(makeCode((n) => k++ % n)).toMatch(CODE_RE);
    expect(CODE_RE.test('AB1D')).toBe(false);
  });

  it('allows only the production site, this project’s previews and localhost', () => {
    expect(originAllowed('https://the-veil-mauve.vercel.app', ORIGINS)).toBe(true);
    expect(originAllowed('https://the-veil-qkfm0n0ze-amirrezaakhavan2003-4212s-projects.vercel.app', ORIGINS)).toBe(true);
    expect(originAllowed('https://the-veil-git-multiplayer-amirrezaakhavan2003-4212s-projects.vercel.app', ORIGINS)).toBe(true);
    expect(originAllowed('http://localhost:5173', ORIGINS)).toBe(true);
    expect(originAllowed('http://127.0.0.1:4173', ORIGINS)).toBe(true);
    expect(originAllowed('https://evil.example', ORIGINS)).toBe(false);
    expect(originAllowed('https://the-veil-x-someone-else.vercel.app', ORIGINS)).toBe(false);
    expect(originAllowed('https://the-veil-mauve.vercel.app.evil.example', ORIGINS)).toBe(false);
    expect(originAllowed('http://localhost.evil.example', ORIGINS)).toBe(false);
    expect(originAllowed(null, ORIGINS)).toBe(false);
  });
});

describe('rules version on JOIN (D-83)', () => {
  const server = { rules: 'aaaa1111', params: 'bbbb2222', commit: 'unknown' };
  it('JOIN carries the page rules; malformed rules are refused', () => {
    expect(ok({ v: 1, type: 'JOIN', name: 'Ana', rules: server })).toEqual({ v: 1, type: 'JOIN', name: 'Ana', rules: server });
    for (const rules of ['x', { rules: 'a', params: 'b' }, { ...server, extra: 'y' }, { ...server, rules: 'has space' }, { ...server, params: 'p'.repeat(65) }])
      expect(ok({ v: 1, type: 'JOIN', name: 'Ana', rules })).toEqual({ error: 'BAD_MESSAGE' });
  });
  it('the server refuses other rules or parameters and pages that send none; another commit alone is fine', () => {
    expect(joinRulesError(server, server)).toBeNull();
    expect(joinRulesError({ ...server, commit: '9f8e7d6c5b4a' }, server)).toBeNull();
    expect(joinRulesError({ ...server, rules: 'cccc3333' }, server)).toBe('VERSION_MISMATCH');
    expect(joinRulesError({ ...server, params: 'dddd4444' }, server)).toBe('VERSION_MISMATCH');
    expect(joinRulesError(undefined, server)).toBe('VERSION_MISMATCH');
  });
  it('the page refuses a server with other rules, or one that sends none', () => {
    expect(compareRules(server, server)).toBe('same');
    expect(compareRules({ ...server, params: 'dddd4444' }, server)).toBe('different');
    expect(compareRules(undefined, server)).toBe('different');
  });
  it('players are told to reload, or that the room closed because of an update', () => {
    expect(VERSION_MESSAGES.VERSION_MISMATCH).toBe('The game was updated. Reload the page to play.');
    expect(VERSION_MESSAGES.CLOSED_BY_UPDATE).toBe('This room closed because the game was updated.');
    expect(en.room.errors.VERSION_MISMATCH).toBe(VERSION_MESSAGES.VERSION_MISMATCH);
    expect(en.room.errors.CLOSED_BY_UPDATE).toBe(VERSION_MESSAGES.CLOSED_BY_UPDATE);
    expect(en.room.errors.UNREACHABLE).toMatch(/Check the code/);
  });
});
