# Dad's Games

An ad-free puzzle portal built for one player: my father, who has Alzheimer's.

He loves water sort, untangle, sudoku, and word puzzles. The free versions of
those games are built around ads, and the ads disorient him — he taps them,
loses the game, and sometimes ends up somewhere he doesn't understand. This is
the same games, with nothing else in them.

## What makes it different

- **Every puzzle is provably solvable**, and says so on screen. Puzzles are
  generated backwards from a solved state, and a test page proves 1,000 of them
  per game before anything ships. He never grinds against an impossible board.
- **Nothing ever interrupts.** No ads, popups, prompts, timers, scores,
  currencies, streaks, or update notices. Not even a friendly one.
- **Nothing can be lost.** The game saves after every single move and reopens
  exactly where he left it — through phone restarts, weeks of not playing, and
  airplane mode.
- **Recovery is always in the same place.** Undo, Start Over, and Home are
  visible in every game at all times. Never conditional, never hidden.
- **It works offline, forever**, from an icon on his home screen.

## Running it locally

```bash
node serve.js
```

No install step, no dependencies. Node's built-in modules only.

The server prints a LAN address so a real Android phone on the same wifi can
load it during development. (Service workers only register over https or
localhost, so offline behavior is tested on the deployed site.)

## Testing

Open `test/test.html` in a browser. It generates and verifies a thousand
puzzles per game, exercises the save/crash/rules paths, and must be fully green
before any deploy. That page is the whole test framework — there is no runner
to install.

## Stack

Plain HTML, CSS, and JavaScript. No framework, no build step, no dependencies —
chosen deliberately so this still works and can still be maintained years from
now, on any machine, with or without a toolchain.
