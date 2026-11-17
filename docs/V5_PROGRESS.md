# V5 progress

Branch `v5` (from `ui-v4` at 254be45). Rules: RUNPLAN Section A (Study frozen, golden test at every commit, never merge, never deploy); choices in DECISIONS.md as [V5, review]. One row per phase.

Gate per phase: rules hash check, typecheck, build, unit tests (golden included), e2e (`PW_NO_ROOM=1`: the two room-server specs need wrangler, not used), life walkthrough at 375 and 360 x 760 and with first-time hints, Episode 3 Hard walkthrough, axe on every distinct Play screen of a life.

| Phase | Status | Rules hash | Gate | Notes |
|---|---|---|---|---|
| N1 remove missions | DONE (two targets missed) | 35f3c43191c5b77b (new; was b1b485fa65cf3b29) | typecheck, build, 223 unit (golden included), 20 e2e (new: no "mission" on any life screen, "You played like" with the fair-tax line), life walkthrough 375 and 360 and with hints, Ep3 Hard, axe 0 violations (64 screens); sims 1,000 lives | D-210. Score = bank (plus Second Chance points); bots keep fixed values traits; "You played like..." at the end. All E checks pass; F-a, F-b, F-d, F-f pass; F-e dropped. Missed: Ep4 leader loses the finale 13.3% (target 20%; was 15.7%), score gap 59.8% (target 40%; was 37.1%). Taps in a life 98 to 94. |
| N2 style B (Retro TV studio) | DONE | 35f3c43191c5b77b (unchanged) | typecheck, build, 223 unit, 18 e2e (style page test removed with the page), life walkthrough 375 and 360 and with hints, Ep3 Hard, axe 0 violations (64 screens), text under 16 px: 0 | D-211. Deep teal stage with studio glow and a static 4% grain, orange actions, Fredoka and Nunito, flat puppets with big eyes (6 expressions each, Dash's 4, the avatars), cream stamps; preview page removed. JS 267.4 KB gzipped. |
| N3 fewer taps, shorter results | DONE | 35f3c43191c5b77b (unchanged) | typecheck, build, 223 unit, 18 e2e (new: summary at most 50 words, Ep4 pay at most 45, no unfilled placeholders), life walkthrough 375 and 360 and with hints, Ep3 Hard, single episodes 1 to 5 with hints, axe 0 violations (54 screens), text under 16 px: 0, `v4-did-check` 56 blocks 0 mismatches | D-212. Round results carried to the next round's first screen; folded screens; taps 94 to 73 (72 to 75 over five seeds); summary 37 to 46 words; Ep4 pay 11 to 43 words; Ep2 formula only behind "See the money". JS 265.2 KB gzipped. |

## Needs Amir

- D-212: a life is at 72 to 75 taps over five seeds, so a long life (comeback, many events) can land at 75; the ranking bars left the summary (place only) to stay under 50 words.
- D-211: the negative coral is lighter than in the preview (#ffb0a0) to pass AA on cards; Play's smallest text is 16 px, so screens are denser.
- D-210: with no missions the finale keeps the order, so "Ep4 leader loses the finale" is 13.3% (target 20%) and the score gap share 59.8% (target 40%); life-level knobs could not reach them in six sweeps. A finale mechanic that reorders banks would be a rules change.
- D-210: "You played like..." maps choices to principles by fixed rules (a judgement); review the mapping.
- D-210: the Worrier card no longer costs the human anything (debt points are gone); it stays as a private trait that drives bots and colours claims.
