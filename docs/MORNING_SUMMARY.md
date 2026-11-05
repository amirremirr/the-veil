# Morning summary (5 November 2026)

For Amir. Everything below was done by an unattended AI run on the `autorun` branch. Every number comes from bot-only simulations, and every review is AI judgment (a proxy). No human has played anything built tonight.

## The game now, from a player's seat

You are a contestant on a satirical TV game show, The Veil: Live, hosted by Dash Fortuna. You get a secret mission (get rich, protect the poorest, grow the pie, or reward hard work) and play either one episode or a whole "life" of five episodes with the same bank: Born (vote on a tax rule before you know your income), First Hustle (choose your hours, then a luck die), Bad Luck Season (buy insurance, bar risky players, then the wheel), The Hiring Round (take turns as HireBot, hiring by a biased meter), and the Grand Finale (rewrite the rules, with bribes). Before each choice you can tell the table something, true or not, and the reveal at the end of each episode shows who lied. A life ends with "The Receipts", every lie you told and whether it paid, then all missions flip and the ranking is final. A life takes about 10 minutes at a realistic pace.

## What changed tonight, as a player would notice

- **Episode 1:** your first answer on what is fair is asked before you are born; claims now work like polls (they change which rule looks able to win); the top bar no longer spoils your income; peeks show their cost in the bank line.
- **Episode 2:** fewer bot lies (54% of claims, was 82%); the income screen shows its parts ("20 base + 6h x 4.8 = 29 more, then your die -30"), and the prize screen shows how income became the round's money after tax and hour costs.
- **Episode 3:** in a life the wheel costs 220, and the event card says so; the bar and wheel screens hide the banks until the wheel lands; the bar result says who votes and what bars you; you see the audience's read of you; cover prices are shown the same way everywhere.
- **Episode 4:** HireBot reads claims (Bayes, discounted by the worker's record); the hire screen is in plain words with a meter and the hiring line; the result says what your job paid, what training cost and what came from gifts; other workers' training costs are private (a leak fixed); a "Don't train" tile.
- **Episode 5:** claims come before donations, and donors fund players who promised yes; the ballots stamp each vote "kept" or "broke promise"; a bribe-taker who voted no is named; dropped amendments are explained.
- **A whole life:** real stakes (start at 10, living cost 45 a round, so debt happens in about half of lives); every result shows "Your bank 10 to 26: +61 this round, then -45 living costs."; the score is explained ("half your bank + half your mission, minus debt points, plus guesses"); the ranking now shows your rounded gap to the players above and below you; a Second Chance card for whoever is last after Episode 3, announced to everyone; The Receipts, a result card, 12 achievements, a Daily Life seed and a playtest kit.

## What the reviews and the loop found

Round 2 ran two fresh-eyes reviewers (a designer and a casual player) and three audits (design, logic, UX), then fixed 15 of 20 ranked problems. The improvement loop then ran **15 cycles** (05:30 to about 09:00 Istanbul time), alternating the two reviewer types, each seeing only fresh screenshots of a life and one Hard episode. Every cycle found something worth fixing, so the loop never hit the "two quiet cycles" stop.

Fixed in the loop (D-167 to D-181): money lines that did not add up (the most common finding, nearly every cycle), "Mission complete" shown with a falling bank (now "improved"), a broken "{truth}" line, the life's wheel loss shown as 140, the wheel result spoiled by the top bar, host lines that denied a hit, a privacy leak of training costs, a wrong-donor line in Episode 5, unexplained ties and bar votes, and labels that read backwards.

Left, with reasons in `docs/review/fix-list.md` (won't-fix list): bots lie too little and don't act on their missions (lie rates are tuned per episode); debt points can swamp an unlucky life (four reviewers; a scoring rule); luck swamps effort in Episode 2 (that is Episode 2's lesson, checked by B.1); no multiplayer for Play (needs the room server); the right mission stays hidden after a wrong guess (spec); Episode 2 feels repetitive and a life has many tap-through screens.

## Checks (bots only)

| Area | E checks | Main fun numbers |
|---|---|---|
| Ep1 (2,000 games) | E1 +52.6 points: pass | lies 21.8% of claims, lie success 72.4% |
| Ep2 (2,000) | E2 -5.37: pass; claimed over true +0.034 h: pass | lies 54.1%, lie success 13.6%, luck hides effort 65.6% |
| Ep3 (500) | E3a 2.83, E3b +24.1%, E3c 67.6%, E3d +39.9%: all pass | lie success 67.5%, bar recall 31.3% |
| Ep4 (2,000) | E4a 90.0%, E4b 0.0%: pass | lies 42.6%, lie success 34.7% |
| Ep5 (2,000) | E5 -0.175: pass (programmed bots) | lies 24.3%, lie success 40.9%, bribe-taker voted no in 23.5% |
| Life (1,000) | every E check passes inside a life | debt in 48.5% of lives; F-a 1.89, F-b 18%, F-d 88% miss their targets |

The logic audit found one dominant habit (never give in Episode 3, +1.8 ± 0.7 for a bot) and nearly dead options (Help the Poorest 1.8%, an 80% tax under 1.2%). The loop changed no game rule, so these numbers still stand. Unit tests 206, e2e 15 passed, accessibility (axe) 0 violations on 74 screens.

## Five decisions made for you

1. **Life stakes** (D-160): start 10, living cost 45, Episode 3 loss 220 in a life. Alternative: a lower living cost (40 was tested on 1,000 lives, no gain) or a per-episode debt cap.
2. **Episode 2 lying** (D-162): bots lie in 54% of claims, short of the 50% target, because fewer lies flip the "claimed effort exceeds true effort" check. Alternative: hit 50% and drop that check.
3. **HireBot's claim weight** (D-159): 0.25; 0.5 and 1 broke E4b. Alternative: a stronger weight with a looser E4b.
4. **Hard mode** (D-164): Hard hides the mission hints and the poll; Easy and Normal keep both. Alternative: remove the hints everywhere.
5. **Rivals' scores in a life** (D-180): you see only your rounded gap to the players above and below, because exact scores point at missions. Alternative: show every score, or ranks only.

## Unfinished or broken

- Play has no multiplayer; the room server would also need the new rules.
- F-a, F-b and F-d (life fun targets) miss.
- Episode 1's bank line can be one coin off its income line (fractional incomes after the rule).
- Replaying a challenge code reveals every hidden card (harmless without a leaderboard).
- Bot behaviour (lie rates, mission-driven play) is the most repeated complaint and is untouched.

**Human validation: NOT DONE. Gates 1 and 2 are still outstanding.**

## How to try it

- Latest commit: see `git log -1 origin/autorun` (the loop's last commit is listed in `docs/review/loop-log.md`).
- Preview: Vercel builds a preview for every pushed branch; open the project's Deployments in the Vercel dashboard and pick the latest `autorun` preview (the production site, https://the-veil-mauve.vercel.app, still serves `main`).
- Challenge codes: type `playtest-1` (or any loop seed, `loop9` to `loop15`) into "Challenge code" on the setup screen so everyone plays the same game.
- Playtest kit: add `?playtest=1` to the preview URL; testers send back a results code, which you paste into `?playtest=results`. Steps in `docs/playtest/HOW_TO.md`.

**Before merging to main:** the room server must be redeployed first, because the engine's rules changed and a page and a server with different rules refuse to play together. That deploy needs your approval; nothing was deployed tonight.
