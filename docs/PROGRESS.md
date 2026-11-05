# AUTORUN progress

Run mode: all tasks T0 to T9 in one session (owner's instruction for this run), started 2026-11-05 01:21 Istanbul time.

| Task | Status | Commits | Notes |
|---|---|---|---|
| T0 smoke | DONE | (this commit) | SMOKE OK: golden test 19/19 passed, no prompts |
| T1 AI playtest Ep3 | DONE | see log | AI playtest (proxy, not human evidence); 4 copy fixes (D-150) |
| T2 Episode 4 | DONE | see log | E4 passes; claims give training away (B.1), lie metrics off (D-151) |
| T3 Episode 1 | DONE | see log | E1 passes; bots never lie about votes (D-152) |
| T4 Episode 2 | DONE | see log | E2 and added check pass; lie metrics off (D-153) |
| T5 Episode 5 | DONE | see log | E5 passes (programmed); claim screen 45 words (D-154) |
| T6 LIFE, Receipts, result card | DONE | see log | all E checks pass in a life; F-f 0.1% (D-155) |
| T7 AI playtest life, polish | DONE | see log | AI playtest (proxy); 7 clarity fixes; axe 0 violations (D-156) |
| T8 Retention (conditional) | DONE | see log | Daily Life, share grid, 12 achievements, rival line; party link and multiplayer skipped (D-157) |
| T9 Report | DONE | see log | docs/AUTORUN_REPORT.md, README Status updated |

## Needs Amir

- D-150: e2e runs here without the multiplayer and versions specs (they need wrangler, which this run must not start). Run the full e2e with the room server before merging.

- D-151: Episode 4 claims reveal training (98.9% with the claim) and bots lie almost only when sure to win (S-a 90%, lie success 36%). Needs a second motive or a different claim rule; choice made: report, not invent.
- D-151: E4b is measured without Hiring Spree in round 1 (15% with it). Alternative: keep Spree out of round 1.
- D-151: F-f (someone in debt) 28% at 4 seats, 12% at 2 seats in Episode 4; not tuned.

- D-152: Episode 1 bots keep claimed votes (0.03% broken), so lie success and S-b are degenerate. A claim would need a payoff (for example, others' votes reacting to it) for bots to lie. F-f 17% at 4 seats.
- D-152: the life's first fair-tax answer is deferred to LIFE mode (T6).

- D-153: Episode 2 claim moved onto the effort screen (decision budget) and luck dice hidden until the end. Alternatives: claim after the reveal (11 decisions), or show dice (luck no longer hides effort).
- D-153: Episode 2 lie success 13.5%, S-a 82%: lies are rare but nearly always taken when they pay, and seldom win.

- D-154: Episode 5 claim screen can reach 45 words with 4 amendments (limit 40). Alternative: one claim per amendment on its vote screen (adds no decisions, but claims then come one at a time).
- D-154: Episode 5 donations replace the 0/5/10 gift on that screen.

- D-155: in a life nobody goes into debt (F-f 0.1%): Episode 3's stakes were tuned for a 10-coin start. Needs a life-level tuning of LIVING_COST or the Episode 3 loss.
- D-155: bot judges now read only the meter (spec). Claims then never pay, so Episode 4 has no bot lies.
- D-155: the first fair answer is asked in Episode 5, not Episode 1 (v1).

- D-157: party link and Play multiplayer not built (they need the room server redeployed).

## Stashes and wip branches

None.

## Log

- T0: SMOKE OK. `git status` clean except an untracked `.claude/launch.json` (left alone, not committed). Golden test passed (19 tests).
- T1: AI playtest (proxy, not human evidence) of Episode 3 as Skimmer, Careful, Bluffer: `docs/playtest/ai-ep3.md`, screenshots in `docs/playtest/shots/`. Fixed 4 copy problems (D-150). Gate: typecheck, build, 183 unit tests, e2e 14 passed (no room-server specs), walkthrough Ep3 4 seats Normal: 28 screens, 9 decisions, 1,465 words, every screen 760 px, no hscroll. Sim 500 games (seed t1, engine unchanged): E3a 2.76 ± 0.21, E3b +24.3% ± 1.9, E3c 64.5% ± 1.7, E3d +33.8% ± 3.4, lie success 69.6% ± 2.0, F-f 35.4% ± 2.2, all gating pass; bar recall 31.1% and S-b 82.9% still fail as reported in D-149.
- Environment note: node_modules was missing; installed with `npm ci`. Playwright 1.50 needs `PW_EXECUTABLE=/opt/pw-browsers/chromium` here.
- T2: Episode 4 built (engine `src/engine/play/ep4.ts`, UI `src/ui/play/Episode4.tsx`, sim `sim/episodes.ts` + `sim/metrics.ts`, tests `tests/engine/play-ep4.test.ts`). Gate: typecheck, build, unit tests (188), e2e 14 passed (no room-server specs), walkthrough Ep4 4 seats Normal 25 screens / 9 decisions / every screen 760 px, 2 seats Hard 26 screens. Sim table in D-151 (2,000 games): E4a 89.7% ± 0.6, E4b 0.0%.
- T3: Episode 1 built (engine `src/engine/play/ep1.ts`, UI `src/ui/play/Episode1.tsx`, tests `tests/engine/play-ep1.test.ts`). Gate: typecheck, build, 191 unit tests, e2e 14 passed, walkthrough Ep1 4 seats Normal 19 screens / 6 decisions / 760 px, 2 seats Hard 18 screens. E1 +22.5 points ± 1.6 (D-152).
- T4: Episode 2 built (`src/engine/play/ep2.ts`, `src/ui/play/Episode2.tsx`, `tests/engine/play-ep2.test.ts`). Gate: typecheck, build, 193 unit tests, e2e 14 passed, walkthroughs 4 seats Normal and 2 seats Hard, every screen 760 px. E2 slope -5.37 ± 0.08 (D-153). Session restarted once mid-task; work was intact.
- T5: Episode 5 built (`src/engine/play/ep5.ts`, `src/ui/play/Episode5.tsx`, `tests/engine/play-ep5.test.ts`). Gate: typecheck, build, 195 unit tests, e2e 14 passed, walkthroughs 4 seats Normal (16 screens, 8 decisions) and 2 seats Hard, every screen 760 px. E5 -0.175 ± 0.003 (D-154).
- T6: LIFE mode (engine, menu, comeback card, per-episode near-miss snapshot), the Receipts, result card v2 (`src/ui/play/LifeEnd.tsx`, `tests/engine/play-life.test.ts`). Gate: typecheck, build, 198 unit tests, e2e 14 passed, life walkthrough 111 screens all 760 px, 9.9 min at pace. Life sim 1,000 lives: every E check passes (D-155). Two worker restarts during T6; no work lost.
- T7: AI playtest (proxy, not human evidence) of a full life: `docs/playtest/ai-life.md`. Fixes in D-156. axe on 74 screens: 0 violations. Gate: typecheck, build, 198 unit tests, e2e 14 passed, life walkthrough 111 screens, all 760 px, 9.9 min at pace.
- T8: Daily Life, share text, achievements, rival line (`src/ui/play/retention.ts`, `tests/engine/play-retention.test.ts`, `tests/e2e/life.spec.ts`). Gate: typecheck, build, 200 unit tests, e2e 15 passed, Daily Life walkthrough 110 screens all 760 px. Party link and Play multiplayer skipped: need the room server.
- T9: final report `docs/AUTORUN_REPORT.md`; README Status table updated. Episode 3 confirming run under the final rules (500 games): every gate passes. Human validation (Gates 1 and 2) NOT DONE. Merging to `main` needs the room server redeployed first.

ALL DONE

## Round 2

| Task | Status | Notes |
|---|---|---|
| R1 Ep5 donations follow promises | DONE | S-a 24%, lie success 41%, took-and-voted-no 24% of games, E5 passes (D-158) |
| R2 Ep4 judges read claims | DONE | E4a/E4b pass, S-a 43%, lie success 35%; read with claim 99.5% and contested 13% fail (D-159) |
| R3 LIFE stakes | DONE | F-f 48.5%; E3a-d pass in a life; F-a 1.89, F-b 18%, F-d 88% fail (D-160) |
| R4 First fair answer | DONE | asked before birth in Episode 1 of a life; E5 passes (D-161) |
| R5 Ep2 lying | DONE | S-a 82% to 54% (target 50%); E2 checks pass; lie success 14% (D-162) |
| R6 Ep1 claims as polls | DONE | S-a 22%, lie success 72%, E1 +52.6 points; S-b 84% (D-163) |
| E1 Fresh eyes | DONE | two AI reviewers (proxy), verbatim in docs/playtest/fresh-eyes.md |
| E2 Design audit | DONE | docs/review/design-audit.md (AI judgment, proxy) |
| E3 Logic audit | | |
| E4 UX audit | | |
| E5 Fixes | | |
| F1 Playtest kit | | |
| F2 Case study | | |
| R7 Report | | |

### Round 2 log

- R1: Episode 5 reordered (proposal with the second fair answer, claims, then donations); donors fund yes-claimers; Episode 5 walkthrough 15 screens, all 760 px, claim screen 35 words; 200 unit tests, e2e passed (D-158).
- R2: Bayes reading of claims in Episode 4, weight 0.25, credibility value 25; 200 unit tests, e2e 15 passed, Episode 4 walkthrough every screen 760 px (D-159).
- R3: life start 10, living cost 45, Episode 3 loss 220 in a life; 200 unit tests, e2e 15 passed, life walkthrough 111 screens all 760 px (D-160).
- R4: first fair answer in Episode 1 (LIFE), Episode 5 asks only the second in a life; 201 unit tests, e2e 15 passed, life walkthrough all 760 px (D-161).
- R5: Episode 2 credibility value 17; 201 unit tests, e2e passed (D-162).
- R6: Episode 1 claims pay through strategic votes; credibility value 0.5; 201 unit tests, e2e 15 passed, Episode 1 walkthrough all 760 px (D-163). Also committed: `sim/audit.ts` (for E3) and a first draft of `docs/CASE_STUDY.md` (for F2).
- E1: full life (107 screens) and Episode 3 Hard (26) captured; Reviewer A (designer) and Reviewer B (casual) saved verbatim. Both: the bank math and the ranking are never explained; A: the Mission and odds labels do the thinking; B: wanted to stop at the HireBot screen and the finale claims.
- E2: design audit; weakest: Ep3 on Normal (no wheel hits), Ep4 judge screen, Ep5 claims and donations, the unexplained score.
