## 2026-08-23 - [HIGH] XSS Vulnerability via innerHTML in Threat Modal
**Vulnerability:** Found multiple uses of `.innerHTML` combined with template literals in `src/content.js` to build the threat modal UI.
**Learning:** Even if some data (like confidence scores or pre-defined labels) is safe, building DOM structures with `.innerHTML` using user-facing data (like email subjects or link structures) opens up DOM XSS vulnerabilities. The codebase had comments recognizing this for URLs but missed applying the principle consistently across the UI.
**Prevention:** Avoid `.innerHTML` entirely for dynamically generated UI elements. Always use `document.createElement`, `.className`, `.textContent`, and `appendChild` instead. This ensures all text is properly escaped by the browser engine.
