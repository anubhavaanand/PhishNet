# Changelog

All notable changes to PhishNet will be documented in this format.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-08-18

### Added
- **Core ML Pipeline**: Transformers.js + ONNX Runtime Web for on-device DistilBERT inference
- **Privacy-First Architecture**: Zero network requests for inference, model cached locally
- **Cross-Provider Support**: Gmail (mail.google.com) and Outlook (outlook.live.com, outlook.office.com)
- **Real-Time Detection**: Inline badges (🛡️ Safe / ⚠️ Phishing / ❓ Uncertain) with confidence scores
- **Link Analysis**: Heuristic detection of suspicious URLs with visual highlighting
- **Popup UI**: Model status, manual scan, settings (auto-scan, sensitivity, link highlighting)
- **Offscreen Document**: MV3-compliant ML inference isolation
- **Service Worker**: Message routing, settings persistence, model lifecycle management

### Technical
- Manifest V3 with strict CSP (`wasm-unsafe-eval` for ONNX WASM)
- ES Modules throughout (no build step required)
- IndexedDB model caching via Transformers.js
- Chrome storage sync for user preferences
- MutationObserver for SPA navigation (Gmail/Outlook)

### Documentation
- DESIGN.md — Architecture, components, data flow
- IMPLEMENTATION_PLAN.md — 4-day sprint breakdown
- API_REFERENCE.md — Message types, interfaces, storage schema
- DEPLOYMENT.md — Chrome Web Store & Devpost submission guide
- PRIVACY_POLICY.md — GDPR/CCPA compliant, zero data collection
- CONTRIBUTING.md — Contribution guidelines, privacy requirements
- SECURITY.md — Threat model, CSP, permissions justification
- CODE_OF_CONDUCT.md — Community standards

### DevOps
- GitHub repository with professional structure
- Generated icons (16, 32, 48, 128px)
- MIT License
- .gitignore excluding docs/, build artifacts

---

## [Unreleased]

## [1.1.0] - Detection Engine Upgrade

### Added
- UTS #39-style confusable skeletoning: homoglyph and digit-substitution
  attacks (p\u0430ypal.com, g00gle.com) normalize before distance checks
- Damerau-Levenshtein distance with transposition shortcut for
  transposition typosquats (payapl.com)
- Display-name vs sender-domain brand impersonation cross-check
- URL hardening: dangerous schemes (data:/javascript:/vbscript:),
  open-redirect parameters, invisible-character obfuscation,
  excessive hyphen runs and domain length
- Calibrated logistic scoring replacing linear confidence
- Labeled mini-corpus evaluation in tests with recall/FPR gates

### Changed
- Heuristic fallback re-tuned: urgency weight 8/signal, link risk 16/link
- Memoization caches for skeleton, registrable-domain and lookalike results
- Performance: ~0.25 ms/scan heuristic (4,000 scans/sec)

### Fixed
- Damerau row-buffer rotation aliasing prevPrev rows

 - Sprint 1 (Day 1-2)

### In Progress
- Content script testing on live Gmail/Outlook
- Model loading verification in offscreen document
- End-to-end inference pipeline
- Badge injection and link highlighting UX

### Planned
- [ ] Selector robustness testing
- [ ] Error handling for model load failures
- [ ] Performance optimization (WebWorker inference)
- [ ] Accessibility improvements (ARIA, keyboard nav)

---

## Versioning Scheme

- **Major**: Breaking changes to API, architecture, or privacy model
- **Minor**: New features, provider support, detection capabilities
- **Patch**: Bug fixes, selector updates, performance improvements

---

## Release Process

1. Update version in `manifest.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag -a v1.0.1 -m "Release v1.0.1"`
4. Push: `git push origin v1.0.1`
5. Build zip for Chrome Web Store
6. Submit store update
7. GitHub Release with artifacts