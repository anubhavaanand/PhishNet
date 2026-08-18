# Contributing to PhishNet

Thank you for your interest in contributing! PhishNet is a privacy-first phishing detector, and we welcome contributions that maintain our privacy guarantees.

## Getting Started

### Prerequisites
- Chrome 109+ (for Offscreen Documents API)
- Basic knowledge of Chrome Extensions (MV3), JavaScript ES Modules
- No build tools required — vanilla JS only

### Development Setup
```bash
git clone https://github.com/anubhavaanand/PhishNet.git
cd PhishNet

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select PhishNet folder
```

## Code Style

### JavaScript
- ES Modules (`type: "module"` in manifest)
- Vanilla JS — no frameworks, no build step
- JSDoc comments for public functions
- 2-space indentation, single quotes
- Async/await over promises

### CSS
- Custom properties for theming (light/dark)
- BEM-like class naming: `.phishnet-badge--phishing`
- Mobile-first, responsive
- `prefers-color-scheme`, `prefers-reduced-motion` support

### Architecture Principles
- **Privacy-first**: No external network requests for inference
- **Single responsibility**: One file = one concern
- **Graceful degradation**: Show "Uncertain" vs crash
- **Manifest V3 compliant**: Service worker, offscreen doc, CSP

## Contribution Types

### 🐛 Bug Fixes
1. Check existing issues first
2. Create minimal reproduction
3. Fix with test case if possible

### ✨ Features
1. Open issue to discuss design first
2. Ensure privacy guarantees maintained
3. Update relevant documentation

### 📝 Documentation
- Fix typos, clarify instructions
- Add missing JSDoc
- Update README/DESIGN.md for architectural changes

## Pull Request Process

1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/your-feature-name`
3. **Make changes** with clear, focused commits
4. **Test locally** on Gmail and Outlook
5. **Update docs** if needed
6. **Submit PR** with description of changes

### Commit Message Format
```
type(scope): brief description

Longer explanation if needed

Fixes #issue-number
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### PR Requirements
- [ ] No console.log in production code
- [ ] CSP compliant (no inline scripts)
- [ ] Works on Gmail AND Outlook
- [ ] Settings persist across reloads
- [ ] No memory leaks (check DevTools)
- [ ] Dark mode / reduced motion support

## Testing Checklist

Before submitting:
- [ ] Fresh Chrome profile, load unpacked extension
- [ ] Gmail: phishing email → red badge
- [ ] Gmail: legitimate email → green badge
- [ ] Outlook.com: same tests
- [ ] Model loads on first install (~50MB)
- [ ] Settings persist after reload
- [ ] No console errors
- [ ] Popup opens, shows status, settings work

## Privacy Guidelines

**Never** add:
- Analytics/tracking
- External API calls for email content
- Crash reporting that sends email data
- Any data leaving the browser without explicit user consent

**Always**:
- Process locally
- Use `chrome.storage.sync` for preferences only
- Document any network requests in PRIVACY_POLICY.md

## Code Review Checklist

Reviewers will check:
- [ ] Privacy guarantees maintained
- [ ] CSP compliance
- [ ] Cross-provider compatibility (Gmail/Outlook)
- [ ] Error handling present
- [ ] Documentation updated
- [ ] No unnecessary dependencies

## Questions?

Open a GitHub Discussion or issue. We're happy to help!

---

**Remember**: PhishNet's core value is **privacy**. Every contribution must preserve that.