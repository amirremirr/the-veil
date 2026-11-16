# UI V3 progress

Branch `ui-v3`. Spec: `docs/UI_V3_SPEC.md`. One row per phase. Rules hash must stay `3bf67478ab66d810` through U4.

| Phase | Status | Rules hash | Gate | Notes |
|---|---|---|---|---|
| U1 stage and cast | DONE | 3bf67478ab66d810 (unchanged) | typecheck, build, 219 unit, 15 e2e (room specs excluded, as before), life walkthrough 375 and 360, Ep3 Hard: all pass, every screen fits | D-195. Shape-people cast, Dash drawn, podium stage, claim bubbles, Call it on bubbles, stamps on characters, staged peaks, five type sizes. JS 250.4 to 259.1 KB gzipped. |

## Needs Amir

- D-195: the cast shrinks to 58 or 46 px on dense decision screens to keep the no-scroll rule (spec says about 72 px).
- D-195: in multiplayer rooms other humans show the default hexagon (the chosen shape is not sent through the room server).
