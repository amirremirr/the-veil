# UI V3: make it look and feel like a game show

**Owner:** Amirreza Akhavan. **Branch:** `ui-v3` (from `main` at 8e0a045). **Scope:** Play mode only. Study mode keeps its look.

## Why
A review of all 77 screens of a full life (16 Nov 2026) found: no faces in a game about reading people (24 px icons, the host is a text box); one graphic in the whole game (the wheel); no sound; almost no motion; a win and a loss look the same; about half of all taps are "Tap to continue" and it takes about 9 taps to reach the first decision; formulas set as headlines (the HireBot result, the score paragraph); half-empty screens; decimals like 78.7; and runaway scores (433 coins against 42 after Episode 2).

## Rules for the builder
1. Read this file, `docs/RUNPLAN.md` Sections A and B, `docs/review/ux-audit.md` and `docs/playtest/fresh-eyes.md` first. Section A applies (Study frozen, golden test at every commit, never deploy, never merge, never ask: record choices as [UI-V3, review] in DECISIONS.md and continue), except the branch is `ui-v3`.
2. **Phases U1 to U4 are presentation only.** They must not change any file under `src/engine` or `src/shared/flow.ts`. Check after every phase that the rules hash is still `3bf67478ab66d810`. Only U5 touches the engine.
3. No downloaded assets. Characters are inline SVG drawn in code; sounds are synthesized with the Web Audio API. No new dependency over 15 KB gzipped; total JS growth at most 60 KB gzipped.
4. Every screen fits 375x760 with no scroll; tap targets at least 44 px; contrast AA; axe 0 violations; reduced motion gives a static equivalent of every animation.
5. Strings under `play.*`, no em dashes. Satire never targets disability, illness, caregivers, gender or real groups.
6. After each phase: quality gate (typecheck, build, unit, e2e, walkthroughs), commit, push `ui-v3`, one row in `docs/UI_V3_PROGRESS.md`.

## U1. The stage and the cast (the core change)
- **Characters.** Each contestant is a "shape person": an abstract character built from its existing motif (Marigold the flower, Chet the triangle, Dot the dot grid, Ugo, and so on), with eyes, a mouth and a body, about 72 px on stage. No human features that suggest ethnicity or gender. Six expressions each: neutral, pleased, smug, shocked, sad, caught. The human picks one of 6 avatars at setup (same style) and has the same expressions.
- **Dash Fortuna** is a character too (a microphone-headed host), shown about 56 px beside his lines, with 4 expressions.
- **The stage.** The middle of every Play screen is a stage: the contestants stand at podiums in a row, each podium showing name and bank. This replaces the small avatar row and fills the empty middle.
- **Claims are speech bubbles** above each character on the stage. The "claims are in" screen is removed: the bubbles appear on the move screen, one at a time, 300 ms apart. "Call it" becomes a tap on a bubble (then "Call it for 10?" confirm), replacing the chip row.
- **Reactions.** Expressions change with events: shocked on a wheel hit, smug after a lie that worked, caught on a CAUGHT stamp, sad in debt, pleased on a gain.
- **Stamps** (TRUE, LIE, CAUGHT, CALLED WRONG, GOOD HIRE, BAD HIRE, kept, broke promise) land on the character with a thump, rotated a few degrees, not as inline text.
- **Design tokens** in one file: colors, type scale (at most 5 sizes), spacing, radii, shadows, durations. Remove one-off styles.

## U2. Sound, motion and feedback
- **Sound** (Web Audio, synthesized, one small module): tap, lock-in, bubble pop, wheel ticks that slow down, SAFE chime, HIT thud, coin gain, coin loss, stamp thump, price-jump sting, episode fanfare, life-end fanfare. Starts after the first tap. A mute button in the top bar, remembered (try/catch). Volume moderate; no looping music.
- **Haptics:** `navigator.vibrate` on stamps and wheel hits where supported; off with reduced motion.
- **Motion:** coins fly between a podium and the bank; the bank counts up or down; the wheel spins with easing for 2 to 3 seconds; ballots flip; price digits roll. Every reveal at most 4 seconds, tap to skip.
- **Win and loss must look different.** A hit: the stage flashes pink, the character is shocked, the bank drops in red. A gain: yellow glow, pleased, the bank rises. Debt: the podium cracks or dims and shows "In debt".
- **Peaks.** Each episode's reveal is staged one contestant at a time with the stamp landing (Episodes 1 and 4 are lists of small text now; restage them like Episode 3). The Receipts become staged moments with the characters, not a list.

## U3. Fewer taps, clearer words
- **Auto-advance** beats that only inform (an animation plus one line), after the animation and a 1.2 second hold, with tap to skip. Keep a tap only where the player must read to decide.
- **Merge:** the event card into the round's first screen as a banner; "your card" into the intro; the two summary screens into one.
- **Onboarding:** replace the three opening cards with one card and a "Skip" link, then teach in play: coach marks on the first claim, first move and first call (once, dismissible, remembered). First decision within 4 taps of choosing Play.
- **Targets:** taps in a full life down at least 30% from the current walkthrough; the measured life stays under 12 minutes at pace.
- **Numbers:** show whole coins everywhere (round for display; the ledger keeps exact values and still adds up, with a "rounded" note when needed).
- **No formulas in headlines.** The HireBot result headline is "You earned 0 as HireBot" with a three-row breakdown (base, good hires, bad hires). The score paragraph becomes a two-part bar (bank half, mission half) with debt as a red notch; the words move behind "See the money".
- **The HireBot judge screen:** one worker card at a time, swipe or tap "Complex" or "Simple", the meter as a bar on the card with the 60% line, the claim as the worker's speech bubble.
- **Episode 5:** amendments as cards with a yes/no tally that fills as ballots land; no 10 px text. Minimum body text 14 px everywhere.
- **Desktop:** the phone layout centered at most 480 px wide on a dark studio backdrop.

## U4. Review loop (proxy, not human evidence)
- Capture a full life with motion on (include mid-animation frames of each reveal) and Episode 3 on Hard.
- Two fresh subagents that have not seen the code or this spec: a mobile game UI designer and a casual first-time player. Give them the before screenshots (`docs/playtest/shots/life-careful`) and the after screenshots. Ask for a verdict on each of the nine problems in "Why", the top 5 remaining problems, and a 5-second test (from the first screen alone: what is this?).
- Fix the top problems, re-gate, repeat. Stop after two cycles in a row with nothing high-impact, or 6 cycles.
- Save to `docs/review/ui-v3-review.md` with before and after images side by side for 8 key screens.

## U5. Runaway scores (engine, Play only; changes the rules hash)
- Measure on 1,000 lives: the ratio of the top bank to the bottom bank after each episode, and how often the final rank order equals the order after Episode 2.
- Targets: final order equals the Episode 2 order in at most 35% of lives; the leader after Episode 4 loses the lead in the finale in at least 20% of lives; every E check passes; F-e and F-f stay in range.
- Knobs, Play params only, in this order: compress Episode 2 incomes (the wage or the talent spread in a life), raise later-episode stakes, scale mission points by episode so later episodes weigh more. At most 6 sweeps of 300 lives, confirm on 1,000. Record before and after in a D-entry.
- Keep U5 in its own commits so it can be reverted alone. Report the new rules hash. Merging it needs the room server redeployed first (the owner does that).

## Final report
`docs/UI_V3_REPORT.md`, plain and short: what a player now sees and hears; the 8 before and after pairs; taps and time before and after; bundle size before and after; a11y results; U5's table; choices made with alternatives; what is left; "Human validation: NOT DONE"; the commit and the preview link. Reply with its text.
