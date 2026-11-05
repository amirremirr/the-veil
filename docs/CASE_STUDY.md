# The Veil: a case study

*Draft, November 2026. Amirreza Akhavan, with AI assistance in design review and implementation.*

## The question

The Veil asks one question across five short episodes: does where you stand change what you think is fair? Players move through a life on a game show. Each episode stages one well-known mechanism from economics, and in the Play version each mechanism runs through the players themselves: they make claims that may be false, read each other, and act on what they believe. The Study version, kept frozen and checked by replay tests at every change, presents the same mechanisms as a calmer classroom game.

## The economics, episode by episode

**Episode 1, Born: the veil of ignorance.** Players vote on how income is shared before they know their own income (Rawls 1971; Harsanyi 1955). In round 2 anyone may pay to peek at their income first, and everyone sees who peeked. The question is whether knowing your place changes your vote. In the bot simulation it does: among peekers, the share voting for no redistribution rises from 0% at the lowest income to 38% at the highest.

**Episode 2, First Hustle: effort, luck and the cost of taxes.** Income is talent times effort plus luck; only the total is public. Taxes reduce the return to effort, so effort falls as taxes rise (the incentive cost of redistribution; Mirrlees 1971). A Hustle Prize goes to whoever the table believes worked hardest, which stages the problem of rewarding effort when you only see results (performance pay under moral hazard; Holmström 1979). Claims about effort are cheap and drift upward.

**Episode 3, Bad Luck Season: adverse selection.** An insurer prices cover from last round's buyers. Safe players leave when the price rises, so the pool gets riskier and the price climbs again (Akerlof 1970; Rothschild and Stiglitz 1976). Players claim their risk, and pool members can vote to bar applicants, which stages underwriting. A second hidden card (worry, which raises the cost of debt) means careful low-risk people buy too, so applying is not proof of risk (Finkelstein and McGarry 2006). A vote on a mandate ends the spiral.

**Episode 4, The Hiring Round: statistical discrimination.** A hiring algorithm judges two abstract groups, Circles and Squares, by a belief about each group updated from last year's workers. A worker from the group with the lower belief gains less from training, so fewer train, which keeps the belief low (Phelps 1972; Arrow 1973; Coate and Loury 1993). Players take turns as the judge, paid for good hires and penalized for bad ones, and see that the profit-maximizing rule produces a gap with no prejudiced person in the room.

**Episode 5, Grand Finale: self-serving fairness.** Players write the rules behind a veil, then see their incomes, propose amendments and buy votes in secret. An unpaid "what tax is fair?" question is asked before and after. People's sense of fairness tends to move toward their own interest once they know their position (Babcock and Loewenstein 1997). In the bot simulation this shift is programmed in, and the game says so; with people it is the open question.

## Design principles

Seven rules guided the Play version: meaningful choices, uncertainty that comes from people rather than dice, feedback within seconds, learnable opponents, quiet-tense-reveal pacing, actions that target another player in every episode, and sessions of five minutes per episode. Each became a check: for example, bots must split between their top two options at least a quarter of the time, and every screen must fit a phone without scrolling. One rule governs everything: the game may bend numbers for drama, never cause and effect. Each episode's mechanism is a gating test in a bot simulator, run after every change.

## From "clear but not fun" to a social game

The first Play version had players choose from options with a near-computable best answer while a wheel decided outcomes. The author's own playtest found it clear but not fun. The redesign moved the uncertainty from dice to people, starting with Episode 3, and took several rounds of review (decisions D-110 to D-149 in the repository).

The numbers show the path. In the first social version, bars hit a high-risk player 99.6% of the time and a reader of the bots' beliefs judged claims right 92.6% of the time: the hidden information was effectively public, because applying for cover gave risk away. Adding the worry card made applying ambiguous (low-risk applicants rose to 20% of the round-2 pool) but lies still succeeded 97.8% of the time. Grounding the bar in prices, so that a member bars an applicant by the expected saving on next round's premium, brought bar accuracy to 74.5% and lie success to 70.1%, inside the 50% to 75% target. Later changes (independent cards, gifts, difficulty levels) settled at bars hitting high risk 66.5% of the time, lie success 69.4%, and a claim reader at 83.1%, still above its 80% target.

The general lesson, applied to the other four episodes, was that a claim must pay through other players' decisions, computed from the game's payoffs. Where it did not (in Episodes 1, 4 and 5 of the first full build), bots never lied and reading was trivial. A second round fixed this: Episode 5 donors fund players who promise to vote yes, which gives false promises a reason; Episode 4 judges read "I trained" by Bayes' rule, discounted by the worker's record; Episode 1 bots vote strategically and treat claims as polls.

## What the AI reviewers found

Two kinds of AI review were used, both proxies and labeled as such: persona playtests (an AI reading every screen as a skimmer, a careful reader and a bluffer) and fresh-eyes reviews by reviewers who saw only screenshots. They found mostly clarity problems: a price board that said "No change" while the numbers moved, a summary that announced a winner from scores hidden until the end, lines that told life players they didn't know an income that was public. An automated accessibility scan of every screen found two markup errors, both fixed. The fresh-eyes reviews are in `docs/playtest/fresh-eyes.md`.

## What is still unproven

No human has played the Play version. Every result above comes from bots following rules written for them, so they describe the model, not people. The two planned human playtests, one of Episode 3 and one of a full life, have not happened. Nothing here shows that people find the game fun, that they replay it, or that it teaches the mechanisms better than a lecture. Some design targets still miss in simulation, and they are listed in `docs/AUTORUN_REPORT.md`. The next step is the human playtest.

## References

Akerlof, G. (1970). The market for "lemons". *Quarterly Journal of Economics* 84(3).
Arrow, K. (1973). The theory of discrimination. In *Discrimination in Labor Markets*.
Babcock, L. and Loewenstein, G. (1997). Explaining bargaining impasse: the role of self-serving biases. *Journal of Economic Perspectives* 11(1).
Coate, S. and Loury, G. (1993). Will affirmative-action policies eliminate negative stereotypes? *American Economic Review* 83(5).
Finkelstein, A. and McGarry, K. (2006). Multiple dimensions of private information. *American Economic Review* 96(4).
Harsanyi, J. (1955). Cardinal welfare, individualistic ethics, and interpersonal comparisons of utility. *Journal of Political Economy* 63(4).
Holmström, B. (1979). Moral hazard and observability. *Bell Journal of Economics* 10(1).
McKelvey, R. and Palfrey, T. (1995). Quantal response equilibria for normal form games. *Games and Economic Behavior* 10(1).
Mirrlees, J. (1971). An exploration in the theory of optimum income taxation. *Review of Economic Studies* 38(2).
Phelps, E. (1972). The statistical theory of racism and sexism. *American Economic Review* 62(4).
Rawls, J. (1971). *A Theory of Justice*.
Rothschild, M. and Stiglitz, J. (1976). Equilibrium in competitive insurance markets. *Quarterly Journal of Economics* 90(4).
