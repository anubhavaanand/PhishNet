# Contributing to PhishNet

Thanks for helping make PhishNet better. PhishNet detects phishing email entirely
on-device, so every contribution has to preserve two hard invariants:

1. **No email content ever leaves the browser.** Inference runs locally; the only
   network request is the one-time model download from Hugging Face.
2. **MV3 CSP holds.** No remote script, no `eval`, no `new Function`, no inline
   script in any extension page.

If a change breaks either of these, it does not merge regardless of how good it is.

> 👋 **First contribution?** Read the [Newcomer Guide](NEWCOMER_GUIDE.md) first — it walks through setup, the local checks, good-first-issue entry points, and the PR flow.

---

## The flow

PhishNet takes contributions through forks and pull requests, like any other
GitHub project. The one extra step is that **you claim the issue before you start
coding**.

| # | Step | What happens |
| --- | --- | --- |
| 1 | **Find an issue** | Open, and not already carrying a `claimed` label. `good first issue` is the soft landing. |
| 2 | **Comment `/assign-me`** | The bot replies 🚀, labels it `claimed`, and gives you **7 days** to open a PR. |
| 3 | **Fork and branch** | Fork on GitHub, clone your fork, branch off `main`. |
| 4 | **Code and test** | `npm test` must be green, `npm run build` must succeed. |
| 5 | **Open the PR** | Against `main`, with `Fixes #<number>` in the body. |

Why claim first: several people read this repo, and without a claim two of you
will write the same patch, or a PR will land for work someone is halfway through.
It is not a gate you have to argue your way through — `/assign-me` is
self-service and immediate.

If an issue is already claimed, take a different one. If the claim has gone quiet
past its 7 days, comment on the issue and offer to pick it up; a maintainer can
release it.

Full claim rules are in [Claiming an issue](#claiming-an-issue).

---

## Claiming an issue

Comment `/assign-me` on any open issue. The bot replies with a 🚀 and a due date,
and labels the issue `claimed` / `claimed/@your-login`.

```text
/assign-me
```

- **Up to 3 claims at a time.** Finish one, or release it, before taking more.
- **Open a PR within 7 days.** The claim comment states the exact date. Let it go
  stale and it returns to the pool — comment on it if you want it back.
- **Hand it back** any time with `/release` — no explanation needed.
- **`/assign`, `/claim`, `/take`** are aliases for `/assign-me`;
  **`/unassign`, `/stop`, `/drop`** for `/release`.
- **One issue per PR.** If you find a second bug while working, file it
  separately rather than folding it in.

A claim is a label, not a GitHub assignment: GitHub will not assign anyone
outside the collaborator list to an issue (isaacs/github#100), so the label is
what everyone else sees.

Issues carrying `blocked`, `maintainer-only`, `wontfix`, `duplicate`, or
`invalid` cannot be self-assigned — those are decided by a maintainer.

The logic lives in `.github/scripts/assign.js` and is covered by
`tests/assign.test.js`.

---

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20+ (CI uses 20) | Build + test runner |
| npm | 10+ | Lockfile is v3 |
| Chrome | 109+ | Offscreen Documents API |

No Python, no global CLI tools. `npm install` is the whole setup.

---

## Setup

Clone **your fork** and keep `upstream` pointing at this repository, so you can
sync before opening a PR:

```bash
git clone https://github.com/<your-username>/code-cyan-phishNet.git
cd code-cyan-phishNet
git remote add upstream https://github.com/anubhavaanand/code-cyan-phishNet.git
npm install
npm run build     # emits dist/popup.html + dist/options.html
```

Before each pull request:

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
```

Load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the repository root

After any change to `frontend/`, re-run `npm run build` and hit the reload icon on
the extensions page. Changes to `src/` (content script, service worker) only need
the extension reload.

For Firefox, run `./build-firefox.sh`, then load `dist-firefox/` via
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.

---

## Repository layout

```
manifest.json              MV3 manifest (Chrome) — points at dist/
src/
  background.js            Service worker: routing, settings, whitelist, lifecycle
  background-firefox.js    Firefox event-page variant (no offscreen API)
  content.js               DOM extraction + inline badges + link highlighting
  offscreen.js             Loads Transformers.js, runs DistilBERT inference
  selectors.js             Gmail / Outlook / Office 365 CSS selector sets
  popup.html, popup.js     Legacy vanilla popup — Firefox still ships this one
  styles.css               Content-script badge and tooltip styles
  utils/
    heuristic-detector.js  Rule-based engine (also the model-off fallback)
    error-boundary.js      Safe DOM/retry/message helpers
    logger.js              IS_DEBUG-gated logging facade
frontend/
  popup.html, options.html Vite entry points
  src/                     React popup + options page
    components/            Presentational components
    hooks/                 useSettings, useModelStatus, useScanHistory
    lib/                   constants.js (defaults), messaging.js (runtime bridge)
    styles/tokens.css      Design tokens
public/
  offscreen.html           Host page for src/offscreen.js
  icons/                   Extension icons
vendor/                    Transformers.js + ONNX WASM (git-ignored, see below)
tests/                     node:test suites (see below)
```

### Two popups, on purpose

`dist/popup.html` (React, themes `auto`/`light`/`dark`) is what Chrome loads.
`src/popup.html` (vanilla, themes `aloe`/`graphite`/`dusk`) is what Firefox loads,
because `build-firefox.sh` copies `src/` and the Firefox manifest points there.
**If you change one popup, decide whether the other needs the same change.**

`vendor/` is listed in `.gitignore` so secret scanners stop flagging minified
bundles, but the files are deliberately still tracked — the extension needs them
at runtime. Do not "clean up" this contradiction; it is intentional.

---

## Common tasks

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Build extension UI | `npm run build` |
| Run all tests (builds first) | `npm test` |
| Run tests while editing | `npm run test:watch` |
| One suite | `node --test tests/detector.test.js` |
| One test by name | `node --test --test-name-pattern="homograph" tests/` |
| Firefox package | `./build-firefox.sh` |
| Dev server for the UI | `npm run dev` |

---

## Testing

Two runners, both wired into `npm test`:

| Command | Runner | Covers |
| --- | --- | --- |
| `npm run test:unit` | `node --test` | Extension core: detector, selectors, error boundary, service worker, corpus, packaging |
| `npm run test:ui` | Vitest + Testing Library | React components, hooks, and the messaging bridge |

`pretest` runs a Vite build first, because `tests/package.test.js` asserts the built
`dist/` matches the manifest. Node's runner needs no framework dependency; Vitest
covers the `.jsx`/ESM side that Node cannot load.

### What is covered

| Suite | What it protects |
| --- | --- |
| `detector.test.js` | Distance helpers, homographs, brand lookalikes, URL and attachment analysis, classification, and robustness against empty/null/malformed input |
| `selectors.test.js` | Provider detection for Gmail/Outlook/OWA, and that each provider defines the selectors `content.js` reads |
| `error-boundary.test.js` | Safe DOM helpers, retry/backoff, debounce/throttle, visibility |
| `background.test.mjs` | The service-worker message contract: settings, whitelist, history, model gating, unknown messages — driven through the same `chrome.runtime.onMessage` path the UI uses |
| `corpus.test.js` | Quality gates on a labelled mini-corpus (recall ≥ 0.75, FPR ≤ 0.25) |
| `package.test.js` | Manifest targets exist, built HTML references resolve, CSP is strict, no `eval`/`innerHTML`/`console.log`, syntax of every source file |
| `tests/frontend/messaging.test.js` | The UI↔worker contract: every message type, response shape, and error path |
| `tests/frontend/constants.test.js` | Shared verdict metadata and settings defaults |
| `tests/frontend/hooks.test.jsx` | `useSettings`, `useModelStatus`, `useScanHistory` — mount fetches, pushed updates, teardown |
| `tests/frontend/components.test.jsx` | `Button`, `Badge`, `TabBar`, `EmptyState`, `Icon` |

`tests/helpers/chrome-mock.js` is a small `chrome.*` stub; extend it rather than
reaching for a heavyweight fake.

### What is not covered

`src/content.js` — the DOM extraction and badge injection. It needs a jsdom
fixture per provider, which does not exist yet.

### Writing a test

- Use `describe`/`test` from `node:test` and `node:assert/strict`.
- Prefer testing through public entry points (e.g. the worker's message contract)
  over re-implementing internals.
- Every new bug fix gets a regression test that fails before the fix.
- Detectors must never throw: if you add an input shape, add a robustness test.

---

## Privacy rules

**Never add**

- analytics, telemetry, crash reporting that includes email data
- any request that carries email content, sender, or subject to a server
- remote script tags, CDNs, `eval`, or `new Function`
- email content in `localStorage` / `chrome.storage.sync` (scan *stats* and a
  truncated subject in `chrome.storage.local` are the current exception — keep it
  that way, and never widen it)

**Always**

- process locally
- store preferences in `chrome.storage.sync`, scan history in `chrome.storage.local`
- update `PRIVACY_POLICY.md` if you add any network request or storage

CI enforces the mechanical parts (CSP, no `eval`, no `innerHTML`, no raw
`console.log`); the rest is on you.

---

## Issues

Search before filing. A good issue is one someone else can act on without asking
follow-up questions.

**Bug reports** should include: extension version, browser + version, provider
(Gmail / Outlook.com / Office 365 / Firefox), what you did, what you expected,
what happened, and console output. **Redact real email content** — describe the
message instead of pasting it.

**Feature requests** should state the user problem first, then the proposal.
Detection changes need a note on expected false-positive impact.

Label `good first issue` is reserved for work with a clear, bounded scope.

Claiming is self-service — comment `/assign-me` and you are done. See
[Claiming an issue](#claiming-an-issue) above. If you are not sure whether an
issue is still wanted, ask in the thread before starting; a two-line comment is
cheaper than a wasted evening.

---

## Pull requests

### Before you open one

The issue should already be yours — see [Claiming an issue](#claiming-an-issue).
If it is not, claim it first; a PR for an unclaimed issue may be closed as a
duplicate of someone else's work.

```bash
npm test          # must be green
npm run build     # must succeed
```

- [ ] The issue is claimed (`/assign-me`) — or you state why it could not be
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] No `console.log` in production code (`logger.debug` is fine)
- [ ] CSP unchanged or still strict
- [ ] No email content leaves the browser
- [ ] Firefox path considered if you touched the popup or background
- [ ] Tests added or updated
- [ ] Docs updated (`README.md`, `CHANGELOG.md`)
- [ ] `CHANGELOG.md` entry under `Unreleased`

### Opening it

Push to **your fork**, then open the PR against
`anubhavaanand/code-cyan-phishNet:main` — not against your own fork's `main`.

```bash
git push -u origin fix/short-description
```

GitHub will offer a "Compare & pull request" banner on your fork; that is the
fastest path. Put `Fixes #<number>` in the body so the issue closes on merge.

### Commits

Conventional commits, imperative mood:

```
feat(detector): flag punycode homographs in sender display names
fix(background): persist theme across service-worker restarts
test(corpus): add paypal-transposition ham sample
docs(readme): correct Firefox install steps
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`.

Reference the issue in the body: `Fixes #123`.

### Review

A reviewer will check, in this order: privacy invariants, CSP, correctness,
test coverage, then style. Expect the first two to be non-negotiable.

---

## Good first issues

- **Test `src/content.js` extraction** with a jsdom fixture per provider — the
  last uncovered surface, and the one most likely to break when Gmail or Outlook
  ships a redesign.
- **Unify the Firefox popup** with the React one so both browsers ship one UI.
- **Report `senderEmail` for Gmail** as a first-class selector instead of relying
  on the `[email]` attribute fallback.
- **Add Firefox to the bug-report template** (it currently lists Chrome versions only).

---

## Questions

Open a GitHub Discussion or issue. Include what you already tried.