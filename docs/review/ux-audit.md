# UI and UX audit (RUNPLAN E4)

**AI judgment (a proxy, not human evidence).** From the full-life capture at 375 x 760 on Normal (107 screens, `fresh-life-1`) and Episode 3 on Hard (26 screens), the walkthrough word counts, the axe scan (T7) and a tap-target scan.

## Nielsen's ten heuristics

| # | Heuristic | Verdict | Evidence |
|---|---|---|---|
| 1 | Visibility of system status | Good | The top bar always shows round, bank and every contestant; every decision is followed by a result beat. |
| 2 | Match with the real world | OK | Plain words ("Buy cover", "Train?"). The jargon is the satire's (SafeHands, HireBot). Mission names are clear; "Middle Way" for Limit the Gap is a stretch. |
| 3 | User control and freedom | Weak | No way back from a locked-in choice (by design), and the menu is the only exit. Beats can't be replayed. |
| 4 | Consistency and standards | Weak | The claim verb has five layouts across five episodes (see the logic audit). Gift is a tile everywhere except Episode 5. |
| 5 | Error prevention | Good | Lock-in buttons are disabled until a choice is made; invalid choices can't be built. |
| 6 | Recognition rather than recall | OK | Claims are repeated on the move screens; the mission is in the top bar only as a progress bar, so the mission's rule must be remembered. |
| 7 | Flexibility and efficiency | OK | Tap anywhere advances beats. No skip for intros a returning player has seen. |
| 8 | Aesthetic and minimalist design | OK | One big element per screen; reveal screens run long (Episode 2 hours and dice 113 to 131 words; Episode 5 ballots up to 130). |
| 9 | Recognize and recover from errors | OK | Few errors possible; the near miss on each summary names the one decision that would have helped. |
| 10 | Help and documentation | OK | "What was really going on?" on every summary; the opening cards. No in-game rules reference during play. |

## Visual hierarchy, targets, density

- The decision is the most prominent thing on every decision screen (big title, tiles, one lock-in button at the bottom). On the Episode 5 second fair-answer screen, the proposal chips (24 buttons) compete with the fair answer for attention.
- Tap targets: tiles and lock-in buttons are 52 to 112 px tall; chips are 40 px tall (Episode 5 tax and floor chips, Episode 2 claim chips, Episode 4 hiring rows are 52 px). 40 px is under the 44 px guideline.
- Empty areas: move screens with a single tile (Episode 4 judge screen's gift tile) leave a large gap between the list and the footer. Crowded: Episode 2 and Episode 5 reveals.
- Contrast: axe found no contrast violations on 74 distinct screens (T7).
- Onboarding: from opening Play to the first decision a new player taps the opening cards (3), Pick your show, the setup, the mission card, the intro, the "your card" beat and often an event card: about 9 taps before deciding anything.
- Numbers: the top bar shows every bank on every screen. Banks matter for the Rawlsian mission and for debt, so they belong there. Engine banks carry fractions (taxes and leakage), and the screens round them.

## Feel

- Reveal timings: every reveal is at most 4 seconds and skippable (REVEAL_MAX_MS); under reduced motion everything is instant. The Receipts run at most 20 seconds.
- Peaks: Episode 3's card reveal and Episode 5's ballots look like peaks (stamps, a headline). Episode 1's and Episode 4's peaks are lists of small text stamps ("R1 trained, TRUE · R2 ..."): they read like a log, not a reveal.
- Loss and win feel too alike: the same layout and colors for a disaster and a jackpot, apart from one line of text; the bank number changes but nothing on screen celebrates or mourns.
- Transitions: none between episodes in a life beyond the summary's button; the life has no "previously on" moment.

## Voice

Across one life (`fresh-life-1`): 40 spoken lines (host and bots), 33 distinct. Repeats: Dash's "Not one lie. Nobody tell the network." 3 times (the honest-peak line in several episodes); "Welcome back to The Veil: Live!", "Clean round, folks.", "Nope! Better luck reading people next episode." and "HireBot learned something..." twice each. Flat lines: the event-intro template ("The producers just handed me this: X. Lovely.") is the same shape every time. Guardrails (A.2 rule 7): the jokes target the host, the sponsors, HireBot and the paperwork; no line mocks illness, disability, caregivers, gender or real groups; Circles and Squares stay abstract.
