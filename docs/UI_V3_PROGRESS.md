# UI V3 progress

Branch `ui-v3`. Spec: `docs/UI_V3_SPEC.md`. One row per phase. Rules hash must stay `3bf67478ab66d810` through U4.

| Phase | Status | Rules hash | Gate | Notes |
|---|---|---|---|---|
| U1 stage and cast | DONE | 3bf67478ab66d810 (unchanged) | typecheck, build, 219 unit, 15 e2e (room specs excluded, as before), life walkthrough 375 and 360, Ep3 Hard: all pass, every screen fits | D-195. Shape-people cast, Dash drawn, podium stage, claim bubbles, Call it on bubbles, stamps on characters, staged peaks, five type sizes. JS 250.4 to 259.1 KB gzipped. |
| U2 sound, motion, feedback | DONE | 3bf67478ab66d810 (unchanged) | typecheck, build, 219 unit, 15 e2e, life walkthrough 375 and 360, Ep3 Hard: all pass | D-196. Synthesized sound with mute, haptics, coin flights, counting banks, wheel ticks, rolling price, hit/gain flashes, staged Receipts, capture script. JS 260.5 KB gzipped. |
| U3 fewer taps, clearer words | DONE | 3bf67478ab66d810 (unchanged) | typecheck, build, 219 unit, 15 e2e, life walkthrough 375 and 360, Ep3 Hard, axe 0 violations (64 screens): all pass | D-197. Auto-advance, event banner, mission + intro, one summary, one opening card + coach marks, whole coins, HireBot headline, score bar, judge cards, desktop column. Taps in a life 110 to 71 (-35%), pace 9.7 to 8.0 min. JS 262.5 KB gzipped. |
| U4 review loop | DONE (stopped at 3 cycles) | 3bf67478ab66d810 (unchanged) | after each cycle: 219 unit, 15 e2e (now with raw-key and stamp-width checks), life walkthrough 375 and 360, Ep3 Hard, axe 0 violations | D-198 to D-200, `docs/review/ui-v3-review.md`. Two fresh AI reviewers per cycle (proxy, not human evidence). The owner's seven points fixed; stopped after 3 cycles for budget, with high items still open (money arithmetic in small print, empty space on reveals). JS 263.4 KB gzipped. |

## Needs Amir

- D-200: the review loop stopped after 3 cycles (spec: two clean cycles or 6); the cycle 3 fixes were not re-reviewed.

- D-197: "your card" stays its own beat in Episodes 2 to 5 (the engine deals after the intro); merging needs an engine change.
- D-197: auto-advance holds 1.2 s after the animation, as specified; beats with 40 or more words may be too fast for slow readers (a tap is never needed, but there is no pause).

- D-196: sound is on by default (after the first tap) with a mute button; alternative: off by default.

- D-195: the cast shrinks to 58 or 46 px on dense decision screens to keep the no-scroll rule (spec says about 72 px).
- D-195: in multiplayer rooms other humans show the default hexagon (the chosen shape is not sent through the room server).
