# THE VEIL: LIVE
### Play mode v2: the social redesign

**Status:** design spec for Claude Code. Replaces Sections 5, 6.2, 7.3 to 7.7, 10.2 and 12 of PLAY_MODE_SPEC.md v1.0. Everything else in v1.0 stays (ruleset plumbing, bank, debt stress, missions, events system, theme, tone, Study frozen).
**Author:** Amirreza Akhavan
**Why v2:** in v1 the mechanism happens *to* the player. You pick from options with a near-computable best answer, a wheel decides, and the only interaction is one vote. Playtesting (the author's own) found it clear but not fun. v2 makes every mechanism happen *through* the players: they claim things that may be false, read each other, and act on what they believe. The economics stays the same. The source of uncertainty moves from dice to people.

---

## 0. Rules for whoever builds this

1. Read this document, PLAY_MODE_SPEC.md v1.0, DECISIONS.md and the engine first.
2. **Study mode is frozen.** The golden Study test (tests/engine/golden.test.ts) must pass unchanged at every commit.
3. Every Play number goes in `src/engine/play/params.ts`. Every Play string goes under `play.*`. No em dashes anywhere.
4. Each episode's mechanism (Section 2) must still produce its effect, checked by the simulator. Fun may bend numbers, never cause and effect.
5. Record every choice this spec leaves open in DECISIONS.md, starting at D-109.
6. Build in the milestone order of Section 9 and stop where it says stop.

---

## 1. Design principles, as rules for this game

These are the seven principles we test every screen against, turned into rules that can be checked.

| # | Principle | Rule for The Veil | Check |
|---|---|---|---|
| 1 | Meaningful choices | Every decision screen has at least two options a reasonable player would pick, and at least one decision per round depends on what you believe about another player. | Bots split between the top two options at least 25% of the time (sim). A playtester can say why they chose, in a sentence about a person. |
| 2 | Uncertainty, clear rules | Rules fit on one screen. The uncertainty comes mainly from hidden information held by players, not from dice alone. | A reader using the bots' beliefs guesses hidden facts right 55% to 80% of the time (sim). |
| 3 | Fast feedback | Every decision gets a visible consequence within 5 seconds. | Walkthrough timing. |
| 4 | Mastery | Bots have learnable habits, and honesty has a memory (your record follows you through the life). | A second play scores higher on average than a first (human playtest only). |
| 5 | Emotional contrast | Each episode is quiet, then tense, then a reveal. The life builds to one big reveal at the end (the Receipts, Section 3.4). | Each episode has exactly one marked peak screen. |
| 6 | Social consequences | Players can do something to each other in every episode: bar, judge, reward, bribe or expose. | Every episode has at least one action whose target is another player. |
| 7 | Short sessions | An episode takes at most 5 minutes and at most 6 decisions. A life takes at most 25 minutes. Stopping after any episode feels complete. | Walkthrough timing and decision count. |

**Compelling, not compulsive.** No streak punishments, no countdowns that cost you something for leaving, no daily login rewards, no loot boxes. The reason to come back is a better strategy, an unresolved rivalry or a new seed.

---

## 2. The mechanism rule (unchanged in substance)

| Episode | Mechanism that must stay true | New social layer |
|---|---|---|
| 1 Born | You vote on the sharing rule before you know your income | **The Peek**: pay to see your income before the vote; everyone sees that you peeked |
| 2 First Hustle | Income mixes effort and luck; others can't tell which; taxes reduce effort | **Earned It?**: claim your effort, the table awards the Hustle Prize to whoever it believes worked hardest |
| 3 Bad Luck Season | The price rises because mostly risky people buy; a mandate stops the spiral | **The Pool**: claim your risk; pool members can bar people they think are risky |
| 4 The Hiring Round | Old beliefs plus incentives create a gap with no prejudiced player | **You are HireBot**: players take turns as the judge who hires |
| 5 Grand Finale | Your sense of a fair rule moves once you know where you stand | **Bought Votes**: secret donations, then ballots land one at a time |

---

## 3. The spine: four verbs that run through every episode

Players learn four verbs in Episode 1 and use them all life. This is what makes the second episode easier than the first and the second life better than the first.

### 3.1 CLAIM
- Before each decision, each contestant may make one **public claim** from 2 or 3 preset options for that episode, or stay silent. Claims can be false.
- Preset only, no free text in solo play (bots must parse them; no moderation). Multiplayer keeps its existing chat as well.
- Claims extend the existing StructuredMessage type. They are logged actions, so replays stay exact.

### 3.2 READ
- Every episode has one decision that targets another player based on what you believe (bar, award, hire, bribe).
- The screen shows the **audience poll**: the table's aggregated bot belief about the hidden fact in question ("Audience: 64% think Chet is high risk"). The human may follow or ignore it. It's a hint, not the truth.

### 3.3 ACT
- The episode's main economic choice, as in Study (vote, effort, cover, training, rules).

### 3.4 REVEAL, and the Receipts
- Hidden facts are revealed at the end of each episode, one contestant at a time, starting with the most surprising one (the biggest lie, or the biggest wrong read).
- Each claim gets a stamp: **TRUE** or **LIE**. "Chet said he worked 9 hours. He worked 2."
- **Track record.** Every contestant has a public honesty record: claims checked so far and how many were true ("7 of 9 true"). It's shown under their avatar from Episode 2 on.
- Bots already weigh messages by the speaker's record of keeping their word (README, Bots). v2 feeds every checked claim into that record, so lying is a resource you spend: it pays now and costs you belief later.
- **The Receipts** (life mode, end of Episode 5): a 20-second reel of the life's best moments: every lie that worked, every lie that got caught, every betrayal, and finally all missions flipped at once. This is the life's single biggest peak.

### 3.5 Bots that bluff
- Each bot gets an **honesty trait** drawn once per life from its personality's range (bot stream, deterministic):
  - Chet: lies often when it pays (honesty 0.3 to 0.5). Overclaims effort and safety.
  - Marigold: nearly always honest (0.85 to 1.0).
  - Ugo: unpredictable (0.4 to 0.9).
  - Dot: honest by default, lies only when the gain is large (0.7 to 0.9, threshold rule).
- A bot claim: compute the payoff gain from the lie under current beliefs. Lie if gain x (1 - honesty) exceeds the expected loss from being caught (lower future credibility, valued with a fixed parameter `PLAY.CREDIBILITY_VALUE`). Otherwise tell the truth or stay silent.
- Habits are learnable on purpose (mastery), and the per-life draw stops them being certain.
- Bots read claims with the existing rule (fixed weight x speaker record). They also read actions: buying history, peeking, training. Record in DECISIONS.md exactly which actions update which beliefs.

---

## 4. Episode specifications

Each episode keeps its Study level's rules and v1's Play overrides except where listed. Target: at most 6 decisions, at most 5 minutes.

### Episode 1: "Born"
**Mechanism:** vote on the sharing rule before knowing your income.
**Rounds:** 2. Income deck `[10, 40, 110, 300]` (v1).

**Round 1 (pure veil, teaches the verbs):**
1. CLAIM: "I'm voting Safety Net" / "I'm voting Free Market" / "I'm voting Middle Way" / silent. (Use the Study principle names that map to these; record the mapping.)
2. ACT: secret vote on the sharing rule.
3. REVEAL: votes flip one at a time, with broken-promise stamps. Then incomes flip, poorest first.

**Round 2 (the Peek):**
1. **The Peek:** before claims, each contestant may pay `PLAY.PEEK_COST = 10` to see their own round-2 income. Everyone sees who peeked, not what they saw.
2. CLAIM, then ACT (vote), then REVEAL, as in round 1.
3. **Peak moment:** the reveal shows peekers' votes next to their incomes. "Dot peeked. Dot got 300. Dot voted Free Market."

**Why this teaches:** the veil's whole point is that knowing your position changes your vote. The Peek lets players watch that happen, and the round-1 vote is the comparison.
**Mechanism check E1 (updated):** non-peekers vote before knowing; among bot peekers, the share voting for the least redistribution rises with income (sim). The structural test still checks that no income is visible before the vote to anyone who didn't peek.
**Card guess:** end of episode, as in v1 (first one of the life).

### Episode 2: "First Hustle"
**Mechanism:** income = talent x effort + luck; others can't tell which; taxes reduce effort.
**Rounds:** 3. Luck die `[-30, 0, 10, 30, 90]` (v1). The luck poll from Study is replaced by the Hustle Prize (it asks the same question with stakes).

**Each round:**
1. ACT: tax vote (round 1 only; the rate holds for the episode), then effort (the hustle meter, private).
2. REVEAL: gross incomes and luck dice, but **effort stays hidden**.
3. CLAIM: "I worked hard" (state 0 to 10 hours, one tap on a 3-step scale: little / some / a lot) or silent.
4. READ: **The Hustle Prize.** Each contestant votes for who earned it most (not yourself). The plurality winner takes `PLAY.HUSTLE_PRIZE = 30` coins. Ties split.

**Peak moment:** the episode's end reveal shows true effort next to each claim. "Ugo won the Hustle Prize twice. He worked 'a little'. He rolled the jackpot."
**Why this teaches:** players face the real problem of rewarding effort when you only see results mixed with luck. Cheap talk inflates, and a Meritocrat wants to reward the right person and can't tell who it is.
**Mechanism check E2 (unchanged):** effort falls as the tax rises. **Added:** mean claimed effort exceeds mean true effort (bots inflate). Check the prize doesn't flip the E2 slope's sign; if it does, cut the prize before touching anything else.

### Episode 3: "Bad Luck Season" (rebuilt as The Pool)
**Mechanism:** the price rises because mostly risky people buy; a mandate stops the spiral.
**Rounds:** 4. Round 1 is the launch round; rounds 2 and 3 are voluntary; the regime vote after round 3; round 4 under the chosen regime. Episode starting bank 10, loss 140 (DECISIONS.md D-97, D-123).
**Risk types:** dealt from a deck of exactly 2 HIGH and 2 LOW (half the table, rounded), shuffled on the game stream. Every claim and move screen says "Two of you are high risk." Bots' beliefs know it: from its own type, a bot starts at 1/3 that a given other player is high (if it is high) or 2/3 (if low), and keeps a joint belief over the possible assignments (D-120).

SafeHands Mutual runs a pool. The price formula is Study's: `price = LOADING x LOSS x mean risk of last round's members` (premiumFor). Only who may join changes.

**Round 1, the launch round:** "SafeHands signs everyone up for the launch season. After that, it's your choice." Everyone is covered at the pooled price. Each contestant still claims and chooses the gym. Every round-1 player is a member in round 2 (D-121).

**Rounds 2 to 4, each round** (two screens: the claim, then the move; D-110):
1. CLAIM: "I'm low risk" / "I'm high risk" / silent.
2. READ: **The Bar.** Last round's members vote on whether to bar one applicant from joining this round (strict majority of members; one bar per round). The audience poll shows the table's belief about each contestant's risk. Cast on the move screen, together with ACT.
3. ACT: buy cover or not; gym or not (gym is public).
4. REVEAL: the Wheel of Misfortune for each contestant (v1), then the price board: "38 to 62. Last round's pool was mostly risky people."

Bots value debt over the episode's remaining rounds, not only the current one (D-122).

**Peak moment:** round 4's result under the voted regime, then risk cards flip with the claims stamped TRUE or LIE.
**Why this teaches:** players do adverse selection to each other. Safe players leave because the price is too high, risky players lie to stay in, and the bar is screening, which is what real insurers try with underwriting. The mandate vote ends the game of chicken.
**Mechanism check E3 (updated for the launch round):** in round 2 (the first voluntary round), high-risk buyers outnumber low-risk buyers at least 2 to 1 (E3a), and the mean round-3 price is at least 15% above round 2 when the market is open (E3b). The bar targets a high-risk contestant more often than a low-risk one (E3c: screening works somewhat), and the price round 3's pool sets is still above the round-2 price with the bar active (E3d: screening doesn't fully fix it).

### Episode 4: "The Hiring Round" (you are HireBot)
**Mechanism:** old beliefs plus incentives create a gap with no prejudiced player.
**Rounds:** 4. Rounds 1 and 2 baseline; the policy vote; rounds 3 and 4 under the policy. Groups, care probabilities, costs, test accuracy and wages as in Study and v1.

**The judge seat rotates:** each round one contestant is the judge (each sits once in 4 rounds). The other three are workers.

**Each round:**
1. ACT (workers): train or not, at their drawn cost. Private.
2. CLAIM (workers): "I trained" / silent.
3. READ (judge): for each worker the judge sees group, test result and claim, plus **the HireBot meter**: the posterior chance the worker is skilled, computed from the group's current belief and the test exactly as Study does. The judge hires each worker for the complex job or the simple job.
4. Judge's pay: `PLAY.JUDGE_BASE = 40`, plus `PLAY.JUDGE_GAIN = 20` per skilled worker hired complex, minus `PLAY.JUDGE_LOSS = 30` per unskilled worker hired complex. With these numbers a payoff-maximizing judge hires exactly when the posterior is above 30 / (20 + 30) = 0.6, which is Study's threshold. Keep that identity if you retune: `JUDGE_LOSS / (JUDGE_GAIN + JUDGE_LOSS) = L4.THRESHOLD`.
5. REVEAL: true skill of each hire, stamped GOOD HIRE or BAD HIRE; the group beliefs update as in Study.

**Bot judges** use the meter and the threshold (the Study HireBot rule). A human judge may do anything.
**Peak moment:** the end screen shows the gap and one line: "Nobody here was prejudiced. You hired by the numbers. The numbers came from last year." If the human judged, it shows their own hires: "You turned down 2 trained Squares."
**Why this teaches:** the player sits in the seat that produces statistical discrimination and finds the rational choice uncomfortable. As a worker, they then feel why training doesn't pay when the judge's belief is against you, which is the self-fulfilling part.
**Guardrail:** jokes target HireBot, the show and the meter. Never the groups. Circles and Squares stay abstract.
**Mechanism check E4 (unchanged):** the Circle minus Square gap is positive in at least 70% of episodes with bot judges; a Square who passes the test rarely gets a good job in round 1.

### Episode 5: "Grand Finale: Rewrite the Rules"
**Mechanism:** your sense of a fair rule moves once you know where you stand.
**Flow and numbers** as in v1 (life banks as incomes, max donation 40, fair answers before and after).

**Changes:**
1. CLAIM before the amendment votes: "I'll vote yes" / "I'll vote no" / silent, per amendment.
2. Donations are secret until the ballots land (unless the Leaked Receipts event drew).
3. REVEAL: ballots land one at a time. A donor whose recipient took the money and voted against them gets the stamp: **"Took your 40. Voted no."**
4. Then, in LIFE mode, **the Receipts** (Section 3.4), then the result card.

**Mechanism check E5 (unchanged).**

---

## 5. Events (trimmed)

- `PLAY.EVENT_CHANCE` falls from 0.6 to 0.4. Events now compete with the social layer for attention, and players need some quiet rounds (principle 5).
- Keep only cards that change a decision. Cut "Quiet Finale" (it's the same as no event) and any card the sim shows changes no bot choice in more than 90% of draws. Record cuts in DECISIONS.md.
- New Episode 3 card: **"Leaked Medical Files"**: everyone's risk type is shown to the pool for this round. (It shows what full information does: the bar becomes perfect and the pool holds. Only from round 2.)
- New Episode 2 card: **"Security Cameras"**: true effort is shown this round. (Shows what the Hustle Prize looks like when effort is observable.)

---

## 6. Feedback that teaches and pulls you back

### 6.1 Near misses
On each episode summary, one line from the existing counterfactual code: the single change to your own decisions that would have helped you most, with the amount. "Staying out of the pool in round 3 would have kept 41 coins." Only your own choices, never other players' private information.

### 6.2 What was really going on?
Unchanged from v1 (3 lines, then the link to Study). Add one line per episode naming the social layer's real-world twin: underwriting (the Bar), performance pay (the Hustle Prize), statistical discrimination (the judge), lobbying (Bought Votes), and information (the Peek).

### 6.3 Episode summary
One screen: biggest lie, biggest wrong read, your bank change, mission progress, near miss, card guess result, "What was really going on?". No tables.

---

## 7. Retention and sharing (build only after Gate 2, Section 9)

| Feature | What it is | Pillar it serves |
|---|---|---|
| Daily Life | One shared seed per day for a full life against the bots. A spoiler-free result: emoji grid per episode (banked, lied, caught, debt) plus final rank. | Personal challenge, retention |
| Result card v2 | v1's card plus your honesty record ("Lied 3 of 11 times. Caught twice.") and a title from honesty x fair-answer shift x rank ("Honest until payday", "Lied once. Won everything."). | Funny story, social experiment |
| Party link | "Play one episode with me": a room link that starts at a chosen episode with bots filling empty seats. A first-time guest is playing within 30 seconds of opening the link. | Easy invitation |
| Achievements | Named after the economics, shown on the result card: Death Spiral (the pool emptied), Lemon (lied about risk and got in), Free Rider, Glass Ceiling Breaker, Kingmaker (your donation decided an amendment), Veil Piercer (peeked and won). At most 12. No grinding achievements. | Mastery, funny story |
| Rival line | After a life, "Chet beat you by 12. Rematch with the same seed?" | Reason to go again |

No streaks with penalties, no notifications, no currency for sale.

---

## 8. Targets

### 8.1 Mechanism checks (simulator, must pass)
E1 to E5 as updated in Section 4.

### 8.2 Social-layer checks (simulator, design targets)
- S-a: bots lie in 15% to 50% of claims where lying would pay (lies exist but aren't constant).
- S-b: a reader using the bots' beliefs judges a claim TRUE or LIE correctly 55% to 80% of the time (interpretable, not solved).
- S-c: in Episodes 2 to 5, the targeted action (bar, prize, hire, bribe) goes to a different contestant than it would under full information in 20% to 50% of episodes (reading matters).
- S-d: the honest bot (Marigold) and the liar (Chet) each win a life between 15% and 40% of the time (honesty isn't dominant either way).
- v1's F-a to F-f stay, except F-d, redefined by the author after Q1: a big moment is an event card, an 80+ coin swing, a bar, or a lie stamped at the reveal that changed someone's outcome (a liar who got in, or an honest player who was barred). Target unchanged: at least 90% of episodes.

### 8.3 Human playtest checks (the gates)
Run on 3 to 5 people who haven't seen the game. Don't explain anything. Record:
- Time to first decision (target under 30 seconds).
- Screens where they hesitated or asked "what do I do?".
- Laughs, accusations, arguments (count them).
- Did they start another episode without being asked? (The main number.)

Then ask the six stranger-test questions:
1. Explain the game in one sentence.
2. Which decision did you care about?
3. What surprised you?
4. How did your decision change the outcome?
5. Do you want another round? Why?
6. **Who would you play this with?** (Pass if they name a person.)

Plus one teaching question: "Why did the price go up?" (or the episode's equivalent). Pass if most answers name the mechanism in their own words.

---

## 9. Milestones and gates

| # | Milestone | Done when |
|---|---|---|
| Q1 | The spine (claims, track record, bot honesty traits, belief updates from claims and actions, the TRUE/LIE reveal, audience poll on READ screens) plus **Episode 3 rebuilt as The Pool**, near misses, and the 3 UI fixes (Section 10). | Golden Study passes; E3 and S-a, S-b pass or are reported; Episode 3 playable at 375 px; a preview link exists. **Stop and report.** |
| Gate 1 | The author runs the human playtest (8.3) on Episode 3. | At least 3 of 5 voluntarily replay, or name a person in question 6. If it fails, revise Episode 3 before going on. |
| Q2 | Episode 4 (the judge) and Episode 1 (the Peek). | E1, E4, S-c pass; both playable. **Stop and report.** |
| Q3 | Episode 2 (Hustle Prize), Episode 5 (Bought Votes), LIFE mode, the Receipts reel, result card v2. | All E and S checks pass or are reported; a full life is playable in under 25 minutes. |
| Gate 2 | Playtest a full life with 3 to 5 people. | Same pass rule as Gate 1, on a full life. |
| Q4 | Section 7 (Daily Life, party link, achievements, rival line), Play multiplayer, sounds, polish. | Two-player Play room end to end; a guest plays within 30 seconds of a link; Lighthouse accessibility at least 95. |

At every merge to main: redeploy the room server first (the rules hash changes), with the author's approval.

---

## 10. Small UI fixes (do in Q1)

1. Names under avatars everywhere (not only initials).
2. The results screen says what you did: "You bought cover." / "You stayed out."
3. Missions shown on the summary made the card guess before it pointless. Order: card guess first, then reveal missions.

---

## 11. Open items for the author

1. Whether claims in multiplayer stay preset-only or also allow free chat during CLAIM.
2. Whether a human judge in Episode 4 sees the HireBot meter by default or must tap to see it (seeing it by default makes the rational choice easier and the discomfort sharper; hiding it tests intuition).
3. The Daily Life share format (emoji grid or a short text line).
