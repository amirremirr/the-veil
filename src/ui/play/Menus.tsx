// Play spec Section 8: "How do you want to play?", then Play's own show picker and casting call.
// The Study menus (Full game, One level, Setup) are unchanged and reached through "With the economics".
import { useState } from 'react';
import type { Difficulty, LevelId } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { PLAYABLE_EPISODES } from '../../engine/play/rules';
import { useStore } from '../store';
import { t } from '../i18n';
import { Page } from '../components/common';
import { BackLink } from '../screens/Menus';

export function HowToPlay() {
  const { go, settings } = useStore();
  const options = [
    { id: 'PLAY' as const, title: t('play.choose.fun'), desc: t('play.choose.funDesc'), to: 'playMode' as const },
    { id: 'STUDY' as const, title: t('play.choose.econ'), desc: t('play.choose.econDesc'), to: 'mode' as const },
  ];
  if (settings.ruleset === 'STUDY') options.reverse();
  return (
    <Page narrow>
      <BackLink onClick={() => go('title')} />
      <h1 className="h-display mb-4 text-3xl">{t('play.choose.title')}</h1>
      <div className="space-y-3">
        {options.map((o, i) => (
          <button key={o.id} type="button" className={`choice block p-4 ${i === 0 ? 'border-ink' : ''}`} onClick={() => go(o.to)} data-ruleset-choice={o.id}>
            <span className="h-display block text-2xl">{o.title}</span>
            <span className="mt-1 block text-sm text-soft">{o.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-soft">{t('play.disclaimer')}</p>
    </Page>
  );
}

export function PlayModeSelect() {
  const { go } = useStore();
  const choose = (n: LevelId) => {
    useStore.setState({ setupFor: { mode: 'EPISODE', level: n }, screen: 'playSetup' });
  };
  return (
    <Page narrow>
      <BackLink onClick={() => go('howPlay')} />
      <p className="h-show text-lg">{t('play.show')}</p>
      <h1 className="h-show mb-1 text-3xl">{t('play.modes.title')}</h1>
      <p className="mb-4 text-sm italic">{t('play.tagline')}</p>
      <div className="space-y-3">
        <button type="button" className="choice block p-4" disabled aria-disabled>
          <span className="h-show block text-2xl">{t('play.modes.life')}</span>
          <span className="mt-1 block text-sm text-soft">{t('play.modes.lifeDesc')}</span>
          <span className="label mt-1 block">{t('play.modes.soon')}</span>
        </button>
        <section className="form-card p-3" aria-labelledby="one-ep">
          <h2 id="one-ep" className="h-show text-xl">
            {t('play.modes.episode')}
          </h2>
          <p className="mb-2 text-sm text-soft">{t('play.modes.episodeDesc', { bank: PLAY.EPISODE_STARTING_BANK })}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {([1, 2, 3, 4, 5] as LevelId[]).map((n) => {
              const ready = PLAYABLE_EPISODES.includes(n);
              return (
                <li key={n}>
                  <button type="button" className="choice block h-full" disabled={!ready} aria-disabled={!ready} onClick={() => ready && choose(n)}>
                    <span className="label block">{t('play.modes.ep', { n })}</span>
                    <span className="block font-semibold">{t(`play.episodes.${n}.name`)}</span>
                    <span className="block text-xs text-soft">{ready ? t(`play.episodes.${n}.pitch`) : t('play.modes.soon')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <p className="mt-4 text-xs text-soft">{t('play.disclaimer')}</p>
    </Page>
  );
}

export function PlaySetup() {
  const { go, start, setupFor, settings } = useStore();
  const [n, setN] = useState<2 | 3 | 4>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.difficulty);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  if (!setupFor) return null;
  return (
    <Page narrow>
      <BackLink onClick={() => go('playMode')} />
      <section className="form-card p-4">
        <p className="label">
          {t('play.modes.ep', { n: setupFor.level ?? 3 })} · {t(`play.episodes.${setupFor.level ?? 3}.name`)}
        </p>
        <h1 className="h-show text-2xl">{t('play.setup.title')}</h1>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start({ mode: 'EPISODE', level: setupFor.level ?? 3, ruleset: 'PLAY', nPlayers: n, difficulty, seed, humanName: name.trim() || undefined });
          }}
        >
          <fieldset>
            <legend className="label mb-1">{t('play.setup.players')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('play.setup.players')}>
              {([2, 3, 4] as const).map((k) => (
                <button key={k} type="button" aria-pressed={n === k} className="choice justify-center" onClick={() => setN(k)}>
                  <span className="num text-lg">{k}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label mb-1">{t('play.setup.difficulty')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('play.setup.difficulty')}>
              {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} className="choice justify-center text-sm" onClick={() => setDifficulty(d)}>
                  {t(`setup.${d}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="label">{t('play.setup.name')}</span>
            <input className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t('play.setup.seed')}</span>
            <input className="num mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={seed} maxLength={64} onChange={(e) => setSeed(e.target.value)} />
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              {t('play.setup.start')}
            </button>
          </div>
        </form>
      </section>
    </Page>
  );
}
