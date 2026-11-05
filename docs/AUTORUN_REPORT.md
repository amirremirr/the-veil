# AUTORUN report

## Round 2 and the big-picture review (5 November 2026, about 03:45 to 05:30 Istanbul time)

Every number here comes from bot-only simulations, and every review is AI judgment (a proxy). **No human has played anything built here.**

### What each task did

| Task | Status | Result |
|---|---|---|
| R1 Episode 5: donations follow promises | DONE | Claims come before donations; donors fund "yes" claimers by record and pivotality. S-a 24.3%, lie success 40.9%, "Took your 40. Voted no." in 23.5% of games, E5 passes (D-158). |
| R2 Episode 4: judges read claims | DONE | Bayes' rule with the worker's record and the table's honesty prior (weight 0.25; 0.5 and 1 broke E4b). E4a 90.0%, E4b 0.0%, S-a 42.6%, lie success 34.7%. Training read with the claim 99.5% and contested hires 13.2% still miss (D-159). |
| R3 Life stakes | DONE | Life start 10, living cost 45, Episode 3 loss 220 in a life. Debt in 48.5% of lives (was 0.1%). E3a to E3d measured inside a life for the first time, all pass. F-a 1.89, F-b 18% and F-d 88% still miss (D-160). |
| R4 First fair answer | DONE | Asked before birth in Episode 1 of a life; Episode 5 asks only the second; E5 passes (D-161). |
| R5 Episode 2 lying | DONE | S-a 82% to 54% (target 50%): fewer lies would flip the gating "claimed effort exceeds true effort" check (D-162). |
| R6 Episode 1 claims as polls | DONE | Claims pay through strategic votes. S-a 21.8%, lie success 72.4%, E1 +52.6 points (D-163). |
| E1 Fresh eyes | DONE | Two AI reviewers saw only screenshots (`docs/playtest/fresh-eyes.md`). |
| E2 to E4 Audits | DONE | `docs/review/design-audit.md`, `logic-audit.md`, `ux-audit.md`. |
| E5 Fixes | DONE | 15 of 20 ranked fixes made (`docs/review/fix-list.md`, D-164); a new Reviewer B on the new screens still found the coins and the score hard to follow (`docs/playtest/fresh-eyes.md`). |
| F1 Playtest kit | DONE | `?playtest=1`, survey, results code, `?playtest=results`, `docs/playtest/HOW_TO.md` (D-166). |
| F2 Case study | DONE | `docs/CASE_STUDY.md` (D-165). |

### Simulator checks after round 2 (bots only)

| Episode | E checks | Claim layer |
|---|---|---|
| 1 Born | E1 +52.6 points (pass) | S-a 21.8%, lie success 72.4%, S-b 83.7% |
| 2 First Hustle | E2 -5.37 (pass), claimed over true +0.034 h (pass) | S-a 54.1%, lie success 13.6%, S-b 96.2% |
| 3 Bad Luck Season | E3a to E3d pass (unchanged) | lie success 67.5%, S-b 82.6%, bar recall 31.3% |
| 4 The Hiring Round | E4a 90.0%, E4b 0.0% (pass) | S-a 42.6%, lie success 34.7%, read with claim 99.5% |
| 5 Grand Finale | E5 -0.175 (pass, programmed) | S-a 24.3%, lie success 40.9%, betrayal in 23.5% of games |
| Life (1,000) | every E check passes, E3 inside a life too | F-f 48.5%, F-a 1.89, F-b 18%, F-c 48.5%, F-d 88% |

### The big-picture verdict (AI judgment, a proxy)

- **Episode 1:** strongest moment, the Peek (public, costly signalling); weakest, a claim before anyone knows anything. A first-timer would likely not ask for another round of it alone: it is the tutorial.
- **Episode 2:** strongest, the dice reveal ("Effort is invisible. Luck is loud."); weakest, a tax vote that bots keep near zero. Maybe another round: the prize vote is fun.
- **Episode 3:** strongest, being barred, and the death spiral when it happens; weakest, a season on Normal where the wheel never hits. On Hard the designer would play again.
- **Episode 4:** strongest, the belief board drifting from "the numbers"; weakest, the judge screen (both reviewers stalled there before E5's rewrite).
- **Episode 5:** strongest, the bribe and the fair-answer shift ("the best idea in the game"); weakest, the claim and donation screens before E5.
- **The life:** the score was never explained, so the ending felt arbitrary ("lost by 55 while ahead"); E5 now explains the score and itemizes every bank change. Reviewer A would play it "gladly with 4 to 6 friends on phones", not solo on Normal.

### Fixes made in E5 and left

Made: bank lines on every result, the score explained, the life summary's start-bank bug, Episode 4's "Round 5" button, a "Don't train" tile, plainer Episode 5 claims and ballots, the comeback exchange rate, host lines that contradicted the screen, varied honest-peak lines, LIE stamps in red, a "claims work like polls" line, 44 px chips, no mission hints on Hard, and a plain-language judge screen. Left: the wheel's luck on Normal, multiplayer, feedback on a wrong mission guess, one layout for the claim verb, the challenge-code replay exploit.

### New "Needs Amir" items

- Hard now hides the mission hints (D-164); Easy and Normal keep them (v2 B.6).
- Episode 2 can't hit both S-a and the added E2 check: choose which matters more (D-162).
- Episode 4's training read with the claim stays near 100% while E4b holds (D-159).
- Life stakes: start 10, living cost 45, Episode 3 loss 220 in a life (D-160).
- Episode 5 order changed: proposal with the second fair answer, claims, then donations (D-158).

**Human validation: NOT DONE.** Gates 1 and 2 are still outstanding.

---

# Round 1

For Amir. One unattended session on 5 November 2026, about 01:20 to 03:45 Istanbul time, on branch `autorun`. Every number below comes from bot-only simulations. It describes the bots, not people. **No human has played anything built here.**

## 1. What was built

| Task | Status | What |
|---|---|---|
| T0 smoke | DONE | Golden test, PROGRESS.md. |
| T1 AI playtest Ep3 | DONE | AI playtest (proxy, not human evidence) as Skimmer, Careful, Bluffer (`docs/playtest/ai-ep3.md`); 4 copy fixes (D-150). Persona script `scripts/ai-playtest.mjs`. |
| T2 Episode 4, The Hiring Round | DONE | Rotating judge; train, claim, test, hire; the HireBot meter (hidden on Hard); GOOD / BAD HIRE; policy vote; end line and the judge's own record (D-151, changed by D-155). |
| T3 Episode 1, Born | DONE | Vote claims, secret votes, the paid Peek in round 2, broken-promise stamps, incomes poorest first, peekers' votes next to their incomes (D-152). |
| T4 Episode 2, First Hustle | DONE | Tax vote, hustle meter with an effort claim, public gross incomes with hidden dice, the Hustle Prize, Security Cameras (D-153). |
| T5 Episode 5, Grand Finale | DONE | Rules behind the veil, the income ceremony, fair answers before and after, secret donations up to 40, vote claims, ballots with "Took your 40. Voted no." (D-154). |
| T6 LIFE, Receipts, result card | DONE | Five episodes with banks carried over, the comeback card, per-episode near misses, the Receipts reel, result card v2 (canvas PNG, share or download, 21 titles) (D-155). |
| T7 AI playtest of a life, polish | DONE | AI playtest (proxy) of a full life (`docs/playtest/ai-life.md`), 7 clarity fixes, axe on 74 screens (0 violations), copy and speed checks (D-156). |
| T8 Retention | DONE | Daily Life (Istanbul day seed), emoji share grid, 12 achievements, rival line with a same-seed rematch; no streaks, timers or notifications (D-157). Party link and Play multiplayer skipped (room server). |
| T9 Report | DONE | This file. |

Each new episode is a Play-only level definition (`src/engine/play/ep1.ts`, `ep2.ts`, `ep4.ts`, `ep5.ts`). `LEVELS` switches on the ruleset, so a Study game runs the Study code unchanged. The golden Study test passed at every commit.

## 2. Checks per episode

Bot-only, 4 seats, Normal, mean ± SE (bootstrap over games). E checks are the gates; the rest are design targets.

**Episode 1, Born** (2,000 games, D-152)

| Check | Result | Status |
|---|---|---|
| E1 structure: no non-peeker sees an income before voting | unit test | pass |
| E1 peekers voting Free Market, top two incomes minus bottom two | +22.5 points ± 1.6 (0.0% / 1.6% / 6.4% / 38.1% at incomes 10 / 40 / 110 / 300) | pass |
| Lie success (a broken promise whose real vote won), 50% to 75% | 80%, but only 5 broken promises | fail |
| S-b, 55% to 80% | 100% | fail |
| F-d / F-e / F-f | 100% / 22 to 29% each / 17.3% | pass / pass / fail |

**Episode 2, First Hustle** (2,000 games, D-153)

| Check | Result | Status |
|---|---|---|
| E2 slope of mean effort on the tax rate (below 0) | -5.37 ± 0.08 hours per unit of tax | pass |
| E2 added: mean claimed minus true effort (above 0) | +0.13 ± 0.01 hours | pass |
| The prize does not flip the E2 slope | -5.44 with the prize and without it | pass |
| B.1 effort read from income alone (about 80% at most) | 65.6% ± 0.3 | pass |
| Lie success / S-a / S-b | 13.5% / 82.1% / 95.9% | fail / fail / fail |
| S-c / contested reads | 73.9% / 19.9% | fail / at the bound |
| F-d / F-e / F-f | 90.1% / 23 to 27% / 45.4% | pass |

**Episode 3, Bad Luck Season** (confirming run under the final rules, 500 games, seeds t9; the 2,000-game table is in D-149)

| Check | Result | Status |
|---|---|---|
| E3a high- / low-risk applicants, round 2 (at least 2) | 2.83 ± 0.20 | pass |
| E3b round-3 price over round 2 (at least +15%) | +24.1% ± 1.9 | pass |
| E3c bars that hit a high-risk player (at least 60%) | 67.6% ± 1.7 | pass |
| E3d price after the bar still above round 2 | +39.9% ± 3.5 | pass |
| S-e / lie success / S-a | 26.1% / 67.5% / 33.0% | pass |
| Bar recall (35% to 60%) / S-b (55% to 80%) | 31.3% / 82.6% | fail / fail (as in D-149) |
| F-d / F-e / F-f | 99.4% / 21 to 27% / 38.2% | pass |

**Episode 4, The Hiring Round** (2,000 games, bot judges read the meter only, D-151 and D-155)

| Check | Result | Status |
|---|---|---|
| E4a Circle minus Square gap positive (at least 70%) | 90.3% ± 0.6 | pass |
| E4b passing Squares hired complex in round 1, no Hiring Spree (at most 10%) | 0.0% (15.3% with Spree rounds) | pass |
| B.1 training read from the test alone (about 80% at most) | 75.4% ± 0.3 | pass |
| B.1 training read using the claim | 100% | fail |
| Lie success / S-a | n/a: bots never lie (a claim gains them nothing) | not measurable |
| S-b / contested hires (at least 20%) | 79.6% / 15.3% | pass / fail |
| F-e / F-f | 22 to 27% / 27.8% | pass / fail |

**Episode 5, Grand Finale** (2,000 games, D-154)

| Check | Result | Status |
|---|---|---|
| E5 slope of the fair-answer shift on wealth rank (below 0), **programmed** | -0.175 ± 0.003 | pass |
| Donations whose recipient voted no | 44.9% | reported |
| S-c a donation decided an amendment (20% to 50%) | 27.8% | pass |
| F-d / F-e / F-f | 100% / 22 to 28% / 0% | pass / pass / fail |

**A whole life** (1,000 lives, D-155; a 2,000-life run was killed by the container before it finished)

| Check | Result | Status |
|---|---|---|
| E1 / E2 / E2 added / E4a / E4b / E5 inside a life | +25.7 points / -5.80 / +0.44 h / 91.0% / 0.0% / -0.021 | all pass |
| F-a lead changes (at least 2) | 1.91 ± 0.06 | fail |
| F-b last after Episode 2 finishes top two (at least 20%) | 21.5% | pass |
| F-c top two within 15% (at least 40%) | 74.0% | pass |
| F-d big moment per episode (at least 90%) | 89.7% | fail (by 0.3 points) |
| F-e mission win shares (15% to 35%) | 24 / 27 / 25 / 24% | pass |
| F-f someone goes into debt (30% to 70%) | 0.1% | fail |
| A life at a realistic pace (at most 25 minutes) | 9.9 minutes (111 screens, 41 decisions) | pass |

## 3. What fails or was left out, and why

- **Bots rarely lie outside Episode 3.** In Episodes 1, 4 and 5 a claim earns a bot nothing in its own model, so it tells the truth. Lie success and S-b are degenerate there, and in Episode 4 the claim gives training away. A payoff for talk (other players reacting to claims) or a second hidden motive, as Episode 3's worry card, is needed.
- **Debt in a life almost never happens** (F-f 0.1%). Episode 3's stakes were tuned for a 10-coin start; a life starts at 100, and Episodes 1 and 2 pay well.
- **Episode 3** bar recall and S-b still miss, as before this run.
- **Episode 5's claim screen** reaches 45 words with four amendments (limit 40).
- **Left out:** the life's first fair answer in Episode 1 (both answers are asked in Episode 5); the party link and Play multiplayer (they need the room server); the multiplayer and versions e2e specs were not run (they need wrangler, which this run may not start). E3 is not re-measured inside a life.

## 4. Top 10 "Needs Amir" decisions

| # | Choice made | Alternative |
|---|---|---|
| 1 | Bot judges in Episode 4 read the meter only, as the spec says, so claims never pay for bots (D-155). | Let judges weigh claims; at 0.25 x record, E4b failed in a life (97% of passing Squares hired). |
| 2 | Episode 2's claim sits on the effort screen, before incomes: 8 decisions, not 11 (D-153). | Claim after the reveal, in the spec's order, at 11 decisions (limit 10). |
| 3 | Episode 2 hides the other players' luck dice until the end, so luck hides effort (D-153). | Show the dice, as the spec's reveal says; then incomes give effort away. |
| 4 | Episode 1 claims: Free Market = No Tax, Safety Net, Middle Way = Limit the Gap; Help the Poorest can be voted but not claimed (D-152). | Four claims, one per rule. |
| 5 | Episode 5 in a life: banks are the incomes and each bank becomes its after-rules amount; a debt stays (D-155). | Banks plus a separate deck income, or debt counted as negative income. |
| 6 | E4b is measured without Hiring Spree in round 1 (D-151). | Keep Hiring Spree out of round 1. |
| 7 | Mission scales per episode (`MISSION_SCALE_EP`) and per life (`MISSION_SCALE_LIFE`), calibrated by simulation (D-151, D-155). | One scale everywhere. |
| 8 | In the Receipts a lie "worked" when the liar's bank rose more than the table's median that episode (D-155). | Use each episode's own success test. |
| 9 | Episode 5's donation is that screen's gift; there is no separate 0 / 5 / 10 gift (D-154). | Add the gift too. |
| 10 | Share format: an emoji grid (open item 3, D-157). | A one-line text. |

Also decided: the comeback card comes before Episode 4 (bots always took the coins); Episode 4 picks the better schedule for the worker; the HireBot meter is shown on Easy and Normal and hidden on Hard (open item 2).

## 5. Human validation: NOT DONE

Gate 1 (the human playtest of Episode 3) and Gate 2 (the human playtest of a full life) are **still outstanding**. Nothing in this run shows whether people enjoy the game or replay it. The two AI playtests are proxies: an AI reading screenshots as a persona, not human evidence.

What to playtest first with people: **Episode 3 alone**, as Gate 1 requires, with 3 to 5 people who haven't seen the game, using the spec's Section 8.3 protocol (time to first decision, hesitations, laughs and accusations, whether they start another episode unasked, the six stranger-test questions, and "why did the price go up?"). Then one full life for Gate 2. Watch the Episode 4 judge screen (does the meter make the rational choice feel uncomfortable?), Episode 2's claim on the effort screen, and Episode 5's claim screen.

Challenge codes: Episode 3, `playtest-1` (4 seats, Normal; the walkthrough seed). A full life: `daily-2026-11-05`, or the Daily Life button on the day of the playtest.

## 6. Version

This report is committed on top of 1af85c2; the latest commit is `git log origin/autorun -1`. Rules hash 894cc6e5b5bdb823 (Play params 3da15ab376a0dc06; Study params 5ba140feb4eef1b7, unchanged). **Merging to `main` needs the room server redeployed first**, because the rules hash changed (D-75). That needs your approval and was not done.
