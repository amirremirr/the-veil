# AI playtest of a full life (proxy, not human evidence)

RUNPLAN T7. **AI playtest (proxy, not human evidence).** An AI read every screen of a whole Play life as two personas. This is not a human playtest. Gate 2 (the human playtest of a full life) has **not** been done, and nothing here shows whether people enjoy or replay the game.

## Method

`node scripts/ai-playtest.mjs --persona SKIMMER|CAREFUL --mode LIFE` plays a life (Episodes 1 to 5, then the Receipts and the result card) through the UI at 375 x 760, 4 seats, Normal, reduced motion, name "Ana", seeds `ai-life-SKIMMER` and `ai-life-CAREFUL`. Screenshots (JPEG) and the visible text of every screen are in `docs/playtest/shots/life-<persona>/`. Skimmer: first option everywhere, says nothing, takes the coins. Careful: claims the truth, trains if a Circle, votes the middle options, takes the points.

Screens: Skimmer 111, Careful 108. Every screen fit 760 px, no horizontal scroll.

## Findings (before fixes)

| # | Screen | Problem | Who | Fixed |
|---|---|---|---|---|
| 1 | Episode 5 in a life: intro, finale card, veil, first fair question | Said incomes come from a deck and that you don't know your income, while your bank is your income and public all life. | Both | Yes: life versions of the four lines ("This time your incomes are your banks. Everyone can see them."). |
| 2 | Missions beat after each episode in a life | Showed a score of 0 for everyone and could announce "You won the episode!" from that, because cards stay hidden until the end. | Both | Yes: in a life it shows the public ranking without scores, headed "The ranking so far" and "Leading the life: Chet". |
| 3 | Episode 4 belief board | "A worker is hired complex when the meter reaches 50%" after a Hiring Spree round read as next round's rule. | Careful | Yes: "This round, HireBot hired from 50%." |
| 4 | Episode 2 and 5 summaries | "overclaimed effort 1 times". | Careful | Yes: once / twice / N times. |
| 5 | Result card | "Lied 0 of 11 times. Caught 0." | Careful | Yes: "Told the truth 11 of 11 times." |
| 6 | Episode 4 train screen under blind hiring | 71 words (limit 65). | Both | Yes: shorter blind-hiring line. |
| 7 | Episode 3 regime vote | 70 to 74 words with the round's last claim above the vote (also T1 finding 6). | Careful | Yes: the stray claim line removed, option lines shortened. |
| 8 | Episode 5 claim screen | 45 words with four amendments (limit 40). | Both | Partly: names moved into button labels; still 45 at four amendments (reported, D-154). |
| 9 | Reveal screens (Episode 2 hours and dice, Episode 5 ballots) | 120 to 130 words. Not under a word limit (B.8 limits claim and move screens), but dense for a Skimmer. | Skimmer | No (reported). |

## Per persona

**Skimmer:** gets through every episode on headlines and buttons. The episode headlines carry the mechanism in Episodes 3 and 4 (price board, belief board). In Episodes 1, 2 and 5 the mechanism lives in the peak reveal, which is the longest screen, so a Skimmer likely misses it. The near miss on each summary is the one mission-relevant line a Skimmer reads.

**Careful:** can explain each episode's mechanism from the screens: the price board (Episode 3), the belief board and the end line (Episode 4), the peekers' votes next to incomes (Episode 1), hours and dice at the end (Episode 2), the fair-answer shift on the ballots screen (Episode 5). Mission tiles changed Careful's choices in Episodes 3 and 4 (gym, training), not in Episode 5 (the constitution chips show the preview only for the selected rule).

## Accessibility (automated, T7)

`node scripts/a11y.mjs` runs axe (wcag2a, wcag2aa) on every distinct screen of a life (74 screens). Before fixes: `listitem` (the Hustle Prize list had a group role) and `aria-prohibited-attr` (a label on a plain span in the Episode 5 claims). After fixes: 0 violations, including color contrast. Keyboard: Tab through the result card screen, every focused control shows the focus ring. Reduced motion: the Receipts become a static list. Results in `docs/playtest/a11y.json`.

## Every screen (words)

### Skimmer

| Screen | Words |
|---|---|
| 001-ep1-r0-VALUES_REVEAL | 30 |
| 002-ep1-r1-INTRO | 72 |
| 003-ep1-r1-DECIDE-CLAIM | 57 |
| 004-ep1-r1-DECIDE-CLAIM | 56 |
| 005-ep1-r1-DECIDE-CLAIM | 37 |
| 006-ep1-r1-DECIDE-VOTE | 49 |
| 007-ep1-r1-DECIDE-VOTE | 56 |
| 008-ep1-r1-REVEAL-VOTE | 39 |
| 009-ep1-r1-REVEAL-VOTE | 53 |
| 010-ep1-r2-DECIDE-PEEK | 51 |
| 011-ep1-r2-DECIDE-PEEK | 49 |
| 012-ep1-r2-DECIDE-CLAIM | 37 |
| 013-ep1-r2-DECIDE-VOTE | 49 |
| 014-ep1-r2-DECIDE-VOTE | 59 |
| 015-ep1-r2-REVEAL-VOTE | 41 |
| 016-ep1-r2-REVEAL-VOTE | 56 |
| 017-ep1-r2-REVEAL-CARDS | 88 |
| 018-ep1-r2-GUESS-EPISODE | 52 |
| 019-ep1-r2-LEVEL_DEBRIEF | 32 |
| 020-ep1-r2-LEVEL_DEBRIEF | 45 |
| 021-ep2-r1-INTRO | 69 |
| 022-ep2-r1-DECIDE-TAX | 56 |
| 023-ep2-r1-DECIDE-TAX | 55 |
| 024-ep2-r1-DECIDE-EFFORT | 50 |
| 025-ep2-r1-REVEAL-INCOME | 57 |
| 026-ep2-r1-DECIDE-PRIZE | 49 |
| 027-ep2-r1-REVEAL-PRIZE | 40 |
| 028-ep2-r2-DECIDE-EFFORT | 50 |
| 029-ep2-r2-DECIDE-EFFORT | 50 |
| 030-ep2-r2-REVEAL-INCOME | 65 |
| 031-ep2-r2-DECIDE-PRIZE | 49 |
| 032-ep2-r2-REVEAL-PRIZE | 40 |
| 033-ep2-r3-DECIDE-EFFORT | 46 |
| 034-ep2-r3-DECIDE-EFFORT | 50 |
| 035-ep2-r3-REVEAL-INCOME | 65 |
| 036-ep2-r3-DECIDE-PRIZE | 49 |
| 037-ep2-r3-REVEAL-PRIZE | 41 |
| 038-ep2-r3-REVEAL-CARDS | 127 |
| 039-ep2-r3-GUESS-EPISODE | 52 |
| 040-ep2-r3-LEVEL_DEBRIEF | 34 |
| 041-ep2-r3-LEVEL_DEBRIEF | 45 |
| 042-ep3-r1-INTRO | 73 |
| 043-ep3-r1-DECIDE-CLAIM | 58 |
| 044-ep3-r1-DECIDE-CLAIM | 54 |
| 045-ep3-r1-DECIDE-CLAIM | 34 |
| 046-ep3-r1-DECIDE-CHOICE | 49 |
| 047-ep3-r1-DECIDE-CHOICE | 56 |
| 048-ep3-r1-REVEAL-EVENTS | 59 |
| 049-ep3-r1-REVEAL-EVENTS | 47 |
| 050-ep3-r2-DECIDE-CLAIM | 34 |
| 051-ep3-r2-DECIDE-CHOICE | 49 |
| 052-ep3-r2-DECIDE-CHOICE | 61 |
| 053-ep3-r2-REVEAL-EVENTS | 46 |
| 054-ep3-r2-REVEAL-EVENTS | 58 |
| 055-ep3-r2-REVEAL-EVENTS | 53 |
| 056-ep3-r3-DECIDE-CLAIM | 34 |
| 057-ep3-r3-DECIDE-CHOICE | 49 |
| 058-ep3-r3-DECIDE-CHOICE | 61 |
| 059-ep3-r3-REVEAL-EVENTS | 39 |
| 060-ep3-r3-REVEAL-EVENTS | 66 |
| 061-ep3-r3-REVEAL-EVENTS | 43 |
| 062-ep3-r3-DECIDE-REGIME | 74 |
| 063-ep3-r4-DECIDE-CHOICE | 49 |
| 064-ep3-r4-DECIDE-CHOICE | 62 |
| 065-ep3-r4-DECIDE-CHOICE | 50 |
| 066-ep3-r4-REVEAL-EVENTS | 58 |
| 067-ep3-r4-REVEAL-CARDS | 72 |
| 068-ep3-r4-GUESS-EPISODE | 52 |
| 069-ep3-r4-LEVEL_DEBRIEF | 33 |
| 070-ep3-r4-LEVEL_DEBRIEF | 56 |
| 071-ep4-r1-INTRO | 70 |
| 072-ep4-r1-DECIDE-HIRE | 46 |
| 073-ep4-r1-DECIDE-HIRE | 63 |
| 074-ep4-r1-REVEAL-PAY | 54 |
| 075-ep4-r1-REVEAL-PAY | 41 |
| 076-ep4-r2-DECIDE-TRAIN | 57 |
| 077-ep4-r2-DECIDE-CLAIM | 40 |
| 078-ep4-r2-REVEAL-PAY | 53 |
| 079-ep4-r2-REVEAL-PAY | 42 |
| 080-ep4-r2-DECIDE-POLICY | 63 |
| 081-ep4-r3-DECIDE-TRAIN | 71 |
| 082-ep4-r3-DECIDE-TRAIN | 49 |
| 083-ep4-r3-DECIDE-TRAIN | 57 |
| 084-ep4-r3-DECIDE-CLAIM | 40 |
| 085-ep4-r3-REVEAL-PAY | 55 |
| 086-ep4-r3-REVEAL-PAY | 42 |
| 087-ep4-r4-DECIDE-TRAIN | 57 |
| 088-ep4-r4-DECIDE-CLAIM | 40 |
| 089-ep4-r4-REVEAL-PAY | 53 |
| 090-ep4-r4-REVEAL-PAY | 41 |
| 091-ep4-r4-REVEAL-CARDS | 111 |
| 092-ep4-r4-GUESS-EPISODE | 52 |
| 093-ep4-r4-LEVEL_DEBRIEF | 34 |
| 094-ep4-r4-LEVEL_DEBRIEF | 44 |
| 095-ep5-r1-INTRO | 70 |
| 096-ep5-r1-DECIDE-VEIL | 55 |
| 097-ep5-r1-DECIDE-VEIL | 52 |
| 098-ep5-r1-DECIDE-VEIL | 48 |
| 099-ep5-r1-DECIDE-FAIR_1 | 40 |
| 100-ep5-r1-REVEAL-INCOMES | 47 |
| 101-ep5-r1-DECIDE-FAIR_2 | 38 |
| 102-ep5-r1-DECIDE-LOBBY | 47 |
| 103-ep5-r1-DECIDE-CLAIM | 33 |
| 104-ep5-r1-DECIDE-AMEND_0 | 47 |
| 105-ep5-r1-DECIDE-AMEND_1 | 47 |
| 106-ep5-r1-REVEAL-AMENDMENTS | 89 |
| 107-ep5-r1-GUESS-EPISODE | 52 |
| 108-ep5-r1-LEVEL_DEBRIEF | 34 |
| 109-ep5-r1-LEVEL_DEBRIEF | 39 |
| 110-ep5-r1-RUN_DEBRIEF | 34 |
| 111-ep5-r1-RUN_DEBRIEF | 46 |

### Careful

| Screen | Words |
|---|---|
| 001-ep1-r0-VALUES_REVEAL | 34 |
| 002-ep1-r1-INTRO | 73 |
| 003-ep1-r1-DECIDE-CLAIM | 57 |
| 004-ep1-r1-DECIDE-CLAIM | 50 |
| 005-ep1-r1-DECIDE-CLAIM | 37 |
| 006-ep1-r1-DECIDE-VOTE | 49 |
| 007-ep1-r1-DECIDE-VOTE | 54 |
| 008-ep1-r1-REVEAL-VOTE | 39 |
| 009-ep1-r1-REVEAL-VOTE | 53 |
| 010-ep1-r2-DECIDE-PEEK | 49 |
| 011-ep1-r2-DECIDE-CLAIM | 39 |
| 012-ep1-r2-DECIDE-VOTE | 49 |
| 013-ep1-r2-DECIDE-VOTE | 61 |
| 014-ep1-r2-REVEAL-VOTE | 41 |
| 015-ep1-r2-REVEAL-VOTE | 56 |
| 016-ep1-r2-REVEAL-CARDS | 90 |
| 017-ep1-r2-GUESS-EPISODE | 52 |
| 018-ep1-r2-LEVEL_DEBRIEF | 35 |
| 019-ep1-r2-LEVEL_DEBRIEF | 45 |
| 020-ep2-r1-INTRO | 68 |
| 021-ep2-r1-DECIDE-TAX | 56 |
| 022-ep2-r1-DECIDE-TAX | 58 |
| 023-ep2-r1-DECIDE-TAX | 57 |
| 024-ep2-r1-DECIDE-EFFORT | 50 |
| 025-ep2-r1-REVEAL-INCOME | 57 |
| 026-ep2-r1-DECIDE-PRIZE | 55 |
| 027-ep2-r1-REVEAL-PRIZE | 43 |
| 028-ep2-r2-DECIDE-EFFORT | 50 |
| 029-ep2-r2-REVEAL-INCOME | 58 |
| 030-ep2-r2-DECIDE-PRIZE | 56 |
| 031-ep2-r2-REVEAL-PRIZE | 40 |
| 032-ep2-r3-DECIDE-EFFORT | 51 |
| 033-ep2-r3-DECIDE-EFFORT | 50 |
| 034-ep2-r3-REVEAL-INCOME | 57 |
| 035-ep2-r3-DECIDE-PRIZE | 55 |
| 036-ep2-r3-REVEAL-PRIZE | 41 |
| 037-ep2-r3-REVEAL-CARDS | 122 |
| 038-ep2-r3-GUESS-EPISODE | 52 |
| 039-ep2-r3-LEVEL_DEBRIEF | 35 |
| 040-ep2-r3-LEVEL_DEBRIEF | 48 |
| 041-ep3-r1-INTRO | 71 |
| 042-ep3-r1-DECIDE-CLAIM | 58 |
| 043-ep3-r1-DECIDE-CLAIM | 55 |
| 044-ep3-r1-DECIDE-CLAIM | 34 |
| 045-ep3-r1-DECIDE-CHOICE | 49 |
| 046-ep3-r1-DECIDE-CHOICE | 56 |
| 047-ep3-r1-REVEAL-EVENTS | 65 |
| 048-ep3-r1-REVEAL-EVENTS | 49 |
| 049-ep3-r2-DECIDE-CLAIM | 34 |
| 050-ep3-r2-DECIDE-CHOICE | 49 |
| 051-ep3-r2-DECIDE-CHOICE | 65 |
| 052-ep3-r2-REVEAL-EVENTS | 45 |
| 053-ep3-r2-REVEAL-EVENTS | 62 |
| 054-ep3-r2-REVEAL-EVENTS | 42 |
| 055-ep3-r3-DECIDE-CHOICE | 43 |
| 056-ep3-r3-REVEAL-EVENTS | 63 |
| 057-ep3-r3-DECIDE-REGIME | 70 |
| 058-ep3-r4-DECIDE-CHOICE | 50 |
| 059-ep3-r4-DECIDE-CHOICE | 50 |
| 060-ep3-r4-REVEAL-EVENTS | 61 |
| 061-ep3-r4-REVEAL-CARDS | 74 |
| 062-ep3-r4-GUESS-EPISODE | 52 |
| 063-ep3-r4-LEVEL_DEBRIEF | 34 |
| 064-ep3-r4-LEVEL_DEBRIEF | 60 |
| 065-ep4-r1-INTRO | 71 |
| 066-ep4-r1-DECIDE-HIRE | 52 |
| 067-ep4-r1-DECIDE-HIRE | 55 |
| 068-ep4-r1-DECIDE-HIRE | 65 |
| 069-ep4-r1-REVEAL-PAY | 50 |
| 070-ep4-r1-REVEAL-PAY | 41 |
| 071-ep4-r2-DECIDE-TRAIN | 57 |
| 072-ep4-r2-DECIDE-CLAIM | 41 |
| 073-ep4-r2-REVEAL-PAY | 55 |
| 074-ep4-r2-REVEAL-PAY | 42 |
| 075-ep4-r2-DECIDE-POLICY | 63 |
| 076-ep4-r3-DECIDE-TRAIN | 48 |
| 077-ep4-r3-DECIDE-TRAIN | 55 |
| 078-ep4-r3-DECIDE-TRAIN | 61 |
| 079-ep4-r3-DECIDE-CLAIM | 41 |
| 080-ep4-r3-REVEAL-PAY | 53 |
| 081-ep4-r3-REVEAL-PAY | 38 |
| 082-ep4-r4-DECIDE-TRAIN | 61 |
| 083-ep4-r4-DECIDE-CLAIM | 41 |
| 084-ep4-r4-REVEAL-PAY | 55 |
| 085-ep4-r4-REVEAL-PAY | 38 |
| 086-ep4-r4-REVEAL-CARDS | 112 |
| 087-ep4-r4-GUESS-EPISODE | 52 |
| 088-ep4-r4-LEVEL_DEBRIEF | 33 |
| 089-ep4-r4-LEVEL_DEBRIEF | 44 |
| 090-ep5-r1-INTRO | 69 |
| 091-ep5-r1-DECIDE-VEIL | 55 |
| 092-ep5-r1-DECIDE-VEIL | 53 |
| 093-ep5-r1-DECIDE-VEIL | 48 |
| 094-ep5-r1-DECIDE-FAIR_1 | 40 |
| 095-ep5-r1-REVEAL-INCOMES | 47 |
| 096-ep5-r1-DECIDE-FAIR_2 | 38 |
| 097-ep5-r1-DECIDE-LOBBY | 47 |
| 098-ep5-r1-DECIDE-CLAIM | 45 |
| 099-ep5-r1-DECIDE-AMEND_0 | 47 |
| 100-ep5-r1-DECIDE-AMEND_1 | 47 |
| 101-ep5-r1-DECIDE-AMEND_2 | 47 |
| 102-ep5-r1-DECIDE-AMEND_3 | 47 |
| 103-ep5-r1-REVEAL-AMENDMENTS | 130 |
| 104-ep5-r1-GUESS-EPISODE | 52 |
| 105-ep5-r1-LEVEL_DEBRIEF | 34 |
| 106-ep5-r1-LEVEL_DEBRIEF | 42 |
| 107-ep5-r1-RUN_DEBRIEF | 76 |
| 108-ep5-r1-RUN_DEBRIEF | 53 |
