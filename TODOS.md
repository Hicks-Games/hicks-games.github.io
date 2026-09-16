# TODOS

Deferred work with enough context to pick up cold. Add items here rather than
expanding the current build.

---

## Revisit remote visibility after the portal has real usage

**What:** Reconsider adding a minimal remote channel to the portal — either a
static settings file the app reads (`portal-config.json` committed to the repo,
fetched when online), a crash beacon that reports errors to an endpoint, or
both.

**Why:** Decided against all remote channels on 2026-09-14 (eng review, option
T1-C): everything stays on-device, nothing is ever transmitted. That decision
was made without usage data. Two costs come with it, and only real use will show
whether they hurt:

1. **Difficulty can only be changed in person.** Alzheimer's is progressive, so
   his comfort zone will move down over time. Today the only way to adjust it is
   the on-device settings hatch (3-second hold on the menu's corner), which
   means a visit — or talking a man with Alzheimer's through a hidden gesture
   over the phone.
2. **Crashes are invisible until a visit.** The error journal
   (`portal.errors` in localStorage, read through the settings hatch) is
   local-only. He cannot report bugs. Silence and success look identical from
   afar.

**Context for whoever picks this up:** The zero-infrastructure option is a
`portal-config.json` in the same GitHub repo — edit it from any browser, the
phone picks it up next time it's online, no server and nothing about him
transmitted anywhere. That covers difficulty, text size, and the word-game
threshold. The crash beacon is the harder half: it needs a real write endpoint
(a Cloudflare Worker or similar), which introduces the first server-shaped
moving part and its own maintenance and rot risk. The two halves are separable
and the config file is the cheap one.

**Trigger:** After v1 has been on his phone long enough to learn whether remote
adjustment is actually needed — specifically, the first time a difficulty change
would have helped and required a visit, or the first crash discovered late.

**Depends on:** v1 shipped, installed, and observed in real use.

**Pros:** Keeps the option alive with its full reasoning intact for the moment
there's evidence to decide on.
**Cons:** Any remote read reintroduces a runtime network call that the current
design forbids; the beacon reintroduces infrastructure. Both need a conscious
re-decision, not a drift.
