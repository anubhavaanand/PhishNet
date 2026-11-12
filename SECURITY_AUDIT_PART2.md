# PhishNet — Security & Bug Audit (Part 2)

**Scope:** second pass over vendor bundle, dependency tree, content/offscreen/background edge cases, frontend, assets, and policy docs.
**Companion to:** `SECURITY_AUDIT.md` (F-001–F-120). This file adds **F-121–F-210** (90 findings).
**Date:** 2026-11-12

| Severity | Count (Part 2) |
|---|---|
| Critical | 0 |
| High | 4 |
| Medium | 40 |
| Low | 46 |
| **Total** | **90** |

---

## A. Vendor, CSP & Supply Chain

### F-121 — ORT WASM defaults to jsDelivr, which CSP forbids
- **Severity:** High · **Category:** Security/Privacy · **Labels:** `security`, `privacy`, `bug`
- **Location:** `vendor/transformers.min.js` (`wasmPaths = "https://cdn.jsdelivr.net/npm/@huggingface/transfo…"`); `manifest.json:58-60`
- **Description:** The bundle sets a default `wasm.wasmPaths` to jsDelivr. The extension CSP is `script-src 'self' 'wasm-unsafe-eval'` (no jsDelivr), so if `env.backends.onnx.wasm.wasmPaths` is not applied before load, WASM fetches fail.
- **Impact:** Model never loads; contradicts “offline after download” and “no third-party” claims.
- **Fix:** Force local `wasmPaths` immediately after import, and assert no network in a test; remove the CDN fallback.

### F-122 — ORT proxy worker needs `worker-src`, absent from CSP
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `csp`
- **Location:** `vendor/transformers.min.js` (`ort-wasm-proxy-worker`); `manifest.json:58-60`
- **Description:** ORT can spawn a proxy worker from a blob; CSP has no `worker-src`.
- **Impact:** Model/inference may fail on configurations that use the proxy worker.
- **Fix:** Add `worker-src 'self' blob:` (or disable proxy worker / set `numThreads=1` and verify).

### F-123 — Missing source map referenced by the vendor bundle
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `vendor/transformers.min.js` (`sourceMappingURL=transformers.min.js.map`)
- **Description:** The `.map` is not shipped; devtools requests 404.
- **Impact:** No debuggable stack traces; console noise.
- **Fix:** Ship the map or strip the comment.

### F-124 — Vendor bundle has no version/provenance marker
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `supply-chain`
- **Location:** `vendor/transformers.min.js`
- **Description:** The checked-in bundle has no version string/build hash; reviewers cannot tie it to an upstream release.
- **Impact:** Cannot audit diffs or verify integrity; supply-chain risk.
- **Fix:** Record the exact upstream version/commit and hash in `VENDOR.md`; regenerate via a pinned script.

---

## B. Background Service Worker

### F-125 — No payload size limit on `SCAN_EMAIL`
- **Severity:** Medium · **Category:** Security · **Labels:** `security`
- **Location:** `src/background.js:138-165`; `src/offscreen.js`
- **Description:** `message.payload` (subject/body/links) is forwarded to offscreen without length checks.
- **Impact:** A malicious context can send huge payloads → memory/CPU DoS.
- **Fix:** Cap subject/body/links/attachments sizes; reject oversized payloads.

### F-126 — Whitelist broadcast to every tab/content script
- **Severity:** Medium · **Category:** Privacy · **Labels:** `privacy`, `security`
- **Location:** `src/background.js:311-320`
- **Description:** `broadcastSettingsUpdate` sends the full settings (including `whitelist`) to all tabs via `chrome.tabs.sendMessage`.
- **Impact:** Trusted-sender list (personal data) exposed to content scripts that don’t need it.
- **Fix:** Send only the fields each receiver needs; whitelist only to popup/options.

### F-127 — `SCAN_CURRENT_TAB` doesn't verify the active tab is mail
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:233-250`
- **Description:** Queries the active tab and messages it without checking the URL/host.
- **Impact:** Errors on non-mail tabs; confusing UX.
- **Fix:** Check `tab.url` against Gmail/Outlook before messaging; return a friendly error.

### F-128 — `sensitivityThreshold` not range-validated
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:41-60,168-171`
- **Description:** Stored/updated threshold is used as-is; values >1 or <0 or non-numbers are accepted.
- **Impact:** Threshold >1 makes everything “Uncertain”; non-number breaks comparisons.
- **Fix:** Clamp to `[0,1]` and coerce to number on load/update.

### F-129 — Default whitelist trusts entire consumer domains
- **Severity:** Medium · **Category:** Security/Privacy · **Labels:** `security`, `privacy`
- **Location:** `src/background.js:33-36`
- **Description:** Default whitelist contains `google.com`, `microsoft.com`, `apple.com`, `amazon.com`, etc. Any sender on those registrable domains is marked trusted without scanning.
- **Impact:** A phisher who can spoof a `@google.com`-style sender (or a compromised subdomain) bypasses detection; weakens the default posture.
- **Fix:** Default to an empty whitelist or require explicit opt-in; document the risk.

### F-130 — `UPDATE_SETTINGS` can replace `whitelist` with a non-array
- **Severity:** Medium · **Category:** Bug/Security · **Labels:** `bug`, `security`
- **Location:** `src/background.js:168-171`
- **Description:** `saveSettings` spreads arbitrary `settings`; `whitelist` can become a string/object for the current session.
- **Impact:** `ADD_WHITELIST` spread on a string yields characters; whitelist logic breaks.
- **Fix:** Validate `whitelist` is an array of strings on every update; reject otherwise.

### F-131 — No status rebroadcast after SW wake
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/background.js:341-367`
- **Description:** After a service-worker restart, already-open tabs/popup keep stale status until they poll.
- **Impact:** Popup shows stale “loading/error” after wake.
- **Fix:** On init completion, broadcast status to existing tabs (track tab IDs).

---

## C. Offscreen Document

### F-132 — Unknown typed messages hang the channel
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:115-151`
- **Description:** The listener returns `true` for any message with a `type`, but only `RUN_INFERENCE` calls `sendResponse`; other types never respond.
- **Impact:** Sender promise never settles (timeout/leak).
- **Fix:** Return `true` only for `RUN_INFERENCE`; call `sendResponse` (or return false) for others.

### F-133 — Model label not validated against `LABEL_MAP`
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:128-142`
- **Description:** `LABEL_MAP[topPrediction.label]` may be `undefined` if the model emits an unexpected label.
- **Impact:** `label: undefined` → badge/modal break (`label.includes` throws).
- **Fix:** Validate/fallback to `uncertain`; derive labels from model config.

### F-134 — Progress can regress on retries
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:61-74`
- **Description:** `reportProgress` sends raw percentages; retries can move backwards.
- **Impact:** Jumpy progress bar.
- **Fix:** Clamp monotonically (`Math.max(prev, value)`).

### F-135 — Char truncation can split a surrogate pair
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/offscreen.js:176-181`
- **Description:** `slice(0, maxTokens*4)` may cut a surrogate pair; tokenizer can error.
- **Impact:** Rare inference failure on emoji-heavy emails.
- **Fix:** Use `Array.from`/tokenizer truncation; avoid splitting pairs.

---

## D. Content Script

### F-136 — History timestamp has no date
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:279`
- **Description:** Stores `new Date().toLocaleTimeString()` only.
- **Impact:** History entries from different days are indistinguishable.
- **Fix:** Store ISO timestamp; format in UI.

### F-137 — History id `Date.now()` collides
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:278`
- **Description:** `id: Date.now()` for rapid scans in the same millisecond.
- **Impact:** Duplicate React keys / wrong list updates.
- **Fix:** Use `crypto.randomUUID()` (as background does).

### F-138 — Compose/reply/draft areas are scanned
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Description:** `extractEmailContent`/`extractLinks`/`extractAttachments` operate on the message element without excluding compose/reply/draft regions; `EMAIL_SELECTORS.*.composeArea`/`draftArea` are defined but unused (`selectors.js:51-76`).
- **Impact:** Draft text/links analyzed; false verdicts; privacy.
- **Fix:** Skip `composeArea`/`replyArea`/`draftArea`/`skipElements` subtrees during extraction.

### F-139 — `GET_SETTINGS` on every scan
- **Severity:** Medium · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/content.js:167-173`
- **Description:** Each scan round-trips to the (possibly asleep) service worker for settings.
- **Impact:** Latency on every email; SW wake cost.
- **Fix:** Cache settings in the content script; update on `SETTINGS_UPDATE`.

### F-140 — Unchecked `chrome.runtime.lastError`
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:56,169,207-208,796-810`
- **Description:** `sendMessage(...).catch(...)` is used in some places but not all; callback-style calls ignore `lastError`.
- **Impact:** Unhandled promise rejections / silent failures.
- **Fix:** Always handle rejection/lastError.

### F-141 — Body text includes headers
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:327`
- **Description:** When no body selector matches, `bodyEl = element`, so the extracted “body” includes sender/subject/header text.
- **Impact:** Duplicated tokens skew heuristics/ML.
- **Fix:** Prefer a body-only container; strip header regions.

### F-142 — Image links have empty display text
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:417`
- **Description:** `linkEl.textContent.trim()` is empty for image-only links; display-text mismatch check is skipped.
- **Impact:** “Image as link” phishing (common) not caught.
- **Fix:** Use `alt`/`aria-label`/`title` as fallback display text; flag image-only links.

### F-143 — Attachments deduped by filename only
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:449`
- **Description:** `attachments.includes(clean)` dedupes by name; same name with different types/sizes collapses.
- **Impact:** Under-counts attachments.
- **Fix:** Dedupe by name+size+type.

### F-144 — Outlook `data-convid` may be absent
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:122-131`
- **Description:** `element.dataset.convid` on `[role=listitem]` may be undefined; falls back to sender+subject hash.
- **Impact:** ID collisions / re-scans.
- **Fix:** Prefer `data-conversation-id`/provider IDs; validate.

### F-145 — Short whitelisted emails skipped before whitelist
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:161-164`
- **Description:** The `<15` char early return runs before `isWhitelisted`, so short trusted emails aren’t marked trusted.
- **Impact:** Inconsistent trusted UX.
- **Fix:** Check whitelist first, then length.

### F-146 — Modal lacks focus trap/restore
- **Severity:** Low · **Category:** Accessibility · **Labels:** `accessibility`, `bug`
- **Location:** `src/content.js:511-727`
- **Description:** `role="dialog"` but focus is not moved into the modal or restored on close; ESC handler only.
- **Impact:** Keyboard/screen-reader users lose context.
- **Fix:** Focus the close button on open; trap Tab; restore focus on close.

### F-147 — No cap on extracted links
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/content.js:397-421`
- **Description:** Every matching anchor in a message is pushed; huge threads/emails produce large arrays.
- **Impact:** CPU/memory spikes; large messages to offscreen.
- **Fix:** Cap (e.g., 100) with a “more” indicator.

### F-148 — No cap on extracted attachments
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/content.js:426-450`
- **Description:** No limit on attachment count.
- **Impact:** Large payloads.
- **Fix:** Cap and summarize.

### F-149 — `lastUrl` is dead state
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `src/content.js:32`
- **Description:** `lastUrl` is assigned but never compared/used.
- **Impact:** Confusion; SPA navigation handling relies solely on mutations.
- **Fix:** Use it to detect route changes, or remove.

### F-150 — Quoted/threaded links are analyzed
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:404`
- **Description:** `element.querySelectorAll` includes quoted replies and signature links, not just the current message body.
- **Impact:** Old/quoted phishing links can flag a safe email.
- **Fix:** Restrict to the current message body container.

### F-151 — `SETTINGS_UPDATE` doesn't re-render existing badges
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/content.js:788`
- **Description:** On settings change, existing badges are not re-evaluated (e.g., autoScan/highlight changes).
- **Impact:** Stale UI until reload.
- **Fix:** Re-run checks or update visibility on settings change.

---

## E. Detection Engine

### F-152 — Userinfo URL trick not detected
- **Severity:** High · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `src/utils/heuristic-detector.js:283-321`
- **Description:** `https://paypal.com@evil.com` parses with hostname `evil.com`; no brand/homograph match → not suspicious.
- **Impact:** Classic phishing URL evades detection.
- **Fix:** If `parsed.username`/`parsed.password` is present, flag as deceptive.

### F-153 — IPv6 hosts not handled
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:306-312`
- **Description:** IP regex only matches IPv4; `http://[::1]/`, `http://[2001:db8::1]/` not flagged.
- **Impact:** Evasion via IPv6 literal.
- **Fix:** Detect bracketed IPv6 hosts.

### F-154 — Non-http(s) schemes not flagged
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `src/utils/heuristic-detector.js:287-290`
- **Description:** Only `data:`/`javascript:`/`vbscript:` are flagged; `ftp:`, `ws:`, `wss:`, `file:` pass.
- **Impact:** Unexpected schemes not surfaced.
- **Fix:** Allowlist `http:`/`https:`/`mailto:`; flag others.

### F-155 — Attachment filename evasion (ADS/RTL/trailing)
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `src/utils/heuristic-detector.js:254-266`
- **Description:** `file.exe::$DATA`, `file.exe `, `file.exe.`, and RTL-override (`file\u202Efdp.exe`) are not normalized.
- **Impact:** Malicious attachments evade.
- **Fix:** Strip trailing dots/spaces, ADS suffixes, zero-width/RTL controls; then analyze.

### F-156 — Relative display-text URL not parsed
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:458-469`
- **Description:** `new URL(link.text.trim())` requires an absolute URL; `www.paypal.com` throws and is skipped.
- **Impact:** Display-text mismatch missed for scheme-less text.
- **Fix:** Resolve with a base or prepend `https://` for analysis.

### F-157 — Brand substring FPs for `groups`/`purchases`
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:230-232`
- **Description:** `groups.com` contains `ups`; `purchases.com` contains `chase` → flagged as brand deception.
- **Impact:** False positives.
- **Fix:** Compare registrable label tokens, not substrings.

### F-158 — Encoded open-redirect not detected
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:268,315`
- **Description:** `OPEN_REDIRECT_REGEX` doesn't decode `%2F`/`%3A%2F%2F`; encoded targets evade.
- **Impact:** Evasion.
- **Fix:** Decode URI components before matching.

### F-159 — Non-standard ports not flagged
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/heuristic-detector.js:283-321`
- **Description:** `parsed.port` is ignored; `https://paypal.com:8443` looks normal.
- **Impact:** Missed signal.
- **Fix:** Flag unusual ports.

### F-160 — Private/loopback IPs flagged as suspicious
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `false-positive`
- **Location:** `src/utils/heuristic-detector.js:306-312`
- **Description:** Any IPv4 literal is suspicious, including `192.168.x.x`/`10.x`.
- **Impact:** FPs on intranet links.
- **Fix:** Allowlist private ranges or mark as “internal”.

---

## F. Selectors & Error Boundary

### F-161 — Large unused selector config
- **Severity:** Medium · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `src/selectors.js:51-193`
- **Description:** `composeArea`, `replyArea`, `draftArea`, `loadingIndicators`, `phishingKeywords`, `threadContainer`, `threadView`, `attachmentLinks`, `attachmentSizes`, `linkText`, `timestamp` are never read.
- **Impact:** Dead code; false sense of coverage (e.g., drafts not excluded).
- **Fix:** Wire them up (esp. compose/draft exclusion) or remove.

### F-162 — Brittle provider selectors
- **Severity:** Medium · **Category:** Maintainability · **Labels:** `maintainability`, `bug`
- **Location:** `src/selectors.js:8-45`
- **Description:** Hard-coded Gmail/Outlook class names change frequently; no fallback/telemetry.
- **Impact:** Silent scan failures after provider UI updates.
- **Fix:** Use stable `data-*`/ARIA selectors; add a self-test/fallback and log selector misses.

### F-163 — Shortener list incomplete
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/selectors.js:215-218`
- **Description:** Missing common shorteners (`rb.gy`, `tiny.cc`, `v.gd`, `s.id`, `shorturl.at`, `rebrand.ly`).
- **Impact:** Missed suspicious links.
- **Fix:** Expand and dedupe with the detector's list.

### F-164 — `safeSendMessage` doesn't catch sync throw
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/utils/error-boundary.js:110-122`
- **Description:** If `chrome.runtime.sendMessage` throws synchronously (invalidated context), it isn't caught.
- **Impact:** Unhandled exception.
- **Fix:** Wrap the call in try/catch and reject.

### F-165 — `retryWithBackoff` has no jitter
- **Severity:** Low · **Category:** Performance · **Labels:** `performance`
- **Location:** `src/utils/error-boundary.js:157-168`
- **Description:** Deterministic backoff can synchronize retries.
- **Impact:** Thundering herd on mass reload.
- **Fix:** Add jitter.

---

## G. Popup

### F-166 — Threshold slider fill never updates
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/popup.html:575`; `src/popup.js:166-170,325-331`
- **Description:** Track fill uses `var(--fill,47%)` but JS never sets `--fill`; the filled portion is always 47%.
- **Impact:** Misleading sensitivity control.
- **Fix:** Set `thresholdSlider.style.setProperty('--fill', pct+'%')` on input/load.

### F-167 — History rendering assumes `item.label` is a string
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/popup.js:191-210`
- **Description:** `item.label.includes(...)` throws on corrupt/legacy records.
- **Impact:** Popup breaks.
- **Fix:** Guard `typeof item.label === 'string'`.

### F-168 — Whitelist rendering assumes string entries
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/popup.js:212-232`
- **Description:** Non-string entries are rendered via `textContent` (coerced) but delete calls background, which calls `.trim()` on a non-string (Chrome) → throws.
- **Impact:** Delete fails / console error.
- **Fix:** Validate/normalize entries on render and send only strings.

### F-169 — Status polling interval never cleared
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `performance`
- **Location:** `src/popup.js:339-362`
- **Description:** `setInterval(refreshStatus, 4000)` has no `clearInterval`.
- **Impact:** Leak in long-lived/dev contexts.
- **Fix:** Store and clear on unload.

### F-170 — Unknown status leaves stale label
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `src/popup.js:76-106`
- **Description:** `statusLabels[status]` undefined → “Unknown”; dot class becomes `status-dot undefined`.
- **Impact:** Broken UI on new statuses.
- **Fix:** Default to a known state; sanitize class.

### F-171 — `statusDot` class may be `undefined`
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `src/popup.js:79`
- **Description:** `'status-dot ' + status` with undefined status.
- **Impact:** Missing dot styling.
- **Fix:** Fallback to `loading`.

---

## H. React Frontend

### F-172 — `var(--pn-gold-dark)` is undefined
- **Severity:** Medium · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `frontend/src/components/StatsTab.jsx:60,96`; `frontend/src/styles/tokens.css`
- **Description:** Trusted tag uses `var(--pn-gold-dark)`, which is never defined (only `--pn-gold`, `--pn-gold-light`, `--pn-gold-pale`).
- **Impact:** Trusted text color invalid/inherited.
- **Fix:** Add `--pn-gold-dark` or use `--pn-amber-dark`.

### F-173 — Conflicting margin declarations in `ScanTab`
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `ui`
- **Location:** `frontend/src/components/ScanTab.jsx:134`
- **Description:** `marginTop: 4` plus `margin: '4px auto 0'` (and the `mis` key typo) — the shorthand wins.
- **Impact:** Unexpected spacing.
- **Fix:** Use one declaration.

### F-174 — Unused `ConfidenceRing` import
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `frontend/src/components/ScanTab.jsx:2`
- **Description:** Imported but never rendered.
- **Impact:** Dead import.
- **Fix:** Remove.

### F-175 — `Toast` never auto-dismisses / no live region
- **Severity:** Low · **Category:** Accessibility · **Labels:** `accessibility`, `bug`
- **Location:** `frontend/src/components/Toast.jsx`
- **Description:** Accepts `onDismiss` but never calls it; no `role="status"`/`aria-live`.
- **Impact:** Toasts persist; screen readers may miss them.
- **Fix:** Add timer + `role="status"`.

### F-176 — `useModelStatus` error never clears
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/hooks/useModelStatus.js`
- **Description:** `error` set on failure but not reset after a successful poll.
- **Impact:** Stale error banner.
- **Fix:** Clear `error` on success.

### F-177 — Options toast timer not cleared
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/options/main.jsx`
- **Description:** `setTimeout` in `showToast` isn't cleared on unmount.
- **Impact:** State update after unmount warning.
- **Fix:** Track/clear timer in `useEffect` cleanup.

### F-178 — Sensitivity label uses exact match
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/lib/constants.js:94-100`
- **Description:** `SENSITIVITY.find(v => v.value === value)`; arbitrary values fall back to “Standard”.
- **Impact:** Misleading label.
- **Fix:** Find nearest value or show raw percentage.

### F-179 — `getLocalStorage` ignores `lastError`
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/lib/messaging.js:75-80`
- **Description:** Callback resolves `data` without checking `chrome.runtime.lastError`.
- **Impact:** Silent failures.
- **Fix:** Check and reject/log.

### F-180 — TabBar lacks tab semantics
- **Severity:** Low · **Category:** Accessibility · **Labels:** `accessibility`
- **Location:** `frontend/src/components/TabBar.jsx`
- **Description:** Buttons are not `role="tab"` inside `role="tablist"`; no `aria-selected`.
- **Impact:** Screen-reader navigation is unclear.
- **Fix:** Add roles/`aria-selected`.

### F-181 — SegmentedControl missing Home/End keys
- **Severity:** Low · **Category:** Accessibility · **Labels:** `accessibility`
- **Location:** `frontend/src/components/SegmentedControl.jsx`
- **Description:** Only ArrowLeft/Right are handled.
- **Impact:** Incomplete keyboard support.
- **Fix:** Add Home/End.

### F-182 — Stats history key collision
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `frontend/src/components/StatsTab.jsx:65`
- **Description:** `key={item.id || i}`; duplicate `Date.now()` ids collide.
- **Impact:** React reconciliation glitches.
- **Fix:** Use a stable unique id (UUID).

---

## I. Build, Dependencies & Assets

### F-183 — Vulnerable Vite/esbuild in the lockfile
- **Severity:** High · **Category:** Security · **Labels:** `security`, `ci`
- **Location:** `package-lock.json` (vite 5.4.21, esbuild 0.21.5)
- **Description:** `npm audit` reports **1 high** (Vite path traversal / launch-editor RCE) and **1 moderate** (esbuild dev-server request forgery).
- **Impact:** Dev-server compromise if exposed; known CVEs.
- **Fix:** Upgrade Vite/esbuild; add `npm audit --audit-level=high` to CI.

### F-184 — `package.json` missing metadata/scripts
- **Severity:** Medium · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `package.json`
- **Description:** No `license`, `author`, `repository`, `homepage`; no `test`, `lint`, or combined `build`.
- **Impact:** Poor discoverability; contributors can’t run tests via npm.
- **Fix:** Add metadata and scripts.

### F-185 — 4.4 MB of assets, including an exact duplicate
- **Severity:** Medium · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `assets/`
- **Description:** `phishnet_mountain_banner.gif` and `phishnet_mountain_scenery.gif` are byte-identical (360 KB each); many unused scenery files.
- **Impact:** Repo bloat; clone size.
- **Fix:** Remove duplicates/unused; compress; consider Git LFS.

### F-186 — Outdated bundled Three.js (r160)
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`, `security`
- **Location:** `docs/vendor/three.module.js`
- **Description:** Three.js r160 (2023) is bundled (1.3 MB) with no update process.
- **Impact:** Missing fixes; large file.
- **Fix:** Pin/update via a script; tree-shake.

### F-187 — Generated `banner.pixel.json` checked in
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `assets/banner.pixel.json` (112 KB)
- **Description:** Generated pixel data is committed.
- **Impact:** Noise/bloat.
- **Fix:** Generate at build time; gitignore.

### F-188 — Firefox build doesn't build `dist/`
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`, `build`
- **Location:** `build-firefox.sh`
- **Description:** Copies `src/public/vendor` but not a built `dist/`; Firefox manifest still points at `dist/popup.html`.
- **Impact:** Firefox popup/options 404.
- **Fix:** Run the Vite build before packaging.

### F-189 — Firefox package includes the test playground
- **Severity:** Low · **Category:** Security · **Labels:** `security`, `bug`
- **Location:** `build-firefox.sh`; `public/test-emails.html`
- **Description:** `public/` (including `test-emails.html`) is copied into the shipped package.
- **Impact:** Extra attack surface / confusion.
- **Fix:** Exclude `test-emails.html` from production packages.

---

## J. Docs, Policies & Marketing Page

### F-190 — SECURITY.md falsely says the SW never sees email content
- **Severity:** High · **Category:** Security/Docs · **Labels:** `security`, `docs`
- **Location:** `SECURITY.md` (data-flow table: “Background SW … Email Content Access ❌ Never”)
- **Description:** The background handles `SCAN_EMAIL` with a payload containing subject/body and forwards it to offscreen.
- **Impact:** False security claim; failed audits.
- **Fix:** Correct the table (SW relays content transiently; it is not persisted).

### F-191 — SECURITY.md overstates model integrity verification
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `docs`
- **Location:** `SECURITY.md` (“Transformers.js validates model integrity”)
- **Description:** Transformers.js does not verify model hashes; only the cache layer is used.
- **Impact:** False assurance.
- **Fix:** Implement hash pinning or remove the claim.

### F-192 — SECURITY.md says offscreen makes no network requests
- **Severity:** Medium · **Category:** Security · **Labels:** `security`, `docs`
- **Location:** `SECURITY.md` (data-flow table)
- **Description:** The offscreen document downloads the model from Hugging Face.
- **Impact:** Inaccurate.
- **Fix:** State the one-time model download.

### F-193 — PRIVACY_POLICY claims no personal data under GDPR/CCPA
- **Severity:** Medium · **Category:** Privacy · **Labels:** `privacy`, `docs`
- **Location:** `PRIVACY_POLICY.md:67-69`
- **Description:** Email subject/sender/body are personal data; local processing still constitutes processing.
- **Impact:** Legally questionable claim.
- **Fix:** Reword (local processing of personal data; no transmission/retention beyond on-device history).

### F-194 — PRIVACY_POLICY ignores `chrome.storage.local` history
- **Severity:** Medium · **Category:** Privacy · **Labels:** `privacy`, `docs`
- **Location:** `PRIVACY_POLICY.md:46-49`; `src/content.js:277-287`
- **Description:** Says “settings only in sync”, but scan history (subject/sender) is stored locally.
- **Impact:** Incomplete disclosure.
- **Fix:** Document local history and retention.

### F-195 — CODE_OF_CONDUCT has a placeholder contact
- **Severity:** Medium · **Category:** Docs · **Labels:** `docs`
- **Location:** `CODE_OF_CONDUCT.md:37`
- **Description:** `conduct@phishnet.example.com` is non-functional.
- **Impact:** Reports go nowhere.
- **Fix:** Use a real contact or GitHub private reporting.

### F-196 — README/docs website URL mismatches the repo
- **Severity:** Medium · **Category:** Docs · **Labels:** `docs`
- **Location:** `README.md:15`; `docs/index.html:11`
- **Description:** `anubhavaanand.github.io/PhishNet/` but repo is `Project-Cyan-PhishNet`.
- **Impact:** Broken Pages link.
- **Fix:** Update to the real Pages URL (or repo redirect).

### F-197 — CHANGELOG release tag doesn't match version
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `CHANGELOG.md` (release process `git tag v1.0.1`)
- **Description:** Version is 1.1.0.
- **Impact:** Wrong tags.
- **Fix:** Derive from manifest.

### F-198 — CONTRIBUTING says no build tools required
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `CONTRIBUTING.md`
- **Description:** “No build tools required — vanilla JS only,” but `frontend/` uses Vite + React and the manifest expects `dist/`.
- **Impact:** Misleading setup instructions.
- **Fix:** Document the Vite build.

### F-199 — CONTRIBUTING references non-existent `DESIGN.md`
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `CONTRIBUTING.md` (PR requirements)
- **Description:** `DESIGN.md` is not in the repo.
- **Impact:** Broken instruction.
- **Fix:** Add it or remove the reference.

### F-200 — README hardcodes test/brand counts
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `README.md` (“30/30 tests”, “25+ major brands”)
- **Description:** Counts drift from reality.
- **Impact:** Stale docs.
- **Fix:** Generate or soften.

### F-201 — Marketing page has no `og:image`
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `docs/index.html:8-12`
- **Description:** `twitter:card=summary_large_image` but no image.
- **Impact:** Blank social previews.
- **Fix:** Add a 1200×630 OG image.

### F-202 — Duplicate `.btn-primary:hover` rule
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `docs/index.html:111-112`
- **Description:** Two hover rules with different box-shadows; the later wins.
- **Impact:** Confusing CSS.
- **Fix:** Merge into one.

### F-203 — Inline handler and debug globals in production
- **Severity:** Low · **Category:** Security · **Labels:** `security`, `maintainability`
- **Location:** `docs/index.html:352,684,942`
- **Description:** `onclick="return false"`, `console.warn`, and `window.__pnRenders` ship to production.
- **Impact:** CSP-unfriendly; debug leakage.
- **Fix:** Move handlers to JS; gate debug behind a flag.

### F-204 — Mini 3D stages blank for reduced-motion users
- **Severity:** Low · **Category:** Accessibility · **Labels:** `accessibility`, `bug`
- **Location:** `docs/index.html:723-730`
- **Description:** `start()` returns early when `prefersReduced`, before `init()`, so mini canvases never render.
- **Impact:** Empty visuals for those users.
- **Fix:** Render a single static frame when reduced motion is set.

### F-205 — Test playground duplicates link arguments
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `public/test-emails.html:318`
- **Description:** `heuristicDetect(emailContent, links)` passes links already on `emailContent` → double-count.
- **Impact:** Inflated playground scores (mirrors F-034).
- **Fix:** Call `heuristicDetect(emailContent)`.

### F-206 — Manifest lacks `author`
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`
- **Location:** `manifest.json`
- **Description:** No `author` field.
- **Impact:** Chrome Web Store listing less complete.
- **Fix:** Add `author`.

### F-207 — README says the model is cached “forever”
- **Severity:** Low · **Category:** Docs · **Labels:** `docs`
- **Location:** `README.md`
- **Description:** Clearing site data/IndexedDB removes the cache; “forever” is inaccurate.
- **Impact:** Misleading.
- **Fix:** Say “until you clear browsing data.”

### F-208 — Hero renderer has no WebGL failure guard
- **Severity:** Low · **Category:** Bug · **Labels:** `bug`
- **Location:** `docs/index.html:477`
- **Description:** `new THREE.WebGLRenderer(...)` at module top can throw on software-GL hosts; the rest of the script (reveals) then fails.
- **Impact:** Blank hero / no reveal animations.
- **Fix:** Wrap in try/catch (mini stages already do).

### F-209 — Hardcoded colors in nav/install panels
- **Severity:** Low · **Category:** Maintainability · **Labels:** `maintainability`, `ui`
- **Location:** `docs/index.html:48,223`
- **Description:** `rgba(11,15,23,...)`, `#0D1420` bypass the token system.
- **Impact:** Theme inconsistency.
- **Fix:** Use CSS variables.

### F-210 — `docs/index.html` preconnect to fonts with no local fallback
- **Severity:** Low · **Category:** Privacy · **Labels:** `privacy`, `docs`
- **Location:** `docs/index.html:14-17`
- **Description:** Google Fonts preconnect/stylesheet on the marketing page (third-party request), conflicting with the privacy message.
- **Impact:** Mixed messaging; minor tracking.
- **Fix:** Self-host fonts or remove.

---

## Appendix — Cross-references

- Duplicates of Part 1 were intentionally excluded. Related: F-003 (web-accessible vendor), F-005 (CSP), F-009/F-031 (model pinning), F-034 (duplicate link args), F-055–F-064 (false positives), F-092 (React keys), F-099 (npm audit), F-107 (repo URLs), F-108 (history privacy), F-109–F-111 (SECURITY.md), F-115 (inline handlers).

## Suggested priority for Part 2

1. **P0:** F-121, F-122 (model/worker CSP), F-183 (vulnerable Vite/esbuild).
2. **P1:** F-125–F-130 (message/settings/whitelist hardening), F-152–F-155 (detection evasions), F-190 (false security claim).
3. **P2:** F-136–F-151 (content-script correctness), F-166–F-172 (popup/frontend).
4. **P3:** F-184–F-210 (build hygiene, docs, marketing).