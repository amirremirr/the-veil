# Fix list (RUNPLAN E5)

Merged from the fresh-eyes reviews (E1), the design audit (E2), the logic audit (E3) and the UX audit (E4); **AI judgment, a proxy.** Ranked by impact on fun and clarity divided by effort. Status after E5.

| # | Problem (source) | Fix | Effort | Status |
|---|---|---|---|---|
| 1 | Bank changes never explained; "after the rule 61" but bank 10 to 26 (A, B, E2) | Every round result shows "Your bank 10 to 26: +61 this round, then -45 living costs." (Episode 3: "Living costs: -45.") | S | Done |
| 2 | The ranking uses an unexplained score; "Mission complete" yet last; "beat you by 55" with a lower bank (A, B, E2) | The summary shows "Your score 62 = half your bank 13 + half your mission 49, minus debt 0, plus guesses 0. The ranking uses this score." | S | Done |
| 3 | Life summary "Your bank: 10 to 60" ignored the episode's real start (A, B) | The summary uses the bank at the episode's start | S | Done (bug) |
| 4 | Episode 4's last round button said "Round 5" (B) | "To the reveal" | S | Done (bug) |
| 5 | Episode 4 train screen: no visible "Don't train"; the grant's cut not shown (B) | A "Don't train" tile; "Costs you 15 this round (was 30)." | S | Done |
| 6 | Episode 5 vote screens showed claims that read as votes; "Yes TRUE" stamps (B) | "What they claimed: Ana yes, ..."; ballots read "(kept)" / "(broke promise)"; the claim screen asks "How will you vote on each change?" | S | Done |
| 7 | The comeback card gives no exchange rate between coins and points (A) | "Your score counts half your bank, so 60 coins are worth 30 points, plus whatever they do for your mission." | S | Done |
| 8 | Host lines contradict the screen: "Nobody got hurt" after a covered hit; "fooled you completely" when nobody lied (A, B) | The quiet-round line and the wrong-guess lines no longer claim a lie or no harm | S | Done |
| 9 | The same honest-peak line three times in one life (E4) | Six variants | S | Done |
| 10 | Meritocrat card says "this episode" in every episode (A, B) | "Hours worked and training count. Before anyone has worked, that means equal banks." | S | Done |
| 11 | Peak screens of Episodes 1, 2 and 4 read like logs (E4) | LIE stamps in bold red | S | Done |
| 12 | Episode 1's round-1 claim feels pointless (A) | The claims beat says "Claims work like polls: they change which rule looks able to win." (and R6 gives claims a real effect) | S | Done |
| 13 | Tap targets of 40 px (E4) | 44 px everywhere in Play | S | Done |
| 14 | Episode 4 judge screen is "a spreadsheet" (A, B) | Plain words ("Square, passed, claims training"), a meter bar with the hiring line marked, "Complex hire: +20 if trained, -30 if not. Base 40." | M | Done |
| 15 | "Mission +N" and the odds readouts do the thinking (A) | Hard now hides the mission hints, as it already hides the poll; Easy and Normal keep them (v2 B.6) | S | Done on Hard (D-164), Needs Amir |
| 16 | The wheel hit nobody all Episode 3 on Normal (A) | Not done: a game-logic change to the draw; the Episode 3 checks were tuned on the current odds | M | Left |
| 17 | Multiplayer and a discussion phase (A's top change) | Not done: needs the room server | L | Left |
| 18 | The mission guess gives no feedback on the right answer (A, B) | Not done: in a life, other missions stay hidden until the end (spec) | S | Left, Needs Amir |
| 19 | Five layouts for the claim verb (E3) | Not done | M | Left |
| 20 | Replaying a challenge code reveals every hidden card (E3) | Not done: harmless without a leaderboard | M | Left |

## Won't fix (with reasons, so loop cycles don't redo them)

| Idea | Reason |
|---|---|
| Multiplayer or pass-and-play | Needs the room server redeployed (A.2 rule 3: no deploys tonight); the code path for Play rooms does not exist yet. |
| Remove the mission hints on Easy and Normal | v2 B.6 and D-143 require a preview on every tile; Hard already hides them (D-164). Revisit with human playtest evidence. |
| Force the wheel to hit someone each episode | A rule change not justified by a dominant habit, dead option or exploit; the E3 checks were tuned on the current odds. |
| Show other players' missions after a wrong guess in a life | The spec keeps missions hidden until the end of a life (v1 7.4 for a single episode only). |
| A discussion or accusation phase | A new phase and a new verb; out of scope for copy and UI fixes, and bots can't parse free text (v2 3.1). |
| Make Episode 3 gifts pay (the audit's one dominant habit: "never give" +1.8 ± 0.7 for a bot seat) | Bots give when it raises their mission this round, and it costs them a little overall; a human is never forced to give. Changing gift value would change every episode's mission balance; not worth the risk without people's data. |
| Show every player's score on the ranking during a life | Scores reveal missions (each mission has its own scale); v1 shows ranks only until cards are public. Your own score is now shown. |
| Cap the Episode 2 die at about ±25 | A rule change that would weaken E2's "luck hides effort" (B.1 66%); not a dominant habit or an exploit. |
| Break ties by claims or a revote | A rule change; ties are now explained on screen ("A tie: drawn by lot."). |
| Never repeat an event card in an episode; give Hard its own twist | Rule changes not justified by the audit; Hard already differs (no poll, no hints, bots lie more). |
