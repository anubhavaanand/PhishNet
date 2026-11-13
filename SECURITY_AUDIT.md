# PhishNet — Security & Bug Audit

**Scope:** entire repository (Chrome MV3 extension, Firefox event-page variant, React frontend, tests, CI, docs, policies).
**Method:** manual line-by-line review of all source, plus `node tests/unit.test.js` (30/30 pass) and static inspection of manifest/CSP/CI.
**Date:** 2026-11-12

Severity legend: **Critical** (breaks shipped artifact / exploitable) · **High** (security or major correctness) · **Medium** (bug/robustness/privacy) · **Low** (polish/maintainability).

Labels used per finding: `security`, `privacy`, `bug`, `performance`, `maintainability`, `ci`, `docs`, plus severity label.

---

## 0. Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 20 |
| Medium | 55 |
| Low | 41 |
| **Total** | **120** |

Top themes:
1. **Shipped artifact is broken** — manifest points to `dist/*` that is neither committed nor built by CI (`F-001`, `F-002`, `F-086`).
2. **Unvalidated message surface** — background accepts `UPDATE_SETTINGS` / `ADD_WHITELIST` / `CLEAR_HISTORY` with no schema or sender checks (`F-011`–`F-015`).
3. **Detection false positives** — punycode, brand substrings, display-name substrings, keyword substrings, `.min.js` (`F-055`–`F-064`).
4. **Firefox is a weaker, divergent engine** (`F-078`–`F-084`).
5. **Docs/privacy/security claims contradict code** (`F-106`–`F-116`).

---

## 1. Manifest, Permissions & CSP

### F-001 — Popup/options point at unbuilt `dist/`
- **Severity:** Critical · **Category:** Bug · **Labels:** `bug`, `build`
- **Location:** `manifest.json:13,22`
- **Description:** `action.default_popup` = `dist/popup.html` and `options_page` = `dist/options.html`, but `dist/` is not committed (`git ls-files dist` empty) and `npm run build` is not run before loading unpacked.
- **Impact:** Loading the repo unpacked shows a blank/broken popup and options page; the primary UI is unreachable.
- **Fix:** Either commit a built `dist/`, or point the manifest at the vanilla `src/popup.html`, and add a `prebuild`/build step to the load & CI flow.

### F-002 — CI release zip omits `dist/`
- **Severity:** Critical · **Category:** CI/Bug · **Labels:** `bug`, `ci`
- **Location:** `.github/workflows/ci.yml:233-242`
- **Description:** The `package` job zips `manifest.json src/ public/ vendor/ ...` but not `dist/`, while the manifest references `dist/popup.html` and `dist/options.html`.
- **Impact:** Every published artifact is missing the popup/options → broken release.
- **Fix:** Run the Vite build in CI and include `dist/` in the zip, or repoint the manifest to non-bundled assets.

### F-003 — Over-broad `web_accessible_resources`
- **Severity:** High · **Category:** Security · **Labels:** `security`
- **Location:** `manifest.json:61-64`
- **Description:** `vendor/ort-wasm/*` and `public/icons/*` are exposed to `<all_urls>`. The WASM/ORT assets do not need to be readable by arbitrary web pages.
- **Impact:** Any site can probe/load extension resources (fingerprinting, potential WASM reuse). Larger attack surface.
- **Fix:** Restrict `matches` to the extension's own pages (`chrome-extension://<id>/*`) or remove `vendor/ort-wasm` from web-accessible resources if the offscreen doc can fetch it directly.

### F-004 — Unused `scripting` and `activeTab` permissions
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `permissions`
- **Location:** `manifest.json:44-49`; no `chrome.scripting`/`chrome.action` usage in `src/`
- **Description:** The content script is statically declared; nothing calls `chrome.scripting` or relies on `activeTab`.
- **Impact:** Unnecessary permissions increase review friction and perceived privilege.
- **Fix:** Remove `scripting` and `activeTab` (keep `storage`, `offscreen`, host permissions).

### F-005 — CSP missing `worker-src`/`style-src`
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `csp`
- **Location:** `manifest.json:58-60`
- **Description:** `extension_pages` CSP sets only `script-src` and `object-src`. ORT may spawn blob/worker contexts; inline `<style>` in `popup.html` relies on default `style-src`.
- **Impact:** Potential runtime failure if ORT needs workers; unclear style policy.
- **Fix:** Add explicit `worker-src 'self' blob:` (if needed) and `style-src 'self' 'unsafe-inline'` (or move inline styles out), then tighten.

### F-006 — Redundant Hugging Face host permissions
- **Severity:** Low · **Category:** Security · **Labels:** `security`, `permissions`
- **Location:** `manifest.json:55-56`
- **Description:** Both `https://huggingface.co/*` and `https://*.huggingface.co/*` are listed; the latter subsumes the former.
- **Impact:** Noise; no functional harm.
- **Fix:** Keep only `https://*.huggingface.co/*`.

### F-007 — No `minimum_chrome_version`
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `manifest.json`
- **Description:** Uses Offscreen Documents (Chrome 109+) but declares no minimum.
- **Impact:** Installs on older Chromium where `chrome.offscreen` is missing → silent failure.
- **Fix:** Add `"minimum_chrome_version": "109"`.

### F-008 — Version mismatch across artifacts
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `docs`
- **Location:** `manifest.json:4` (1.1.0), `src/popup.html:812` (v1.0.0), `build-firefox.sh:40` (`phishnet-v1.0.0-firefox.zip`)
- **Description:** Three different versions are advertised.
- **Impact:** User confusion; wrong release tags.
- **Fix:** Single source of truth (manifest) and derive the rest.

### F-009 — Model fetched without integrity pinning
- **Severity:** High · **Category:** Security · **Labels:** `security`, `supply-chain`
- **Location:** `src/offscreen.js:19-30`
- **Description:** `env.allowRemoteModels = true` and a mutable `onnx-community/...` model id; no revision hash or checksum verification.
- **Impact:** A compromised/mutated upstream model executes in the extension context (WASM) → code exec risk.
- **Fix:** Pin an exact revision (commit SHA) and verify a hash; consider self-hosting the model as a bundled, signed asset.

### F-010 — `all_frames:false` misses iframe content
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `manifest.json:42`
- **Description:** Some mail views render message bodies in iframes.
- **Impact:** Emails in frames are not scanned.
- **Fix:** Evaluate per-provider; if needed, add a frame-targeted content script with strict frame origin checks.

---

## 2. Background Service Worker

### F-011 — No sender/origin validation on messages
- **Severity:** High · **Category:** Security · **Labels:** `security`
- **Location:** `src/background.js:121-133`
- **Description:** `handleIncomingMessage` trusts any `message.type` from any extension context; no `sender.id`/`sender.url` check.
- **Impact:** Any extension context (or a compromised content script) can invoke `ADD_WHITELIST`, `CLEAR_HISTORY`, `UPDATE_SETTINGS`, `SCAN_EMAIL`.
- **Fix:** Validate `sender.id === chrome.runtime.id` and, for tab messages, `sender.tab` host against the allowlist; reject unknown senders.

### F-012 — `ADD_WHITELIST`/`REMOVE_WHITELIST` unvalidated
- **Severity:** High · **Category:** Security · **Labels:** `security`, `privacy`
- **Location:** `src/background.js:173-189`
- **Description:** Entries are only trimmed/lowercased; no domain/email format check, no length cap, no rejection of `*` or `@`.
- **Impact:** A caller can whitelist broad values, disabling protection; storage poisoning.
- **Fix:** Validate against a strict domain/email regex, cap length and list size, reject wildcards.

### F-013 — `UPDATE_SETTINGS` merges arbitrary keys
- **Severity:** High · **Category:** Bug/Security · **Labels:** `bug`, `security`
- **Location:** `src/background.js:168-171`
- **Description:** `saveSettings` spreads any `message.settings` into persisted state (including `whitelist`, `theme`, `sensitivityThreshold`) with no schema/range validation.
- **Impact:** Invalid types/values persisted (e.g., threshold as string, whitelist as object) → breakage or protection bypass.
- **Fix:** Whitelist allowed keys, coerce/validate types and ranges, clamp threshold to [0,1], validate whitelist entries.

### F-014 — `saveSettings` persists whole object, no size cap
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:65-72`
- **Description:** Entire settings object (incl. unbounded whitelist) written to `chrome.storage.sync` (per-item quota).
- **Impact:** Quota errors / silent save failure with large whitelists.
- **Fix:** Persist only known fields; cap whitelist length; handle `chrome.runtime.lastError`.

### F-015 — Stored settings trusted without validation
- **Severity:** Medium · **Category:** Security · **Labels:** `security`
- **Location:** `src/background.js:41-60`
- **Description:** `loadSettings` accepts whatever is in storage; only `whitelist` array-ness is checked, not entry contents or threshold range.
- **Impact:** Manually corrupted storage or a prior bug can force unsafe behavior.
- **Fix:** Validate/normalize on load (same validator as `UPDATE_SETTINGS`).

### F-016 — Offscreen `reasons`/`justification` mismatch
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:98-102`
- **Description:** `reasons: ['LOCAL_STORAGE','WORKERS']` with justification about inference; `LOCAL_STORAGE` is not required for inference.
- **Impact:** Over-scoped offscreen reason; may be rejected in review.
- **Fix:** Use `['WORKERS']` only.

### F-017 — SW state lost on termination; stale status
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:9-11,25-36`
- **Description:** MV3 service workers are killed; `modelStatus`/progress reset to `loading`, and `init()` re-creates offscreen doc, but in-flight state and progress are lost.
- **Impact:** Popup may show stale/incorrect status; scans fail until reload.
- **Fix:** Persist status/progress in `chrome.storage.session`; rehydrate on wake; reattach to existing offscreen doc.

### F-018 — `RELOAD_MODEL` can leave status stuck
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:214-229`
- **Description:** If `closeDocument`/`createOffscreenDocument` fails after setting `modelStatus='loading'`, status never resolves.
- **Impact:** Permanent "Loading…" UI.
- **Fix:** On failure set `modelStatus='error'` and broadcast.

### F-019 — Pending inference callbacks not cleared
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `performance`
- **Location:** `src/background.js:20,272-306`
- **Description:** `pendingInferenceCallbacks` entries are removed on resolve/reject/timeout, but not on SW suspend or offscreen doc close.
- **Impact:** Stale map growth; promises never settle.
- **Fix:** Clear on `onSuspend`/document close; reject pending on teardown.

### F-020 — Self-messaging on the same channel
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:121-133,294-305`
- **Description:** Background sends `RUN_INFERENCE` via `chrome.runtime.sendMessage` while also registering `onMessage`; depending on delivery semantics it may receive its own message and hit `default` (`Unknown message type`).
- **Impact:** Log noise; potential confusion.
- **Fix:** Use `chrome.runtime.sendMessage` with a targeted receiver, or handle `RUN_INFERENCE` as a no-op in the SW, or use a Port.

### F-021 — Broadcasts to every tab
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/background.js:311-338`
- **Description:** `chrome.tabs.query({})` + `sendMessage` to all tabs for every settings/status change.
- **Impact:** Unnecessary messages; errors swallowed.
- **Fix:** Track content-script tab IDs, or broadcast only to tabs with the extension injected.

### F-022 — `CLEAR_HISTORY` partial clear
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `privacy`
- **Location:** `src/background.js:191-196`
- **Description:** Clears `scanHistory`/`scanStats` but not any other local data (e.g., future caches).
- **Impact:** "Clear" may not fully clear.
- **Fix:** Enumerate and clear all extension-owned local keys.

### F-023 — Init race on error
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:341-367`
- **Description:** `initPromise` is reset to `null` on failure; a near-simultaneous `onInstalled`/`onStartup` can start a second init.
- **Impact:** Duplicate offscreen creation attempts.
- **Fix:** Guard with a boolean “initializing” flag and backoff.

---

## 3. Offscreen Document & Model

### F-024 — `device:'auto'` may select unavailable WebGPU
- **Severity:** High · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:26-30`
- **Description:** Only the WASM ORT build is vendored; `device:'auto'` can attempt WebGPU and fail.
- **Impact:** Model load failure on some machines.
- **Fix:** Force `device:'wasm'` (as Firefox does) or vendor the WebGPU build and feature-detect.

### F-025 — ORT wasm path/filename mismatch
- **Severity:** High · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:22`; `vendor/ort-wasm/ort-wasm-simd-threaded.jsep.{mjs,wasm}`
- **Description:** `wasmPaths` points at the directory; ORT resolves specific filenames (e.g., `ort-wasm-simd-threaded.jsep.wasm`). Verify the exact expected names for the pinned ORT version.
- **Impact:** 404 on WASM → model never loads.
- **Fix:** Pin ORT version and set `wasmPaths` to the exact file names/URLs; test offline.

### F-026 — Fixed `topk:4`/label order assumption
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:33-46,128-142`
- **Description:** `LABEL_MAP` assumes `LABEL_0..LABEL_3` and `topk:4`; a model with different label ordering/count mislabels.
- **Impact:** Wrong Safe/Phishing verdicts.
- **Fix:** Read `config.json`/label mapping from the model; derive labels dynamically.

### F-027 — Char-based truncation, not tokens
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:176-181`
- **Description:** `truncateText` uses `maxTokens*4` chars and slices arbitrarily.
- **Impact:** May exceed the 512-token context or cut mid-word, skewing results.
- **Fix:** Use the tokenizer's `truncation`/`max_length`, or a conservative char cap with word boundary.

### F-028 — No cancellation on timeout
- **Severity:** Medium · **Category:** Performance · **Labels:** `performance`, `bug`
- **Location:** `src/offscreen.js:159-171`
- **Description:** `Promise.race` rejects at 15s but the underlying inference keeps running.
- **Impact:** Wasted CPU/memory; overlapping scans.
- **Fix:** Use `AbortController`/cancellation if supported; drop stale results via request id.

### F-029 — Unhandled `sendMessage` rejections
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:80,89-92`
- **Description:** `OFFSCREEN_READY`/`OFFSCREEN_ERROR` are sent without `.catch`; if the SW is asleep there is no receiver.
- **Impact:** Unhandled promise rejection; lost status.
- **Fix:** `.catch(()=>{})` and/or persist status to `chrome.storage.session`.

### F-030 — Reason generation parses raw text only
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:186-246`
- **Description:** Email/URL regexes run over `text` (subject+body) which may be truncated/plain; links from the DOM are not passed in.
- **Impact:** Missed sender/link signals in the ML path.
- **Fix:** Pass structured `sender`/`links` from the content script into the offscreen payload.

### F-031 — Mutable remote model revision
- **Severity:** Low · **Category:** Security · **Labels:** `security`, `supply-chain`
- **Location:** `src/offscreen.js:19-30`
- **Description:** No pinned revision/tag digest.
- **Impact:** Upstream changes silently alter behavior.
- **Fix:** Pin revision and verify hash (see F-009).

### F-032 — Warmup on every load
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/offscreen.js:73-74`
- **Description:** A dummy inference runs on every model load.
- **Impact:** Extra latency on each cold start.
- **Fix:** Warm up once per session and cache readiness.

### F-033 — `loadAttempts` lifecycle
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:51-52`
- **Description:** Module-global `loadAttempts` is only reset by creating a new document.
- **Impact:** If init is re-entered without reload, retries are exhausted.
- **Fix:** Reset in `init()` entry or on `RELOAD_MODEL`.

---

## 4. Content Script

### F-034 — Duplicate links/attachments double-counted
- **Severity:** Critical · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:224`; `src/utils/heuristic-detector.js:378-381`
- **Description:** `heuristicDetect(emailContent, emailContent.links, emailContent.attachments)` passes links/attachments that are already on `emailContent`; the detector merges both → duplicates.
- **Impact:** Inflated `linkRiskScore`/`attachmentRiskScore` and duplicate reasons; skewed verdicts.
- **Fix:** Call `heuristicDetect(emailContent)` only, or have the detector not re-merge `emailContent.links`.

### F-035 — Threshold ignores `phishing_url`
- **Severity:** High · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:234-238`
- **Description:** Sensitivity downgrade only applies when `result.label === 'phishing_email'`.
- **Impact:** `phishing_url`/`phishing_url` verdicts bypass the user's threshold.
- **Fix:** Apply the threshold to any phishing label (and document behavior).

### F-036 — MutationObserver debounce starvation
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `performance`
- **Location:** `src/content.js:67-96`
- **Description:** Every mutation resets the debounce timer; on busy Gmail/Outlook DOM the callback may never fire.
- **Impact:** Emails never scanned on active pages.
- **Fix:** Use a max-wait/throttle (e.g., lodash-style) or `requestIdleCallback`; run a periodic sweep.

### F-037 — Modal replacement leaks keydown listener
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `performance`
- **Location:** `src/content.js:513-527,714-727`
- **Description:** `openThreatModal` removes an existing modal DOM node but never calls its `closeModal`, so the document-level `keydown` handler persists.
- **Impact:** Listener accumulation; multiple ESC handlers; memory leak.
- **Fix:** Track and remove the previous handler, or reuse a single global listener.

### F-038 — Non-atomic scan-history updates
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:263-290`
- **Description:** `chrome.storage.local.get` then `set` without a lock; concurrent scans race.
- **Impact:** Lost increments / corrupted `scanStats`.
- **Fix:** Serialize writes (queue) or use `chrome.storage.local` with a single writer (background) and atomic update.

### F-039 — Scan history stores subject/sender (privacy)
- **Severity:** Medium · **Category:** Privacy · **Labels:** `privacy`
- **Location:** `src/content.js:277-287`
- **Description:** Persists `subject`, `sender` email/domain, label, confidence, timestamp to `chrome.storage.local`.
- **Impact:** Email metadata retained on device; not disclosed in the privacy policy.
- **Fix:** Make history opt-in, store minimized data, disclose in `PRIVACY_POLICY.md`, and add a clear-all.

### F-040 — `getEmailId` deprecated `unescape` + weak hash
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:136-140`
- **Description:** Uses deprecated `unescape(encodeURIComponent(...))`; falls back to a 32-char truncation of raw text.
- **Impact:** Collisions → skipped scans or re-scans.
- **Fix:** Use `TextEncoder` + a stable hash; prefer provider-provided IDs.

### F-041 — Link extraction misses relative/encoded URLs
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:397-421`
- **Description:** Only `http://`, `https://`, `mailto:` are kept; relative URLs are dropped and `&amp;` is not decoded.
- **Impact:** Phishing via relative or entity-encoded hrefs evades detection.
- **Fix:** Resolve against `document.baseURI`; decode HTML entities; analyze `link.href` (the DOM-resolved URL) and `getAttribute('href')` both.

### F-042 — Attachment filename filtering evadable
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:426-450`
- **Description:** Requires a `.`, length `<100`; extensionless names, trailing dots/spaces, and RTL-override characters evade.
- **Impact:** Malicious attachments missed.
- **Fix:** Normalize (trim trailing dots/spaces, strip RTL/zero-width), and analyze even without a dot.

### F-043 — Manual scan picks last message element
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:782-800`
- **Description:** `messageElements[messageElements.length-1]` may be a draft, compose area, or a different thread message.
- **Impact:** Wrong email scanned / wrong verdict shown.
- **Fix:** Prefer the currently open/visible message (e.g., `[aria-selected="true"]`, `.adn.ads`? no) or the last *read* message; filter out drafts/compose.

### F-044 — Badge injection may break provider layout
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/content.js:455-508`
- **Description:** Badge is inserted as a sibling of the sender node inside Gmail/Outlook's managed DOM.
- **Impact:** Framework re-render removes it; layout shifts.
- **Fix:** Use a stable container/portal; re-inject on observed mutations; scope CSS.

### F-045 — Link highlighting mutates provider DOM
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/content.js:732-761`
- **Description:** Appends a `<span>` inside `<a>` and toggles classes; provider re-render wipes it.
- **Impact:** Highlights disappear; possible invalid HTML nesting.
- **Fix:** Use CSS-only outlines (class on the `<a>`) and re-apply after mutations; avoid injecting children into anchors.

### F-046 — Scan dedupe sets not reconciled
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:31-34,200`
- **Description:** `manual-<timestamp>` IDs bypass `scannedEmailIds`; `activeScans` cleared in `finally` but not on early returns.
- **Impact:** Repeated scans / duplicate history entries.
- **Fix:** Use provider IDs for manual scans; ensure `activeScans` cleanup on all paths.

### F-047 — Observer scope is the whole body
- **Severity:** Medium · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/content.js:79-82`
- **Description:** `childList+subtree` on `document.body` for large SPA DOM.
- **Impact:** High CPU on big inboxes.
- **Fix:** Observe the message container only; debounce/throttle with max-wait.

### F-048 — Message listener never removed
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:53,778-807`
- **Description:** `init()` adds `chrome.runtime.onMessage` but cleanup only disconnects the observer.
- **Impact:** Duplicate handlers if re-init.
- **Fix:** Store and remove the listener in cleanup.

### F-049 — Incomplete unload cleanup
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:810-813`
- **Description:** Only observer + debounce cleared; message listener/active scans remain.
- **Impact:** Minor leak.
- **Fix:** Centralize teardown.

### F-050 — Attribute injection surface (low)
- **Severity:** Low · **Category:** Security · **Labels:** `security`
- **Location:** `src/content.js:749-751`
- **Description:** `data-phishnet-tooltip`/`data-tooltip` are set from `href.slice(0,80)` via `setAttribute` (safe) — but the tooltip CSS renders `attr(...)` as text; no HTML injection. Verify no code path uses `innerHTML`.
- **Impact:** Informational; confirm no `innerHTML` with URL/text.
- **Fix:** Keep using `textContent`/`setAttribute`; add a lint rule banning `innerHTML` in `src/`.

### F-051 — Subject fallback can grab page heading
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:299-308`
- **Description:** Falls back to `document` + generic `h2/h3/[role=heading]`.
- **Impact:** Wrong subject → wrong scan text.
- **Fix:** Restrict fallback to the message container.

### F-052 — Body truncated at 4000 chars
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:366`
- **Description:** `safeText(clone, 4000)` may cut long emails.
- **Impact:** Missed signals late in the body.
- **Fix:** Raise/parametrize; ensure truncation is token-aware.

### F-053 — Insecure `http://` links accepted
- **Severity:** Low · **Category:** Security · **Labels:** `security`
- **Location:** `src/content.js:408`
- **Description:** `http://` links are analyzed but not specifically warned as cleartext.
- **Impact:** Users may not realize the connection is unencrypted.
- **Fix:** Flag `http:` separately (mixed-content risk).

### F-054 — document_idle only
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:39-57`
- **Description:** Init at `document_idle`; early SPA content may be missed until a mutation.
- **Impact:** First email may be unscanned.
- **Fix:** Run an initial sweep after load and on `visibilitychange`.

---

## 5. Detection Engine (`heuristic-detector.js`)

### F-055 — All punycode flagged as homograph
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:194`
- **Description:** `if (s.includes('xn--')) return true;`
- **Impact:** Legitimate IDN domains (e.g., `xn--80ak6aa92e.com`) flagged phishing.
- **Fix:** Only flag punycode when the decoded label is confusable with a brand, or when mixed with ASCII brand labels.

### F-056 — Brand substring over-flagging
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:230-232`
- **Description:** `cleanDomain.includes(brand)` flags `mygithub.io`, `notamazon.com`, etc.
- **Impact:** False positives on legitimate domains containing brand words.
- **Fix:** Compare the registrable label, not substring; use skeleton distance only.

### F-057 — Display-name substring false positives
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:354-358`
- **Description:** `name.includes(brand)` flags “Purchaser” (contains `chase`) and “groups” (contains `ups`).
- **Impact:** Legitimate senders flagged.
- **Fix:** Token-boundary match on skeletonized tokens; require the token to equal the brand.

### F-058 — Keyword substring false positives
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:317-320`
- **Description:** `domain.includes('account')` flags `accountant.com`; similar for other keywords.
- **Impact:** False positives.
- **Fix:** Match label prefixes/hyphens, not arbitrary substrings.

### F-059 — `.min.js` flagged as dangerous
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:257-260`
- **Description:** Double-extension regex treats `app.min.js` as `.min` + `.js` and flags `js` as dangerous.
- **Impact:** Legitimate JS attachments flagged phishing.
- **Fix:** Use a known dangerous-extension list on the *final* extension; treat `min.js`/`d.ts` as safe; require executable types.

### F-060 — Dangerous-extension list too broad / evadable
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:29-32,254-266`
- **Description:** `js`/`jse` cause FPs; no handling of trailing dots/spaces, RTL override, or Unicode homograph extensions.
- **Impact:** Both FPs and evasions.
- **Fix:** Normalize filename; use a curated list; detect RTL/zero-width.

### F-061 — Urgency keyword substring FPs
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:394-399`
- **Description:** `fullText.includes(kw)` matches `tax` in `taxi`, `account` in `accounting`, etc.
- **Impact:** Inflated urgency score.
- **Fix:** Word-boundary matching; weight by context.

### F-062 — `senderTrustScore` exceeds documented cap
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/utils/heuristic-detector.js:402-426,518-523`
- **Description:** Lookalike(45) + impersonation(34) + persona(25) = 104, but UI shows `/45`.
- **Impact:** Misleading Threat Inspector; inconsistent scoring.
- **Fix:** Clamp each sub-score or update the UI denominator; document caps.

### F-063 — Any dangerous attachment forces phishing
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:501-507`
- **Description:** `dangerousAttachmentCount>0` sets `totalRisk>=70` and label phishing.
- **Impact:** Legit `.js`/double-ext attachments → phishing.
- **Fix:** Combine with sender/link context; require corroboration.

### F-064 — Fabricated URL scores
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:525-530`
- **Description:** `legitimate_url`/`phishing_url` scores copy the email scores.
- **Impact:** Misleading analytics/UI.
- **Fix:** Compute URL-specific scores or omit.

### F-065 — Dead `<form>` signal
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:481-483`
- **Description:** Content script extracts `textContent`, so tags never appear; `text.includes('<form')` is always false.
- **Impact:** Signal never fires.
- **Fix:** Detect forms from the DOM (content script) and pass a boolean flag.

### F-066 — Open-redirect regex over-broad
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:268,298,315`
- **Description:** Flags any `?url=`/`?redirect=` even same-host.
- **Impact:** FPs on legitimate redirect links.
- **Fix:** Resolve the redirect target and compare hosts.

### F-067 — Structural URL heuristics over-flag
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:306-312`
- **Description:** Flags any IP host, `>4` labels, `>75` chars, `3+` hyphens.
- **Impact:** FPs on legitimate URLs (e.g., `a.b.c.example.com`, long slugs).
- **Fix:** Weight, don't hard-flag; combine with brand/TLD signals.

### F-068 — 4+ digit domain rule
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:333`
- **Description:** `/[0-9]{4,}/` flags domains like `12345.com`.
- **Impact:** FPs.
- **Fix:** Remove or require suspicious TLD/brand context.

### F-069 — Incomplete multi-part suffix list
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:44-49`
- **Description:** Missing several ccTLD second-level suffixes (e.g., `com.tw`, `com.ua`).
- **Impact:** Wrong registrable domain → brand check errors.
- **Fix:** Use the Public Suffix List or a comprehensive dataset.

### F-070 — Limited official-domain allowlist
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:51-54,81-96`
- **Description:** `KNOWN_OFFICIAL_DOMAINS`/`BRAND_SET` are small and manual.
- **Impact:** Legit brand domains flagged; new brands missed.
- **Fix:** Data-drive the list; allow user overrides.

### F-071 — Hardcoded `.com` in skeleton match
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:245-249`
- **Description:** `skelDomain.endsWith(brand + 'com')` only handles `.com`.
- **Impact:** Misses other TLDs; odd FPs.
- **Fix:** Compare the registrable label only.

### F-072 — Arbitrary Greek length rule
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:196-197`
- **Description:** Greek flagged only when `length > 4`.
- **Impact:** Inconsistent detection.
- **Fix:** Use script-mixing heuristics with clear thresholds.

### F-073 — Digit folds create false brand matches
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:127-128`
- **Description:** `1→l`, `0→o` can turn numeric strings into brand names.
- **Impact:** Rare FPs.
- **Fix:** Only fold digits in the brand-comparison path (already scoped) and re-verify.

### F-074 — Caches never invalidated
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/utils/heuristic-detector.js:57-58,204-210`
- **Description:** Bounded but no TTL/invalidation.
- **Impact:** Stale results if brand list changes at runtime (rare).
- **Fix:** Clear caches when the brand list/updatable config changes.

### F-075 — Reasons truncated to 6
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/utils/heuristic-detector.js:514`
- **Description:** `slice(0,6)` may drop the dangerous-attachment reason.
- **Impact:** Critical signal hidden in UI.
- **Fix:** Prioritize/always include attachment reasons.

### F-076 — URL parse failure treated as suspicious
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:280-282`
- **Description:** Any `new URL` failure returns `true`.
- **Impact:** Relative/malformed links flagged (safe default, but noisy).
- **Fix:** Distinguish “unparseable” from “malicious”; flag as uncertain.

### F-077 — Divergent TLD/shortener sets across contexts
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:16-19` vs `src/selectors.js:207-218`
- **Description:** Offscreen uses the detector's hardcoded defaults; content script uses `selectors.js` values. They differ.
- **Impact:** Inconsistent verdicts between heuristic and ML paths.
- **Fix:** Single source of truth for utility selectors.

---

## 6. Firefox Variant

### F-078 — Reduced `isUrlSuspicious` on Firefox
- **Severity:** High · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `src/background-firefox.js:125-143`
- **Description:** Firefox copy lacks homograph, lookalike-brand, dangerous-scheme, invisible-char, and open-redirect checks.
- **Impact:** Materially weaker phishing detection on Firefox.
- **Fix:** Share the full `heuristic-detector.js` (it is UMD/CommonJS-compatible) instead of a reduced copy.

### F-079 — No inference timeout on Firefox
- **Severity:** High · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background-firefox.js:163-183`
- **Description:** `runInference` awaits the pipeline with no timeout/race.
- **Impact:** Hung scans; unresponsive popup.
- **Fix:** Add a timeout + cancellation, mirroring Chrome.

### F-080 — Firefox results lack heuristic signals
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background-firefox.js:163-183`
- **Description:** No `signals`/`links`/`attachments` merge; Threat Inspector shows partial data.
- **Impact:** Inconsistent UX/behavior vs Chrome.
- **Fix:** Merge heuristic results as Chrome does.

### F-081 — Firefox settings/whitelist unvalidated
- **Severity:** Medium · **Category:** Security · **Labels:** `security`
- **Location:** `src/background-firefox.js:257-279`
- **Description:** Same unvalidated `UPDATE_SETTINGS`/`ADD_WHITELIST` as Chrome.
- **Impact:** Same as F-012/F-013.
- **Fix:** Share the validator.

### F-082 — Dynamic import in event page may be blocked
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background-firefox.js:66-69`
- **Description:** `import(browser.runtime.getURL('vendor/transformers.min.js'))` in a classic event page; CSP/module support must be verified.
- **Impact:** Model never loads on Firefox.
- **Fix:** Test on Firefox; adjust CSP / bundle as needed.

### F-083 — Broadcast error handling
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background-firefox.js:206-214`
- **Description:** `.catch` on `sendMessage` assumes a promise; Firefox supports it, but verify.
- **Impact:** Possible unhandled rejection on older versions.
- **Fix:** Feature-detect promise vs callback.

### F-084 — Firefox theme default diverges
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background-firefox.js:31`
- **Description:** `theme:'aloe'` vs React `auto/light/dark`.
- **Impact:** Theme mismatch.
- **Fix:** Unify theme vocabulary.

---

## 7. Build, Vite & React Frontend

### F-085 — `useSettings` imports a non-existent export
- **Severity:** Critical · **Category:** Bug · **Labels:** `bug`, `build`
- **Location:** `frontend/src/hooks/useSettings.js:1`; `frontend/src/lib/messaging.js`
- **Description:** `import { ..., DEFAULT_SETTINGS } from '@/lib/messaging'` but `messaging.js` does not export `DEFAULT_SETTINGS` (it lives in `constants.js`).
- **Impact:** Build error / `undefined` defaults; popup/options crash.
- **Fix:** Import `DEFAULT_SETTINGS` from `@/lib/constants` (or re-export it).

### F-086 — No build script produces both pages
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `build`
- **Location:** `package.json:7-11`; `vite.config.js:16-35`
- **Description:** `build` runs popup only; `build:options` is separate; nothing builds both; manifest expects both.
- **Impact:** `dist/options.html` missing after a normal build.
- **Fix:** Add `"build": "vite build && vite build --mode options"` (or a multi-input build).

### F-087 — `emptyOutDir:false` with sequential builds
- **Severity:** High · **Category:** Bug · **Labels:** `bug`, `build`
- **Location:** `vite.config.js:24`
- **Description:** Popup then options builds share `dist/` without cleaning; stale assets/possible collisions.
- **Impact:** Inconsistent artifacts.
- **Fix:** Clean `dist/` at start or use a single multi-page build.

### F-088 — Frontend not built/validated in CI
- **Severity:** High · **Category:** CI · **Labels:** `ci`, `bug`
- **Location:** `.github/workflows/ci.yml`
- **Description:** CI runs Node unit tests only; no `npm ci` / `vite build`.
- **Impact:** Frontend regressions (like F-085) ship undetected.
- **Fix:** Add a job: `npm ci && npm run build` + a smoke check that `dist/popup.html` and `dist/options.html` exist.

### F-089 — Unsupported `css` prop on `Slider`
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/components/Slider.jsx`
- **Description:** Uses `css={{...}}` (emotion) without configuring emotion; React will warn/ignore.
- **Impact:** Console warnings; thumb styling not applied.
- **Fix:** Remove the `css` prop; use inline styles or a real CSS class.

### F-090 — Duplicate popup implementations
- **Severity:** Medium · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `src/popup.html`, `src/popup.js` vs `frontend/`; `manifest.json:13`
- **Description:** Manifest uses `dist/popup.html` (React), so the vanilla popup is dead code.
- **Impact:** Confusion, double maintenance.
- **Fix:** Delete the unused vanilla popup or make it the shipped one; document the choice.

### F-091 — Theme vocabulary mismatch
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/popup.js:55` (`aloe/graphite/dusk`) vs `frontend/src/lib/constants.js:86-88` (`auto/light/dark`)
- **Description:** Two different theme systems share one `theme` setting.
- **Impact:** User's choice doesn't apply consistently.
- **Fix:** Unify on one vocabulary and migrate stored values.

### F-092 — Duplicate React keys in trusted lists
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/components/TrustedSection.jsx`, `TrustedTab.jsx`
- **Description:** `key={entry}`; duplicate/empty entries cause key collisions.
- **Impact:** Render warnings/glitches.
- **Fix:** Dedupe + validate; use a stable id.

### F-093 — Side effect inside setState updater
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/hooks/useSettings.js`
- **Description:** `updateSettings(next)` is called inside the `setSettings` updater.
- **Impact:** Double-send under StrictMode; React anti-pattern.
- **Fix:** Compute `next` outside, then `setSettings(next)` and send once.

### F-094 — `AnimatedNumber` doesn't handle target changes well
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/components/AnimatedNumber.jsx`
- **Description:** Animates from 0 on every `value` change; no interruption handling.
- **Impact:** Visual jump on rapid updates.
- **Fix:** Animate from current displayed value; cancel prior RAF.

### F-095 — `ConfidenceRing` no reset animation
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/components/ConfidenceRing.jsx`
- **Description:** `strokeDashoffset` transitions but initial mount may not animate.
- **Impact:** Cosmetic.
- **Fix:** Set initial offset then update on next frame.

### F-096 — Fonts referenced but not bundled
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `privacy`
- **Location:** `frontend/src/styles/tokens.css`
- **Description:** `Quicksand`/`Inter`/`JetBrains Mono` are referenced but not imported/bundled; extension CSP is `'self'`.
- **Impact:** Silent fallback; inconsistent look.
- **Fix:** Bundle fonts locally or use system fonts.

### F-097 — No `test` script / unused React deps
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `package.json`
- **Description:** Tests exist but no `npm test`; React deps are only used by the (unbuilt) frontend.
- **Impact:** Contributors can't run tests via npm; dependency bloat.
- **Fix:** Add `"test": "node tests/unit.test.js"`; ensure frontend is actually built.

### F-098 — `.gitignore` ignores `vendor/` and `doc/`
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `.gitignore`
- **Description:** `vendor/` is ignored (currently tracked files remain, but new files are silently skipped); `doc/` ignored while `docs/` is the Pages site.
- **Impact:** Missing vendor assets for future updates.
- **Fix:** Remove `vendor/` from `.gitignore` (or `git add -f`); clarify `docs/` vs `doc/`.

---

## 8. CI / DevOps

### F-099 — No SAST/secret/dependency scanning
- **Severity:** High · **Category:** Security · **Labels:** `security`, `ci`
- **Location:** `.github/workflows/ci.yml`
- **Description:** No CodeQL, `npm audit`, or secret scanning in CI.
- **Impact:** Vulnerable deps/leaks go unnoticed.
- **Fix:** Add CodeQL, `npm audit --audit-level=high`, and GitHub secret scanning.

### F-100 — CI doesn't build the extension
- **Severity:** Medium · **Category:** CI · **Labels:** `ci`
- **Location:** `.github/workflows/ci.yml`
- **Description:** No `npm ci`/build; the packaged zip is never validated to load.
- **Impact:** Broken artifacts (F-002) pass CI.
- **Fix:** Add a build job and a “load unpacked” smoke test.

### F-101 — Artifacts only on push to main
- **Severity:** Medium · **Category:** CI · **Labels:** `ci`
- **Location:** `.github/workflows/ci.yml:220-221`
- **Description:** `package` job gated to `push` on `main`; PRs get no artifact.
- **Impact:** Reviewers can't test builds.
- **Fix:** Build artifacts on PRs too (retain briefly).

### F-102 — Fragile `console.log` grep
- **Severity:** Medium · **Category:** CI · **Labels:** `ci`
- **Location:** `.github/workflows/ci.yml:56-63`
- **Description:** Line-based grep with `grep -v` misses multi-line/`console['log']`.
- **Impact:** Forbidden logging can slip through.
- **Fix:** Use ESLint `no-console` (allow `warn`/`error`).

### F-103 — Fragile CSP grep
- **Severity:** Medium · **Category:** CI · **Labels:** `ci`
- **Location:** `.github/workflows/ci.yml:65-71`
- **Description:** Only matches literal `<script>`; misses `<script >`/inline handlers.
- **Impact:** Inline scripts could pass.
- **Fix:** Parse HTML or use a proper linter.

### F-104 — Dependabot ignores all major updates
- **Severity:** Low · **Category:** CI · **Labels:** `ci`, `security`
- **Location:** `.github/dependabot.yml`
- **Description:** `ignore: dependency-name: "*" version-update:semver-major`.
- **Impact:** Stuck on vulnerable majors.
- **Fix:** Remove the blanket ignore; review majors deliberately.

### F-105 — No Firefox build validation
- **Severity:** Low · **Category:** CI · **Labels:** `ci`
- **Location:** `.github/workflows/ci.yml`, `build-firefox.sh`
- **Description:** Firefox packaging is manual and untested.
- **Impact:** Firefox artifact rot.
- **Fix:** Add a CI step to run `build-firefox.sh` and validate the manifest/zip.

---

## 9. Docs, Privacy & Repo Hygiene

### F-106 — Privacy policy has placeholder contacts/URLs
- **Severity:** High · **Category:** Privacy/Docs · **Labels:** `privacy`, `docs`
- **Location:** `PRIVACY_POLICY.md:52,64-65`
- **Description:** `https://github.com/yourusername/phishnet`, `your.email@example.com`.
- **Impact:** Invalid/not actionable policy; compliance risk.
- **Fix:** Replace with real repo/contact or remove.

### F-107 — Repo name mismatch everywhere
- **Severity:** High · **Category:** Docs · **Labels:** `docs`
- **Location:** `README.md:10,15,43`; `CONTRIBUTING.md:14`; `docs/index.html:308,319,452,464-466`; `src/popup.html:813`
- **Description:** Links/badges point to `anubhavaanand/PhishNet`, but the repo is `anubhavaanand/Project-Cyan-PhishNet`.
- **Impact:** Broken CI badge, clone URL, issues, pages.
- **Fix:** Update all URLs to the canonical repo (or add a redirect).

### F-108 — Privacy policy omits local scan history
- **Severity:** Medium · **Category:** Privacy · **Labels:** `privacy`, `docs`
- **Location:** `PRIVACY_POLICY.md:9-14,46-49`; `src/content.js:277-287`
- **Description:** Policy says nothing is stored, but subject/sender history is stored in `chrome.storage.local`.
- **Impact:** Inaccurate privacy disclosure.
- **Fix:** Disclose local history, its retention, and opt-out/clear.

### F-109 — SECURITY.md CSP contradicts manifest
- **Severity:** Medium · **Category:** Security/Docs · **Labels:** `security`, `docs`
- **Location:** `SECURITY.md:64-80` vs `manifest.json:58-60`
- **Description:** SECURITY.md claims jsDelivr in CSP and `worker-src 'self' blob:`; the real manifest has neither.
- **Impact:** False assurance; failed audits.
- **Fix:** Sync docs with the actual manifest; regenerate from source.

### F-110 — Privacy policy model source wrong
- **Severity:** Medium · **Category:** Privacy/Docs · **Labels:** `privacy`, `docs`
- **Location:** `PRIVACY_POLICY.md:24-29`; `src/offscreen.js:26`
- **Description:** Says jsDelivr; code downloads from Hugging Face and vendors ORT locally.
- **Impact:** Inaccurate disclosure.
- **Fix:** Correct the source list.

### F-111 — Placeholder security contact
- **Severity:** Medium · **Category:** Security · **Labels:** `security`
- **Location:** `SECURITY.md:12,90`
- **Description:** `security@phishnet.example.com` is non-functional; policy says “do not open public issues.”
- **Impact:** No working vulnerability disclosure channel.
- **Fix:** Provide a real email/handle or enable private vulnerability reporting.

### F-112 — CHANGELOG references non-existent docs
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `CHANGELOG.md`
- **Description:** Lists `DESIGN.md`, `API_REFERENCE.md`, `DEPLOYMENT.md` that don't exist.
- **Impact:** Broken references.
- **Fix:** Add the docs or remove the claims.

### F-113 — Model id mismatch in README
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `README.md:60`; `src/offscreen.js:26`
- **Description:** README cites `cybersectony/...`, code uses `onnx-community/...-ONNX`.
- **Impact:** Confusion.
- **Fix:** Use one canonical model id.

### F-114 — Supported-versions table omits 1.1.0
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `SECURITY.md:7-10`
- **Description:** Only `1.0.x` listed.
- **Impact:** Users unsure if 1.1.0 is supported.
- **Fix:** Update the table.

### F-115 — Test playground shipped with inline handlers
- **Severity:** Low · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `public/test-emails.html:177-181,242-341`
- **Description:** Inline `onclick=` handlers; if opened as an extension page, CSP blocks them. Also `list.innerHTML=''`.
- **Impact:** Playground broken under CSP; unnecessary shipped surface.
- **Fix:** Move handlers to a script file; exclude from the production package.

### F-116 — Marketing site loads Google Fonts
- **Severity:** Low · **Category:** Privacy · **Labels:** `privacy`
- **Location:** `docs/index.html:14-17`
- **Description:** External Google Fonts request on the marketing page (not the extension), which conflicts with the “zero third-party” message.
- **Impact:** Mixed message; minor privacy.
- **Fix:** Self-host fonts or remove.

### F-117 — `target="_blank"` without `rel="noopener"`
- **Severity:** Low · **Category:** Security · **Labels:** `security`
- **Location:** `src/popup.html:813`
- **Description:** Footer link lacks `rel="noopener"`.
- **Impact:** Reverse-tabnabbing (mitigated by modern browsers, but inconsistent).
- **Fix:** Add `rel="noopener noreferrer"`.

### F-118 — `innerHTML` clear in playground
- **Severity:** Low · **Category:** Security · **Labels:** `security`
- **Location:** `public/test-emails.html:328`
- **Description:** `list.innerHTML = ''` is safe (clearing), but establishes an `innerHTML` pattern.
- **Impact:** Informational.
- **Fix:** Use `replaceChildren()`.

### F-119 — Short emails skipped
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:161-164`
- **Description:** `emailContent.text.length < 15` skips scanning.
- **Impact:** Short phishing (“Verify now”) evades.
- **Fix:** Lower the threshold; rely on links/sender signals for short bodies.

### F-120 — Sender email parsed from `title` can be wrong
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:323-328`
- **Description:** Falls back to `title` attribute, which may be a display name, not an email.
- **Impact:** Wrong sender domain → wrong whitelist/verdict.
- **Fix:** Prefer `email`/`data-email`; validate with an email regex before use.

---

## Appendix A — Confirmed non-issues (checked)

- **Damerau-Levenshtein buffer rotation** (`heuristic-detector.js:152-182`): reviewed; the three-row rotation is correct (tests pass). The CHANGELOG “fixed” note is accurate.
- **`vendor/` not tracked**: `git ls-files vendor` shows the WASM/JS are tracked; not a missing-asset bug (but see F-098 for the `.gitignore` risk).
- **DOM XSS via link href**: modal uses `textContent`/`setAttribute` (`content.js:658-668`); no `innerHTML` with user data in `src/`. Keep it that way (F-050).

## Appendix B — Suggested remediation order

1. **P0 (ship blockers):** F-001, F-002, F-085, F-024, F-025 — make the extension actually load and the model run.
2. **P1 (security):** F-003, F-009, F-011–F-015, F-078 — lock down messages, permissions, model integrity, Firefox parity.
3. **P2 (correctness/FPs):** F-034–F-036, F-055–F-068 — fix double-counting, threshold, observer starvation, false positives.
4. **P3 (privacy/docs):** F-039, F-106–F-111 — accurate disclosures and contacts.
5. **P4 (CI/quality):** F-088, F-099–F-105 — build/test/scan in CI.