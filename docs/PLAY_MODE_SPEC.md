# THE VEIL: LIVE
### Play mode specification (v1.0)

**Status:** design spec for Claude Code. Builds on the existing engine; Study mode (today's game) must not change.
**Author:** Amirreza Akhavan
**Read with:** DECISIONS.md, README.md, src/engine, src/shared/flow.ts

---

## 0. Rules for whoever builds this

1. Read this whole document, DECISIONS.md and the engine before writing code.
2. **Study mode is frozen.** Every Study-mode game must replay exactly as before. Add a golden test: a set of fixed Study seeds and action logs whose final-state hashes are recorded before any Play-mode work and must stay identical after.
3. Play mode is the same engine with a different ruleset (Section 3). No second engine, no copied level files. Differences live in parameters, small optional hooks, and the UI.
4. **Preserve every mechanism** (Section 2). Numbers, pacing and presentation may be bent for fun. Cause and effect may not.
5. Every number lives in params.ts under `PLAY`. Every player-facing string goes in en.json under `play.*`. No em dashes in any text.
6. Record every choice this spec leaves open in DECISIONS.md.
7. Build in the milestone order of Section 12 and stop where it says stop.

---

## 1. What Play mode is

Today's game teaches well but feels flat for an average player: calm choices, then a table of results. Play mode keeps the same economics and adds what fun games have:

- **Suspense** before every result.
- **Stakes that build up:** money carries over across a whole life.
- **Surprises:** an event card most rounds.
- **People to react to:** a host, contestants who talk back, betrayals revealed on the spot.
- **A payoff about you:** a shareable card at the end.

### 1.1 The theme: "The Veil: Live"

A satirical reality show where contestants live **an entire life on air, in one season**. Tagline: **"One life. One season. No refunds."**

- **Host: Dash Fortuna.** Smooth, shameless, loves drama, understands nothing about economics but pretends to. He narrates, teases, and reads the audience poll.
- **Episodes are life stages.** Each of the five levels becomes an episode.
- **Sponsors are the satire targets.** SafeHands Mutual sponsors the insurance episode; HireBot 3000 is the guest judge of the hiring episode; the Ministry of Deserving becomes "the show's legal department", appearing only in fine print.
- **Contestants:** the human player(s) plus the existing bots (Chet, Marigold, Ugo, Dot), same personalities, now with on-camera "confessional" lines.
- **Audience poll:** the bots' existing beliefs about who holds which secret card, shown as "The audience thinks Chet is the Egoist (62%)".

### 1.2 Tone

- Fast, bright, a little chaotic. Short lines: host lines at most 15 words, instructions at most 25 words per screen.
- Satire targets: the host, the show, sponsors, algorithms, the economy, and the player's own hypocrisy.
- **Never mock:** disability, illness, caregivers, gender, or any real group. Circles and Squares stay abstract. Bad-luck cards joke about the paperwork and the show, never the misfortune itself (same rule as Section 10.3 of the original spec).

---

## 2. The mechanism rule

Play mode may change amounts, ranges, round counts, timing and presentation. Each episode's core mechanism must still produce its effect. The simulator checks this (Section 10).

| Episode | Mechanism that must stay true | Allowed bends |
|---|---|---|
| 1 Born | You vote on the sharing rule before you know your income | More extreme incomes, 2 rounds, events |
| 2 First Hustle | Income comes from effort and luck; others can't tell which; taxes reduce effort | Wilder luck with a jackpot, 3 rounds, events |
| 3 Bad Luck Season | Insurance price rises because mostly risky people buy; a mandate stops the spiral | Bigger disasters, 3 rounds, events, dramatic price display |
| 4 The Hiring Round | Old beliefs plus incentives create a gap with no prejudiced player | 4 rounds, game-show presentation, events |
| 5 Grand Finale | Your sense of a fair rule moves once you know where you stand | Bigger bribes, ceremony, events |

---

## 3. Architecture

### 3.1 Ruleset

- Add `ruleset: 'STUDY' | 'PLAY'` to SetupConfig and GameState. Default for existing code paths: 'STUDY'.
- `PLAY` parameters are overrides applied on top of the Study params for that game only. Do not mutate global params (the audit flagged global mutable params). Pass an effective-params object through the engine, or resolve params from the ruleset at each read.
- The rules version (D-75) must include the ruleset. A Play game and a Study game never share saves, records or rooms.

### 3.2 Modes

- `LIFE`: the five episodes in order, money carried over (Section 4).
- `EPISODE`: any single episode, started with `PLAY.STARTING_BANK`.
- Study keeps its existing FULL_RUN and SINGLE_LEVEL modes unchanged.

### 3.3 Hooks the engine needs (keep them small)

1. **Bank:** each player's carried money in Play mode (Section 4).
2. **Events:** an optional per-round modifier drawn from the game stream (Section 6).
3. **Episode parameter overrides:** Section 5 values per episode.
4. **Play scoring:** Section 4.3.

Everything else (host lines, reactions, reveals, polls, result card) is UI built from data the engine already exposes through visibleState. Never leak private information through new UI.

---

## 4. One life: money that carries over

### 4.1 The bank

- Every player starts the life with `PLAY.STARTING_BANK = 100` coins.
- After each round: `bank = bank + W - PLAY.LIVING_COST`, where W is that round's money as computed by the episode rules, and `PLAY.LIVING_COST = 30`.
- The bank can go negative. Negative means **in debt**.
- Show every player's bank at all times. In Play mode banks are public (it's TV).

### 4.2 Debt stress (replaces the hardship line in Play mode)

- In Play mode, the Study hardship line (W below 40) is switched off.
- Instead: at the end of each round, a player in debt loses `PLAY.DEBT_POINTS_PER_COIN = 1` score point per coin of debt, capped at `PLAY.DEBT_PENALTY_CAP = 40` points per round. The cap keeps comebacks possible.
- This keeps the property the hardship line was added for: self-interested players have a reason to want protection, and now poorer players want it more, which is a realistic wealth effect.
- Bots must evaluate options with this rule (their round score depends on their bank). Check that every bot evaluation path receives the bank.

### 4.3 Scoring and missions

- Values cards become **missions**, with one-line names:
  - Egoist: "Get rich" (your own bank)
  - Rawlsian: "Protect the poorest" (the lowest bank at the table)
  - Utilitarian: "Grow the pie" (the average bank)
  - Meritocrat: "Reward hard work" (average bank, reduced when bank shares drift from effort shares; effort = Episode 2 effort plus Episode 4 training, as in Study)
- **Final score** = 0.5 x (your final bank) + 0.5 x k_play x (your mission's value on final banks) - (total debt stress points).
- k_play per mission is calibrated by simulation so no mission dominates (Section 10). Store in `PLAY.MISSION_SCALE`.
- Show a **mission progress bar** on screen at all times, plus a **live ranking** of contestants (rank only, not exact scores). The ranking leaks a little about cards; in Play mode that's acceptable.

### 4.4 Single-episode play

`EPISODE` mode starts everyone at `STARTING_BANK` and scores the episode the same way on the banks at its end.

---

## 5. Episode specifications

Each episode keeps its Study level's rules except where listed. Phase flow follows the existing shared flow (2 screens per round), plus the reveal sequences in Section 7.

### Episode 1: "Born" (Level 1)
- **Rounds:** 2.
- **Incomes deck:** `[10, 40, 110, 300]` (wider than Study's so the vote feels scary).
- **Intro:** Dash introduces the contestants as babies. Before anyone is born, each contestant answers the unpaid question "What tax rate do you think is fair?" (this is the life's first fair answer; see Episode 5).
- **Reveal:** incomes flip one card at a time, poorest first, with a drumroll.
- Leakage and principles unchanged.

### Episode 2: "First Hustle" (Level 2)
- **Rounds:** 3.
- **Luck die:** `[-30, 0, 10, 30, 90]`, shown as a rolling die; 90 is the jackpot face.
- **Work screen:** the existing slider, restyled as a "hustle meter". The line "Your money with average luck" stays.
- **Reveal:** each contestant's die rolls in turn; the jackpot gets an effect and a host line.
- Tax vote, median rule, talent and effort cost unchanged.
- The luck poll and the Bonus Pot are kept but shortened to one screen each.

### Episode 3: "Bad Luck Season" (Level 3)
- **Rounds:** 3. Rounds 1 and 2 voluntary market; then the regime vote; round 3 under the chosen regime.
- **Loss:** `100` (from 80). Premium and mandate formulas unchanged in structure.
- **Price board:** SafeHands Mutual's price is shown as a big ticker. After each round it animates to the new price with the reason ("Last round's buyers were mostly high risk").
- **Reveal:** a "Wheel of Misfortune" spins for each contestant (same probabilities as the rules; the wheel is presentation only).
- Gym unchanged.

### Episode 4: "The Hiring Round" (Level 4)
- **Rounds:** 4. Rounds 1 and 2 baseline; the policy vote; rounds 3 and 4 under the policy.
- Money amounts, training costs (15/30/45/60), beliefs, test accuracy and threshold unchanged.
- **Presentation:** HireBot 3000 is the guest judge. Each test result is announced like a talent-show verdict, then HireBot's confidence bar fills toward the 60% line before the stamp lands.
- Guardrail: jokes target HireBot and the show, never the groups.

### Episode 5: "Grand Finale: Rewrite the Rules" (Level 5)
- **Rounds:** 1 era, as in Study.
- **Incomes:** the contestants' **life banks** replace the income deck. You write the rules first (veil stage uses the deck's expectation, as now), then the banks are revealed in a ceremony and you can amend.
  - Note for the builder: this keeps the mechanism (positions are revealed after the veil choice). Record in DECISIONS.md how the veil-stage expected outcomes are computed when incomes are banks.
- **Max donation:** `40` (from 20).
- **Second fair answer:** after the reveal, the unpaid fair-tax question again. The shift between the life's first answer (Episode 1 intro) and this one feeds the result card.
- In EPISODE mode (Finale played alone), use the Study income deck scaled by 2 instead of life banks.

---

## 6. Event cards

### 6.1 Rules
- Before each round (except Episode 5's single era, which gets one event before lobbying), draw from the game stream: with probability `PLAY.EVENT_CHANCE = 0.6` an event card from that episode's deck, otherwise "Quiet week".
- An event changes **one parameter for that round only**, announced by Dash before decisions are made. It's logged, so replays stay exact.
- No event may break the episode's mechanism (Section 2). Each card below lists what it touches.
- Events are public. Their text is satirical; their effect is stated plainly underneath in one line.

### 6.2 Decks (effects are multipliers or offsets for that round)

**Episode 1**
| Card | Effect |
|---|---|
| Economic Boom | all incomes x1.2 |
| Market Crash | all incomes x0.8 |
| Tax Office on Strike | leakage x2 |
| Surprise Inheritance | one random contestant +60 after taxes |
| Lottery Fever | the top income card becomes 400 |

**Episode 2**
| Card | Effect |
|---|---|
| Lucky Week | luck die values x1.5 |
| Overtime Bonanza | talent multiplier 4 becomes 5 |
| Burnout Season | effort cost 0.4 becomes 0.6 |
| Viral Video | one random contestant luck +80 |
| Bad Wi-Fi Week | luck die values x0.5 |

**Episode 3**
| Card | Effect |
|---|---|
| Storm Season | every risk x1.5 (capped at 0.9) |
| Gym Sale | gym cost 6 becomes 3 |
| Price War | premium x0.8 this round (next round's price is still set from buyers) |
| Medical Breakthrough | loss 100 becomes 50 |
| Paperwork Week | mandate contribution +5 (only if mandate is active; otherwise Quiet week) |

**Episode 4**
| Card | Effect |
|---|---|
| Hiring Spree | job threshold 0.6 becomes 0.5 |
| Recession | long-hours pay 180 becomes 140 |
| Training Grant | every training cost -15 (minimum 0) |
| HireBot Update | belief update weight 0.2 becomes 0.3 this round |
| Office Party | flexible-hours pay +20 |

**Episode 5**
| Card | Effect |
|---|---|
| Lobbyist Convention | max donation 40 becomes 60 |
| Leaked Receipts | every donation is shown publicly before the amendment votes |
| Constitutional Panic | amendments need every vote but one |
| Quiet Finale | no change |

### 6.3 Comeback card (life mode only)
Once per life, for the contestant in last place after Episode 3, the show offers "A Second Chance": take 60 coins now, or decline and get +20 mission points. It's announced on air. Record its effect on the fun metrics.

---

## 7. Presentation

### 7.1 Screen structure
- An **ON AIR** top bar: episode name, round, contestants' banks, live ranking, mission bar, chat button.
- **Danger meter** under your bank: green above 60, amber 0 to 60, red in debt.
- Keep the two-screens-per-round flow, the "Thinking..." indicator and every accessibility rule from Study.

### 7.2 Reveal sequences (presentation only; outcomes are already decided by the engine)
- Episode 1: income cards flip one by one, poorest first.
- Episode 2: each luck die rolls in turn; jackpot effect.
- Episode 3: the Wheel of Misfortune per contestant; the price ticker animates.
- Episode 4: HireBot's confidence bar fills, then the stamp.
- Episode 5: the bank reveal ceremony, then each amendment vote lands one ballot at a time.
- Each sequence takes at most 4 seconds, can be skipped with one tap, and is replaced by an instant result under reduced motion.

### 7.3 Dash Fortuna and the contestants
- **Host lines:** one before each round (introducing the event) and one after each reveal, chosen from template banks keyed by outcome (jackpot, disaster, betrayal, debt, comeback, quiet round). At least 6 variants per key. Use second-person variants when the subject is the human (as in D-38).
- **Confessional lines:** after each reveal, one bot speaks to the camera in its voice about what just happened (at least 4 variants per bot per outcome key).
- **Broken promises:** when a contestant's action contradicts their message this round, stamp it immediately: "Chet said he'd vote Safety Net. He didn't."
- **Audience poll:** once per episode, show the table's aggregated bot beliefs about one contestant's mission as a poll bar.
- **Reactions:** five quick reaction buttons (laugh, gasp, angry, clap, eye-roll) on results screens. In multiplayer they're broadcast; bots react occasionally in character. Reactions carry no game effect and aren't logged as actions (keep them out of the replay log).

### 7.4 Card guess every episode
At the end of each episode, guess one other contestant's mission. Correct: +15 points and an on-air celebration. Wrong: a host tease. The answer is revealed immediately for that contestant only.

### 7.5 "What was really going on?"
On every episode summary, a button opens 3 short lines on the real mechanism ("SafeHands priced from last round's buyers. Healthy people left, so the price climbed. That's adverse selection."), then a link: "See the exact model in the economics version." Play mode states once in the mode screen and once in About: "Play mode exaggerates the numbers for drama. The mechanisms are real."

### 7.6 Episode summary (short)
One screen: who won the episode, the biggest moment (largest swing or event), your bank change, your mission progress, the card-guess result, and the "What was really going on?" button. No tables unless opened.

### 7.7 The result card (end of a life, or end of a single episode)
- A shareable image (canvas to PNG). Mobile: Web Share API; desktop: download.
- Contents: your contestant name, your final rank, a three-line life story generated from your biggest moments ("Born poor. Hit the jackpot at 22. Lost it all in the storm."), your mission and whether you completed it, and a **fun title** from your fair-answer shift (Episode 1 vs Episode 5) and final wealth rank, for example "Principled until payday".
- Small print on the card: "Just for fun. Not a diagnosis." This is entertainment labeling; Study mode keeps its neutral wording.
- No private information about other players on the card.

### 7.8 Visual style
- Distinct from Study's paper look: a bright studio palette (deep stage blue, spotlight yellow, hot pink accent), bold display font, subtle stage-light gradients. Keep WCAG AA contrast in both light and dark.
- Sound effects (drumroll, stamp, jackpot, applause), **off by default**, with a toggle in the top bar.

---

## 8. Mode selection and navigation

- Title screen: "How do you want to play?"
  - **Quick and fun** (Play mode, default): "A whole life in about 20 minutes. Big swings, drama, secret missions."
  - **With the economics** (Study mode): "The exact models, formulas and research behind each level."
- Settings can switch modes any time (a game in progress keeps its mode).
- Inside Play mode: "Live a whole life" (LIFE) or "Play one episode" (EPISODE, all episodes unlocked).
- Multiplayer offers both modes; the ruleset is a room setting and part of the rules version. Play-mode rooms use shorter timers: `PLAY.DECISION_SECONDS = 30`, results `15`, episode summary `45`.

---

## 9. Text and copy

- All Play copy under `play.*` in en.json. Host and confessional banks in `src/ui/copy/play/`.
- Plain English, short sentences, no em dashes, no economics jargon during play (jargon only behind "What was really going on?").
- Write at least: 6 host lines per outcome key, 4 confessional lines per bot per key, the full event deck text, 12 Wheel of Misfortune slips (bureaucracy jokes only), 20 result-card titles covering every shift and rank combination.

---

## 10. Targets (checked by the simulator, bot-only)

Extend `sim/run.ts` with `--ruleset PLAY --mode LIFE|EPISODE`. Report mean ± SE, check every target mechanically, exit nonzero on failure (as in F7).

### 10.1 Mechanism checks (must pass; these protect the economics)
- E1: the vote happens before incomes are revealed (structural test).
- E2: mean effort falls as the tax rises (regression slope of effort on t is negative).
- E3: round-1 High-risk buyers outnumber Low-risk buyers at least 2 to 1; the mean round-2 price is at least 15% above round 1 when the market is open.
- E4: the Circle-minus-Square gap is positive in at least 70% of episodes; a Square passing the test rarely gets a good job in round 1.
- E5: the bot fair-answer shift across a life has a negative slope on wealth rank (labeled programmed, as in D-73).

### 10.2 Fun targets (design targets for tuning)
- F-a: lead changes per life: mean at least 2.
- F-b: comebacks: the contestant last after Episode 2 finishes first or second in at least 20% of lives.
- F-c: close finishes: first and second place within 15% of each other in at least 40% of lives.
- F-d: big moments: at least one event or a single-round bank swing of 80+ coins in at least 90% of episodes.
- F-e: missions: no mission wins more than 35% or less than 15% of seats.
- F-f: debt: at least one contestant goes into debt in 30% to 70% of lives (danger exists but isn't constant).

Tune only `PLAY.*` parameters to hit these. Never tune Study parameters for Play mode.

---

## 11. Tests

- Golden Study replay hashes unchanged (Section 0).
- Play replay determinism, including events, the comeback card and auto-decisions.
- Bank arithmetic and debt stress cap.
- Event effects apply for one round only and are logged.
- visibleState in Play hides missions, private info and pending decisions exactly as Study does; reactions never carry private data.
- Rules version differs between rulesets; a Play save can't load as Study and the reverse.
- Result card contains no other player's private information.
- Walkthrough at 375 px for a full life: no overlaps, no horizontal scroll; record screens and words per episode.
- A Playwright test for a two-player Play-mode room through one episode.

---

## 12. Milestones

| # | Milestone | Done when |
|---|---|---|
| P1 | Framework: ruleset plumbing, golden Study test, mode screen, bank and debt stress, event system, Play scoring and missions, ON AIR bar, danger meter, live ranking, host and confessional system, reactions, card guess, episode summary, "What was really going on?". **Episode 3 fully built** and playable as a single episode. Simulator support for Play. | Golden Study test passes; E3 passes; Episode 3 playable at 375 px; a preview link exists. **Stop and report.** |
| P2 | Episodes 1 and 2. | E1, E2 pass; both playable as single episodes. |
| P3 | Episodes 4 and 5, LIFE mode, comeback card, result card. | E4, E5 and all fun targets pass or are reported; full life playable; result card shares on a phone. |
| P4 | Play mode in multiplayer, sounds, visual polish, copy pass. | Two-player Play room works end to end; Lighthouse accessibility at least 95. |

After P1, the author playtests Episode 3 in both modes with real people before P2 starts.

---

## 13. Open items for the author

1. Final show name ("The Veil: Live" is the working title).
2. Whether the result card links back to the game (a URL on the card).
3. Whether Play mode becomes the default for multiplayer rooms.
