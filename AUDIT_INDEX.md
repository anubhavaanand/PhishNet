# PhishNet Audit Index

210 findings (F-001–F-210) from a full read of the codebase. Full detail in  and ; each finding is also an individual GitHub issue.

## Critical

- **F-001** — Popup/options point at unbuilt `dist/` — issue #9
- **F-002** — CI release zip omits `dist/` — issue #10
- **F-034** — Duplicate links/attachments double-counted — issue #42
- **F-085** — `useSettings` imports a non-existent export — issue #93

## High

- **F-003** — Over-broad `web_accessible_resources` — issue #11
- **F-009** — Model fetched without integrity pinning — issue #17
- **F-011** — No sender/origin validation on messages — issue #19
- **F-012** — `ADD_WHITELIST`/`REMOVE_WHITELIST` unvalidated — issue #20
- **F-013** — `UPDATE_SETTINGS` merges arbitrary keys — issue #21
- **F-024** — `device:'auto'` may select unavailable WebGPU — issue #32
- **F-025** — ORT wasm path/filename mismatch — issue #33
- **F-035** — Threshold ignores `phishing_url` — issue #43
- **F-036** — MutationObserver debounce starvation — issue #44
- **F-037** — Modal replacement leaks keydown listener — issue #45
- **F-055** — All punycode flagged as homograph — issue #63
- **F-056** — Brand substring over-flagging — issue #64
- **F-057** — Display-name substring false positives — issue #67
- **F-058** — Keyword substring false positives — issue #65
- **F-078** — Reduced `isUrlSuspicious` on Firefox — issue #86
- **F-079** — No inference timeout on Firefox — issue #87
- **F-086** — No build script produces both pages — issue #94
- **F-087** — `emptyOutDir:false` with sequential builds — issue #96
- **F-088** — Frontend not built/validated in CI — issue #95
- **F-099** — No SAST/secret/dependency scanning — issue #107
- **F-106** — Privacy policy has placeholder contacts/URLs — issue #114
- **F-107** — Repo name mismatch everywhere — issue #115
- **F-121** — ORT WASM defaults to jsDelivr, which CSP forbids — issue #125
- **F-152** — Userinfo URL trick not detected — issue #161
- **F-183** — Vulnerable Vite/esbuild in the lockfile — issue #192
- **F-190** — SECURITY.md falsely says the SW never sees email content — issue #199

## How to navigate

- Filter by severity: , , , 
- Filter by category: , , , , , , , 
- Filter by area: , , , , , 

---

Audit compiled with Kilo.
