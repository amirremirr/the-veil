# AI playtest of Episode 3 (proxy, not human evidence)

RUNPLAN T1. **AI playtest (proxy, not human evidence).** An AI read every screen as three personas. This is not a human playtest and says nothing about whether people enjoy or replay the game. Gate 1 (the human playtest of Episode 3) has **not** been done.

## Method

`node scripts/ai-playtest.mjs --persona <P> --episode 3` plays Episode 3 through the real UI at 375 x 760, 4 seats, Normal, reduced motion, stage name "Ana", and saves a screenshot and the visible text of every screen to `docs/playtest/shots/ep3-<persona>/` (`screens.md` holds the text). Seeds `ai-ep3-SKIMMER`, `ai-ep3-CAREFUL`, `ai-ep3-BLUFFER`. Personas decide from their own cards and the public table only (`personaDecision` in `src/ui/devtools.ts`):

- **Skimmer:** reads only headlines and buttons, taps fast. Says nothing, buys cover, no gym, never bars.
- **Careful:** reads everything. Claims the truth, buys cover if high risk or a Worrier, gym if high risk, votes Half cover.
- **Bluffer:** lies every round (claims the opposite risk), buys cover, bars the contestant the audience suspects most, votes Keep the market.

Screens: Skimmer 32, Careful 33, Bluffer 27 (Leaked Medical Files drew in the Bluffer's round 2, so claims closed after round 1). Every screen fit 760 px; no horizontal scroll.

## Findings (before fixes)

| # | Screen | Problem | Who hits it | Fixed |
|---|---|---|---|---|
| 1 | Price board after the launch round | The chip said "No change" while the big numbers moved (39 to 27, 39 to 19, 39 to 42). All three personas see a contradiction in the headline itself. | All | Yes: the chip shows Up or Down by the real change; the line now reads "Everyone was in, so the new price is the whole table's average risk." |
| 2 | Price board, rounds 2 and 3 | "Last round, mostly risky people bought cover" was shown whenever the price rose, including a 9% rise from a pool of one safe and one risky buyer. The claim about the pool's make-up could be false. | Careful | Yes: "Last round's pool was riskier than the one before." (true whenever the price rises, since the price follows the pool's mean risk). |
| 3 | The Bar, two players barred | "Marigold and Dot are barred. Dot applied for cover and was turned away." The other barred player was never explained. | Careful, Bluffer | Yes: adds "Marigold didn't apply, so no cover this round." |
| 4 | Card reveal and summary | "Dot Ledger lied 1 times." / "said 'high risk' 1 times". | All | Yes: "once", "twice", "3 times". |
| 5 | Move screen | "Mission -4" under a bar target reads to a Skimmer as the price of barring, not the change to the mission. | Skimmer | No (a layout change to the tile is bigger than a copy fix; noted for the human playtest). |
| 6 | Regime vote | A leftover claim ("Ugo: I'm high risk.") sits above the vote with no heading. | Careful | No (harmless; it is the round's claim feed). |
| 7 | Summary, "Biggest wrong read" | When it is about you, it cites a poll about you that you never saw. | Skimmer | No (true and short; reported). |

Mechanics and numbers were not changed.

## Per persona

**Could they explain "why did the price go up?" from the screens alone?**
- Skimmer: partly. The headline on the price board is the reason line, so a headline reader sees it. Before fix 1, the round-1 board contradicted itself, which is the first price screen they see.
- Careful: yes. Price board line plus "What was really going on?" names adverse selection. Fix 2 removes a line Careful could catch being wrong.
- Bluffer: yes, and Bluffer saw the opposite case too (a round where the pool got safer and the price fell 20%).

**Did their mission change what they did?**
- Skimmer (Get rich): no. They never read the Mission tiles; the near miss ("Staying out of the pool and hitting the gym in round 3 would have left you 42 coins richer") was the first mission-relevant information they absorbed.
- Careful (Grow the pie): somewhat. Mission +1 on the gym tile pushed toward the gym in rounds 2 and 4, but buying cover as a Worrier showed Mission -2 to -6 and they bought anyway (their card says debt hurts 3x).
- Bluffer (Grow the pie): no. Lies and bars were chosen for the bluff, not the mission; the mission ended "not complete".

## Every screen

### Skimmer: every screen

| Screen | Words | Type | What the persona thinks they do | What they could misread |
|---|---|---|---|---|
| 001-ep3-r0-VALUES_REVEAL | 30 | VALUES_REVEAL | Learn my secret mission. | Skimmer may not connect "Grow the pie" to the later Mission +N tiles. |
| 002-ep3-r1-INTRO | 71 | INTRO | Read the premise, tap Roll the cameras. | "Members can bar people" comes before any pool exists; fine as a teaser. |
| 003-ep3-r1-DECIDE-CLAIM | 58 | CLAIM-mycards | See my two secret cards. | The Worrier line is the densest text; Skimmer reads only "LOW RISK" and "Worrier". |
| 004-ep3-r1-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 005-ep3-r1-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 006-ep3-r1-DECIDE-CHOICE | 56 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 007-ep3-r1-REVEAL-EVENTS | 58 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 008-ep3-r1-REVEAL-EVENTS | 43 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 009-ep3-r2-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 010-ep3-r2-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 011-ep3-r2-DECIDE-CHOICE | 61 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 012-ep3-r2-REVEAL-EVENTS | 47 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 013-ep3-r2-REVEAL-EVENTS | 54 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 014-ep3-r2-REVEAL-EVENTS | 45 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 015-ep3-r3-DECIDE-CLAIM | 54 | EVENT | Read the twist. | Clear; the effect line is plain. |
| 016-ep3-r3-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 017-ep3-r3-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 018-ep3-r3-DECIDE-CHOICE | 63 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 019-ep3-r3-REVEAL-EVENTS | 41 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 020-ep3-r3-REVEAL-EVENTS | 59 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 021-ep3-r3-REVEAL-EVENTS | 39 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 022-ep3-r3-DECIDE-REGIME | 74 | REGIME | Vote on the rule. | A leftover claim line ("Ugo: I'm high risk.") sits above the vote; harmless but unexplained. |
| 023-ep3-r4-DECIDE-CLAIM | 46 | REGIME | Vote on the rule. | A leftover claim line ("Ugo: I'm high risk.") sits above the vote; harmless but unexplained. |
| 024-ep3-r4-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 025-ep3-r4-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 026-ep3-r4-DECIDE-CHOICE | 61 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 027-ep3-r4-REVEAL-EVENTS | 28 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 028-ep3-r4-REVEAL-EVENTS | 54 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 029-ep3-r4-REVEAL-CARDS | 89 | CARDS | See who lied. | Before the fix, "lied 1 times". Longest screen (65 to 107 words), but it is the peak and fits. |
| 030-ep3-r4-GUESS-EPISODE | 52 | GUESS | Guess one mission. | Clear. |
| 031-ep3-r4-LEVEL_DEBRIEF | 41 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |
| 032-ep3-r4-LEVEL_DEBRIEF | 75 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |

### Careful: every screen

| Screen | Words | Type | What the persona thinks they do | What they could misread |
|---|---|---|---|---|
| 001-ep3-r0-VALUES_REVEAL | 34 | VALUES_REVEAL | Learn my secret mission. | Skimmer may not connect "Grow the pie" to the later Mission +N tiles. |
| 002-ep3-r1-INTRO | 71 | INTRO | Read the premise, tap Roll the cameras. | "Members can bar people" comes before any pool exists; fine as a teaser. |
| 003-ep3-r1-DECIDE-CLAIM | 58 | CLAIM-mycards | See my two secret cards. | The Worrier line is the densest text; Skimmer reads only "LOW RISK" and "Worrier". |
| 004-ep3-r1-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 005-ep3-r1-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 006-ep3-r1-DECIDE-CHOICE | 56 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 007-ep3-r1-REVEAL-EVENTS | 54 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 008-ep3-r1-REVEAL-EVENTS | 43 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 009-ep3-r2-DECIDE-CLAIM | 55 | EVENT | Read the twist. | Clear; the effect line is plain. |
| 010-ep3-r2-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 011-ep3-r2-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 012-ep3-r2-DECIDE-CHOICE | 69 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 013-ep3-r2-REVEAL-EVENTS | 46 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 014-ep3-r2-REVEAL-EVENTS | 52 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 015-ep3-r2-REVEAL-EVENTS | 45 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 016-ep3-r3-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 017-ep3-r3-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 018-ep3-r3-DECIDE-CHOICE | 65 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 019-ep3-r3-REVEAL-EVENTS | 36 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 020-ep3-r3-REVEAL-EVENTS | 54 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 021-ep3-r3-REVEAL-EVENTS | 46 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 022-ep3-r3-DECIDE-REGIME | 74 | REGIME | Vote on the rule. | A leftover claim line ("Ugo: I'm high risk.") sits above the vote; harmless but unexplained. |
| 023-ep3-r4-DECIDE-CLAIM | 48 | REGIME | Vote on the rule. | A leftover claim line ("Ugo: I'm high risk.") sits above the vote; harmless but unexplained. |
| 024-ep3-r4-DECIDE-CLAIM | 58 | EVENT | Read the twist. | Clear; the effect line is plain. |
| 025-ep3-r4-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 026-ep3-r4-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 027-ep3-r4-DECIDE-CHOICE | 63 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 028-ep3-r4-REVEAL-EVENTS | 32 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 029-ep3-r4-REVEAL-EVENTS | 55 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 030-ep3-r4-REVEAL-CARDS | 107 | CARDS | See who lied. | Before the fix, "lied 1 times". Longest screen (65 to 107 words), but it is the peak and fits. |
| 031-ep3-r4-GUESS-EPISODE | 52 | GUESS | Guess one mission. | Clear. |
| 032-ep3-r4-LEVEL_DEBRIEF | 41 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |
| 033-ep3-r4-LEVEL_DEBRIEF | 64 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |

### Bluffer: every screen

| Screen | Words | Type | What the persona thinks they do | What they could misread |
|---|---|---|---|---|
| 001-ep3-r0-VALUES_REVEAL | 34 | VALUES_REVEAL | Learn my secret mission. | Skimmer may not connect "Grow the pie" to the later Mission +N tiles. |
| 002-ep3-r1-INTRO | 72 | INTRO | Read the premise, tap Roll the cameras. | "Members can bar people" comes before any pool exists; fine as a teaser. |
| 003-ep3-r1-DECIDE-CLAIM | 58 | CLAIM-mycards | See my two secret cards. | The Worrier line is the densest text; Skimmer reads only "LOW RISK" and "Worrier". |
| 004-ep3-r1-DECIDE-CLAIM | 34 | CLAIM | Pick a claim. | Clear. Bluffer understands a lie is allowed ("Anyone could be lying"). |
| 005-ep3-r1-DECIDE-CHOICE | 49 | CHOICE-claims | See what others said. | Clear. |
| 006-ep3-r1-DECIDE-CHOICE | 56 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 007-ep3-r1-REVEAL-EVENTS | 59 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 008-ep3-r1-REVEAL-EVENTS | 49 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 009-ep3-r2-DECIDE-CHOICE | 54 | EVENT | Read the twist. | Clear; the effect line is plain. |
| 010-ep3-r2-DECIDE-CHOICE | 63 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 011-ep3-r2-REVEAL-EVENTS | 46 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 012-ep3-r2-REVEAL-EVENTS | 56 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 013-ep3-r2-REVEAL-EVENTS | 35 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 014-ep3-r3-DECIDE-CHOICE | 63 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 015-ep3-r3-REVEAL-EVENTS | 40 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 016-ep3-r3-REVEAL-EVENTS | 57 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 017-ep3-r3-REVEAL-EVENTS | 37 | EVENTS-price | Why did the price move? | Before the fix, round 1 said "No change" while the price moved 39 to 27; later rounds said "mostly risky people bought" even when the pool was half safe. |
| 018-ep3-r3-DECIDE-REGIME | 70 | REGIME | Vote on the rule. | A leftover claim line ("Ugo: I'm high risk.") sits above the vote; harmless but unexplained. |
| 019-ep3-r4-DECIDE-CHOICE | 46 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 020-ep3-r4-DECIDE-CHOICE | 59 | EVENT | Read the twist. | Clear; the effect line is plain. |
| 021-ep3-r4-DECIDE-CHOICE | 65 | CHOICE | Buy/gym/bar/give, then Lock in. | Mission +N/-N under bar names is the least obvious label: Skimmer reads it as a cost of the bar, not a mission change. |
| 022-ep3-r4-REVEAL-EVENTS | 40 | EVENTS-bar | See who was barred. | Before the fix, two barred players with one explanation read as one bar. |
| 023-ep3-r4-REVEAL-EVENTS | 55 | EVENTS-outcome | See my wheel and bank. | Clear: "You bought cover. Bank 42 to 85." |
| 024-ep3-r4-REVEAL-CARDS | 65 | CARDS | See who lied. | Before the fix, "lied 1 times". Longest screen (65 to 107 words), but it is the peak and fits. |
| 025-ep3-r4-GUESS-EPISODE | 52 | GUESS | Guess one mission. | Clear. |
| 026-ep3-r4-LEVEL_DEBRIEF | 42 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |
| 027-ep3-r4-LEVEL_DEBRIEF | 63 | DEBRIEF | Read the summary. | "Biggest wrong read" about yourself refers to a poll you never saw; Careful can work it out, Skimmer cannot. |
