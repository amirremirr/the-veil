# Running a playtest with the built-in kit

For Amir. Nothing here sends data anywhere: each tester copies a short code and sends it to you by hand.

## 1. Make a link

1. Push the branch you want tested (for example `autorun`). Vercel builds a preview for every pushed branch.
2. In the Vercel dashboard open the project, then Deployments, pick the branch's latest preview, and copy its URL. If the preview is protected, use "Share" to make a shareable link.
3. Add `?playtest=1` to the end: `https://<preview-url>/?playtest=1`. That turns on playtest mode for that visit (testers can also tick "Playtest mode" on the Play menu).

Playtest mode only adds a private log in the tester's browser and a short survey after each episode or life. The game itself is unchanged.

## 2. The message to send

> Hi! Could you try a short phone game I made? It takes about 5 minutes for one episode. Open this link on your phone: <link>. Tap "Play", pick "Episode 3: Bad Luck Season", and play without asking me anything. At the end, tap "Playtest: a short survey", answer what you like, tap "Make my results code", and send me the code. Thanks!

For a full life (about 10 to 25 minutes), say "Daily Life" instead of Episode 3. To make everyone play the same game, give them a challenge code (for example `playtest-1`) to type into "Challenge code" on the setup screen.

Don't explain the rules. The point is to see what's unclear.

## 3. Read the results

1. Open `https://<preview-url>/?playtest=results`.
2. Paste every code you received, one per line, and tap "Show results".
3. You get the totals and one row per tester:
   - **Tapped Play again within 10 s**: the main number (Gate 1 and 2 ask whether people replay).
   - **Median time to first decision**: target under 30 seconds.
   - **Longest screens**: where people hesitated.
   - **Another round? / Play with**: the stranger-test answers ("who would you play this with?" passes if they name a person).
   - Per tester: what they lied, barred, gave or peeked, their one-sentence explanation, and their answer to "why did the price go up?".

## 4. Afterwards

Write down laughs, accusations and arguments while watching, if you are in the room: the kit can't count those. Gate 1 passes if at least 3 of 5 testers replay unasked or name a person to play with.
