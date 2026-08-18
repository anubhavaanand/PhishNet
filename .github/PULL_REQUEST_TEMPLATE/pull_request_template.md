## Pull Request Template

### Description
<!-- Clear summary of changes -->

### Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactor (no functional change)
- [ ] Test addition

### Related Issue
<!-- Link to issue: Fixes #123 -->

### Privacy Checklist (Required)
- [ ] No new network requests for email content
- [ ] No new external data storage
- [ ] No new permissions without justification
- [ ] User can disable/opt-out if applicable
- [ ] Works offline after model load
- [ ] Updated PRIVACY_POLICY.md if needed

### Testing Checklist
- [ ] Tested on Gmail (mail.google.com)
- [ ] Tested on Outlook.com (outlook.live.com)
- [ ] Tested on Outlook Office 365 (outlook.office.com)
- [ ] Fresh Chrome profile, load unpacked
- [ ] Model loads on first install
- [ ] Settings persist after reload
- [ ] No console errors
- [ ] Popup opens, shows status, settings work
- [ ] Dark mode works (OS setting)
- [ ] Reduced motion works (OS setting)

### CSP Compliance
- [ ] No inline scripts added
- [ ] No `eval()` or `new Function()` 
- [ ] No new CDN domains without manifest update
- [ ] `wasm-unsafe-eval` only for ONNX (unchanged)

### Documentation
- [ ] Updated README.md if user-facing change
- [ ] Updated DESIGN.md if architecture change
- [ ] Updated API_REFERENCE.md if interfaces change
- [ ] JSDoc comments for new public functions
- [ ] CHANGELOG.md entry added

### Screenshots/Videos (if UI change)
<!-- Drag and drop or link -->

### Performance Impact
- [ ] Inference time < 200ms
- [ ] Memory < 100MB
- [ ] Extension size < 5MB zipped
- [ ] No memory leaks (verified in DevTools)

### Reviewer Notes
<!-- Any specific areas to focus on, known limitations, etc. -->