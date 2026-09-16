# Dad's Games — project instructions

An ad-free puzzle portal for Travis's father, who has Alzheimer's. He plays on a
Samsung Galaxy S10 (Chrome, 360x760 CSS viewport). Travis sets the phone up once
and is usually remote afterward.

Design doc (source of truth):
`~/.gstack/projects/Claude/travi-unknown-design-20260714-165856.md`

## The one rule everything else serves

**The game never lies to him, and never interrupts him.** Every puzzle is
machine-verified solvable before it is shown. Nothing ever pops up, fades in,
asks a question, or takes over the screen except the win celebration.

## Hard constraints — do not violate without an explicit decision

- **No build step. No npm dependencies. No framework.** Plain HTML/CSS/JS that
  runs exactly as written. The reason is maintainability years from now with AI
  help, on a Windows box, by a first-time coder. `serve.js` uses Node built-ins
  only.
- **Never call `localStorage.clear()`** or iterate-and-delete storage keys.
  Every key is namespaced `portal.*` (`portal.watersort.save`,
  `portal.settings`, `portal.errors`). Clearing storage erases his in-progress
  games.
- **Tap-only input.** No drag gestures anywhere. Tap to select, tap to act.
  Minimum 64px touch targets, minimum 24px text, high contrast.
- **Every screen fits 360 x 760 CSS pixels without scrolling.** That is the
  S10's viewport. A game board that needs scrolling to see is a game he can
  lose track of.
- **No prompts, banners, toasts, modals, confirmations, or questions** shown to
  the player. Recovery is three persistent controls present in every game at all
  times, in the same positions: **Undo**, **Start Over**, **Home**.
- **No timers, scores, streaks, currencies, level locks, or failure states.**
- **No network calls at runtime.** All state is on-device by explicit decision.
  No analytics, no telemetry, no beacons, no fonts or scripts from a CDN.
- **Service worker: never `skipWaiting()`, never an update prompt.** Version-
  stamped caches; a new version activates on the next launch only.
- **Every puzzle must be verified solvable** by construction (generated
  backwards from a solved state) or by solver before display, and proven at
  volume in `test/test.html`.

## Build order (from the eng review — the order matters)

1. Shared modules and the menu, **with no service worker**. A cache-first
   service worker during development is the classic way to lose hours to stale
   files. It goes in last; nothing else depends on it.
2. Water sort complete, with its test suites green.
3. Back-gesture trap spike on a real Android phone (Travis has an S25).
4. Service worker last. Then v1 installs on Dad's phone.
5. Then untangle (v1.1), sudoku (v1.2), word game (v1.3).

## Dev loop

```bash
node serve.js
```

Opens on `http://localhost:8080`, and prints a LAN address so the S25 can load
it over wifi. Service workers will not register over the LAN address (https or
localhost only) — test offline behavior on the deployed site or through
`chrome://inspect` port forwarding.

Run `test/test.html` in the browser and confirm every suite is green before any
deploy. That page is the test framework; there is no test runner.

## Deployment

GitHub Pages, from a dedicated GitHub organization so the portal's browser
storage origin is isolated from Travis's other projects (Menhir lives under the
`Archifex` account — a stray `localStorage.clear()` there must never be able to
touch Dad's saves). Repo is the org root site (`<org>.github.io`) to avoid
subpath scope problems with the manifest and service worker.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill
tool. When in doubt, invoke the skill.

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
