# UI V4: simpler, clearer, calmer

**Owner:** Amirreza Akhavan. **Branch:** `ui-v4` (from `main` at f4b84cc). **Scope:** Play mode only; Study keeps its look.

## Why (the owner's playtest, 17 Nov 2026)
1. Too many pop-ups. Instructions and messages should live inside the screen, not on top of it.
2. The game feels complex.
3. Players see points, money and rank but can't tell where they came from or what each decision changed.
4. Screens that move on by themselves go too fast to read.
5. Sound fits, but a win and a loss should sound clearly different.
6. The characters feel artificial ("AI-made"), and the colours and fonts are hard to look at.

## Rules for the builder
Read this file, `docs/UI_V3_SPEC.md`, `docs/UI_V3_REPORT.md` and `docs/RUNPLAN.md` Sections A and B first. Section A applies (Study frozen with the golden test at every commit, never deploy, never merge, never ask: record choices as [UI-V4, review] in DECISIONS.md and continue), on branch `ui-v4`. **V1 to V4 must not change any file under `src/engine` or `src/shared/flow.ts`**; check the rules hash stays `b1b485fa65cf3b29` after each phase. Every screen fits 375x760 with no scroll; tap targets at least 44 px; axe 0 violations; no em dashes; strings under `play.*`. After each phase: quality gate, commit, push `ui-v4`, a row in `docs/UI_V4_PROGRESS.md`.

## V1. No pop-ups
- Remove every overlay from Play except the menu: coach marks, the "Call it on X for 10?" confirm, toasts, sheets. "See the money" and "Details" expand in place, inside the screen.
- Coach marks become one hint line in the screen itself, under the thing it explains, shown the first time only.
- Calling: tapping a bubble flips it to a two-button state inside the bubble ("Call it, 10" / "Cancel").
- Dash's lines sit in a fixed slot of the screen (one line, never covering content).

## V2. Simpler game (presentation and pacing only, no rule change)
- **Unlock one verb at a time in a life.** Episode 1 shows only vote and peek; claims appear from Episode 2; Call it from Episode 3; Give from Episode 4. In a single episode, everything is on as now. Where a verb is hidden, bots still play it and its effect still appears in results with one plain line ("Chet gave Dot 5"). Record in DECISIONS that hiding a human option in a life changes what the human can do; if this changes any E check measured for bots, it doesn't apply (bots unchanged), and say so.
- **One decision per screen.** If a screen asks for more than one choice (move plus give, for example), split it, or make the secondary choice a small row that is clearly optional and collapsed by default.
- **Plain words.** Each decision screen has one question as its headline ("Buy cover this round?") and at most 2 lines of help. Hard limit 45 words on decision screens.
- **A "How this episode works" card** at the start of each episode: 3 short lines and one picture, the only rules text in the episode. Reachable again from the menu.

## V3. Show cause and effect
- **Before deciding:** every option tile states its consequence in plain coins, not formulas: "Cover: pay 61 now. A hit then costs you 0." / "No cover: keep 61. A hit costs you 220." Mission effect as a word, not a number: "Helps your mission" / "Hurts your mission" / "No effect".
- **After each round: "What your choices did."** A short list, one row per decision you made, each with its effect: "Bought cover: -61. The wheel missed you, so it didn't pay off this time." / "Said 'low risk' (a lie): nobody called it, so you stayed in the pool." Then one row for luck ("Luck: the wheel missed you") and one for everyone else ("Others: Dot's tax vote cost you 12"). The rows add up to the bank change shown; the money ledger stays behind "See the money".
- **Score.** When the score changes, show it as two labelled pieces flying into the score bar ("+30 bank", "+8 mission"), never as a sentence of arithmetic. The summary says in one line what helped and hurt most this episode.
- **Rank.** Show who is ahead and by how much as a simple bar race, updated at each episode's end.

## V4. Pacing and sound
- **Auto-advance only for screens of 8 words or fewer.** Every other screen waits for a tap. Where a screen does auto-advance, a thin progress line shows it, and a tap or touch holds it.
- **Reveals:** never shorter than 1.5 s per item; total at most 6 s; tap to skip.
- **Win and loss sound clearly different:** a short rising major jingle for a gain, scaled in length by size (small, medium, big); a descending "wah-wah" for a loss, also scaled; a neutral tick for no change. Being caught and catching someone get their own sounds. Keep mute remembered.

## V5. Three style directions, for the owner to choose (no change to the game itself)
The characters, colours and fonts feel artificial. Don't redesign the game yet. Build a preview page at `?styles=1` showing **the same two screens** (the Episode 3 move screen and the Episode 3 reveal, with the full cast and Dash) in three directions, side by side, each with a name and a 2-line description:
- **A. Paper puppets.** Warm cream paper background, characters as hand-cut paper shapes with slightly uneven edges and a soft drop shadow, ink outlines (use rough.js, under 10 KB gzipped, or hand-drawn SVG paths with jitter), muted warm palette (tomato, mustard, teal, ink). Fonts: a friendly serif for headlines (Fraunces) and Atkinson Hyperlegible for text.
- **B. Retro TV studio.** 1970s game show: deep teal and orange, rounded chunky type (Fredoka for headlines, Nunito for text), characters as simple flat puppets with big expressive eyes, a studio-light glow, a subtle film grain.
- **C. Clean editorial.** Light background, black text, one bright accent, characters as minimal line drawings with personality in posture rather than detail (the style of explainer games like The Evolution of Trust), Inter or Atkinson Hyperlegible throughout.
- Characters in all three stay abstract shapes (no ethnicity or gender cues) with clear expressions. All three meet AA contrast.
- Capture each direction at 375x760 into `docs/review/styles/`. **Do not apply any direction to the game**; stop after V5 and report.

## Report
`docs/UI_V4_REPORT.md`: what changed per phase; before and after screenshots for 6 key screens; words per decision screen before and after; how many overlays before (count) and after (0); the three style captures; anything left; "Human validation: NOT DONE"; the commit and preview link. Reply with its text.
