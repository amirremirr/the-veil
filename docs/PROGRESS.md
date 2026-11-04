# AUTORUN progress

Run mode: all tasks T0 to T9 in one session (owner's instruction for this run), started 2026-11-05 01:21 Istanbul time.

| Task | Status | Commits | Notes |
|---|---|---|---|
| T0 smoke | DONE | (this commit) | SMOKE OK: golden test 19/19 passed, no prompts |
| T1 AI playtest Ep3 | DONE | see log | AI playtest (proxy, not human evidence); 4 copy fixes (D-150) |
| T2 Episode 4 | | | |
| T3 Episode 1 | | | |
| T4 Episode 2 | | | |
| T5 Episode 5 | | | |
| T6 LIFE, Receipts, result card | | | |
| T7 AI playtest life, polish | | | |
| T8 Retention (conditional) | | | |
| T9 Report | | | |

## Needs Amir

- D-150: e2e runs here without the multiplayer and versions specs (they need wrangler, which this run must not start). Run the full e2e with the room server before merging.

## Stashes and wip branches

None.

## Log

- T0: SMOKE OK. `git status` clean except an untracked `.claude/launch.json` (left alone, not committed). Golden test passed (19 tests).
- T1: AI playtest (proxy, not human evidence) of Episode 3 as Skimmer, Careful, Bluffer: `docs/playtest/ai-ep3.md`, screenshots in `docs/playtest/shots/`. Fixed 4 copy problems (D-150). Gate: typecheck, build, 183 unit tests, e2e 14 passed (no room-server specs), walkthrough Ep3 4 seats Normal: 28 screens, 9 decisions, 1,465 words, every screen 760 px, no hscroll. Sim 500 games (seed t1, engine unchanged): E3a 2.76 ± 0.21, E3b +24.3% ± 1.9, E3c 64.5% ± 1.7, E3d +33.8% ± 3.4, lie success 69.6% ± 2.0, F-f 35.4% ± 2.2, all gating pass; bar recall 31.1% and S-b 82.9% still fail as reported in D-149.
- Environment note: node_modules was missing; installed with `npm ci`. Playwright 1.50 needs `PW_EXECUTABLE=/opt/pw-browsers/chromium` here.
