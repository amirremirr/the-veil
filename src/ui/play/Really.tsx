// "What was really going on?": three lines on the mechanism (Play spec 7.5). UI V4 (V1): it opens in place,
// in the screen's own content area, instead of a sheet on top.
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import en from '../copy/en.json';
import { useOnline } from '../components/Online';
import { useStagePanel } from './OnAir';

/** How many "What was really going on?" lines an episode has. */
const reallyCount = (level: number) => ((en as unknown as { play: { really: Record<string, string[]> } }).play.really[`L${level}`] ?? []).length;

function ReallyBody({ v }: { v: ViewState }) {
  const online = useOnline();
  const chooseMode = useStore((s) => s.chooseMode);
  return (
    <>
      <ul className="space-y-2 text-body" data-really>
        {Array.from({ length: reallyCount(v.levelIndex) }, (_, i) => i).map((i) => (
          <li key={i}>{t(`play.really.L${v.levelIndex}.${i}`)}</li>
        ))}
      </ul>
      {!online && (
        <button type="button" className="min-h-[44px] font-semibold underline" onClick={() => chooseMode('SINGLE_LEVEL', v.levelIndex)}>
          {t('play.really.link')}
        </button>
      )}
    </>
  );
}

/** The link that opens "What was really going on?" in place. */
export function ReallyButton({ v, className = '' }: { v: ViewState; className?: string }) {
  const open = useStagePanel();
  if (!open) return null;
  return (
    <button
      type="button"
      className={`min-h-[44px] text-small font-semibold underline ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        open({ title: t('play.really.button'), body: <ReallyBody v={v} /> });
      }}
      data-really-button
    >
      {t('play.really.button')}
    </button>
  );
}
