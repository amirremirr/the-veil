# Morning summary

## Round 4: Call it (5 November 2026, evening)

For Amir. An unattended AI run on `autorun`. Numbers are from bot-only simulations; reviews are AI judgment (a proxy).

### What a player notices

- Every move screen after the claims has **"Call (10):"** with the names of the players who made a claim. Tap one to stake 10 coins on their claim being a lie.
- If they lied, they pay you 20 and get a **CAUGHT** stamp. If they told the truth, you pay them 10 and get **CALLED WRONG**. Dash reacts, the money shows in "See the money", and the call goes into the Receipts.
- **A caught lie costs something in its episode:**
  - Episode 2: the liar can't win the Hustle Prize that round, and their true hours become public.
  - Episode 3: if they applied for cover, they are turned away.
  - Episode 4: they get the simple job. Only HireBot can call here, because it is the only player with a move after the claims.
  - Episodes 1 and 5: only the payment applies.
- **The computer players never call.** They do weigh the risk that you will call them, so they bluff less against you.

### Audit, all five episodes (150 games each, fixed rule minus adaptive play, points)

| Episode | Round 3 | Round 4 |
|---|---|---|
| 1 | claim Safety Net +1.5 ± 1.3; others within noise | the same; always call -8.0 ± 1.3; never call 0.0 |
| 2 | claim a lot +0.7 ± 0.3 | the same; always call -15.7 ± 1.2; never call 0.0 |
| 3 | never bar +2.1 ± 1.3; never give -0.1 | the same; always call -22.6 ± 4.6; never call 0.0 |
| 4 | claim I trained +0.8 ± 0.6 | the same; always call -7.0 ± 0.4; never call 0.0 |
| 5 | nothing over 1 SE | the same; always call -6.0 ± 0.4; never call 0.0 |

The bot-only numbers are identical to Round 3, because bots don't call and bot-only tables have no human caller. So the target (no rule more than 1 SE better than adaptive play) is still missed in Episodes 1 to 4. Calling blindly is a clear loss.

### Lie success and calls, per episode (bots)

Lie success is unchanged: Ep1 72.4%, Ep2 19.0%, Ep3 77.7%, Ep4 34.7%, Ep5 39.2%. Episode 2 is still under 30%, and Episode 3 is just over 75%.

With bot calls switched on (best sweep, stakes 15/15), calls happened in 76%, 37%, 8%, 9% and 45% of rounds, and were right only 0.2%, 1.7%, 0%, 3.8% and 15.4% of the time (target 40% to 70%).

### Stakes chosen

10 to call, 20 to the caller for a caught lie (the spec's numbers). Four sweeps (10/20 and 15/15, fixed-weight reads, then Bayes' rule with a table prior and with each personality's own prior) all left calls mostly wrong. The cause: the risk of being called works, so bots stop lying, but callers can't see that and keep calling true claims.

### E checks

All pass, unchanged from Round 3:
- Episodes: E1, E2 and the claimed-over-true check, E3a to E3d, E4a and E4b, E5.
- A life (1,000 lives): every check, plus F-b 24.0%, F-e 22.6% to 26.3%, F-f 47.2%.

### Decisions made for you

1. **Bots don't call** (`PLAY.CALL_BOTS: false`). Their calls were right at most 18% of the time, and a truthful human would have farmed them. Alternative: let bots learn from public call results and switch it on.
2. **Episode 4: only HireBot calls.** It is the only player with a move after the claims. Alternative: a call step for the workers (a new screen).
3. **Episode 5: one call per player, on any amendment screen.** Alternative: one per amendment.
4. **Episode 2: the call and the prize vote go in together**, and calls settle first. Alternative: a separate screen that shows the true hours before the vote.
5. **A lie's chance of being false uses each personality's honesty range** (public in the spec), updated by the record. Alternative: the table average.

### Still unfinished

- The audit and lie-success targets are unmet (see above).
- The Episode 3 move screen is 71 words and Episode 4's hire screen is 80, over the 65-word limit. Most of that is older than this round.
- The reveal screens don't repeat the CAUGHT stamps yet; they show on the round results and in the Receipts.

**Human validation: NOT DONE. Gates 1 and 2 are still outstanding.**

Latest commit: the head of `origin/autorun`. Preview: the latest `autorun` deployment in the Vercel dashboard. Before merging to main, the room server must be redeployed (the rules changed), which needs your approval.

---

## Round 3: how the game plays (5 November 2026, afternoon)

For Amir. An unattended AI run on `autorun`. Every number is from bot-only simulations; every review is AI judgment (a proxy). No human has played any of it.

### What a player would notice

- **"See the money"** sits in every round's bank line. It opens a panel listing every coin (income, the rule, peek, cover, gym, wheel hit, pay, training, gifts, prize, donations, Second Chance, living costs) and every score point (half the bank change, mission points, debt points, guesses), and the lines add up exactly to the change shown. Episode 1's "after the rule" now matches the bank line to the coin.
- **Episode 2's luck die is gentler:** eleven faces from -30 to +70 (was -30 to +90 in five steps), so hours matter more and a bluff about hours is believed more often.
- **Episode 3 bots** give and bar only when it helps their own mission; Protect-the-poorest bots now bar less, because a barred player's lost cover counts against them.
- **Episode 2 bots** no longer lie about their hours when the cameras show them.
- **A whole life:** the Second Chance is 120 coins or 40 points (was 60 or 20), and living costs are 40 a round (was 45), so the player who is last after Episode 2 more often climbs back.

### Before and after (bots)

| Task | Measure | Before | After |
|---|---|---|---|
| G2 | Missions differ on their key decision (two missions at least 15 points apart, every episode) | already true: spreads 24 to 100 points | the same; bar vote by Protect-the-poorest 29.5% to 22.9% |
| G3 | Episode 3 "never give" against adaptive play | +1.8 ± 0.7 | -0.1 ± 0.1 |
| G4 | Episode 2 lie success (target 30% to 75%) | 13.6% | 19.0% ± 1.1 (2,000 games) |
| G4 | Share of income differences explained by effort | 50.2% | 53.0% |
| G4 | Contested reads (target 20%) | 19.6% | 27.7% |
| G5 | Help the Poorest 1.8%, 80% tax 0.7% and 1.2% | | kept as real choices (reasons in D-191) |
| G6 | F-a lead changes (target 2) | 1.89 | 1.95 ± 0.05 |
| G6 | F-b comebacks (target 20%) | 18.0% | 24.0% ± 1.4 |
| G6 | F-d big moments (target 90%) | 88.0% | 86.7% ± 0.4 |

Every E check passes in every episode and inside a life (1,000 lives).

### Audit, all five episodes (150 games each, fixed rule minus adaptive play)

- Episode 1: every rule within noise except "always claim Safety Net" +1.5 ± 1.3.
- Episode 2: "always claim a lot" +0.7 ± 0.3.
- Episode 3: "never give" fixed (-0.1 ± 0.1); "never bar" +2.1 ± 1.3.
- Episode 4: "always claim I trained" +0.8 ± 0.6.
- Episode 5: nothing beats adaptive play by more than 1 SE.

So the target (no rule more than 1 SE better) is met in Episode 5 only. The remaining gaps are small (under 2.5 points) and mostly say lying is cheap against these bots.

### Loop

2 cycles (a designer, then a casual player). Fixed: lies under the Security Cameras, and two HireBot result lines. Cycle 2 found nothing new beyond the won't-fix list; the loop stopped there because the run was long.

### Five decisions made for you

1. **The Bar counts the mission** (D-188): bots weigh what barring does to the barred player's money. Alternative: keep D-133's price-saving-only rule.
2. **Episode 5 proposals keep Study's money pull** (D-188): a mission-only proposal cut lie success to 30%. Alternative: switch it on and retune donations.
3. **Gifts and bars only when they help** (D-189): this ends "never give", but bars halved (905 to 430 per 500 games). Alternative: keep the logit noise and accept the dominant habit.
4. **A finer, narrower Episode 2 die** (D-190), not honest bots voting by effort (that made lies fail more). Alternative: let the prize follow claims when incomes are close.
5. **A bigger Second Chance and living cost 40** (D-192). Alternative: a second card after Episode 2.

### Still unfinished

- Episode 2 lie success (19%) is under its 30% floor.
- F-a is just under 2 and F-d misses.
- Four claim or bar rules still edge out adaptive play.
- Bots still lie rarely on Normal.
- No Play multiplayer.

**Human validation: NOT DONE. Gates 1 and 2 are still outstanding.**

Latest commit: the head of `origin/autorun`, see `git log -1 origin/autorun`. Preview: the latest `autorun` deployment in the Vercel dashboard. Before merging to main, the room server must be redeployed (rules changed), which needs your approval.

---

## Rounds 1 and 2 (5 November 2026, night)

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
