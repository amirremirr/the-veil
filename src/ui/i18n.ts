import en from './copy/en.json';
import events from './copy/events.json';
import voices from './copy/bots/voices.json';

type Vars = Record<string, string | number | undefined>;

function lookup(path: string): unknown {
  let cur: unknown = en;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function fill(str: string, vars: Vars = {}): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** Translate a key from en.json. Missing keys render as the key itself so they are easy to spot. */
export function t(key: string, vars?: Vars): string {
  const v = lookup(key);
  return typeof v === 'string' ? fill(v, vars) : key;
}

export function tList(key: string): string[] {
  const v = lookup(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

/**
 * A news headline. When the name slot holds the human player, the second-person bank `<key>.you`
 * is used if it exists, so headlines never read "You tops the list".
 */
export function newsletter(key: string, variant: number, vars: Vars, humanSubject = false): string {
  const banks = events.newsletter as Record<string, string[]>;
  const bank = (humanSubject && banks[`${key}.you`]) || banks[key] || [];
  if (!bank.length) return '';
  return fill(bank[variant % bank.length], vars);
}

export function lifeEvent(variant: number): string {
  return events.lifeEvents[variant % events.lifeEvents.length];
}

/** A bot's line. When the message is about the human, the `<TYPE>_YOU` bank is used if it exists. */
export function voiceLine(bot: string, type: string, variant: number, vars: Vars, aboutHuman = false): string {
  const banks = (voices as Record<string, Record<string, string[]>>)[bot] ?? {};
  const bank = (aboutHuman && banks[`${type}_YOU`]) || banks[type] || [];
  if (!bank.length) return '';
  return fill(bank[variant % bank.length], vars);
}
