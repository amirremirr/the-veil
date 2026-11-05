# Morning summary (5 November 2026)

For Amir. All of this was done by an unattended AI run on the `autorun` branch. Every number comes from bot-only simulations and every review is AI judgment (a proxy). No human has played anything built tonight.

## The game now, from a player's seat

You are a contestant on a satirical TV show, The Veil: Live, hosted by Dash Fortuna. You hold a secret mission (get rich, protect the poorest, grow the pie, or reward hard work) and play one episode or a whole "life" of five episodes on one bank: Born (vote on a tax rule before you know your income), First Hustle (choose your hours, then a luck die), Bad Luck Season (buy cover, bar risky players, spin the wheel), The Hiring Round (take turns as HireBot, hiring by a biased meter), and the Grand Finale (rewrite the rules, with bribes). Before each choice you can tell the table something, true or not; each episode's reveal shows who lied. A life ends with The Receipts (every lie and whether it paid), then the missions flip and the ranking is final. A life takes about 10 minutes.

## What changed tonight, as a player would notice

- **Episode 1:** your first "what is fair" answer comes before birth; claims work like polls (they change which rule looks able to win); the top bar no longer spoils your income.
- **Episode 2:** bots lie less (54% of claims, was 82%); the income and prize screens show the parts ("20 base + 6h x 4.8 = 29 more, then your die -30"), with tax, hour costs and gifts.
- **Episode 3:** in a life the wheel costs 220 and the event cards say so; banks stay hidden until the wheel lands; the bar result states the rule; you see the audience's read of you; ties say "drawn by lot".
- **Episode 4:** HireBot reads claims (discounted by each worker's record); a plain-words hire screen with a meter; the result shows what your job paid, training, gifts and the judge's pay as a sum; training costs are private (a leak fixed).
- **Episode 5:** claims come before donations; ballots stamp "kept" or "broke promise"; a bribe-taker who voted no is named.
- **A whole life:** real stakes (start 10, living cost 45 a round; debt in about half of lives); every result shows "Your bank 10 to 26: +61 this round, then -45 living costs."; the score is written out and adds up; the ranking shows your rounded gap to the players above and below; a Second Chance card for whoever is last after Episode 3, announced to all; The Receipts, a result card, 12 achievements, a Daily Life seed and a playtest kit.

## What the reviews and the loop found

Round 2 ran two fresh-eyes reviewers and three audits, then fixed 15 of 20 ranked problems. The improvement loop then ran **19 cycles** (05:30 to 09:40), alternating a designer and a casual player who saw only fresh screenshots of a life and one Hard episode. Every cycle found at least one high-impact item, so the "two quiet cycles" stop never triggered.

Fixed in the loop (D-167 to D-186): money lines that did not add up (the most common finding), "Mission complete" with a falling bank (now "improved"), a broken "{truth}" line, the wrong wheel loss on an event card, banks spoiling the wheel, host lines denying a hit, a training-cost privacy leak, a wrong-donor line, comeback points labelled as guesses, a childcare cost that ignored the policy, unexplained ties and bar votes, backwards labels. Reviewer claims were checked before acting; several were capture artifacts or wrong and are logged as rejected.

Left (reasons in `docs/review/fix-list.md`): a full itemized ledger per round (top item for the next run); bots that lie little and don't play to their missions; debt points swamping an unlucky life; luck swamping effort; exact rival scores; the right mission after a wrong guess; no Play multiplayer.

## Checks (bots only)

| Area | E checks | Main fun numbers |
|---|---|---|
| Ep1 (2,000 games) | E1 +52.6 points: pass | lies 21.8% of claims, lie success 72.4% |
| Ep2 (2,000) | E2 -5.37, claimed over true +0.034 h: pass | lies 54.1%, lie success 13.6%, luck hides effort 65.6% |
| Ep3 (500) | E3a 2.83, E3b +24.1%, E3c 67.6%, E3d +39.9%: pass | lie success 67.5%, bar recall 31.3% |
| Ep4 (2,000) | E4a 90.0%, E4b 0.0%: pass | lies 42.6%, lie success 34.7% |
| Ep5 (2,000) | E5 -0.175: pass (programmed bots) | lies 24.3%, lie success 40.9%, bribe-taker voted no in 23.5% |
| Life (1,000) | every E check passes inside a life | debt in 48.5% of lives; F-a 1.89, F-b 18%, F-d 88% miss |

The logic audit found one dominant habit (never give in Episode 3, +1.8 ± 0.7 for a bot) and nearly dead options (Help the Poorest 1.8%, an 80% tax under 1.2%). The loop changed no game rule, so these numbers stand. Unit tests 206 and e2e 15 pass; axe found 0 violations on 74 screens.

## Five decisions made for you

1. **Life stakes** (D-160): start 10, living cost 45, Episode 3 loss 220. Alternative: a lower living cost (40 tested on 1,000 lives, no gain) or a per-episode debt cap.
2. **Episode 2 lying** (D-162): 54% of claims, short of the 50% target, because fewer lies flip the "claimed effort exceeds true effort" check. Alternative: hit 50% and drop that check.
3. **HireBot's claim weight** (D-159): 0.25; 0.5 and 1 broke E4b. Alternative: a stronger weight with a looser E4b.
4. **Hard mode** (D-164): Hard hides mission hints and the poll; Easy and Normal keep both. Alternative: hide the hints everywhere.
5. **Rival scores in a life** (D-180): a rounded gap only, because exact scores point at missions. Alternative: every score, or ranks only.

## Unfinished or broken

- Play has no multiplayer.
- Life fun targets F-a, F-b and F-d miss.
- Episode 1's bank line can be one coin off its income line (fractional incomes).
- Replaying a challenge code reveals every hidden card (harmless without a leaderboard).
- Bot behaviour, the most repeated complaint, is untouched.

**Human validation: NOT DONE. Gates 1 and 2 are still outstanding.**

## How to try it

- Latest commit: the head of `origin/autorun` (the last loop commit is named in `docs/review/loop-log.md`).
- Preview: Vercel builds every pushed branch; open the project's Deployments and pick the latest `autorun` preview. The production site (https://the-veil-mauve.vercel.app) still serves `main`.
- Challenge codes: `playtest-1`, or any loop seed (`loop9` to `loop19`), in "Challenge code" on the setup screen.
- Playtest kit: add `?playtest=1` to the preview URL; testers send back a results code, which you paste into `?playtest=results` (see `docs/playtest/HOW_TO.md`).

**Before merging to main:** the room server must be redeployed first, because the engine's rules changed and a page and a server on different rules refuse to play together. That deploy needs your approval; nothing was deployed tonight.
