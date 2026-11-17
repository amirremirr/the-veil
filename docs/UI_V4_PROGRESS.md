# UI V4 progress

Branch `ui-v4`. Spec: `docs/UI_V4_SPEC.md`. One row per phase. Rules hash must stay `b1b485fa65cf3b29` through V4 (no file under `src/engine` or `src/shared/flow.ts` changes in V1 to V5).

Gate per phase: rules hash check, typecheck, build, unit tests (golden included), e2e (`PW_NO_ROOM=1`: the two room-server specs need wrangler, which this run does not use), life walkthrough at 375 and 360 x 760, Episode 3 Hard walkthrough, axe on every distinct Play screen of a life.

| Phase | Status | Rules hash | Gate | Notes |
|---|---|---|---|---|
| V1 no pop-ups | DONE | b1b485fa65cf3b29 (unchanged) | typecheck, build, 219 unit, 17 e2e (2 new no-overlay checks), life walkthrough 375 and 360, Ep3 Hard, axe 0 violations (64 screens): all pass | D-205. 9 kinds of overlay removed (3 coach marks, call confirm, Give sheet, money ledger, really sheet, score words sheet, opening card); 0 left besides the menu. Hints are lines in the screen, calls confirm inside the bubble, Give opens in place, panels replace the content area, Dash speaks from one slot under the cast. JS 264.0 KB gzipped. |

## Needs Amir

- D-205: Dash's slot shows up to two short text lines (his lines run to 15 words), not one; a longer line is cut with an ellipsis.
- D-205: the opt-in playtest survey (`?playtest=1`) stays a full-screen form; it is a research tool, not part of play.
