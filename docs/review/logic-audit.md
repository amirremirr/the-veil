# Game-logic audit (RUNPLAN E3)

**AI judgment and bot simulation (a proxy, not human evidence).** Bots follow the rules written for them, so "dominant strategy" here means dominant against these bots.

Data: `npx tsx sim/audit.ts --games 150` (4 seats, Normal, seeds `audit-<episode>-<n>`), raw numbers in `logic-audit-data.json`. For each fixed rule, the first bot seat plays the rule and the same seat plays adaptively on the same seeds; the table gives the paired difference in that seat's final Play score, mean ± SE.

## 1. Fixed strategies against adaptive play

| Ep | Fixed rule for one seat | Score vs adaptive (points) | Verdict |
|---|---|---|---|
| 1 | always peek | -2.2 ± 1.2 | tie (within 2 SE) |
| 1 | never peek | +0.4 ± 0.4 | tie (within 2 SE) |
| 1 | always silent | -1.0 ± 1.2 | tie (within 2 SE) |
| 1 | always claim Safety Net | +1.5 ± 1.3 | tie (within 2 SE) |
| 1 | always give 10 to the poorest | -14.3 ± 1.0 | adaptive better (over 2 SE) |
| 2 | always claim a lot | +0.6 ± 0.3 | fixed rule better (over 2 SE) |
| 2 | always silent | -0.2 ± 0.3 | tie (within 2 SE) |
| 2 | always truthful | +0.0 ± 0.0 | tie (within 2 SE) |
| 2 | always give 10 to the poorest | -19.6 ± 1.3 | adaptive better (over 2 SE) |
| 2 | never give | -0.4 ± 0.2 | adaptive better (over 2 SE) |
| 3 | always buy cover | -10.8 ± 3.9 | adaptive better (over 2 SE) |
| 3 | never buy cover | -24.4 ± 7.0 | adaptive better (over 2 SE) |
| 3 | always claim low risk | +3.3 ± 1.9 | tie (within 2 SE) |
| 3 | always silent | -2.2 ± 2.4 | tie (within 2 SE) |
| 3 | never bar | +1.8 ± 1.1 | tie (within 2 SE) |
| 3 | always bar someone | -0.1 ± 0.6 | tie (within 2 SE) |
| 3 | never give | +1.8 ± 0.7 | fixed rule better (over 2 SE) |
| 4 | always claim I trained | +0.8 ± 0.6 | tie (within 2 SE) |
| 4 | always silent | +0.0 ± 0.0 | tie (within 2 SE) |
| 4 | always train | -6.5 ± 4.5 | tie (within 2 SE) |
| 4 | never train | -33.9 ± 5.8 | adaptive better (over 2 SE) |
| 4 | always give 10 to the poorest | -28.9 ± 1.7 | adaptive better (over 2 SE) |
| 5 | always donate the maximum | -23.3 ± 1.3 | adaptive better (over 2 SE) |
| 5 | never donate | -1.0 ± 0.7 | tie (within 2 SE) |
| 5 | always claim yes | +0.1 ± 0.8 | tie (within 2 SE) |
| 5 | always silent | -3.6 ± 0.7 | adaptive better (over 2 SE) |

**Findings.** Only one fixed rule beats adaptive play by more than 2 SE: **"never give" in Episode 3 (+1.8 ± 0.7)**: bot gifts there cost more score than they buy. "Always claim low risk" in Episode 3 (+3.3 ± 1.9) and "always claim a lot" in Episode 2 (+0.6 ± 0.3) are close: lying is cheap against these bots. Many claim rules tie (Episode 2, Episode 4 silent at 0.0, Episode 5 "always claim yes"), which means those claims barely move a seat's score: decisions that don't matter much. Giving 10 to the poorest every round costs 14 to 29 points everywhere, and donating the maximum in Episode 5 costs 23: generosity is never free, as intended. Never training in Episode 4 (-33.9) and never buying cover in Episode 3 (-24.4) are clearly worse than adaptive play, so those decisions matter.

Reading the table: a positive difference larger than about 2 SE means the fixed rule beats the bot's own adaptive play (a dominant habit against this table); a difference within noise means the decision barely matters for score; negative means adaptive play is better, as it should be.

## 2. Dead and forced options

Share of all bot decisions for each option (one row per distinct option description; the description lumps sub-choices, see the data file). Options under 3% or over 97% are listed.

| Ep | Decision | Option (bot choices) | Share |
|---|---|---|---|
| 1 | VOTE | vote=P4 gift=no | 1.8% |
| 1 | VOTE | vote=P2 gift=yes | 1.1% |
| 1 | VOTE | vote=P1 gift=yes | 0.2% |
| 2 | TAX | 0.8 | 0.7% |
| 2 | EFFORT | claim=LITTLE gift=yes | 0.1% |
| 3 | CHOICE | buy=false gym=false bar=no gift=yes | 1.5% |
| 3 | CHOICE | buy=true gym=true bar=yes gift=no | 1.6% |
| 3 | CHOICE | buy=true gym=true bar=no gift=yes | 1.3% |
| 3 | CHOICE | buy=true gym=false bar=yes gift=yes | 1.6% |
| 3 | CHOICE | buy=false gym=false bar=yes gift=no | 2.5% |
| 3 | CHOICE | buy=false gym=true bar=yes gift=yes | 1.4% |
| 3 | CHOICE | buy=false gym=false bar=yes gift=yes | 0.5% |
| 3 | CHOICE | buy=true gym=true bar=yes gift=yes | 0.6% |
| 4 | TRAIN | train=false gift=yes | 2.6% |
| 4 | HIRE | complex=1 gift=yes | 2.7% |
| 4 | HIRE | complex=3 gift=yes | 1.5% |
| 4 | HIRE | complex=0 gift=yes | 0.5% |
| 5 | VEIL | t=0.8 | 1.2% |
| 5 | CLAIM | claims=NO/NO | 2.0% |
| 5 | CLAIM | claims=YES/YES | 2.0% |
| 5 | CLAIM | claims=NO/NO/NO | 0.8% |
| 5 | CLAIM | claims=YES/YES/NO | 1.0% |
| 5 | CLAIM | claims=NO/NO/YES | 0.5% |
| 5 | CLAIM | claims=NO/YES/NO | 0.3% |
| 5 | CLAIM | claims=NO/YES/YES | 0.3% |
| 5 | CLAIM | claims=YES/NO/NO | 0.3% |
| 5 | CLAIM | claims=YES/YES/YES | 0.7% |

**Findings.** Most rows are rare combinations of sub-choices (a gift together with a bar, and so on), not dead options. The single options that are nearly dead for bots: **Help the Poorest in Episode 1** (1.8% of votes without a gift: bots almost never vote for it, because its tax leaks the most), **an 80% tax in Episode 2** (0.7%) and **an 80% tax behind the veil in Episode 5** (1.2%). No option is forced over 97%. Gifts are rare in every episode (bots give when a gift raises their mission score, mostly Rawlsians).

## 3. Exploits a min-maxing human would find

| Exploit | Status | Note |
|---|---|---|
| Gift loops (two players giving each other the same gift) | Closed | GIFT_MATCH is 0 (D-149): a gift moves coins, it creates none. |
| Vote coordination | Not possible solo | Bots don't coordinate; in multiplayer (not built for Play) two humans could agree claims outside the game. |
| Replaying a challenge code to learn the deck | **Open** | The same code deals the same cards, events and bot traits. Replaying Daily Life (or using Rematch) lets a player learn every hidden card and then play perfectly. Harmless without a leaderboard; it matters the day results are compared. |
| Reading private cards from the client | **Open in solo** | The browser holds the whole game state (solo play runs in the page). Browser developer tools can read every hidden card. The dev helpers (`window.__veil`) are only in development builds. Multiplayer rooms send views, not the state. |
| Timing tricks | None found | No timers in solo Play; bots decide instantly, so nothing leaks through time. |
| The near miss | Safe | It replays only your own changed decision, and names only your own choices. |
| Mission previews | Mostly safe | Previews use the bots' public beliefs, never hidden cards. They do reveal your own mission's scale indirectly (it's yours). |

## 4. Information leaks in the UI

| Where | What | Verdict |
|---|---|---|
| Audience poll (Episodes 2, 3) | Bots' beliefs from public facts | Intended; on Hard it is hidden. |
| Episode 4 meter | Now includes the claim (R2) | Intended: it shows what HireBot believes. |
| Episode 4 GOOD / BAD HIRE | Reveals a complex hire's training at once | Intended (spec); it also checks that worker's claim at once. |
| Episode 4 belief board | The prior update uses every worker's true training, so a careful player can infer the share of trained simple-job workers from the change | Small leak, inherent to Study's update rule. |
| Episode 2 incomes | Gross income is public, dice hidden | Read accuracy from income alone 65.6% (B.1 target at most 80%). |
| Episode 5 donations | Shown to the recipient only, until the ballots (unless Leaked Receipts) | Unit-tested. |
| Ranking in the top bar | Ranks by Play score include each mission's scale | Accepted in v1 (ranks only, never scores). |
| Episode 1 "Peeked" tag | Public by design | Intended. |

## 5. Dead time

Screens with no decision and no new reveal, from the life walkthrough (111 screens): every episode opens with an intro screen, then a "your card" beat, often an event card, before the first decision; that is 2 to 4 taps before the first choice in each episode (Episode 1: mission, intro, card, then the fair answer). The "claims are in" beat repeats information that the move screen also shows (Episodes 1 and 3). The missions beat and the summary are two screens at every episode end. Consecutive screens with nothing new: the Episode 5 finale card right after its intro (both explain the rules).

## 6. Consistency across episodes

| Verb | Episode 1 | Episode 2 | Episode 3 | Episode 4 | Episode 5 |
|---|---|---|---|---|---|
| Claim | Own screen, list of rules | Chips on the effort screen | Own screen, three tiles | Own screen, two options | One screen, Yes / No per amendment |
| Read | Claims beat, then vote | Prize vote with poll | Bar rows with poll | Judge rows with meter | Lobby shows claims on your amendment |
| Move | Vote tiles | Hustle slider | Cover and gym tiles | Train tile or hiring rows | Rules chips, donation chips |
| Give | Tile | Tile | Tile | Tile | The donation (no 0/5/10 gift) |
| Reveal stamps | TRUE / LIE per round | TRUE / LIE per round | TRUE / LIE per round | TRUE / LIE, GOOD / BAD HIRE | TRUE / LIE per ballot |

The claim verb looks different in every episode: five layouts for one idea. The reveal stamps are consistent. Give is consistent except in Episode 5.
