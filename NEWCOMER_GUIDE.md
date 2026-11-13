# 👋 Newcomer Guide: How to Contribute to PhishNet (Start Here)

Welcome! This is a friendly, self-contained guide to help you make your **first contribution** to **PhishNet** — a privacy-first, on-device phishing email detector (Chrome/Edge MV3 extension) built with vanilla JavaScript, a React popup/options UI, DistilBERT + ONNX Web, and zero telemetry.

No prior Chrome-extension experience is required. Pick a small task, follow the steps below, and open a PR — we're happy to help along the way.

---

## 🧭 What is PhishNet?

PhishNet scans Gmail / Outlook email in your browser and shows an inline **Safe / Phishing / Uncertain** badge. All inference runs **locally** — email text never leaves your tab.

Your first and most important rule as a contributor:

> **Never** add analytics, external API calls for email content, crash reporting that sends email data, or anything that lets email data leave the browser without explicit consent.

See [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) for the full policy and the "Privacy Guidelines" section of [`CONTRIBUTING.md`](CONTRIBUTING.md) for the do/don't list.

---

## 📖 Read this first (10 minutes, before any code)

1. [`README.md`](README.md) — what PhishNet does, how it works, the tech specs.
2. [`CONTRIBUTING.md`](CONTRIBUTING.md) — code style, architecture principles, PR process, privacy guidelines.
3. [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — how we treat each other.
4. [`SECURITY.md`](SECURITY.md) — how to report vulnerabilities privately.
5. This guide — the shortest path from clone to merged PR, including how to **claim an issue** before you start.
6. Skim the code map below so you know where things live.

---

## 🗂️ Code structure (where things live)

| Path | What it is |
| --- | --- |
| `manifest.json` | MV3 extension manifest (permissions, CSP, entry points) |
| `src/content.js` | Content script — extracts email context, injects the verdict badge |
| `src/selectors.js` | Gmail / Outlook DOM selectors (breaks when providers update their UI — great first task) |
| `src/background.js` | Service worker — whitelist handling and message routing (`src/background-firefox.js` is the Gecko variant) |
| `src/offscreen.js` + `public/offscreen.html` | Offscreen document that runs DistilBERT via ONNX Web |
| `src/utils/heuristic-detector.js` | Rule-based fallback engine (lookalike brands, suspicious TLDs, urgency scoring…) |
| `src/utils/logger.js`, `src/utils/error-boundary.js` | Logging and error handling — use these instead of raw `console.log` |
| `src/styles.css` | Badge / inspector styling, light + dark themes |
| `frontend/` | React popup + options UI, built with Vite into `dist/` |
| `tests/` | 213 tests: seven `node --test` suites for the extension core, plus Vitest suites under `tests/frontend/` for the React popup |
| `public/` | Icons, offscreen page, and the `test-emails.html` interactive playground |
| `vendor/` | Locally bundled ONNX Runtime + Transformers.js (no CDNs — CSP requires it) |
| `docs/` | GitHub Pages site |
| `.github/` | CI workflow, issue templates, PR template |

---

## 🚀 Quick local setup

**Prerequisites:** Git, **Node.js 20+** (CI runs on Node 20), npm, and Chrome or Edge 109+.

```bash
# 1. Fork the repo on GitHub (the "Fork" button, top-right), then clone YOUR fork
git clone https://github.com/<your-username>/code-cyan-phishNet.git
cd code-cyan-phishNet

# 2. Point upstream at the real repo so you can sync before each PR
git remote add upstream https://github.com/anubhavaanand/code-cyan-phishNet.git

# 3. Install dependencies (exact versions from package-lock.json)
npm ci

# 4. Build the React popup + options UI  (dist/ is gitignored, so this is required)
npm run build          # -> dist/popup.html + dist/options.html
```

Then load it in the browser:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **"Load unpacked"** and select this folder
4. Pin the PhishNet icon — the popup opens from `dist/popup.html`, which is why step 3 above matters

> 💡 The content scripts (`src/`) are plain vanilla JS with **no build step** — only the popup/options UI needs the one-time Vite build. The ~50 MB quantized model downloads once on your first scan and is cached locally afterwards.

---

## 🧪 Run the checks locally

These are the same checks CI runs (`.github/workflows/ci.yml`), so if they pass locally your PR will too.

```bash
# All tests: node --test suites, then Vitest for the React UI
npm test
# → 150 node tests + 63 Vitest tests, all passing

# Syntax-check a single file
node --check src/utils/heuristic-detector.js
```

Full CI-equivalent sweep (all commands below exit 0 on a healthy tree):

```bash
# Manifest validity
node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));const r=['manifest_version','name','version','description','icons','background','content_scripts','permissions'];for(const f of r){if(!m[f]){console.error('Missing',f);process.exit(1);}}console.log('✅ Manifest valid');"

# JS syntax (module files vs plain scripts, same split as CI)
for f in src/background.js src/offscreen.js src/popup.js src/utils/logger.js; do node --check --input-type=module < "$f" || exit 1; done
for f in src/selectors.js src/utils/error-boundary.js src/utils/heuristic-detector.js src/content.js; do node --check "$f" || exit 1; done

# No raw console.log in production code (use src/utils/logger.js)
! grep -r "console\.log" src/ --include="*.js" | grep -v "console\.error\|console\.warn\|IS_DEBUG"

# No eval() / new Function() (MV3 CSP forbids them)
! grep -r "eval(\|new Function" src/ --include="*.js"
```

CI also validates `manifest.json` references (icons, content scripts, popup/options pages), required files, icon dimensions, and the MV3 CSP string — you don't need to run those by hand; the PR check will.

---

## 🗺️ Where to start (good entry points)

The tracker uses the **`good first issue`** and **`help wanted`** labels for curated starter tasks:

```bash
gh issue list -R anubhavaanand/code-cyan-phishNet --label "good first issue"
gh issue list -R anubhavaanand/code-cyan-phishNet --label "help wanted"
```

| Area | File(s) | Good first task ideas |
| --- | --- | --- |
| Detection heuristics | `src/utils/heuristic-detector.js` | Add a lookalike brand to `HIGH_PROFILE_BRANDS`, add a suspicious TLD, tighten a regex, add a case to `tests/detector.test.js` |
| Selectors | `src/selectors.js` | Fix/refresh Gmail or Outlook DOM selectors (add a fallback selector) |
| Popup UI | `frontend/src/**`, `src/styles.css` | Improve accessibility (ARIA labels, keyboard nav), dark-mode polish |
| Logging / errors | `src/utils/logger.js`, `src/utils/error-boundary.js` | Add JSDoc, safer error handling |
| Docs | `README.md`, `CONTRIBUTING.md`, `PRIVACY_POLICY.md` | Fix typos, clarify setup, add missing JSDoc/comments |
| Tests | `tests/` | Add cases to an existing suite, or cover `src/content.js` (see CONTRIBUTING → Testing) |

No suitable issue? Open one — use the **Bug report** or **Feature request** template from the issue chooser, and for features, discuss the design first (that's the rule in `CONTRIBUTING.md`).

---

## ✅ Contribution workflow (step by step)

1. **Claim the issue first** — find an open issue with no `claimed` label, then comment `/assign-me`. The bot replies 🚀, labels it yours, and gives you **7 days** to open a PR. This is the one rule that is different from a normal GitHub project; everything else below is standard.
2. **Fork** the repository (the "Fork" button, top-right) and clone **your fork**.
3. **Sync and branch** off `main`:
   ```bash
   git fetch upstream
   git checkout main && git merge --ff-only upstream/main
   git checkout -b fix/short-description      # or feature/short-description
   ```
4. **Make focused changes** with clear commits (format below).
5. **Test locally** — run `npm test`, rebuild if you touched `frontend/`, and manually test on **both Gmail and Outlook**.
6. **Update docs** if behavior or architecture changed (and add a `CHANGELOG.md` entry for user-facing changes — the PR template asks for it).
7. **Open a PR against `anubhavaanand/code-cyan-phishNet:main`** — the PR template (`.github/PULL_REQUEST_TEMPLATE/pull_request_template.md`) is attached automatically; fill it in and link the issue with `Fixes #<issue-number>`.

**Done with an issue early?** Comment `/release` on it and take another. You can hold up to **3** at a time.

**Commit message format:**

```
type(scope): brief description

Longer explanation if needed

Fixes #issue-number
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

### What CI checks on your PR

`.github/workflows/ci.yml` runs three jobs on every pull request into `main`:

| Job | What it does |
| --- | --- |
| **Lint & Syntax Check** | manifest validity, `node --check` on every JS file, no raw `console.log`, CSP compliance (no inline scripts, no `eval`) |
| **Validate Extension Structure** | required files exist, manifest references resolve on disk, icon dimensions; also runs `npm ci` + `npm run build` first and verifies every asset the built popup/options pages reference resolves |
| **Unit Tests** | `npm test` — the `node --test` suites plus Vitest |

All three must be green before review starts. (The "Package Extension" job only runs on pushes to `main`.)

---

## 🎨 Code style

**JavaScript**
- ES Modules (`"type": "module"` in the manifest)
- Vanilla JS for the extension core — no frameworks, no build step; the popup/options UI is React + Vite
- JSDoc comments for public functions
- 2-space indentation, single quotes
- `async/await` over raw promises

**CSS**
- Custom properties for theming (light/dark)
- BEM-like class names: `.phishnet-badge--phishing`
- Mobile-first and responsive
- Respect `prefers-color-scheme` and `prefers-reduced-motion`

**Architecture principles:** privacy-first · one file = one concern · graceful degradation (show "Uncertain" instead of crashing) · MV3-compliant (service worker, offscreen doc, strict CSP).

---

## 🔒 PR requirements (reviewers will check these)

Copied from the PR template — you'll tick these boxes yourself:

- [ ] No raw `console.log` in production code (use `src/utils/logger.js`)
- [ ] CSP compliant — no inline scripts, no `eval` / `new Function`
- [ ] Works on **both** Gmail and Outlook
- [ ] Settings persist across reloads (`chrome.storage.sync`)
- [ ] No memory leaks (check DevTools)
- [ ] Dark mode / reduced-motion supported
- [ ] No new network requests for email content; `PRIVACY_POLICY.md` updated if networking changed
- [ ] Docs + `CHANGELOG.md` updated where relevant

---

## 🐛 Troubleshooting

- **`dist/` folder missing / popup won't open** — `dist/` is gitignored, so a fresh clone needs `npm ci && npm run build` before "Load unpacked".
- **`npm ci` fails** — make sure you're on Node 20+ and that the lockfile is untouched (`git status` clean).
- **Build error about an import** — run `npm run build` again after pulling the latest `main`; if it still fails, open an issue rather than working around it locally.
- **Selectors stopped firing after a Gmail/Outlook redesign** — that's a normal, very welcome contribution: update `src/selectors.js` and add a fallback selector.
- **First scan is slow** — expected: the ~50 MB model is downloading once and being cached.

---

## ❓ Questions?

Open a GitHub Discussion or an issue — we're happy to help. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for full details.

**Remember:** PhishNet's core value is **privacy**. Every contribution must preserve it. 🛡️
