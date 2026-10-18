import { useMemo, useState } from 'react';
import archives from '../copy/archives.json';
import type { Difficulty, LevelId } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { FormCard, Page, Stamp } from '../components/common';

export function Title() {
  const { go, game } = useStore();
  const resumable = game && game.phase.kind !== 'END';
  return (
    <Page narrow>
      <div className="flex min-h-[80vh] flex-col justify-center py-8">
        <p className="label">{t('app.ministry')}</p>
        <h1 className="h-display mt-2 text-6xl sm:text-7xl">{t('app.title')}</h1>
        <p className="mt-3 text-lg">{t('app.subtitle')}</p>
        <div className="mt-5">
          <Stamp rotate={-2} className="text-xs">{t('app.motto')}</Stamp>
        </div>
        <nav className="mt-10 flex flex-col gap-3 sm:max-w-xs" aria-label={t('ui.mainMenu')}>
          {resumable && (
            <button type="button" className="btn-primary" onClick={() => go('game')}>
              {t('app.resume')}
            </button>
          )}
          <button type="button" className={resumable ? 'btn-ghost' : 'btn-primary'} onClick={() => go('mode')}>
            {t('app.begin')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => go('archives')}>
            {t('app.archives')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => go('settings')}>
            {t('app.settings')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => go('about')}>
            {t('app.about')}
          </button>
        </nav>
      </div>
    </Page>
  );
}

export function ModeSelect() {
  const { go, chooseMode, progress, settings } = useStore();
  const unlocked = settings.unlockAll ? 5 : progress.unlocked;
  return (
    <Page narrow>
      <BackLink onClick={() => go('title')} />
      <h1 className="h-display mb-4 text-3xl">{t('mode.title')}</h1>
      <div className="space-y-4">
        <button type="button" className="choice block p-4" onClick={() => chooseMode('FULL_RUN')}>
          <span className="h-display block text-2xl">{t('mode.fullRun')}</span>
          <span className="mt-1 block text-sm text-soft">{t('mode.fullRunDesc')}</span>
        </button>
        <FormCard form={t('mode.single')}>
          <p className="mb-3 text-sm text-soft">{t('mode.singleDesc')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {([1, 2, 3, 4, 5] as LevelId[]).map((n) => {
              const locked = n > unlocked;
              const best = progress.best[`L${n}`];
              return (
                <li key={n}>
                  <button type="button" className="choice block h-full" disabled={locked} aria-disabled={locked} onClick={() => !locked && chooseMode('SINGLE_LEVEL', n)}>
                    <span className="label block">{t('mode.level', { n })}</span>
                    <span className="block font-semibold">{t(`levels.${n}.name`)}</span>
                    <span className="block text-xs text-soft">{locked ? t('mode.locked', { prev: n - 1 }) : t(`levels.${n}.question`)}</span>
                    {best !== undefined && !locked && <span className="num mt-1 block text-xs">{t('ui.best', { n: best })}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </FormCard>
      </div>
    </Page>
  );
}

export function Setup() {
  const { go, start, setupFor, settings } = useStore();
  const [n, setN] = useState<2 | 3 | 4>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.difficulty);
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('');
  if (!setupFor) return null;
  return (
    <Page narrow>
      <BackLink onClick={() => go('mode')} />
      <FormCard form={t('setup.title')} right={setupFor.mode === 'SINGLE_LEVEL' ? t('mode.level', { n: setupFor.level ?? 1 }) : t('mode.fullRun')}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            start({ mode: setupFor.mode, level: setupFor.level, nPlayers: n, difficulty, seed, humanName: name.trim() || undefined });
          }}
        >
          <fieldset>
            <legend className="label mb-1">{t('setup.players')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('setup.players')}>
              {([2, 3, 4] as const).map((k) => (
                <button key={k} type="button" aria-pressed={n === k} className="choice justify-center" onClick={() => setN(k)}>
                  <span className="num text-lg">{k}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label mb-1">{t('setup.difficulty')}</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t('setup.difficulty')}>
              {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} className="choice block" onClick={() => setDifficulty(d)}>
                  <span className="block font-semibold">{t(`setup.${d}`)}</span>
                  <span className="block text-xs text-soft">{t(`setup.${d}Desc`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="label">{t('setup.name')}</span>
            <input className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t('setup.seed')}</span>
            <input className="num mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={seed} maxLength={64} onChange={(e) => setSeed(e.target.value)} />
            <span className="mt-1 block text-xs text-soft">{t('setup.seedHint')}</span>
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              {t('setup.submit')}
            </button>
          </div>
        </form>
      </FormCard>
    </Page>
  );
}

export function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn-ghost mb-4" onClick={onClick}>
      ← {t('app.back')}
    </button>
  );
}

export function Archives() {
  const { go, game } = useStore();
  const [q, setQ] = useState('');
  const refs = archives.refs as Record<string, string>;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return archives.entries;
    return archives.entries.filter((e) => `${e.title} ${e.body} ${e.refs.map((r) => refs[r]).join(' ')}`.toLowerCase().includes(s));
  }, [q, refs]);
  return (
    <Page>
      <BackLink onClick={() => go(game && game.phase.kind !== 'END' ? 'game' : 'title')} />
      <h1 className="h-display mb-1 text-3xl">{t('archives.title')}</h1>
      <label className="mt-3 block max-w-md">
        <span className="label">{t('archives.search')}</span>
        <input type="search" className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {list.length === 0 && <p className="mt-4 text-soft">{t('archives.none')}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {list.map((e) => (
          <FormCard key={e.id} form={t('ui.file', { id: e.id.toUpperCase() })} right={e.levels.map((n) => `L${n}`).join(' ')}>
            <h2 className="h-display text-xl">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed">{e.body}</p>
            {e.formula && (
              <p className="mt-2 text-sm">
                <span className="label">{t('archives.formula')}: </span>
                <code className="num break-words">{e.formula}</code>
              </p>
            )}
            <div className="mt-2">
              <span className="label">{t('archives.sources')}</span>
              <ul className="mt-1 space-y-1 text-xs text-soft">
                {e.refs.map((r) => (
                  <li key={r}>{refs[r]}</li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-xs">{e.levels.map((n) => t('archives.level', { n })).join(' · ')}</p>
          </FormCard>
        ))}
      </div>
    </Page>
  );
}

export function SettingsScreen() {
  const { go, settings, updateSettings, resetProgress, resetTips } = useStore();
  const [done, setDone] = useState(false);
  const [tipsDone, setTipsDone] = useState(false);
  const Toggle = ({ k, label }: { k: 'reducedMotion' | 'sound' | 'unlockAll'; label: string }) => (
    <button type="button" aria-pressed={settings[k]} className="choice items-center justify-between" onClick={() => updateSettings({ [k]: !settings[k] })}>
      <span>{label}</span>
      <span className="num">{settings[k] ? t('ui.on') : t('ui.off')}</span>
    </button>
  );
  return (
    <Page narrow>
      <BackLink onClick={() => go('title')} />
      <FormCard form={t('settings.title')}>
        <div className="space-y-4">
          <Toggle k="reducedMotion" label={t('settings.reducedMotion')} />
          <fieldset>
            <legend className="label mb-1">{t('settings.textSize')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('settings.textSize')}>
              {(['S', 'M', 'L'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={settings.textSize === s} className="choice justify-center" onClick={() => updateSettings({ textSize: s })}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label mb-1">{t('settings.theme')}</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label={t('settings.theme')}>
              {(['system', 'light', 'dark'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={settings.theme === s} className="choice" onClick={() => updateSettings({ theme: s })}>
                  {t(`settings.theme${s[0].toUpperCase()}${s.slice(1)}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <Toggle k="sound" label={t('settings.sound')} />
          <fieldset>
            <legend className="label mb-1">{t('settings.difficulty')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('settings.difficulty')}>
              {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                <button key={d} type="button" aria-pressed={settings.difficulty === d} className="choice justify-center" onClick={() => updateSettings({ difficulty: d })}>
                  {t(`setup.${d}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <Toggle k="unlockAll" label={t('settings.unlockAll')} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              resetTips();
              setTipsDone(true);
            }}
          >
            {t('settings.showTips')}
          </button>
          {tipsDone && <p className="text-sm text-soft" role="status">{t('settings.tipsReset')}</p>}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              resetProgress();
              setDone(true);
            }}
          >
            {t('settings.reset')}
          </button>
          {done && <p className="text-sm text-soft" role="status">{t('settings.resetDone')}</p>}
        </div>
      </FormCard>
    </Page>
  );
}

export function About() {
  const go = useStore((s) => s.go);
  return (
    <Page narrow>
      <BackLink onClick={() => go('title')} />
      <FormCard form={t('about.title')}>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>{t('about.purpose')}</p>
          <p>{t('about.author')}</p>
          <h2 className="h-display text-xl">{t('about.methodsTitle')}</h2>
          <p>{t('about.methods')}</p>
          <p className="text-soft">{t('about.noTracking')}</p>
        </div>
      </FormCard>
    </Page>
  );
}
