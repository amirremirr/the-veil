# Implementation decisions

Choices made where the spec (v1.0) was silent, ambiguous, or needed a change to meet the balancing targets. Numbered for reference from code comments.

## Architecture and determinism

- **D-01 Reducer purity.** `reduce(state, action)` deep-clones the state with `structuredClone` and applies a mutating `step`. Invalid actions return the *same* state object and are not logged. The simulator and the counterfactual call `step` directly on their own state for speed.
- **D-02 Random streams.** mulberry32, seeded from a cyrb53 hash of `"<seed>|game"` and `"<seed>|bots"`. Every nature draw (incomes, luck, Life Events, test results, shuffles, tie-break coins) uses `game`. Every bot computation *and* every bot logit draw uses `bots`, so a human's choices never shift nature's draws. Flavor variants (newsletter headline, Life Event text, message phrasing) are hashed from the seed and consume no stream.
- **D-03 Blank seed.** The UI generates a readable random seed before dispatching `START_RUN`, so the reducer itself never needs `Math.random`.
- **D-04 Devtools.** In dev builds only, `window.__veil` (the store) and `window.__autoplay` (a scripted player) are exposed for e2e tests and manual QA. Production builds do not include them.

## Bots

- **D-05 Logit on certainty equivalents.** The spec applies the logit to expected utilities with `scale = max(1, max U - min U)`. Raw CRRA utilities at rho = 2.5 differ by about 1e-4 between options, which makes the scale 1 and the choice uniformly random. Bots therefore convert expected utility to a certainty equivalent in coins (`u^-1(EU) - 50`) and apply the spec's logit and scale to that. Risk attitudes are fully preserved.
- **D-06 Modeling others (Section 5.4).**
  - Level 1: exact. Each other voter's vote distribution is 0.5 x (risk-neutral Egoist favorite) + 0.5 x (favorite of each believed card), the human's uses beliefs only; open SUPPORT/OPPOSE messages shift it by the speaker's reliability. The bot then enumerates plurality outcomes (with coin-flip ties) for each of its own votes.
  - Levels 2 to 4: other players follow the risk-neutral selfish rule for their sampled private type (talent, risk type, or cost). In these levels a Values card barely changes a player's own private decision, so the card-belief branch is not modeled separately.
  - Level 5: pass probabilities assume each other delegate votes for the amendment with probability 0.85 if it raises their own wealth (0.15 if it lowers it, 0.5 if equal), plus the reciprocity bonus for a donation recipient.
- **D-07 Sincere evaluation of single-number votes.** For the Level 2 tax, Level 3 regime, Level 4 policy, and Level 5 veil submission, a bot values each option as if its own vote decided the outcome. With the median or plurality rules involved, this is the standard sincere-voting approximation.
- **D-08 Level 3 decisions are two binary logits.** Section 5.5 says the gym is a two-option logit. A bot first chooses buy vs. not buy (each valued at its best gym response), then gym vs. no gym given that choice. A joint four-option logit made insured bots use the gym (a dominated choice) so often that premiums fell and the market never unraveled.
- **D-09 Belief likelihoods** (Section 5.6) use lambda = 3, rho = 1, and 40 Monte Carlo draws (not 300) for speed. Actors' private information is marginalized by sampling. Belief probabilities have a floor of 0.01.
- **D-10 Messages.** Bots send 0, 1, or 2 messages with weights 0.2 / 0.55 / 0.25. Each message: 15% an ACCUSE (aimed at the player the bot most suspects of being an Egoist), 10% FLAVOR, otherwise honest with probability h. Honest: SUPPORT the intended option or PROMISE the intended action (70%), else CLAIM the true card. Dishonest: SUPPORT the second-best option, PROMISE an action it does not intend, or CLAIM a false card (Rawlsian, or Utilitarian if truly Rawlsian). CLAIM_VALUES moves the listener's belief toward the claimed card by 0.5 x reliability; ACCUSE by 0.25 x reliability.
- **D-11 Reliability** counts SUPPORT and PROMISE only (as specified). A claim is checked at the next decision step it refers to. Claims whose step never happens for that player (for example a promise to buy insurance after a mandate passes) are dropped, not counted.
- **D-12 Bot guesses** in the finale are the argmax of beliefs; ties go to the first card in Egoist, Rawlsian, Utilitarian, Meritocrat order.

## Scoring and balance (Section 11)

- **D-13 Metric scale (handicap).** With S = 0.5 W + 0.5 M, the Rawlsian metric (minimum wealth) is always at most a player's own wealth, so Rawlsians almost never won (0% in early simulations). Each card's metric is multiplied by a constant so its simulated average equals average wealth: Rawlsian 1.67, Meritocrat 1.22, Egoist and Utilitarian 1. Measured with `npx tsx sim/calibrate.ts`. `valuesMetric` is unchanged (so Test 6 is unaffected); `roundScore` applies the scale. The Values card screen states the scale.
- **D-14 Win-rate target interpretation.** The deck holds two Egoists, so Egoists hold 40% of seats in a 4-player game and would "win 40% of runs" even at perfect parity. The simulator reports win rate *per seat holding the card* (parity = 25% with four players) and the target is checked against that.
- **D-15 Level 2 parameters changed.** Leakage kappa 0.2 -> 0.1 and luck values {-10, 0, 10, 20, 40} -> {-20, 0, 10, 30, 60}. With the spec values the lower-median tax averaged 0.16, below the 0.2 to 0.5 target. Test 2 is unaffected (it holds at t = 0). In-game rules, formulas, and the Archives reflect the new values. Wider luck also strengthens the level's lesson.
- **D-16 Balance results** (`npm run sim -- --games 2000 --samples 300`, 4 bots, Normal):

  | Target | Result |
  |---|---|
  | No card wins > 35% or < 15% (per seat) | Egoist 31.5%, Rawlsian 21.4%, Utilitarian 21.8%, Meritocrat 18.9% |
  | L1: no principle > 60% of bot votes | P1 21.6%, P2 18.9%, P3 53.3%, P4 6.2% |
  | L2: mean t in 0.2 to 0.5 | 0.209 (close to the lower bound) |
  | L2: mean effort within 1 of e* | mean gap -0.01, mean absolute gap 0.22 |
  | L3: unravels by round 2 in 50 to 80% | 53.0% |
  | L3: regime vote unanimous in at most 30% | 11.3% |
  | L4: baseline gap positive in at least 80% | 97.0% |
  | L4: some policy reduces the gap | Quota (10.2) and Blind Hiring (7.6) vs. Status Quo (29.5) in rounds 4 and 5 |
  | L5: an amendment proposed in 90% | 100% |
  | L5: slope of shift on income rank negative | -0.21 (change in t per income-rank step) |

  Not verified: the 5 to 8 minute timing target needs human playtests.

## Rules details

- **D-17 Votes are public after each reveal** (Level 1 votes, Level 2 tax ballots, Level 3 referendum, Level 4 policy referendum, Level 5 veil submissions and amendment votes). Reliability checks and Bayesian updates need observable actions.
- **D-18 Hidden scores.** During play the UI shows everyone's wealth but only your own score, because a round score reveals the Values metric. All level scores appear at the level debrief, as the spec's scoreboard requires.
- **D-19 What is public in each level.** Level 2: income and wealth public; talent, effort, and luck private until the debrief. The Bonus Pot deliberately shows two citizens in full (Cappelen et al. spectator design). Level 3: insurance and gym choices and Life Events are public (status icons); risk types and effective risks private. Level 4: group, Care card, test result, HireBot's confidence, and job are public; costs are private; skill (investment) is revealed at the end of each round. Level 5: incomes are public once revealed.
- **D-20 Level 2 poll.** The target is the other citizen with the highest gross income. The truth is luck / gross income, clamped to [0, 1].
- **D-21 Level 2 Bonus Pot with 2 players.** There is only one bot, so the second citizen is a synthetic "Citizen #4471 (Archival)" with an unused talent card, best-response effort at the last tax, and a random luck draw. Bonus coins are shown in the reveal and never enter wealth or scores.
- **D-22 Level 3 market.** The next premium is set after each voluntary round from that round's buyers. If a mandate passes, the market is shelved. If the voluntary regime continues after the insurer exited, no insurance is offered. "Unravels by round 2" in the simulator means nobody bought in round 2 (including because the insurer had already left).
- **D-23 Level 4 details.** Investing makes a worker skilled with certainty. Blind Hiring computes the pooled prior when adopted and then updates only the pooled belief (the group beliefs stay frozen while HireBot cannot see shapes). Quota ties among equal confidence are broken by the game stream. The Meritocrat's effort is 1 if invested.
- **D-24 Level 4 counterfactual.** At the debrief the level is re-run from the RNG snapshot taken at level start, once per scenario (baseline, equal priors 0.45, equal Care odds 0.5, both). The human's logged decisions are replayed where they still apply; otherwise the human seat uses the risk-neutral rule. The same-seed baseline reproduces the actual game exactly. A second column averages 24 alternative histories (fresh seeds, 40 Monte Carlo draws per bot decision, no talk) because a single history with four citizens is noisy. Stereotype channel = baseline - equal priors; care channel = baseline - equal care; interaction = (baseline - both) - stereotype - care.
- **D-25 Level 5 details.** The phase list has one amendment-vote slot per delegate; empty slots are skipped. A bot proposes the sigma-weighted mix of its score-optimal and wealth-optimal constitutions (snapped to the grid) and passes if that equals the current constitution. Bot donations are a logit choice over (recipient, amount in {0, 5, 10, 20}). A delegate's revealed position is their proposal, or the constitution in force at lobbying time if they passed. Amendment votes use logit over the two scores, then the reciprocity bonus.
- **D-26 Level 5 bands** for SUPPORT messages: low taxes (t at most 0.2), moderate (0.3 to 0.5), high (at least 0.6). A SUPPORT is kept if the delegate's submission or proposal falls in the band.
- **D-27 Verdicts.** Consistent if the shift is at most 10 points. "Rich" means the top half by income rank. A shift of 20 points or more is "strong."
- **D-28 Talk menus.** Level 3: PROMISE (buy, gym) in round talks, SUPPORT (regimes) in the referendum talk. Level 4: SUPPORT and OPPOSE (policies) only in the policy talk; round talks offer CLAIM, ACCUSE, and FLAVOR.
- **D-29 Unlocks.** Reaching a level's debrief unlocks the next level, in either mode.

## Presentation

- **D-30 Newsletter placement.** The headline is shown in the round summary, right after the reveal, so it never spoils a card flip.
- **D-31 Accessibility.** Option cards are buttons with `aria-pressed` inside labelled groups (no radio semantics, since arrow-key roving focus is not implemented). Charts carry a text summary in `aria-label`. A polite live region announces phase changes and headlines. All color tokens pass WCAG AA (lowest pair 4.85:1). A Lighthouse run has not been done yet.
- **D-32 Sound.** The setting exists as specified; the game has no audio.
- **D-33 Bot voice banks** live in one file, `src/ui/copy/bots/voices.json`, keyed by bot, with at least three variants per message type per bot.
- **D-34 Archives citation added.** The Supermajority entry cites Buchanan and Tullock (1962), which is not in Section 13. Like every citation, it should be checked before release.
- **D-35 E2E browser.** Playwright uses its bundled Chromium by default; set `PW_CHANNEL=msedge` or `PW_CHANNEL=chrome` to use an installed browser.

## Language

- **D-36 Plain-language pass.** Playtesting showed the in-game text was too hard to follow. All player-facing text (`en.json`, news headlines, Life Event cards, the economist bot's lines) was rewritten in plain English: short sentences, everyday words, no form numbers in titles, no theory terms during play. The four Level 1 principles were renamed (No Tax, Safety Net, Limit the Gap, Help the Poorest), and Level 4's "Complex/Simple job" became "good job/basic job". Theory names and citations now appear only in the end-of-level summaries, the Glossary, and the "exact math" sections. The rules on each level's start screen are now a visible numbered list instead of a collapsed section. All string keys and placeholders are unchanged. The Glossary (`archives.json`) and the methods note for professors were deliberately left technical.

## Screen flow

- **D-37 Fewer screens, clearer layout (UI only).** A phone playtest (375 px) found 135 screens for 38 real decisions, layout that hid content, an unexplained score, and end-of-level summaries 3 to 4.5 phone screens long. Measured with `npm run walkthrough` (seed `playtest-1`, full run, 4 players, Normal): before 135 screens, 45 overlaps, tallest summary 3,422 px; after 66 screens, 0 overlaps, tallest summary 1,107 px, no horizontal scroll at 360 or 375 px. Game rules, payoffs, bots, RNG, and parameters are unchanged; all 25 unit tests pass and replays are identical.
  - **Flow lives in the UI** (`src/ui/flow.ts`). The engine phase list is unchanged. The store's `settle()` dispatches ADVANCE past briefings (shown as a one-line banner), past short results that lead into another decision (Level 2 tax, Level 3 referendum, Level 4 policy and HireBot assignment; shown as a result banner), and past the Level 5 constitution reveal (its content moved onto the income reveal, because the engine only shows incomes once that phase starts). `act()` performs what one tap means on a screen.
  - **Talk stays open behind the decision form.** The engine accepts messages only during TALK, and bots post on entering TALK and decide on entering DECIDE. So the decision form is shown while TALK is still open, with a "What others said" strip and a Reply sheet; pressing the decision button dispatches ADVANCE and then SUBMIT_DECISION. The action log has the same actions in the same order as before.
  - **Reveal and round summary are one screen**, with one Continue that dispatches both ADVANCEs. Level 2's luck survey sits on that results screen. Card flips start automatically.
  - **Only engine change:** `visibleState` now includes `queue` (the current level's phase list), so the UI can render the upcoming decision. It is public structure and touches no rules.
  - **Layout.** The floating chat button is gone ("Chat (n)" is in the top bar). On phones the main action bar is fixed to the bottom and publishes its height as `--bar-h`; `main` pads its bottom by that height plus 16 px. Level 3 choices are toggle cards with a drawn checkbox. Coins show as whole numbers; the score breakdown keeps up to two decimals so it adds up exactly. Level 1 results show one stamp and a "Tie, decided by a coin flip" line.
  - **Score breakdown.** Results show "Your score: S = half your money (W/2) + half your goal (S - W/2)" from the engine's own round score, with a one-line reminder of what the card cares about. The Egoist sees "half your money + half your money".
  - **Summaries.** First fold: the lesson (one sentence), a you vs. the theory row, the level scores, the main chart, and the buttons. Everything else is in one closed "Show details" section; Level 1's three per-round tables became one table with round tabs.
  - **Tips.** Three one-time tips in Level 1, Round 1, remembered in `the-veil:v1` (`tipsSeen`); "Show tips again" in Settings.
