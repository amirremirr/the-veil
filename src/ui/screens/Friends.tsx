// "Play with friends": create a room or join one with a code, then wait in the lobby.
import { useEffect, useState } from 'react';
import type { Difficulty, LevelId, Mode } from '../../engine/types';
import { CODE_RE, cleanName } from '../../../server/src/protocol';
import { useStore } from '../store';
import { createRoom, joinRoom, leaveRoom, startRoomGame, useRoom } from '../room';
import { t } from '../i18n';
import { Avatar, FormCard, Page } from '../components/common';
import { BackLink } from './Menus';

const NAME_KEY = 'the-veil:room-name';
export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function rememberName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // Storage unavailable; the name is only a convenience.
  }
}

const inputClass = 'mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-3';

export function Friends() {
  const { go, friendsFor, settings } = useStore();
  const [tab, setTab] = useState<'create' | 'join'>(friendsFor?.tab ?? 'create');
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(friendsFor?.code ?? '');
  const [mode, setMode] = useState<Mode>('FULL_RUN');
  const [level, setLevel] = useState<LevelId>(1);
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.difficulty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    const n = cleanName(name);
    if (!n) return setError(t('room.errors.badName'));
    let c = code.trim().toUpperCase();
    if (tab === 'join' && !CODE_RE.test(c)) return setError(t('room.errors.badCode'));
    setError(null);
    setBusy(true);
    try {
      if (tab === 'create') c = await createRoom({ mode, level: mode === 'SINGLE_LEVEL' ? level : undefined, difficulty });
      rememberName(n);
      joinRoom(c, n);
      go('lobby');
    } catch {
      setError(t('room.errors.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <BackLink onClick={() => go('title')} />
      <h1 className="h-display mb-2 text-3xl">{t('room.title')}</h1>
      <p className="mb-4 text-sm text-soft">{t('room.intro')}</p>
      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label={t('room.title')}>
        {(['create', 'join'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} className="choice justify-center" onClick={() => setTab(k)}>
            {t(k === 'create' ? 'room.createTab' : 'room.joinTab')}
          </button>
        ))}
      </div>
      <FormCard form={t(tab === 'create' ? 'room.createTab' : 'room.joinTab')}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void enter();
          }}
        >
          {tab === 'join' && (
            <label className="block">
              <span className="label">{t('room.code')}</span>
              <input
                className={`num ${inputClass} text-2xl uppercase tracking-[0.3em]`}
                value={code}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
              />
              <span className="mt-1 block text-xs text-soft">{t('room.codeHint')}</span>
            </label>
          )}
          <label className="block">
            <span className="label">{t('room.name')}</span>
            <input className={inputClass} value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
            <span className="mt-1 block text-xs text-soft">{t('room.nameHint')}</span>
          </label>
          {tab === 'create' && (
            <>
              <fieldset>
                <legend className="label mb-1">{t('room.whatToPlay')}</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('room.whatToPlay')}>
                  {(['FULL_RUN', 'SINGLE_LEVEL'] as Mode[]).map((m) => (
                    <button key={m} type="button" aria-pressed={mode === m} className="choice block" onClick={() => setMode(m)}>
                      <span className="block font-semibold">{t(m === 'FULL_RUN' ? 'room.fullGame' : 'room.oneLevel')}</span>
                      <span className="block text-xs text-soft">{t(m === 'FULL_RUN' ? 'room.fullGameDesc' : 'room.oneLevelDesc')}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {mode === 'SINGLE_LEVEL' && (
                <fieldset>
                  <legend className="label mb-1">{t('room.whichLevel')}</legend>
                  <div className="grid gap-2" role="group" aria-label={t('room.whichLevel')}>
                    {([1, 2, 3, 4, 5] as LevelId[]).map((n) => (
                      <button key={n} type="button" aria-pressed={level === n} className="choice block" onClick={() => setLevel(n)}>
                        <span className="label block">{t('mode.level', { n })}</span>
                        <span className="block font-semibold">{t(`levels.${n}.name`)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
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
            </>
          )}
          {error && (
            <p className="text-sm font-semibold text-stamp" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t('room.working') : t(tab === 'create' ? 'room.create' : 'room.join')}
            </button>
          </div>
        </form>
      </FormCard>
    </Page>
  );
}

export function Lobby() {
  const { go, goOnline } = useStore();
  const r = useRoom();
  const [copied, setCopied] = useState<null | 'ok' | 'fail'>(null);
  useEffect(() => {
    if (r.started && r.view) goOnline();
  }, [r.started, r.view, goOnline]);
  const leave = () => {
    leaveRoom();
    go('title');
  };
  if (r.fatal) {
    return (
      <Page narrow>
        <FormCard form={t('room.title')}>
          <p className="font-semibold" role="alert">
            {t(`room.errors.${r.fatal}`)}
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={leave}>
              {t('app.back')}
            </button>
          </div>
        </FormCard>
      </Page>
    );
  }
  const link = r.code ? `${window.location.origin}${window.location.pathname}?room=${r.code}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  const isHost = !!r.yourSeat && r.host === r.yourSeat;
  const hostName = r.seats.find((s) => s.seat === r.host)?.name ?? '';
  const s = r.settings;
  const settingsLine = s
    ? s.mode === 'FULL_RUN'
      ? t('room.settingsFull', { difficulty: t(`setup.${s.difficulty}`) })
      : t('room.settingsLevel', { n: s.level ?? 1, name: t(`levels.${s.level ?? 1}.name`), difficulty: t(`setup.${s.difficulty}`) })
    : '';
  const empty = Math.max(0, (s?.nPlayers ?? 4) - r.seats.length);
  return (
    <Page narrow>
      <BackLink onClick={leave} />
      <h1 className="h-display mb-4 text-3xl">{t('room.lobbyTitle')}</h1>
      <FormCard form={t('room.codeBig')} right={settingsLine}>
        <p className="num text-center text-6xl font-bold tracking-[0.25em]" data-room-code aria-label={`${t('room.codeBig')} ${r.code ?? ''}`}>
          {r.code ?? '····'}
        </p>
        <p className="mt-2 text-center text-sm text-soft">{t('room.shareHint')}</p>
        <div className="mt-3 flex flex-col items-center gap-1">
          <button type="button" className="btn-ghost" onClick={() => void copy()} disabled={!r.code}>
            {t('room.copyLink')}
          </button>
          <span className="text-xs text-soft" aria-live="polite">
            {copied === 'ok' ? t('room.copied') : copied === 'fail' ? t('room.copyFailed') : ''}
          </span>
        </div>
      </FormCard>
      <div className="mt-4" />
      <FormCard form={t('room.players')}>
        {r.status !== 'open' && !r.seats.length ? (
          <p className="text-sm text-soft">{t('room.connecting')}</p>
        ) : (
          <ul className="space-y-2" data-seats>
            {r.seats.map((seat) => (
              <li key={seat.seat} className="flex items-center gap-3">
                <Avatar human size={28} />
                <span className="min-w-0 flex-1 truncate font-semibold">{seat.name}</span>
                <span className="font-mono text-[11px] uppercase text-soft">
                  {[seat.seat === r.yourSeat && t('room.youTag'), seat.seat === r.host && t('room.hostTag'), !seat.connected && t('room.offlineTag')]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
            {Array.from({ length: empty }, (_, i) => (
              <li key={`bot-${i}`} className="flex items-center gap-3 text-soft">
                <span aria-hidden className="h-7 w-7 rounded-lg border-2 border-dashed border-line" />
                <span className="flex-1">{t('room.computer')}</span>
              </li>
            ))}
          </ul>
        )}
      </FormCard>
      <div className="mt-4 flex flex-col items-end gap-2">
        {isHost ? (
          <>
            <p className="text-sm text-soft">{t('room.startHint')}</p>
            <button type="button" className="btn-primary" disabled={r.status !== 'open' || !s || r.pendingSince !== null} onClick={() => s && startRoomGame(s)}>
              {t('room.start')}
            </button>
          </>
        ) : (
          r.seats.length > 0 && (
            <p className="text-sm" aria-live="polite">
              {t('room.waitingHost', { name: hostName })}
            </p>
          )
        )}
        <button type="button" className="btn-ghost text-sm" onClick={leave}>
          {t('room.leave')}
        </button>
      </div>
    </Page>
  );
}
