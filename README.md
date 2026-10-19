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
src/shared/   screen flow used by the solo store and the room server
src/ui/       React 18 + Zustand + Tailwind + Framer Motion
  copy/en.json      every user-facing string (bot voices, newsletter, Archives in sibling files)
server/       Cloudflare Worker and Durable Object for multiplayer rooms
sim/          headless simulator and calibration tools
tests/        Vitest engine tests and Playwright e2e tests
```

- The engine state is one serializable object. The UI only dispatches actions and renders `visibleState(state, 'you')`, which strips other players' Values cards, private information, scores, and secret decisions. The multiplayer room server renders the same view for each seat (see below).
- Two named random streams (`game` for every outcome, `bots` for all bot reasoning) live inside the state, so a seed plus the action log replays a game exactly. The seed is shown on every debrief, and the run debrief exports the full log as JSON.
- Saved games and settings use `localStorage` key `the-veil:v1`, wrapped so the game still works when storage is unavailable.

## Multiplayer: how it works and how to run it locally

Two to four people can play in a private room; the computer fills any empty seats. Solo play is unchanged: it runs entirely in the browser, offline, with no server.

**How it works.**

- The website stays on Vercel. Rooms run on Cloudflare Workers (`server/`), with one Durable Object per room (SQLite-backed, which the free plan supports).
- The room's Durable Object is the only place the full game state exists. Players send actions and receive only their own view, `visibleState(state, theirSeat)`: never another player's card, private information, pending decision, or the seed. The server sets who an action is from; a client cannot name a seat.
- Both solo play and the server use the same engine and the same screen rules (`src/shared/flow.ts`), so a room plays exactly like solo play. With several humans, a choice made while the talk is open is "locked in" and the talk stays open until everyone has chosen. Results screens move on when everyone presses Ready.
- Timers: 60 seconds for each decision, 30 seconds for results screens, 90 seconds for summaries. If time runs out, the computer chooses for that player with the bots' own reasoning, from a private random stream, so the game stays exactly replayable. A player who drops out and misses two decisions in a row is played by the computer until they come back. A seat token in the browser lets a player rejoin the same seat.
- A room stores its settings, seats and the action log, never the whole state; it rebuilds the state by replaying the log. Its storage is deleted 24 hours after the last move. There are no accounts and no tracking.
- Details and measurements: [DECISIONS.md](DECISIONS.md), D-62 to D-71.

**Run it locally.** Two terminals:

```bash
npm --prefix server install
```

```bash
npm --prefix server run dev
```

```bash
npm run dev
```

The room server listens on http://127.0.0.1:8787, and in development the site connects to it by default. Open http://localhost:5173, choose **Play with friends**, create a room, and open the invite link in a second browser profile or a private window (two tabs in the same browser profile share one seat token, so the second tab would take over the first seat).

| Command | What it does |
|---|---|
| `npm --prefix server run dev` | Local room server (`wrangler dev`, no Cloudflare account needed) |
| `npm --prefix server run typecheck` | Typecheck the Worker |
| `npm --prefix server run loadtest -- --humans 4` | Scripted clients play a full game against a local server started with `npx wrangler dev --var DEV:1`, and report message times and stored size |
| `npm --prefix server run deploy` | Deploy the Worker (after `npx wrangler login`) |

`npm run e2e` starts both servers itself and runs a three-player test.

**Configuration.** The site reads the room server's address from `VITE_ROOM_SERVER_URL` at build time; without it, the "Play with friends" button is hidden in production builds. The Worker accepts requests only from the origins listed in `ALLOWED_ORIGINS` in `server/wrangler.toml` (the production site, this project's Vercel previews, and localhost).

## Methods

**Scoring.** Each round, a player's score is S = 0.5 x (W - H) + 0.5 x k x M. W is the player's own money, H is the hardship penalty, M is the metric on the player's secret Values card, and k is that card's balancing scale. The four metrics are: Egoist, own money minus hardship; Rawlsian, the poorest player's money; Utilitarian, the average player's money; Meritocrat, average money reduced by how far each player's share of money departs from their share of effort. k is 1.66 for the Rawlsian, 1.27 for the Meritocrat and 1 for the others, set in simulation so that each card's average metric matches average wealth. The hardship line is 40 coins: each coin below it costs 2 more points, weighted like own money. It makes self-interested players risk averse, because a coin lost below the line counts about twice as much as a coin gained, close to the loss aversion of about 2 found in experiments (Tversky and Kahneman 1992).

**Bots.** Bots choose by logit quantal response (McKelvey and Palfrey 1995) over certainty equivalents in coins. The chance of choosing an option is proportional to exp(lambda x CE / 10) (a fixed 10-coin scale). With lambda = 2, a bot makes a 10-coin mistake about 12% of the time and a 30-coin mistake almost never. Each bot has CRRA risk aversion, scaled down by a factor of 4 because the hardship line already supplies curvature. Expected values are computed by exact enumeration where the outcomes are few (Levels 1, 3 and 5) and by Monte Carlo from a separate random stream otherwise, so bot reasoning never changes game outcomes. Bots reason one level deep about others and hold Bayesian beliefs over other players' Values cards, updated after every public vote and by messages weighted by the speaker's record.

**Measurement.** Paid choices measure strategy. Unpaid questions about what is fair measure values. In Level 5, the self-serving shift is measured on the unpaid answers given before and after incomes are revealed, following Babcock and Loewenstein's (1997) distinction between pursuing your interest and sincerely believing that what helps you is fair.

**Level points.** Each level is standardized: points = 100 + 50 x (score - table average) / level spread. Each level's spread is the typical within-table standard deviation of scores, measured by simulation.

**Reproducibility.** Every game replays exactly from its seed and action log. `npm run sim` checks the balance targets on thousands of bot-only games. [DECISIONS.md](DECISIONS.md) records every design decision and parameter change.

**Known limits.** Bots are not humans, and balance is measured only on bot-only tables. The game demonstrates mechanisms. It does not estimate real-world magnitudes.

## Status

| Milestone | State |
|---|---|
| M1 to M6: engine, five levels, bots, messaging, beliefs, finale, all UI | Done. All 25 unit tests and 6 e2e tests pass. |
| M7: simulation balancing | Done. All Section 11 targets met (DECISIONS.md D-16). Level 2 parameters changed (D-15). |
| M8: visual design, copy, Archives, accessibility | Done, except a Lighthouse audit, which has not been run. Contrast checked by calculation; no horizontal scroll at 360 px in any phase. |
| M9: deploy | Live on Vercel at https://the-veil-mauve.vercel.app. Pushes to `main` deploy automatically. Not yet checked on iOS Safari, Android Chrome, or Firefox. |
| Multiplayer | On the `multiplayer` branch, not merged. Room server deployed with Wrangler 3 (3.114.17; version 4 is available) at https://the-veil-rooms.theveilgame.workers.dev. Vercel builds read it from `VITE_ROOM_SERVER_URL` (production and preview). 81 unit tests and 9 e2e tests pass, including a three-player test. |

Open items for the author: the final name, the hosting location, and whether to add opt-in result sharing in Phase 2. The About screen will link to the source repository once there is one.
