# UI V4 progress

Branch `ui-v4`. Spec: `docs/UI_V4_SPEC.md`. One row per phase. Rules hash must stay `b1b485fa65cf3b29` through V4 (no file under `src/engine` or `src/shared/flow.ts` changes in V1 to V5).

Gate per phase: rules hash check, typecheck, build, unit tests (golden included), e2e (`PW_NO_ROOM=1`: the two room-server specs need wrangler, which this run does not use), life walkthrough at 375 and 360 x 760, Episode 3 Hard walkthrough, axe on every distinct Play screen of a life.

| Phase | Status | Rules hash | Gate | Notes |
|---|---|---|---|---|
| V1 no pop-ups | DONE | b1b485fa65cf3b29 (unchanged) | typecheck, build, 219 unit, 17 e2e (2 new no-overlay checks), life walkthrough 375 and 360, Ep3 Hard, axe 0 violations (64 screens): all pass | D-205. 9 kinds of overlay removed (3 coach marks, call confirm, Give sheet, money ledger, really sheet, score words sheet, opening card); 0 left besides the menu. Hints are lines in the screen, calls confirm inside the bubble, Give opens in place, panels replace the content area, Dash speaks from one slot under the cast. JS 264.0 KB gzipped. |
| V2 simpler game | DONE | b1b485fa65cf3b29 (unchanged) | typecheck, build, 219 unit, 17 e2e (life checks verb unlocks and every episode's card), life walkthrough 375, 360 and with hints, Ep3 Hard, single episodes 1 to 5 with hints, axe 0 violations (66 screens): all pass | D-206. Verbs unlock in a life (Ep1 vote and peek, claims Ep2, Call it Ep3, Give Ep4); one question per decision screen (Ep3 bar vote and Ep2 claim on their own screens, gym and Give as optional rows, event card its own beat); decision screens max 65 to 44 words, mean 44.1 to 29.0, over 45: 22 to 0; "How this episode works" card with a picture, also in the menu. Taps 71 to 69, pace 9.6 min. JS 266.3 KB gzipped. |
| V3 cause and effect | DONE | b1b485fa65cf3b29 (unchanged) | typecheck, build, 219 unit, 17 e2e (life now checks every "What your choices did" adds up), life walkthrough 375, 360 and with hints, Ep3 Hard, axe 0 violations (66 screens), `v4-did-check` 4 lives 0 mismatches: all pass | D-207. Tiles in coins, mission effect as a word, "What your choices did" on every round result (choices, luck, others, pay and living; adds up to the coin), score pieces flying into the bar, "helped most / hurt most" line, rank bar race (unknown scores in a life shown as "?"). |
| V4 pacing and sound | DONE | b1b485fa65cf3b29 (unchanged) | typecheck, build, 223 unit (4 new UI tests), 18 e2e (new: long screens never move on by themselves), life walkthrough 375, 360 and with hints, Ep3 Hard, axe 0 violations (66 screens): all pass | D-208. Auto-advance only at 8 words or fewer (none today), a touch holds it; reveals 1.5 s per item, 6 s at most, tap to skip; win jingle and loss "wah-wah" scaled by size, a tick for no change, caught and catching sounds. Taps in a life 69 to 98; pace 9.2 min. |
| V5 three style directions | DONE (preview only) | b1b485fa65cf3b29 (unchanged) | typecheck, build, 223 unit, 20 e2e (new style page check), life walkthrough 375, 360 and with hints, Ep3 Hard, axe 0 violations (66 game screens; 6 preview frames and the overview) | D-209. `?styles=1`: A Paper puppets, B Retro TV studio, C Clean editorial; same two screens each; captures in `docs/review/styles/`. Nothing applied to the game. Main JS 272.0 KB gzipped; the preview is a separate 5.9 KB chunk plus fonts. |

## Needs Amir

- D-205: Dash's slot shows up to two short text lines (his lines run to 15 words), not one; a longer line is cut with an ellipsis.
- D-209: choose a style direction (A, B or C) from `docs/review/styles/` or `?styles=1`; none is applied.
- D-208: with auto-advance limited to 8 words, no screen moves on by itself and a life takes 98 taps (was 69); shortening beats or merging them would bring taps down.
- D-208: the new sounds have not been listened to by a person.
- D-207: in a life the rank race can only size the bars of the players next to you (other scores are secret until the end); the rest show "?".
- D-206: hiding claims, Call it and Give in a life's early episodes changes what the human can do there (bots unchanged, so the E checks don't apply and were not re-run).
- D-206: the episode card adds a fourth short "New:" line in a life to name the verb that unlocks.
- D-205: the opt-in playtest survey (`?playtest=1`) stays a full-screen form; it is a research tool, not part of play.
