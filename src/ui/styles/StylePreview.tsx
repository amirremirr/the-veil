// UI V4 (V5): three style directions for the owner to choose from, at ?styles=1. The same two screens (the
// Episode 3 move and the Episode 3 reveal, with the full cast and Dash) in each direction, side by side, each
// with a name and two lines. A preview only: nothing here is applied to the game, and the game never loads it.
// ?styles=1&only=A&screen=move shows one frame alone at 375 x 760 (for the captures in docs/review/styles).
import '@fontsource/fraunces/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-800.css';
import type { CSSProperties, ReactNode } from 'react';
import { t } from '../i18n';
import { Puppet, type Expr, type Kind, type Palette, type Style } from './cast';

type Theme = {
  id: Style;
  palette: Palette;
  bg: string;
  bgImage?: string;
  text: string;
  soft: string;
  card: string;
  cardBorder: string;
  pick: string;
  pickText: string;
  button: string;
  buttonText: string;
  pill: string;
  pillText: string;
  bubble: string;
  bubbleText: string;
  callTag: string;
  callTagText: string;
  lie: string;
  truth: string;
  stampBg: string;
  head: string;
  body: string;
  headWeight: number;
  radius: number;
  shadow: string;
  grain?: boolean;
};

const THEMES: Theme[] = [
  {
    id: 'A',
    palette: {
      ink: '#2a2420',
      fills: { hex: '#e3a92f', ugo: '#3e8f84', marigold: '#d9583d', dot: '#9fb5c8', dash: '#efdcb4' },
      center: '#f6dfb2',
      accent: '#b23a24',
      cheek: '#e9967a',
      white: '#fffaf0',
    },
    bg: '#f4ecd8',
    bgImage: 'radial-gradient(rgb(120 90 50 / 0.06) 1px, transparent 1.2px), radial-gradient(rgb(120 90 50 / 0.05) 1px, transparent 1.4px)',
    text: '#2a2420',
    soft: '#5c5248',
    card: '#fbf6ea',
    cardBorder: '#2a2420',
    pick: '#e3a92f',
    pickText: '#2a2420',
    button: '#b23a24',
    buttonText: '#ffffff',
    pill: '#b23a24',
    pillText: '#ffffff',
    bubble: '#fffaf0',
    bubbleText: '#2a2420',
    callTag: '#2a2420',
    callTagText: '#fffaf0',
    lie: '#a3321e',
    truth: '#2b6e65',
    stampBg: '#fffaf0',
    head: "'Fraunces', Georgia, serif",
    body: "'Atkinson Hyperlegible', system-ui, sans-serif",
    headWeight: 700,
    radius: 6,
    shadow: '2px 3px 0 rgb(60 40 20 / 0.22)',
  },
  {
    id: 'B',
    palette: {
      ink: '#10242a',
      fills: { hex: '#ffc94a', ugo: '#f2862e', marigold: '#ff6f59', dot: '#8fd3c8', dash: '#fff4e0' },
      center: '#ffe2b8',
      accent: '#f2862e',
      cheek: '#ff8f8f',
      white: '#ffffff',
    },
    bg: '#0e3a44',
    bgImage: 'radial-gradient(ellipse 80% 45% at 50% 18%, rgb(255 201 74 / 0.22), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 100%, rgb(242 134 46 / 0.18), transparent 70%)',
    text: '#fff4e0',
    soft: '#cfe6e2',
    card: '#165563',
    cardBorder: '#2a7584',
    pick: '#ffc94a',
    pickText: '#10242a',
    button: '#f2862e',
    buttonText: '#10242a',
    pill: '#ff6f59',
    pillText: '#10242a',
    bubble: '#fff4e0',
    bubbleText: '#10242a',
    callTag: '#10242a',
    callTagText: '#fff4e0',
    lie: '#c2341f',
    truth: '#13675a',
    stampBg: '#fff4e0',
    head: "'Fredoka', 'Nunito', system-ui, sans-serif",
    body: "'Nunito', system-ui, sans-serif",
    headWeight: 600,
    radius: 22,
    shadow: '0 6px 0 rgb(0 0 0 / 0.3)',
    grain: true,
  },
  {
    id: 'C',
    palette: {
      ink: '#111111',
      fills: { hex: 'none', ugo: 'none', marigold: 'none', dot: 'none', dash: 'none' },
      center: '#ffffff',
      accent: '#2547d0',
      cheek: '#2547d0',
      white: '#ffffff',
    },
    bg: '#fbfaf6',
    text: '#111111',
    soft: '#555555',
    card: '#ffffff',
    cardBorder: '#d9d6cc',
    pick: '#2547d0',
    pickText: '#ffffff',
    button: '#111111',
    buttonText: '#ffffff',
    pill: '#2547d0',
    pillText: '#ffffff',
    bubble: '#ffffff',
    bubbleText: '#111111',
    callTag: '#2547d0',
    callTagText: '#ffffff',
    lie: '#b42318',
    truth: '#1e7a34',
    stampBg: '#ffffff',
    head: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    headWeight: 800,
    radius: 10,
    shadow: 'none',
  },
];

const CAST: Array<{ id: Kind; name: string; bank: number }> = [
  { id: 'hex', name: 'You', bank: 118 },
  { id: 'ugo', name: 'Ugo', bank: 224 },
  { id: 'marigold', name: 'Marigold', bank: 66 },
  { id: 'dot', name: 'Dot', bank: 209 },
];

type Cue = { bubbles?: Partial<Record<Kind, string>>; callable?: Kind[]; expr?: Partial<Record<Kind, Expr>>; stamps?: Partial<Record<Kind, { text: string; lie: boolean }>> };

function Grain() {
  return (
    <svg aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.09, mixBlendMode: 'overlay' }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

/** The stage: bubbles, the four contestants at their podiums, stamps. */
function CastRow({ th, cue }: { th: Theme; cue: Cue }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, minHeight: cue.bubbles ? 58 : 0 }}>
        {CAST.map((c) => {
          const text = cue.bubbles?.[c.id];
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-end' }}>
              {text && (
                <p style={{ width: '100%', margin: 0, background: th.bubble, color: th.bubbleText, borderRadius: th.radius + 4, padding: '4px 6px', fontSize: 13, lineHeight: 1.2, textAlign: 'center', fontWeight: 700, border: th.id === 'C' ? `1.5px solid ${th.text}` : th.id === 'A' ? `1.5px solid ${th.text}` : 'none', boxShadow: th.id === 'A' ? th.shadow : 'none' }}>
                  {text}
                  {cue.callable?.includes(c.id) && (
                    <span style={{ display: 'inline-block', marginTop: 2, borderRadius: 999, padding: '0 6px', background: th.callTag, color: th.callTagText, fontSize: 12 }}>{t('play.cast.tapToCall')}</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
        {CAST.map((c) => {
          const st = cue.stamps?.[c.id];
          return (
            <li key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Puppet kind={c.id} expr={cue.expr?.[c.id] ?? 'neutral'} size={64} style={th.id} p={th.palette} label={`${c.name}`} />
                {st && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '4%',
                      transform: 'translate(-50%, -50%) rotate(-6deg)',
                      border: `3px solid ${st.lie ? th.lie : th.truth}`,
                      color: st.lie ? th.lie : th.truth,
                      background: th.stampBg,
                      borderRadius: th.id === 'B' ? 10 : 4,
                      padding: '1px 5px',
                      fontFamily: th.head,
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: 0.5,
                      zIndex: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {st.text}
                  </span>
                )}
              </div>
              <div style={{ marginTop: -2, width: '100%', textAlign: 'center', background: th.card, color: th.text, border: `${th.id === 'C' ? 1 : 2}px solid ${c.id === 'hex' ? th.pick : th.cardBorder}`, borderRadius: th.radius, boxShadow: th.id === 'C' ? 'none' : th.shadow, padding: '2px 2px' }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{c.name}</span>
                <span style={{ display: 'block', fontFamily: th.head, fontWeight: th.headWeight, fontSize: 16, lineHeight: 1.2 }}>{c.bank}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One phone screen of a direction: top bar, stage, Dash's slot, the content, the button. */
function Frame({ th, cue, dash, dashMood, children, button }: { th: Theme; cue: Cue; dash: string; dashMood: Expr; children: ReactNode; button: string }) {
  const style: CSSProperties = {
    position: 'relative',
    width: 375,
    height: 760,
    overflow: 'hidden',
    background: th.bg,
    backgroundImage: th.bgImage,
    backgroundSize: th.id === 'A' ? '7px 7px, 13px 13px' : undefined,
    color: th.text,
    fontFamily: th.body,
    fontSize: 15,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px 16px',
    boxSizing: 'border-box',
    flexShrink: 0,
  };
  return (
    <div style={style} data-style-frame={th.id}>
      {th.grain && <Grain />}
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: th.pill, color: th.pillText, borderRadius: 999, padding: '1px 8px', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>{t('play.onAir')}</span>
        <span style={{ color: th.soft, fontSize: 14 }}>{t('play.bar.round', { r: 2, n: 4 })}</span>
        <span style={{ marginLeft: 'auto', textAlign: 'right', lineHeight: 1 }}>
          <span style={{ display: 'block', fontSize: 12, color: th.soft, letterSpacing: 1 }}>{t('play.bar.bank').toUpperCase()}</span>
          <span style={{ fontFamily: th.head, fontWeight: th.headWeight, fontSize: 24 }}>118</span>
        </span>
      </header>
      <div style={{ marginTop: 8 }}>
        <CastRow th={th} cue={cue} />
      </div>
      <figure style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 0', minHeight: 44 }}>
        <Puppet kind="dash" expr={dashMood} size={52} style={th.id} p={th.palette} />
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.3 }}>
          <b>Dash:</b> {dash}
        </p>
      </figure>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>{children}</main>
      <button type="button" style={{ minHeight: 52, width: '100%', border: 'none', borderRadius: th.id === 'C' ? 10 : 999, background: th.button, color: th.buttonText, fontFamily: th.head, fontWeight: th.headWeight, fontSize: 20, boxShadow: th.id === 'A' ? th.shadow : 'none' }}>
        {button}
      </button>
    </div>
  );
}

function H1({ th, children }: { th: Theme; children: ReactNode }) {
  return <h2 style={{ margin: 0, fontFamily: th.head, fontWeight: th.headWeight, fontSize: 28, lineHeight: 1.1, letterSpacing: th.id === 'C' ? -0.5 : 0 }}>{children}</h2>;
}

function Tile({ th, on, title, desc, note }: { th: Theme; on: boolean; title: string; desc: string; note?: string }) {
  return (
    <div style={{ minHeight: 120, borderRadius: th.radius + 6, padding: 10, background: on ? th.pick : th.card, color: on ? th.pickText : th.text, border: `${th.id === 'C' ? 1.5 : 2}px solid ${on ? th.pick : th.cardBorder}`, boxShadow: th.id === 'C' ? 'none' : th.shadow, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <span style={{ fontFamily: th.head, fontWeight: th.headWeight, fontSize: 20, lineHeight: 1.15 }}>{title}</span>
      <span style={{ marginTop: 4, fontSize: 14, lineHeight: 1.3 }}>{desc}</span>
      {note && <span style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>{note}</span>}
    </div>
  );
}

function MoveScreen({ th }: { th: Theme }) {
  return (
    <Frame
      th={th}
      cue={{ bubbles: { ugo: t('play.claims.RISK.LOW'), marigold: t('play.claims.RISK.LOW'), dot: t('play.claims.RISK.HIGH') }, callable: ['ugo', 'marigold', 'dot'], expr: { marigold: 'smug', hex: 'neutral', ugo: 'pleased', dot: 'neutral' } }}
      dash={t('play.styles.dashMove')}
      dashMood="smug"
      button={t('play.stage.lock')}
    >
      <H1 th={th}>{t('play.move.coverAsk')}</H1>
      <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 14 }}>{t('play.move.riskLine', { p: '40%' })}</p>
      <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile th={th} on title={t('play.stage.buyTitle')} desc={t('play.stage.buyDesc', { p: '61' })} note={t('play.move.helps')} />
        <Tile th={th} on={false} title={t('play.stage.noBuyTitle')} desc={t('play.stage.noBuyDesc', { p: '61', loss: '220' })} />
      </div>
      <div style={{ margin: '8px 0 10px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, borderRadius: th.radius + 6, padding: '0 12px', background: th.card, border: `${th.id === 'C' ? 1.5 : 2}px solid ${th.cardBorder}`, fontSize: 14, fontWeight: 700 }}>
        <span aria-hidden>+</span>
        {t('play.move.gymRow', { c: 6, p: '20%' })}
      </div>
    </Frame>
  );
}

function RevealScreen({ th }: { th: Theme }) {
  const rows: Array<{ id: Kind; name: string; card: 'HIGH' | 'LOW'; chips: Array<[string, boolean]> }> = [
    { id: 'marigold', name: 'Marigold', card: 'HIGH', chips: [[t('play.styles.chip', { r: 1, s: t('play.cards.LIE') }), true], [t('play.styles.chip', { r: 2, s: t('play.cards.LIE') }), true]] },
    { id: 'dot', name: 'Dot', card: 'HIGH', chips: [[t('play.styles.chip', { r: 2, s: t('play.cards.LIE') }), true]] },
    { id: 'ugo', name: 'Ugo', card: 'LOW', chips: [[t('play.styles.chip', { r: 2, s: t('play.cards.TRUE') }), false]] },
    { id: 'hex', name: 'You', card: 'HIGH', chips: [[t('play.styles.chip', { r: 1, s: t('play.cards.TRUE') }), false]] },
  ];
  return (
    <Frame
      th={th}
      cue={{
        expr: { marigold: 'smug', dot: 'caught', ugo: 'pleased', hex: 'shocked' },
        stamps: { marigold: { text: t('play.cards.LIE'), lie: true }, dot: { text: t('play.call.stampCaught'), lie: true }, ugo: { text: t('play.cards.TRUE'), lie: false }, hex: { text: t('play.cards.TRUE'), lie: false } },
      }}
      dash={t('play.styles.dashReveal')}
      dashMood="pleased"
      button={t('play.stage.tap')}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: th.soft }}>{t('play.cards.label').toUpperCase()}</p>
      <H1 th={th}>{t('play.styles.revealHead')}</H1>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: th.card, border: `${th.id === 'C' ? 1 : 2}px solid ${th.cardBorder}`, borderRadius: th.radius + 4, padding: '4px 8px', boxShadow: th.id === 'C' ? 'none' : th.shadow }}>
            <Puppet kind={r.id} expr={r.chips[0][1] ? 'smug' : 'pleased'} size={28} style={th.id} p={th.palette} />
            <span style={{ width: 72, fontWeight: 700, fontSize: 14 }}>{r.name}</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
              {r.chips.map(([x, lie]) => (
                <span key={x} style={{ borderRadius: 4, padding: '0 5px', fontSize: 13, fontWeight: 700, background: lie ? th.lie : 'transparent', color: lie ? '#ffffff' : th.text, border: lie ? 'none' : `1px solid ${th.cardBorder}` }}>
                  {x}
                </span>
              ))}
            </span>
            <span style={{ fontFamily: th.head, fontWeight: th.headWeight, fontSize: 14, borderRadius: 4, padding: '0 6px', background: r.card === 'HIGH' ? th.lie : th.truth, color: '#ffffff' }}>{t(`play.cards.${r.card}`)}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** On a phone narrower than a frame, the overview shrinks each frame to fit (no sideways scroll). */
function Fit({ children }: { children: ReactNode }) {
  const k = typeof window === 'undefined' ? 1 : Math.min(1, (window.innerWidth - 32) / 375);
  if (k >= 1) return <>{children}</>;
  return (
    <div style={{ width: 375 * k, height: 760 * k, overflow: 'hidden' }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

function Direction({ th, only }: { th: Theme; only?: 'move' | 'reveal' }) {
  if (only) return only === 'move' ? <MoveScreen th={th} /> : <RevealScreen th={th} />;
  return (
    <section aria-labelledby={`style-${th.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ maxWidth: 375, minWidth: 0 }}>
        <h2 id={`style-${th.id}`} style={{ margin: 0, fontFamily: th.head, fontWeight: th.headWeight, fontSize: 24 }}>
          {t(`play.styles.${th.id}.name`)}
        </h2>
        <p style={{ margin: '4px 0 0', fontFamily: th.body, fontSize: 15, lineHeight: 1.4 }}>{t(`play.styles.${th.id}.desc`)}</p>
      </div>
      <Fit>
        <MoveScreen th={th} />
      </Fit>
      <Fit>
        <RevealScreen th={th} />
      </Fit>
    </section>
  );
}

export function StylePreview() {
  let only: Style | null = null;
  let screen: 'move' | 'reveal' = 'move';
  try {
    const q = new URL(window.location.href).searchParams;
    const o = q.get('only');
    if (o === 'A' || o === 'B' || o === 'C') only = o;
    if (q.get('screen') === 'reveal') screen = 'reveal';
  } catch {
    // A plain preview of all three.
  }
  if (only) {
    const th = THEMES.find((x) => x.id === only)!;
    return (
      <main aria-label={t(`play.styles.${only}.name`)} style={{ margin: 0, width: 375, height: 760, overflow: 'hidden' }}>
        <h1 className="sr-only">{t(`play.styles.${only}.name`)}</h1>
        <Direction th={th} only={screen} />
      </main>
    );
  }
  return (
    <main style={{ minHeight: '100vh', background: '#e9e7e1', color: '#111111', padding: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{t('play.styles.title')}</h1>
      <p style={{ margin: '4px 0 16px', maxWidth: 720, fontSize: 15, lineHeight: 1.4 }}>{t('play.styles.intro')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {THEMES.map((th) => (
          <Direction key={th.id} th={th} />
        ))}
      </div>
    </main>
  );
}
