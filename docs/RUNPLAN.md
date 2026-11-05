# AUTORUN: one unattended build session

**Owner:** Amirreza Akhavan. **Written by:** the design reviewer. **Branch:** `autorun` (made from `play-mode` at d01915b).
**How it runs:** `scripts/autorun.ps1` starts a fresh Claude Code session for each task below, in order, each with its own spending cap. Nobody is watching. Amir reviews everything afterwards from `docs/AUTORUN_REPORT.md`.

Each session: read this whole file, `docs/PROGRESS.md`, `docs/PLAY_V2_SPEC.md`, `docs/PLAY_MODE_SPEC.md` (v1.0, the baseline that v2 builds on: bank, debt stress, missions, events, event decks, theme, tone), the recent end of `DECISIONS.md`, then do **only the task you were given**, then update PROGRESS.md and stop.

---

## A. Rules for every task (these override anything else)

### A.1 Never wait for a person
- Nobody will answer a question. Never stop to ask. When a choice is needed, take the option most consistent with the spec and Section B below, record it in DECISIONS.md tagged **[AUTORUN, review]**, add one line under "Needs Amir" in PROGRESS.md, and carry on.
- If the spec or a stop rule says "stop and report", treat it as "record it, choose the closest workable option, continue".

### A.2 Hard limits (never break)
1. **Study mode is frozen.** `tests/engine/golden.test.ts` must pass at every commit. Never edit Study params, Study level behavior or the golden files.
2. Work only on the `autorun` branch. Push only `autorun`. **Never** merge into or push to `main`, never push to `play-mode`, never force-push.
3. Never deploy: no wrangler, no vercel CLI, no room-server deploy, no login commands. Never read, print or ask for credentials.
4. Never delete outside the repo, and never delete `node_modules` (a previous run deleted it by following a symlink). If you make a temporary copy of the repo, delete only that copy by its exact path, and never follow symlinks.
5. Every Play number in `src/engine/play/params.ts`, every Play string under `play.*`, **no em dashes** in any text, file or commit message.
6. D-entries continue from the last number in DECISIONS.md.
7. Satire never mocks disability, illness, caregivers, gender or real groups. Circles and Squares stay abstract.
8. **Human validation is outstanding.** The spec's Gate 1 and Gate 2 (human playtests) have not happened. This run builds past them on purpose, because of time. Never describe an AI playtest as a human playtest, never say a gate passed, and never claim the game is fun or that people replay it. AI playtest findings are labeled "AI playtest (proxy, not human evidence)" everywhere. The final report lists both gates as **not done**.
9. If something the spec relies on can't be found in the repo or in either spec, don't reconstruct it from guesswork: choose the simplest version consistent with the engine, mark it [AUTORUN, review], and list it under "Needs Amir".

### A.3 Start of every task
1. `git status`. If the tree is dirty (a previous session was cut off by its budget): run the quality gate (A.4). If it passes, commit as "AUTORUN: finish interrupted work" and push. If not, run `git stash push -u -m "wip-<task>"`, record it in PROGRESS.md, and start clean from HEAD.
2. Read PROGRESS.md to see what earlier tasks did, chose and left failing.

### A.4 Quality gate (before every commit that ends a task)
- `npm run typecheck`, `npm run build` (includes the rules-version check; regenerate with `npm run rules-version` when the engine changed), `npm test` (all unit tests, including golden), `npm run e2e`.
- Walkthrough at 375x760 for every episode you touched (`npm run walkthrough -- --ruleset PLAY --episode N`): no screen taller than the viewport, no horizontal scroll.
- Simulator checks for every episode you touched (`npm run sim -- --ruleset PLAY ...`), with mean ± SE.
- Run e2e and the simulator **one after the other, not in parallel** (parallel runs caused timeouts before).
- If the gate fails and you can't fix it within the task: commit the work to a new branch `autorun-wip-<task>`, push that branch, return `autorun` to its last green commit, mark the task FAILED in PROGRESS.md with the reason, and stop.

### A.5 End of every task
- Commit with a clear message ending in the attribution lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- `git push origin autorun`.
- Update `docs/PROGRESS.md`: task status (DONE / PARTIAL / FAILED), commits, sim table, walkthrough numbers, choices made, "Needs Amir" lines. Commit and push that too.
- Stop. Do not start the next task (the script starts it in a fresh session).

### A.6 Spend carefully
- Don't print whole large files or long logs into the conversation; read the parts you need.
- Tuning sweeps: at most 6 runs of 500 games per task, then one confirming run of 2,000. If a target still misses, report it and move on.
- Prefer finishing a smaller piece cleanly over starting a large piece you can't finish.

---

## B. What Episode 3 taught us (apply to every episode)

These came from five rounds of review on Episode 3. Read D-110 to D-149 for the details.
1. **Hidden information must not be given away by the obvious action.** In Episode 3, risk was the only secret, so applying for cover revealed it. Fixed with a second hidden motive (the worry card). In every episode, check that the action a player takes doesn't reveal the secret more than about 80% of the time. If it does, add a second motive or noise.
2. **Bot rules come from the game's payoffs.** Example: the Bar values a bar by the member's expected price saving (D-133). Don't invent constants like "value 40 minus threshold".
3. **Group decisions need at least half of the others, never unanimity** (D-133).
4. **The fun metrics that matter:** lie success 50% to 75% where claims exist; at least 20% of targeted decisions are contested (belief between 0.35 and 0.65); every E check passes. Precision of a targeted action is not a target.
5. **Seats 2, 3 or 4, default and "Best with 4".** Hidden cards are drawn independently and the totals are never told ("Nobody knows how many..."). If tables where everyone holds the same card push an E check out of range, use a hidden redraw at 3 and 4 seats, mention it in About (D-141). Tune at 4 seats; report 2 and 3.
6. **Give is part of the spine.** On every move screen in every episode, a player may give 0, 5 or 10 coins to one other player, with no match (D-142, D-149). Every choice tile shows its mission preview, "Mission +6" (D-143).
7. **Difficulty changes what you see** (D-145): Easy always shows the audience poll and bots are more honest; Hard hides the poll and bots lie more.
8. **Copy limits:** a claim screen at most 40 words, a move screen at most 65, every screen fits 375x760, at most 10 decision screens per episode, at most 5 minutes per episode at a realistic pace (3 seconds per claim screen, 8 per move screen, plus reveal durations). The life takes at most 25 minutes.
9. **Debt stress lines are exact:** "In debt after a round: -N points per coin owed, at most M."
10. **Names:** show the player's chosen name, with the yellow ring as the "you" marker.
11. **Every episode ends with a peak reveal** (stamps TRUE/LIE and the episode's twin of "Just a Worrier"), then the card guess, then missions, then the summary with a near miss and "What was really going on?".

---

## C. The tasks, in order

Budgets are set in the script. If a task runs out of budget, the next session finishes or stashes its work (A.3).

### T0. Smoke test (tiny)
Check that this session can run without prompts: `git status`, `npm test -- tests/engine/golden.test.ts`, write `docs/PROGRESS.md` from the template at the end of this file, commit it, push `autorun`. Report "SMOKE OK" in PROGRESS.md. Nothing else.

### T1. AI playtest of Episode 3, then clarity fixes
A proxy for the human playtest, not a replacement. Label it that way everywhere.
1. With Playwright, play Episode 3 at 4 seats on Normal three times, as three personas: **Skimmer** (reads only headlines and buttons, taps fast), **Careful** (reads everything), **Bluffer** (lies every round, bars aggressively). Save a screenshot of every screen.
2. Look at every screenshot as that persona. For each screen, write: what the persona thinks they're supposed to do, what they'd misunderstand, and the word count. Then answer for each persona: could they explain "why did the price go up?" from the screens alone, and did their mission change what they did?
3. Write the findings to `docs/playtest/ai-ep3.md`.
4. Fix only clarity problems: copy, order, layout, missing labels. **Don't change mechanics or numbers.** Re-run the gate and the walkthrough.

### T2. Episode 4: "The Hiring Round" (you are HireBot)
Build per PLAY_V2_SPEC.md Episode 4 plus Section B.
- The judge seat rotates. With fewer than 4 seats, rotate through all seats and keep 4 rounds.
- Judge pay: keep the identity `JUDGE_LOSS / (JUDGE_GAIN + JUDGE_LOSS) = L4.THRESHOLD`.
- Open item 2, decided here: the HireBot meter is shown to a human judge on Easy and Normal, and hidden on Hard.
- Claims: workers claim "I trained" / silent. Check B.1: training must not be readable from public actions more than about 80% of the time. The test result is the noisy signal, so it should hold; measure it.
- Reveal stamps: GOOD HIRE / BAD HIRE, and the end line "Nobody here was prejudiced. You hired by the numbers. The numbers came from last year." plus the human's own record as judge when they judged.
- Sim: E4 (gap positive in at least 70% of episodes with bot judges; a passing Square rarely gets a good job in round 1), lie success, contested hires (judge's posterior between 0.35 and 0.65), F-d, F-f, mission shares. Calibrate per-episode mission scales if needed (store them per episode).
- Guardrail: jokes target HireBot, the show and the meter, never the groups.

### T3. Episode 1: "Born" (the Peek)
Build per the spec plus Section B. Round 1 pure veil; round 2 offers the Peek at PLAY.PEEK_COST; claims are about votes ("I'm voting X" / silent); votes flip one at a time with broken-promise stamps; then incomes flip poorest first; the peak shows peekers' votes next to their incomes.
- E1 updated: no non-peeker sees an income before voting (structural test); among bot peekers, the share voting for the least redistribution rises with income.
- Lie success here is "a broken promise that wasn't punished"; define it in a D-entry and measure it.

### T4. Episode 2: "First Hustle" (the Hustle Prize)
Build per the spec plus Section B. Effort is private; gross income and luck are public; claims about effort on a 3-step scale; the Hustle Prize by plurality vote (not yourself), ties split; the Security Cameras event shows true effort for a round.
- E2: mean effort falls as the tax rises (negative slope). Added: mean claimed effort exceeds true effort. If the prize flips the E2 slope, shrink the prize first.
- Check B.1: income reveals effort less than about 80% of the time (luck is the noise).

### T5. Episode 5: "Grand Finale" (Bought Votes)
Build per the spec plus Section B. Claims per amendment ("I'll vote yes / no" / silent); secret donations until the ballots land one at a time; the "Took your 40. Voted no." stamp. In EPISODE mode, incomes come from the Study deck times 2.
- E5 unchanged (the bots' fair-answer shift has a negative slope on wealth rank, labeled as programmed).

### T6. LIFE mode, the Receipts, result card v2
- LIFE mode: five episodes in order, banks carry over (PLAY_MODE_SPEC.md v1 Section 4), missions and honesty records persist for the life, hidden cards are dealt again each episode, the comeback card (v1 6.3).
- Near misses in LIFE: snapshot each episode's start (D-114 noted this).
- **The Receipts** (v2 3.4): a reel at most 20 seconds long, skippable, replaced by a static list under reduced motion: every lie that worked, every lie caught, every betrayal, then all missions flip at once.
- Result card v2 (v2 Section 7): canvas to PNG; Web Share on mobile, download on desktop; honesty record line; a title from honesty, fair-answer shift and rank (write at least 20 titles); "Just for fun. Not a diagnosis."; no other player's private information.
- Calibrate a separate `MISSION_SCALE_LIFE` on full lives. Sim on lives: F-a to F-f, E5, mission shares 15% to 35% each.
- Walkthrough a full life at 375x760 and report the total time at a realistic pace (target at most 25 minutes).

### T7. AI playtest of a full life, then polish (automated QA)
- Repeat T1's method on a full life (one Skimmer, one Careful). Write `docs/playtest/ai-life.md`.
- Fix clarity issues only. Then: an accessibility pass (keyboard focus, labels, contrast AA, reduced motion; use axe through Playwright if it installs from npm, otherwise check by hand), a copy pass (no em dashes, word limits from B.8), and a speed check (the summary near-miss step and sim run time; optimize only if it changes no result, verified by matching game hashes).

### T8. Retention without dark patterns (v2 Section 7, minus multiplayer). Conditional.
**Do this only if T2 to T7 are all DONE and the quality gate is green.** Otherwise skip it, mark it SKIPPED in PROGRESS.md and go to T9. Gameplay comes first: five solid episodes matter more than achievements and daily challenges.
- **Daily Life:** the seed is the date (Europe/Istanbul day); one shared life per day against bots; a spoiler-free share text (emoji grid per episode plus the final rank), copied to the clipboard or Web Share.
- **Achievements:** at most 12, named after the economics (Death Spiral, Lemon, Free Rider, Glass Ceiling Breaker, Kingmaker, Veil Piercer, and others you define), stored locally with try/catch, shown on the result card. No grinding achievements.
- **Rival line:** "Chet beat you by 12. Rematch with the same seed?"
- No streak penalties, no notifications, no timers that punish leaving.
- Skip the party link and Play multiplayer: they need the room server, which can't be deployed tonight. Note this in PROGRESS.md.

### T9. Final report
Write `docs/AUTORUN_REPORT.md` for Amir, short and plain:
1. What was built, per task, with status.
2. One table per episode: every E and S check, mean ± SE, pass or fail.
3. Everything that fails or was left out, and why.
4. The top 10 "Needs Amir" decisions, each with the choice made and the alternative.
5. A section "Human validation: NOT DONE" stating that Gate 1 and Gate 2 are still outstanding and that nothing in this run shows whether people enjoy or replay the game. Then what to playtest first with people, and the challenge code to use.
6. The latest `autorun` commit and the rules hash. Note that merging to `main` needs the room server redeployed first.
Update README's Status table. Commit and push. Write "ALL DONE" as the last line of PROGRESS.md.

---

## PROGRESS.md template (T0 creates it)

```
# AUTORUN progress

| Task | Status | Commits | Notes |
|---|---|---|---|
| T0 smoke | | | |
| T1 AI playtest Ep3 | | | |
| T2 Episode 4 | | | |
| T3 Episode 1 | | | |
| T4 Episode 2 | | | |
| T5 Episode 5 | | | |
| T6 LIFE, Receipts, result card | | | |
| T7 AI playtest life, polish | | | |
| T8 Retention (conditional) | | | |
| T9 Report | | | |

## Needs Amir

## Stashes and wip branches

## Log
```

---

## D. Round 2 (second unattended session, same rules as Section A)

Round 1 built everything, but the claim layer is dead outside Episode 3: in Episodes 1, 4 and 5 a claim earns a bot nothing, so bots never lie, and reading is trivial. A game where only one episode has bluffing breaks the spine (v2 Section 3). Round 2 fixes that, then life stakes. Same Section A rules, B lessons, quality gate, commit and push after every task, PROGRESS.md updated after every task (add rows R1 to R7). Order: R1 to R6, then Section E (E1 to E5), then Section F (F1, F2), then R7 last. If it's after 09:45 Istanbul time, skip to R7.

The principle for every fix (B.2): **a claim must pay through other players' decisions, computed from the game's payoffs.** Players who listen must also discount by credibility (the speaker's record and the table's known honesty mix), so lies pay sometimes and get caught sometimes. No invented constants.

### R1. Episode 5: donations follow promises
- Bot donors decide whom to fund using claims: a donation goes to delegates who claim "I'll vote yes" on the donor's preferred amendment, weighted by the chance they're pivotal and by their record (Ep3's (kept + 1) / (made + 2)).
- Bot recipients now have a reason to claim yes falsely: the expected donation. Use Ep3's claim rule (gain x (1 - honesty) against CREDIBILITY_VALUE x record loss).
- Targets: S-a 15% to 50%; lie success (claimed yes, received a donation, voted no) 30% to 75%; "Took your 40. Voted no." happens in 20% to 60% of games; E5 still passes.
- Cut the claim screen to at most 40 words (show the amendments compactly; don't add decision screens).

### R2. Episode 4: judges read claims, discounted by credibility
- Bot judges update on "I trained" by Bayes' rule, with P(claim | untrained) estimated from public information: the worker's record and the table's honesty prior. Replace "meter only" (D-155). The meter shows the posterior including the claim.
- Bot workers claim by Ep3's rule; the gain is the change in the chance of the complex job times the wage difference.
- Targets: E4a and E4b pass (gating); S-a 15% to 50%; lie success 30% to 75%; training read with the claim at most 85%; contested hires at least 20%.
- If E4b fails under every setting of PLAY.CLAIM_WEIGHT_EP4 in [0.1, 1] (at most 6 sweeps), go back to meter-only, keep the code behind the setting, and report the table.
- Add one line to "What was really going on?": "Everyone says they trained. Talk is cheap, so the old belief about your group still decides."

### R3. LIFE stakes: debt must be possible
- F-f in a life is 0.1% (target 30% to 70%). Tune only LIFE-level Play params: `PLAY.LIFE_STARTING_BANK` (new), `PLAY.LIVING_COST` in LIFE (new override `PLAY.LIFE_LIVING_COST`), and an Episode 3 loss override for LIFE. At most 6 sweeps of 300 lives, then confirm on 1,000.
- Also try to lift F-a (lead changes, 1.91, target 2) and F-d (89.7%, target 90%) with the same knobs. Don't tune episodes for this.
- Measure E3a to E3d inside a life (round 1 never did) and report them.

### R4. The life's first fair answer
- Ask the unpaid "What tax rate do you think is fair?" before birth, in Episode 1's intro (v1 Section 5, Episode 1). Episode 5's second answer and the result card's title use the shift from Episode 1 to Episode 5 in LIFE mode. In EPISODE mode, Episode 5 keeps asking both.

### R5. Episode 2: tune lying
- S-a is 82% (target 15% to 50%) and lie success 13.5%. Add a per-episode `CREDIBILITY_VALUE_EP2` and tune S-a into range; report lie success and S-b. If the Hustle Prize vote ignores claims, make voters discount claims by credibility as in R2.

### R6. Episode 1: claims as polls
- Bots vote strategically under plurality: each votes for its best rule among those it believes can win, using claims as polls, discounted by record (strategic voting under plurality is real; Duverger's law). That gives claims a payoff: claiming a rule makes it look viable. Bots claim by Ep3's rule.
- Targets: S-a at least 5%; report lie success and S-b. Episode 1 is the tutorial, so low lying is acceptable. E1 must pass.

### R7. Report (always last, after Sections E and F)
- Add a "Round 2 and the big-picture review" section at the top of `docs/AUTORUN_REPORT.md`: per task, the new sim table, what passed, what didn't, the big-picture verdict from E2 and E5 (per episode: strongest moment, weakest moment, would a first-timer want another round, and why), the fixes made in E5 and the ones left, and new "Needs Amir" items. Keep "Human validation: NOT DONE". Update README Status. Commit, push. Write "ROUND 2 DONE" as the last line of PROGRESS.md.

---

## E. The big-picture review: is this a good game? (after R6, before R7)

Everything so far checked numbers. This section checks the game itself: is it clear, does it feel good, are the choices interesting, would someone want another round. Judge by what a player sees and does, not by the code. Same Section A rules. **Everything here is AI judgment, a proxy, not human evidence**; label it so, and never claim the game is fun.

### E1. Fresh eyes (independent reviewers)
- Capture a full LIFE at 375x760 on Normal (one screenshot per screen, plus the timing of each reveal) and one Episode 3 on Hard.
- Start **two separate subagents that have not seen the code, the spec or this plan.** Give them only the screenshots in order, plus one sentence: "This is a mobile browser game; play along screen by screen."
  - Reviewer A, an experienced game designer (party and social deduction games such as Coup, Werewolf, Among Us, Jackbox). Ask: what is this game in one sentence; where were you bored, confused or overloaded; which moments are fun and why; which choices are interesting and which are obvious or fake; what is missing that games in this genre have; would you play another round, and with whom; the top 5 changes, ranked.
  - Reviewer B, a casual first-time player, not an economist. Ask: what did you think you were supposed to do on each screen; where did you get lost; what made you laugh or care; when did you want to stop; would you play again.
- Save both verbatim to `docs/playtest/fresh-eyes.md`. Don't argue with them in the file.

### E2. Design audit against the principles
- For each episode and for the life, score the seven principles (v2 Section 1), the emotional loop (goal, think, surprise, meaning, reason to go again) and the five reasons to share (funny story, personal challenge, social experiment, betrayal, easy invitation) as Strong / OK / Weak, each with evidence (screen numbers, sim numbers, reviewer quotes).
- Name the single weakest moment of each episode and of the life.
- Save to `docs/review/design-audit.md`.

### E3. Game-logic audit (not economics: is it a good game system?)
Use the simulator. For each episode, measure:
- **Dominant and dead options.** The choice rate of every option for bots. Any option chosen in under 3% or over 97% of chances is dead or forced; list it.
- **Fixed strategies against adaptive play.** Replace one bot with a fixed rule and compare its mean final score with an adaptive bot's: always lie, always silent, always truthful, never bar or always bar, never give or always give, always buy cover, always peek, always claim "I trained", always donate the maximum. If a fixed rule beats adaptive play by more than 1 SE, the game has a dominant strategy; if every fixed rule ties, decisions don't matter. Report both cases.
- **Exploits** a min-maxing human would find: gift loops, vote coordination, timing tricks, reading another player's private card from the UI or the logs, replaying a challenge code to learn the deck.
- **Information leaks in the UI:** anything on screen (counts, colors, order, animation timing, the audience poll) that gives away hidden cards more than the rules intend.
- **Dead time:** screens with no decision and no reveal; consecutive screens with nothing new.
- **Consistency across episodes:** the same verb (claim, read, move, reveal, give) looks and works the same everywhere.
- Save to `docs/review/logic-audit.md`, with tables.

### E4. UI and UX audit
- Heuristic review of every Play screen (Nielsen's ten heuristics), with screenshots: visual hierarchy (is the decision the most prominent thing), tap targets at least 44 px, empty or crowded areas, contrast, consistency of components across episodes, how fast the onboarding cards get to the first decision, whether every number shown is needed for the decision on that screen.
- Feel: reveal timings (too slow or too fast), the peak screen of each episode (does it look like a peak), transitions, how a loss and a win feel different.
- Voice: count how often each host and bot line repeats across one life; flag repeats and flat lines; check the humor stays inside the guardrails (A.2 rule 7).
- Save to `docs/review/ux-audit.md`.

### E5. Fix the most important problems
- Merge findings from E1 to E4 into one ranked list in `docs/review/fix-list.md`, by impact on fun and clarity divided by effort.
- Implement from the top, as many as time allows (aim for 10 or more). Copy, layout, pacing, feedback, voice and UI changes are free. Game-logic changes are allowed when E3 shows a dominant strategy, a dead option or an exploit, **only if every E check still passes**; record each as a D-entry with [AUTORUN, review].
- After each group of fixes: the quality gate, walkthroughs, commit and push.
- Finish by rerunning E1's Reviewer B (a new subagent, fresh) on the updated screenshots, and save the before and after comparison in `docs/playtest/fresh-eyes.md`.

---

## F. Ready for later (after E5, before R7)

### F1. A self-running playtest kit (for when people play later; nobody plays tonight)
- **Playtest mode:** a URL flag `?playtest=1` (and a menu toggle). Off by default; normal play is unchanged.
- **Silent log**, in memory and local storage with try/catch, never sent anywhere: per screen, the time spent; time from first screen to first decision; taps on "back" or the menu; whether "Play again" was tapped within 10 seconds of the summary; the seats, difficulty, challenge code and episode; whether the player lied, barred, gave or peeked. Nothing about other players' private cards.
- **Short survey after the episode**, skippable, mostly taps: the stranger-test questions in v2 Section 8.3 plus "Was anything unclear at the start?" and "Did your mission change what you did?". At most two free-text boxes.
- **Results code:** "Send results" builds a compact code (JSON compressed and base64url, at most about 600 characters) with a copy button and Web Share. No server, no deploy.
- **Results page** at `?playtest=results`: paste one or more codes; it shows one row per tester and the totals (replay rate, median time to first decision, the screens where people spent the longest, survey answers).
- Tests: the code round-trips exactly; the log holds no private information about other players; playtest mode off changes nothing (walkthrough word counts unchanged).
- A one-page `docs/playtest/HOW_TO.md` for Amir: make a Vercel shareable link, the message to send friends, how to read the results page.

### F2. A case study draft (for professors and employers)
- `docs/CASE_STUDY.md`, at most about 1,500 words, plain prose: the question the game asks; the economics in each episode with sources (as in README Methods); the design principles; how Episode 3 went from "clear but not fun" to the social version, with the numbers from each tuning round (D-110 to D-149); what the AI reviewers found; what is still unproven, stated plainly ("no human has played it yet"). No marketing language, no em dashes.
