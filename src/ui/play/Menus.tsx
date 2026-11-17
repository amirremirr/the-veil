// Play spec Section 8: "How do you want to play?", then Play's own show picker and casting call.
// The Study menus (Full game, One level, Setup) are unchanged and reached through "With the economics".
import { useState } from 'react';
import { HUMAN_AVATARS, ShapePerson, myAvatar, setMyAvatar, type HumanAvatar } from './Characters';
import type { Difficulty, LevelId } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { PLAYABLE_EPISODES } from '../../engine/play/rules';
import { dailySeed, istanbulDay } from './retention';
import { playtestOn, setPlaytest } from '../playtest';
import { useStore } from '../store';
import { t } from '../i18n';
import { Page } from '../components/common';
import { BackLink } from '../screens/Menus';
import { PlayOpening, openingSeen } from './Opening';

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
      <h1 className="h-display mb-4 text-title">{t('play.choose.title')}</h1>
      <div className="space-y-3">
        {options.map((o, i) => (
          <button key={o.id} type="button" className={`choice block p-4 ${i === 0 ? 'border-ink' : ''}`} onClick={() => go(o.to)} data-ruleset-choice={o.id}>
            <span className="h-display block text-title">{o.title}</span>
            <span className="mt-1 block text-small text-soft">{o.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-small text-soft">{t('play.disclaimer')}</p>
    </Page>
  );
}

/** F1: the playtest-mode switch (off by default; ?playtest=1 also turns it on for that visit). */
function PlaytestToggle() {
  const [on, setOn] = useState(playtestOn());
  return (
    <label className="mt-2 flex items-center gap-2 text-small text-soft">
      <input type="checkbox" checked={on} onChange={(e) => { setPlaytest(e.target.checked); setOn(e.target.checked); }} data-playtest-toggle />
      {t('play.pt.toggle')}
    </label>
  );
}

export function PlayModeSelect() {
  const { go } = useStore();
  // D-139: the opening cards, the first time Play mode opens (and on "What is this game?").
  const [opening, setOpening] = useState(() => !openingSeen());
  const choose = (n: LevelId) => {
    useStore.setState({ setupFor: { mode: 'EPISODE', level: n }, screen: 'playSetup' });
  };
  // UI V4 (V1): the opening card is a screen of its own, not a pop-up over this one.
  if (opening) return <PlayOpening onDone={() => setOpening(false)} />;
  return (
    <Page narrow>
      <BackLink onClick={() => go('howPlay')} />
      <p className="h-show text-lead">{t('play.show')}</p>
      <h1 className="h-show mb-1 text-title">{t('play.modes.title')}</h1>
      <p className="mb-4 text-small italic">{t('play.tagline')}</p>
      <div className="space-y-3">
        <button type="button" className="choice block p-4" data-life onClick={() => useStore.setState({ setupFor: { mode: 'LIFE' }, screen: 'playSetup' })}>
          <span className="h-show block text-title">{t('play.modes.life')}</span>
          <span className="mt-1 block text-small text-soft">{t('play.modes.lifeDesc')}</span>
        </button>
        <button
          type="button"
          className="choice block p-4"
          data-daily
          onClick={() => useStore.getState().start({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: dailySeed() })}
        >
          <span className="h-show block text-title">{t('play.daily.title')}</span>
          <span className="mt-1 block text-small text-soft">{t('play.daily.desc', { day: istanbulDay() })}</span>
        </button>
        <section className="form-card p-3" aria-labelledby="one-ep">
          <h2 id="one-ep" className="h-show text-lead">
            {t('play.modes.episode')}
          </h2>
          <p className="mb-2 text-small text-soft">{t('play.modes.episodeDesc', { bank: PLAY.EPISODE_STARTING_BANK })}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {([1, 2, 3, 4, 5] as LevelId[]).map((n) => {
              const ready = PLAYABLE_EPISODES.includes(n);
              return (
                <li key={n}>
                  <button type="button" className="choice block h-full" disabled={!ready} aria-disabled={!ready} onClick={() => ready && choose(n)}>
                    <span className="label block">{t('play.modes.ep', { n })}</span>
                    <span className="block font-semibold">{t(`play.episodes.${n}.name`)}</span>
                    <span className="block text-small text-soft">{ready ? t(`play.episodes.${n}.pitch`) : t('play.modes.soon')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <p className="mt-4 text-small text-soft">{t('play.disclaimer')}</p>
      <PlaytestToggle />
      <button type="button" className="mt-2 text-small font-semibold underline" onClick={() => setOpening(true)}>
        {t('play.opening.menu')}
      </button>
    </Page>
  );
}

export function PlaySetup() {
  const { go, start, setupFor, settings } = useStore();
  const [n, setN] = useState<2 | 3 | 4>(PLAY.DEFAULT_SEATS);
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.difficulty);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [avatar, setAvatar] = useState<HumanAvatar>(myAvatar());
  if (!setupFor) return null;
  return (
    <Page narrow>
      <BackLink onClick={() => go('playMode')} />
      <section className="form-card p-4">
        <p className="label">{setupFor.mode === 'LIFE' ? t('play.modes.life') : `${t('play.modes.ep', { n: setupFor.level ?? 3 })} · ${t(`play.episodes.${setupFor.level ?? 3}.name`)}`}</p>
        <h1 className="h-show text-title">{t('play.setup.title')}</h1>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start({ ...(setupFor.mode === 'LIFE' ? { mode: 'LIFE' as const } : { mode: 'EPISODE' as const, level: setupFor.level ?? 3 }), ruleset: 'PLAY', nPlayers: n, difficulty, seed, humanName: name.trim() || undefined });
          }}
        >
          <fieldset>
            <legend className="label mb-1">{t('play.setup.players')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('play.setup.players')}>
              {([2, 3, 4] as const).map((k) => (
                <button key={k} type="button" aria-pressed={n === k} className="choice flex-col justify-center" onClick={() => setN(k)} data-seats={k}>
                  <span className="num text-lead">{k}</span>
                  {/* D-149 */}
                  {k === 4 && <span className="text-small font-semibold">{t('play.setup.best')}</span>}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label mb-1">{t('play.setup.difficulty')}</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('play.setup.difficulty')}>
              {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                <button key={d} type="button" aria-pressed={difficulty === d} className="choice justify-center text-small" onClick={() => setDifficulty(d)} data-difficulty={d}>
                  {t(`setup.${d}`)}
                </button>
              ))}
            </div>
            {/* D-145: one line per level, shown for the level picked. */}
            <p className="mt-1 text-small text-soft" aria-live="polite" data-difficulty-line>
              {t(`play.setup.levels.${difficulty}`)}
            </p>
          </fieldset>
          <fieldset>
            <legend className="label mb-1">{t('play.setup.avatar')}</legend>
            <div className="grid grid-cols-6 gap-1" role="group" aria-label={t('play.setup.avatar')}>
              {HUMAN_AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={avatar === a}
                  aria-label={t(`play.setup.avatars.${a}`)}
                  className={`grid min-h-[52px] place-items-center rounded-xl border-2 ${avatar === a ? 'border-spot bg-card' : 'border-transparent bg-card/60'}`}
                  onClick={() => {
                    setAvatar(a);
                    setMyAvatar(a);
                  }}
                  data-avatar={a}
                >
                  <ShapePerson kind={a} expr={avatar === a ? 'pleased' : 'neutral'} size={44} />
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
            <input className="num mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3" value={seed} maxLength={64} onChange={(e) => setSeed(e.target.value)} aria-describedby="seed-hint" />
            <span id="seed-hint" className="mt-1 block text-small text-soft">
              {t('play.setup.seedHint')}
            </span>
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
