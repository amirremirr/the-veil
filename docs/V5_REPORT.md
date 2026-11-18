# V5 report

Branch `v5`, made from `ui-v4` at `254be45`. Three phases, done in order, then an engine follow-up. Each was gated, committed, pushed and logged in `docs/V5_PROGRESS.md`. Choices are recorded in `DECISIONS.md` as D-210 to D-216 [V5, review]. Nothing was merged or deployed. Study is untouched: the golden test passes at every commit.

**New rules hash: `b43294bd2727aac5`** (`b1b485fa65cf3b29` before V5, `35f3c43191c5b77b` after N1, `d43a27b11694414b` after the first follow-up). N1 and the follow-up changed the engine, each change in its own commit. Merging needs the room server redeployed with this hash first.

## N1. Missions removed (D-210)

**What is gone:** the mission card, mission points, mission previews on tiles, the mission bar, the card guess and the mission reveal. The VALUES_REVEAL and GUESS phases are never queued in Play.

**Scoring:** your score is your bank (the follow-up removed the Second Chance points option). In a life the bank still counts from the end of Episode 1, so birth income is not scored, as before (D-203). Debt no longer costs points; it is already a negative bank.

**Bots:** each bot has a fixed values trait that drives its choices exactly as its mission did. Marigold protects the poorest, Ugo grows the total, Dot rewards effort, Chet looks after himself. The traits are never named on screen; they show in what each bot does and in one new line per moment in its own voice. The values deck is still shuffled at setup, so the game stream is unchanged.

**End of life:** one screen, "You played like…".
- It maps your own choices over the life to the four principles by fixed rules, and names you after the bot who carries that trait: "You played like Dot."
- It gives one example ("In Episode 4 you paid to train.") and the share of each principle.
- It compares your first fair-tax answer with your vote: "You said 30% tax was fair, and you voted for 30%."
- The mapping is a judgement, not a measurement.

**Checks:** 1,000 bot lives (these describe the bots, not people). Every E check passes. F-a, F-b, F-d and F-f pass. F-e is dropped.

**Retuning:** life-level knobs only, six sweeps of 300 lives, then 1,000 lives to confirm. The bots' finale values weight went from 2 to 4; nothing else changed.

**Two targets missed:**
- The leader after Episode 4 loses the finale in 13.3% of lives (target 20%; it was already 15.7% and missing).
- The score gap share is 59.8% (target 40%; it was 37.1%).

With the score equal to the bank, the finale's flat tax and floor keep everyone's order. The missions used to reorder the finale. Meeting these targets needs a finale mechanic that reorders banks, which is a rules change.

### The N1 table

| 1,000 bot lives | Before (`b1b485fa65cf3b29`) | After (`35f3c43191c5b77b`) |
|---|---|---|
| E1 peekers vote less redistribution (> 0) | 0.499 ± 0.029 PASS | 0.485 ± 0.026 PASS |
| E2 effort slope on tax (< 0) | -4.435 ± 0.171 PASS | -4.225 ± 0.168 PASS |
| E2 added: overclaimed hours (> 0) | 0.368 ± 0.015 PASS | 0.355 ± 0.015 PASS |
| E3a high- to low-risk applicants (at least 2) | 3.70 PASS | 3.33 PASS |
| E3b round-3 price rise (at least +15%) | +37.0% PASS | +31.9% PASS |
| E3c bars that hit high risk (at least 60%) | 91.0% PASS | 91.1% PASS |
| E3d round-3 pool price (above 0) | 0.334 PASS | 0.294 PASS |
| E4a Circle minus Square gap positive (at least 70%) | 89.6% PASS | 89.4% PASS |
| E4b passing Squares hired complex (at most 10%) | 0.0% PASS | 0.0% PASS |
| E5 fair-answer shift slope (< 0) | -0.069 PASS | -0.048 PASS |
| F-a lead changes per life (at least 2) | 2.88 PASS | 3.22 PASS |
| F-b last after Ep2 finishes 1st or 2nd (at least 20%) | 25.2% PASS | 30.4% PASS |
| F-c top two within 15% (at least 40%; not on the keep list) | 66.4% | 39.3% (miss) |
| F-d a big moment (at least 90%) | 88.4% FAIL | 91.5% PASS |
| F-e mission win shares | 24.8 / 25.3 / 33.1 / 16.9 | dropped |
| Wins by bot trait (no target) | n/a | Chet 31.1%, Marigold 11.3%, Ugo 31.3%, Dot 26.3% |
| F-f someone goes into debt (30% to 70%) | 51.6% PASS | 53.3% PASS |
| U5: final order = order after Ep2 (at most 35%) | 15.2% PASS | 10.7% PASS |
| U5: Ep4 leader loses the finale (at least 20%) | 15.7% (miss) | **13.3% (miss)** |
| Score gap 1st to 4th, share of the winner (at most 40%) | 37.1% PASS | **59.8% (miss)** |
| Born poorest wins (at least 15%) | 21.9% PASS | 38.2% PASS |

### The six sweeps

300 lives each. The two numbers are the finale lead change and the score gap share.

| Sweep | Finale lead change | Gap share | Note |
|---|---|---|---|
| No change | 10.0% | 58.5% | |
| Finale weight 4 | 13.7% | 59.5% | **chosen** |
| Second Chance 200 coins | 9.3% | 53.8% | |
| Weight 4 and 200 coins | 11.7% | 54.3% | |
| Weight 10 and Marigold's scale 3 | 14.7% | 62.0% | |
| As above, whole bank scored | 7.0% | 45.4% | Born poorest wins 10.0%: fails |

## N2. Style B, Retro TV studio, across Play (D-211)

**Stage:**
- Deep teal background with a soft studio-light glow.
- A static film grain at 4% opacity: a noise tile in the background, never animated.
- Orange is the main action colour. It is a new `action` design token, on every main button.

**Type:**
- Fredoka for headlines and Nunito for text, bundled locally (no font CDN).
- No Play text is under 16 px. The a11y script now lists any such text: 0 on every Play screen, the menu, and the mode and setup pages. Stamps are the only exception (14 px capitals on cream).

**Characters:**
- Flat puppets with thick outlines and big expressive eyes.
- All six expressions for every contestant, Dash's four, and the six shapes in the avatar picker.
- Stamps are cream cards.
- The wheel, the win and loss flashes and the result card use the same tokens.

**Contrast:** the negative colour is a lighter coral than the preview used, so negative numbers on cards pass AA.

**What else changed:**
- Study keeps its look.
- The `?styles=1` preview page, its script, its test and three unused font packages were removed. The captures stay in `docs/review/styles/`.

## N3. Fewer taps, shorter results (D-212)

**Results carried over:** before an episode's last round, the round's "What your choices did" block shows at the top of the next round's first decision, as "Last round", one line per row. It carries the round's other news as a line:
- the new price of cover;
- the big vote's result;
- who won the Hustle Prize;
- the new HireBot rule.

**Screens folded in:**
- Episode 1's vote result and incomes are now one screen; the unborn beat is gone.
- Episode 2's incomes are one line on the prize vote, and the tax beat is gone.
- Episode 3's Bar result is a line on the wheel; its price board and vote beat moved into the carried block.
- Episode 4's belief board and policy beat are gone.
- In a life, Episode 5's incomes screen is one line on the next question.

**Auto-advance:** no screen over 8 words moves on by itself. The folded engine screens show nothing at all.

**Summary:** at most 50 words (37 to 46 measured). It has:
- the score and its change, and your place;
- the best and worst money line of the episode;
- the biggest lie;
- the near miss.

"What was really going on?" moved into the menu.

**Episode 4's pay screen:** at most 45 words (11 to 43 measured).

**Episode 2's income formula:** it is on no screen now, only behind "See the money".

**Fixed along the way:** an unfilled "{c}" on Episode 1's "Stay blind" tile, there since UI V4. e2e now fails on any unfilled placeholder.

## Engine follow-up: Worrier, Second Chance, finale (D-213 to D-215)

Three Play engine changes, each in its own commit, then one tuning commit.

1. **Worrier interest (D-213, `c6814e9`).** A Worrier who ends an Episode 3 round in debt pays 10% of the debt, rounded up (`PLAY.WORRIER_DEBT_RATE`), as a "Worrier interest" ledger line. The card says exactly that. Bots value the interest the same way, this round and in the rounds still to come. It replaces the old debt-stress multiplier, which cost nothing once the score became the bank.
2. **Second Chance (D-214, `0a232ae`).** No choice: whoever is last on score after Episode 3 gets `PLAY.SECOND_CHANCE_COINS`. One screen for everyone, no decision.
3. **Finale on the whole bank (D-215, `6bf11e0`).** In a life, the rule that wins Episode 5's amendments acts once on every whole bank at the end of the finale, after the donations and calls:
   - each pays the tax on their bank above 0;
   - the pot tops everyone, a debt too, up to the floor;
   - the rest is shared equally (each top-up is cut in proportion if the pot is short).

   Bots value their proposals, votes and donations under it. A new staged beat, "The new rules apply to everything you own", shows each bank on the stage counting from before to after. A single Episode 5 is unchanged.

   Before this, D-155 already taxed banks in a life, but at the start of the finale, with debt counted as 0 and left in place, and with donations moved after the rule.

**Tuning (`24e5dc4`).** Second Chance went from 120 to 250 coins; nothing else changed. A baseline and six sweeps of 300 lives, then 1,000 lives to confirm. The three numbers are the finale lead change, the score gap share and born-poorest wins:

| Sweep | Finale lead change | Gap share | Born poorest wins | Note |
|---|---|---|---|---|
| New rules, no tuning (baseline) | 42.7% | 64.8% | 65.0% | |
| Finale values weight 1 | 34.0% | 64.2% | 59.7% | |
| Finale values weight 10 | 40.3% | 65.1% | 65.7% | |
| Second Chance 250 | 40.7% | 58.0% | 64.0% | **chosen** |
| Second Chance 400 | 44.7% | 55.0% | 65.0% | larger than the whole gap after Ep3 (about 390), so the gift decides the life |
| Second Chance 250, weight 1 | 36.0% | 58.5% | 61.0% | |
| Whole bank scored from the start | 5.7% | 22.1% | 11.0% | informational, outside the allowed knobs; fails two targets |

### Before and after, 1,000 bot lives

| 1,000 bot lives | Before (`35f3c43191c5b77b`) | After (`d43a27b11694414b`) |
|---|---|---|
| E1 peekers vote less redistribution (> 0) | 0.485 ± 0.026 PASS | 0.485 ± 0.026 PASS |
| E2 effort slope on tax (< 0) | -4.225 ± 0.168 PASS | -4.225 ± 0.168 PASS |
| E2 added: overclaimed hours (> 0) | 0.355 ± 0.015 PASS | 0.355 ± 0.015 PASS |
| E3a high- to low-risk applicants (at least 2) | 3.33 PASS | 4.72 PASS |
| E3b round-3 price rise (at least +15%) | +31.9% PASS | +39.6% PASS |
| E3c bars that hit high risk (at least 60%) | 91.1% PASS | 91.5% PASS |
| E3d round-3 pool price (above 0) | 0.294 PASS | 0.391 PASS |
| E4a Circle minus Square gap positive (at least 70%) | 89.4% PASS | 88.7% PASS |
| E4b passing Squares hired complex (at most 10%) | 0.0% PASS | 0.0% PASS |
| E5 fair-answer shift slope (< 0) | -0.048 PASS | -0.057 PASS |
| F-a lead changes per life (at least 2) | 3.22 PASS | 3.75 PASS |
| F-b last after Ep2 finishes 1st or 2nd (at least 20%) | 30.4% PASS | 35.4% PASS |
| F-c top two within 15% (at least 40%) | 39.3% (miss) | 56.4% PASS |
| F-d a big moment (at least 90%) | 91.5% PASS | 96.7% PASS |
| F-f someone goes into debt (30% to 70%) | 53.3% PASS | 53.8% PASS |
| Wins by bot trait (no target) | Chet 31.1%, Marigold 11.3%, Ugo 31.3%, Dot 26.3% | Chet 31.3%, Marigold 12.9%, Ugo 31.6%, Dot 24.2% |
| U5: final order = order after Ep2 (at most 35%) | 10.7% PASS | 9.4% PASS |
| **Finale lead change: Ep4 leader loses the finale (at least 20%)** | 13.3% (miss) | **40.5% PASS** |
| **Score gap 1st to 4th, share of the winner (at most 40%)** | 59.8% (miss) | **57.4% (miss)** |
| **Born poorest wins (at least 15%)** | 38.2% PASS | **64.0% PASS** |

Episodes 1 and 2 did not change, so E1 and E2 are identical.

**Why the gap target is still missed.** The score counts from the end of Episode 1 (D-203), but the finale now taxes the whole bank, birth income included:
- someone born rich pays tax on coins that never counted for them;
- someone born poorest gains.

That is why born-poorest wins jumped to 64% (an even share would be 25%), and why the gap between first and last in score stays wide even though the banks end close together (top to bottom bank about 1.3 to 1). Only a scoring change reached the gap target: counting the whole bank from the start gave 22.1%, but it broke the other two targets. That is the owner's decision, not a tuning knob.

## Finale on earnings since Episode 1 (D-216)

D-215 taxed the whole bank, birth income included, while the score counts only the bank since the end of Episode 1. That double-counted: someone born rich paid tax on coins that never counted for them, and born-poorest wins rose to 64%.

**The fix (`edaa0c8`).** In a life, the winning tax and floor act at the end of the finale, after donations and calls, on each contestant's earnings since the end of Episode 1 (their scored bank):
- only positive earnings are taxed;
- the floor tops up earnings below it;
- the rest is shared equally;
- the Episode 1 bank is not touched.

The staged screen now says "The new rules apply to everything you've earned" and lists each contestant's earnings before and after while the podium banks count. Bots value their proposals, votes and donations under the new rule. A single Episode 5 is unchanged.

**Sweeps (300 lives each).** Second Chance at 120, 180 and 250:

| Second Chance | Finale lead change | Gap share | Born poorest wins | Note |
|---|---|---|---|---|
| 120 | 9.0% | 47.6% | 37.7% | |
| 180 | 13.7% | 41.3% | 37.0% | **chosen**, best on all three |
| 250 | 9.3% | 42.4% | 36.0% | |

**Tuning (`7106441`).** Second Chance 250 to 180, confirmed on 1,000 lives.

### Before and after, 1,000 bot lives

| 1,000 bot lives | Before (`d43a27b11694414b`) | After (`b43294bd2727aac5`) |
|---|---|---|
| E1 peekers vote less redistribution (> 0) | 0.485 ± 0.026 PASS | 0.485 ± 0.026 PASS |
| E2 effort slope on tax (< 0) | -4.225 ± 0.168 PASS | -4.225 ± 0.168 PASS |
| E2 added: overclaimed hours (> 0) | 0.355 ± 0.015 PASS | 0.355 ± 0.015 PASS |
| E3a high- to low-risk applicants (at least 2) | 4.72 PASS | 4.72 PASS |
| E3b round-3 price rise (at least +15%) | +39.6% PASS | +39.6% PASS |
| E3c bars that hit high risk (at least 60%) | 91.5% PASS | 91.5% PASS |
| E3d round-3 pool price (above 0) | 0.391 PASS | 0.391 PASS |
| E4a Circle minus Square gap positive (at least 70%) | 88.7% PASS | 89.0% PASS |
| E4b passing Squares hired complex (at most 10%) | 0.0% PASS | 0.0% PASS |
| E5 fair-answer shift slope (< 0) | -0.057 PASS | -0.051 PASS |
| F-a lead changes per life (at least 2) | 3.75 PASS | 3.32 PASS |
| F-b last after Ep2 finishes 1st or 2nd (at least 20%) | 35.4% PASS | 37.2% PASS |
| F-c top two within 15% (at least 40%) | 56.4% PASS | 58.1% PASS |
| F-d a big moment (at least 90%) | 96.7% PASS | 96.2% PASS |
| F-f someone goes into debt (30% to 70%) | 53.8% PASS | 53.8% PASS |
| Wins by bot trait (no target) | Chet 31.3%, Marigold 12.9%, Ugo 31.6%, Dot 24.2% | Chet 29.5%, Marigold 12.9%, Ugo 32.8%, Dot 24.8% |
| U5: final order = order after Ep2 (at most 35%) | 9.4% PASS | 8.5% PASS |
| **Ep4 leader loses the finale (at least 20%)** | 40.5% PASS | **9.8% ± 0.9 (miss)** |
| **Score gap 1st to 4th, share of the winner (at most 45%)** | 57.4% (miss) | **44.7% ± 1.7 PASS** |
| **Born poorest wins (15% to 35%)** | 64.0% (miss, above 35%) | **35.9% ± 1.5 (miss by 0.9 points)** |

Episodes 1 to 3 did not change, so E1 to E3 are identical.

**What this shows.** Taxing only earnings removes the double count:
- the score gap now meets its target;
- born-poorest wins falls from 64% to just over the ceiling.

The cost is the finale lead change. With birth income untaxed, the finale compresses earnings but rarely reorders them, so the Episode 4 leader usually stays first. None of the three Second Chance values reached 20%. The three targets pull against each other with the knobs allowed. Meeting all three would need a different finale lever, for example a larger pot or a floor tied to the median; that is a rules decision.

**Also in this round (UI only, `88e84da`).** Today's Daily Life seed overflowed 360 x 760 on two screens:
- Episode 2's prize split among everyone now reads "Split 4 ways.";
- the result card's best and worst lines drop the episode name.

## Taps and words

Seed `fresh-life-1`, 375 x 760. Before is end of UI V4 (`254be45`); after is end of N3 (`2e86b33`). The engine follow-ups turn the Second Chance into a screen with no choice and add the finale's beat: 74 taps on this seed, 76 on `fresh-life-3` (over N3's 75), pace 7.5 min, decision screens at most 44 words. The "before" summary and pay word counts are from the UI V4 V3 walkthrough of the same seed; V4 did not change those screens.

| | Before | After N1 | After N3 |
|---|---|---|---|
| Taps in a life | 98 | 94 | **73** (72 to 75 over five seeds) |
| Pace (RUNPLAN B.8 rates) | 9.2 min | 8.8 min | 7.5 min |
| Decision screens: max words, mean, over 45 | 44, 29.4, 0 | 45, 29.7, 0 | 45, 29.5, 0 (the carried block counted apart) |
| Episode summary words | 87 to 117 | 60 to 89 | **37 to 46** (limit 50) |
| Episode 4 pay screen words, last round | 80 | 83 | **43** (limit 45) |
| Screens auto-advancing over 8 words | 0 | 0 | 0 |

**Size:** main JS is 265.2 KB gzipped (was 266.3 at the end of UI V4).

**Gate at the last commit:**
- 223 unit tests, the golden test included;
- 18 e2e tests;
- the life walkthrough at 375 and 360, and with first-time hints;
- Episode 3 on Hard, and single Episodes 1 to 5 with hints;
- axe: 0 violations;
- the "choices add up" check: 56 blocks, 0 mismatches.

The two room-server e2e specs were not run (no wrangler in this run).

## Before and after: 6 key screens

Before: end of UI V4. After: end of V5 (style B, no missions, N3 layout). Same life, seed `fresh-life-1`.

| Screen | Before | After |
|---|---|---|
| 1. Episode 1 vote | ![](review/v5/1-ep1-vote-before.png) | ![](review/v5/1-ep1-vote-after.png) |
| 2. Episode 2 move | ![](review/v5/2-ep2-move-before.png) | ![](review/v5/2-ep2-move-after.png) |
| 3. Episode 3 move | ![](review/v5/3-ep3-move-before.png) | ![](review/v5/3-ep3-move-after.png) |
| 4. Episode 3 round result | ![](review/v5/4-ep3-round-result-before.png) | ![](review/v5/4-ep3-round-result-after.png) |
| 5. Episode 3 reveal | ![](review/v5/5-ep3-reveal-before.png) | ![](review/v5/5-ep3-reveal-after.png) |
| 6. Episode summary | ![](review/v5/6-ep3-summary-before.png) | ![](review/v5/6-ep3-summary-after.png) |

More shots are in `docs/review/v5/`:
- "You played like…": `extra-you-played-like.png`
- the result card: `extra-result-card.png`
- a carried result on the next screen: `extra-carried-result-ep1-peek.png`
- the Second Chance screen: `extra-second-chance.png`
- the finale's earnings beat: `extra-whole-bank.png`
- the Episode 3 secret cards with the new Worrier/Calm text: `extra-worrier-card.png` (this seed is Calm)
- Episode 4's pay screen: `extra-ep4-pay.png`
- an event card: `extra-ep3-event.png`

## What's left

- **Finale lead change (D-216).** The Episode 4 leader loses the finale in 9.8% of lives (target at least 20%), and born-poorest wins is 35.9% (target at most 35%). The score gap passes (44.7%). Meeting all three needs a finale rule change; the owner decides.
- **Second Chance at 180.** "Last on score" can hold more coins than someone else, because the score counts from the end of Episode 1; the screen does not explain that.
- **Finale beat.** It lists earnings, while the podiums show banks; a reader may need a moment to see why the order differs.
- **"You played like…".** The mapping from choices to principles is a judgement; review it.
- **Worrier interest.** The 10% rate was not swept (it moves none of the three life targets).
- **Taps.** A life is at 74 to 76 taps after the follow-ups, one over N3's limit of 75 on `fresh-life-3`.
- **Summary.** The ranking bars left the summary to stay under 50 words; only your place remains, and the screen now has a lot of empty space.
- **Rooms.** Multiplayer rooms keep the folded screens (the incomes and prize screens), and were not tested against the room server.
- **Not seen or heard by a person:** the new look's fonts, grain and characters, and the sounds from UI V4.

## Human validation: NOT DONE

No person has played V5, including the follow-up. Every number here comes from bots or automated checks. Every review is an AI judgement, not human evidence. Nothing here shows whether people find the game clearer, calmer or more fun without missions or in the new look.

## Commit and preview

- **Commits on `v5`:**
  - `4c7fee0`: N1, engine and UI, rules hash `35f3c43191c5b77b`
  - `34f5538`: N2
  - `2e86b33`: N3
  - `c6814e9`: Worrier interest
  - `0a232ae`: Second Chance without a choice
  - `6bf11e0`: finale on the whole bank
  - `24e5dc4`: Second Chance 250 (tuning), rules hash `d43a27b11694414b`
  - `edaa0c8`: finale taxes earnings since Episode 1
  - `7106441`: Second Chance 180 (tuning), rules hash `b43294bd2727aac5`
  - `88e84da`: two 360 px fit fixes (copy only)
- This report and the docs are committed on top of them.
- **Rules hash the room server must serve:** `b43294bd2727aac5`.
- **Preview link:** none. This run did not deploy, as instructed.
