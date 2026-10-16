import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import type { BotKey } from '../../engine/types';

export function useMotionOff(): boolean {
  const sys = useReducedMotion();
  const setting = useStore((s) => s.settings.reducedMotion);
  return !!sys || setting;
}

/** A rubber stamp that slams onto the page. */
export function Stamp({
  children,
  tone = 'stamp',
  rotate = -6,
  small = false,
  className = '',
}: {
  children: ReactNode;
  tone?: 'stamp' | 'good' | 'ink';
  rotate?: number;
  small?: boolean;
  className?: string;
}) {
  const off = useMotionOff();
  const color = tone === 'good' ? 'text-good border-good' : tone === 'ink' ? 'text-ink border-ink' : 'text-stamp border-stamp';
  return (
    <motion.div
      initial={off ? false : { scale: small ? 1.6 : 2.2, opacity: 0, rotate: rotate - 8 }}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
      className={`inline-block max-w-full select-none rounded font-mono font-semibold uppercase ${
        small ? 'border-2 px-1.5 py-0 text-[10px] tracking-[0.1em]' : 'border-[3px] px-3 py-1 text-sm tracking-[0.15em]'
      } ${color} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** A card that flips from its back to its face. */
export function FlipCard({ front, back, flipped, className = '' }: { front: ReactNode; back: ReactNode; flipped: boolean; className?: string }) {
  const off = useMotionOff();
  return (
    <div className={`relative [perspective:800px] ${className}`}>
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={off ? { duration: 0 } : { duration: 0.6, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{back}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{front}</div>
      </motion.div>
    </div>
  );
}

/** A number that ticks up to its value. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const off = useMotionOff();
  const [shown, setShown] = useState(off ? value : 0);
  useEffect(() => {
    if (off) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const dur = 650;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / dur));
      setShown(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, off]);
  return <span className="num">{shown.toFixed(decimals)}</span>;
}

export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-md border border-line">
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-start font-semibold"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span aria-hidden className="font-mono text-soft">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-line px-3 py-3 text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

export function FormCard({ form, title, children, right }: { form?: string; title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="form-card min-w-0">
      {(form || right) && (
        <div className="form-head">
          <span>{form}</span>
          <span>{right}</span>
        </div>
      )}
      <div className="p-4">
        {title && <h2 className="h-display mb-3 text-xl">{title}</h2>}
        {children}
      </div>
    </section>
  );
}

/** Geometric avatars. Each citizen has a distinct simple shape. */
export function Avatar({ bot, size = 40, human = false }: { bot?: BotKey; size?: number; human?: boolean }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 40 40', 'aria-hidden': true } as const;
  if (human || !bot)
    return (
      <svg {...common}>
        <rect width="40" height="40" rx="8" className="fill-ink" />
        <circle cx="20" cy="16" r="7" className="fill-paper" />
        <path d="M8 34c2-7 7-10 12-10s10 3 12 10" className="fill-paper" />
      </svg>
    );
  if (bot === 'chet')
    return (
      <svg {...common}>
        <rect width="40" height="40" rx="8" className="fill-amber/25" />
        <path d="M20 6 34 32H6z" className="fill-amber" />
        <path d="M14 22h12" className="stroke-paper" strokeWidth="3" />
      </svg>
    );
  if (bot === 'marigold')
    return (
      <svg {...common}>
        <rect width="40" height="40" rx="8" className="fill-good/20" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <circle key={a} cx={20 + 9 * Math.cos((a * Math.PI) / 180)} cy={20 + 9 * Math.sin((a * Math.PI) / 180)} r="6" className="fill-good/70" />
        ))}
        <circle cx="20" cy="20" r="5" className="fill-amber" />
      </svg>
    );
  if (bot === 'ugo')
    return (
      <svg {...common}>
        <rect width="40" height="40" rx="8" className="fill-teal/20" />
        <rect x="8" y="8" width="24" height="24" className="fill-teal" />
        <circle cx="15" cy="19" r="4" className="fill-none stroke-paper" strokeWidth="2" />
        <circle cx="25" cy="19" r="4" className="fill-none stroke-paper" strokeWidth="2" />
        <path d="M19 19h2" className="stroke-paper" strokeWidth="2" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect width="40" height="40" rx="8" className="fill-soft/20" />
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={11 + c * 9} cy={11 + r * 9} r="3" className="fill-soft" />))}
    </svg>
  );
}

export function Shape({ group, size = 14 }: { group: 'CIRCLE' | 'SQUARE'; size?: number }) {
  return group === 'CIRCLE' ? (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label="Circle" role="img">
      <circle cx="7" cy="7" r="6" className="fill-teal" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label="Square" role="img">
      <rect x="1" y="1" width="12" height="12" className="fill-amber" />
    </svg>
  );
}

export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <main className={`mx-auto w-full px-4 py-6 ${narrow ? 'max-w-2xl' : 'max-w-page'}`}>{children}</main>;
}
