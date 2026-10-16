# The Veil

*A satirical simulator of justice, luck, and who pays for it.*

You are a newborn citizen of the Republic of Meritopia. Before you know who you will be, you help write the rules. Then you find out who you are, and you get to see whether you still like them.

Five levels turn results from political philosophy, public economics, and behavioral economics into play:

| Level | Question | Core theory |
|---|---|---|
| 1. Behind the Veil | Which distribution rule do you choose when you do not know your position? | Rawls; Harsanyi; Frohlich, Oppenheimer and Eavey |
| 2. Luck vs. Effort | How do beliefs about luck and effort shape support for redistribution? | Mirrlees; Meltzer and Richard; Alesina and Angeletos; Cappelen et al. |
| 3. Shocks and Insurance | Why do voluntary insurance markets unravel, and what does mandatory insurance cost? | Akerlof; Rothschild and Stiglitz; Arrow; Pauly |
| 4. The Labor Market | How can wage gaps arise with no prejudiced person in the room? | Phelps; Arrow; Coate and Loury; Goldin |
| 5. The Constitutional Convention | Do your principles survive learning your position? | Babcock and Loewenstein; Konow |

Each player secretly holds a Values card (Egoist, Rawlsian, Utilitarian, Meritocrat) that decides how they score. Nobody knows who believes what, and the final debrief shows how your stated principles moved once you learned your position.

Author: Amirreza Akhavan. Spec: Phase 1 (solo vs. bots, browser, English).

Play it: https://the-veil-mauve.vercel.app

## Quick start

Requires Node 18 or later (developed on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and build the static site into `dist/` |
| `npm run preview` | Serve the built site |
| `npm test` | Engine unit tests (Vitest), including every worked example in Section 12 of the spec |
| `npm run sim -- --games 2000` | Headless bot-only simulation; writes a CSV and a summary to `sim/out/` |
| `npm run e2e` | Playwright end-to-end tests at 360 px and desktop widths |

`npm run e2e` uses Playwright's bundled Chromium (install it once with `npx playwright install chromium`), or an installed browser via `PW_CHANNEL=msedge` or `PW_CHANNEL=chrome`.

Simulator flags: `--games`, `--players 2|3|4`, `--difficulty EASY|NORMAL|HARD`, `--samples` (Monte Carlo draws per bot decision, default 300), `--seed`, `--out`.

## Architecture

```
src/engine/   pure TypeScript game engine (no UI or browser dependencies)
  params.ts         every numeric constant
  engine.ts         the reducer: reduce(state, action) and visibleState(state, viewer)
  levels/level1-5   one LevelDefinition per level (phases, rules, bot policies, debrief data)
  bots/             CRRA utility, logit choice, Bayesian beliefs, messaging
  counterfactual.ts Level 4 decomposition by re-simulation
src/ui/       React 18 + Zustand + Tailwind + Framer Motion
  copy/en.json      every user-facing string (bot voices, newsletter, Archives in sibling files)
sim/          headless simulator and calibration tools
tests/        Vitest engine tests and Playwright e2e tests
```

- The engine state is one serializable object. The UI only dispatches actions and renders `visibleState(state, 'you')`, which strips other players' Values cards, private information, scores, and secret decisions. This is what makes a later server-authoritative multiplayer version a drop-in change.
- Two named random streams (`game` for every outcome, `bots` for all bot reasoning) live inside the state, so a seed plus the action log replays a game exactly. The seed is shown on every debrief, and the run debrief exports the full log as JSON.
- Saved games and settings use `localStorage` key `the-veil:v1`, wrapped so the game still works when storage is unavailable.

## Methods note for professors

**Bots.** Each bot is a boundedly rational maximizer of its own hidden Values objective, using a logit quantal response rule (McKelvey and Palfrey 1995). For each available action it computes the expected CRRA utility of its round score, by exact enumeration where small (Level 1 and Level 5 income draws) and otherwise by Monte Carlo with 300 draws from a separate random stream, so bot thinking never changes game outcomes. Expected utility is converted to a certainty equivalent in coins, and the bot chooses with probability proportional to `exp(lambda x CE / scale)`, `scale = max(1, max CE - min CE)`. Risk aversion `rho` and precision `lambda` differ by personality (Chet 0.5 and 3; Marigold 2.5 and 2; Ugo 1.0 and 6; Dot 1.5 and 4), and difficulty scales lambda and honesty.

**Others and beliefs.** Bots use level-1 reasoning about others: other bots act as risk-neutral Egoists with probability 0.5 and otherwise according to the bot's belief about their Values card. Beliefs start at the deck frequencies and are updated by Bayes' rule after every public vote, using the likelihood that each card would have chosen that action (logit, lambda = 3, rho = 1). Messages shift beliefs and vote predictions in proportion to the speaker's track record of keeping promises and stated support (Laplace-smoothed reliability).

**Scoring.** Round score is half own wealth plus half the card's metric. The Rawlsian and Meritocrat metrics are rescaled by constants calibrated in simulation so that no card wins by arithmetic alone (see DECISIONS.md D-13).

**Benchmarks.** Every debrief compares the player to a rational benchmark computed by the engine: the expected-income-maximizing principle (Level 1), the selfish effort best response and the median selfish tax (Level 2), risk-neutral insurance and gym choices and expected wealth by type under each regime (Level 3), the return to investment given HireBot's beliefs plus a counterfactual decomposition of the group gap (Level 4), and the slope of the self-serving shift on income rank (Level 5).

**Balance.** In 2,000 bot-only full runs with 300 Monte Carlo draws per decision, every balancing target in Section 11 of the spec is met. The results table is in DECISIONS.md (D-16).

**Caveats.** Bots are models, not people, and the lab-evidence column states only qualitative findings. Citations follow the spec's reference list; per Section 13 of the spec, each should be checked against the source before release.

## Status

| Milestone | State |
|---|---|
| M1 to M6: engine, five levels, bots, messaging, beliefs, finale, all UI | Done. All 25 unit tests and 6 e2e tests pass. |
| M7: simulation balancing | Done. All Section 11 targets met (DECISIONS.md D-16). Level 2 parameters changed (D-15). |
| M8: visual design, copy, Archives, accessibility | Done, except a Lighthouse audit, which has not been run. Contrast checked by calculation; no horizontal scroll at 360 px in any phase. |
| M9: deploy | Live on Vercel at https://the-veil-mauve.vercel.app. Pushes to `main` deploy automatically. Not yet checked on iOS Safari, Android Chrome, or Firefox. |

Open items for the author: the final name, the hosting location, and whether to add opt-in result sharing in Phase 2. The About screen will link to the source repository once there is one.
