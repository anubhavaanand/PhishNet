# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting a Vulnerability

**Please do NOT open public issues for security vulnerabilities.**

Instead, email **security@phishnet.example.com** (or contact maintainers via GitHub private message) with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will:
- Acknowledge within 48 hours
- Provide status updates every 5 business days
- Credit you in the fix (unless you prefer anonymity)

## Security Model

### Threat Model
PhishNet protects users from phishing emails. We assume:
- **Attacker**: Controls email content, sender spoofing, malicious links
- **User**: Opens emails in Gmail/Outlook web
- **Extension**: Runs in user's browser with site access to mail.google.com, outlook.live.com

### Trust Boundaries
```
┌─────────────────────────────────────────────────────────────┐
│  User's Browser (Trusted)                                   │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Content Script  │  │ Offscreen Document              │  │
│  │ (Isolated World)│  │ (Transformers.js + Model)       │  │
│  │ - DOM extract   │◀─│ - Local inference only          │  │
│  │ - UI inject     │  │ - No network requests           │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│         │                       │                            │
│         ▼                       ▼                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Background Service Worker (Message Router)          │    │
│  │ - No inference, no email content                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Security
| Component | Email Content Access | Network Access |
|-----------|---------------------|----------------|
| Content Script | ✅ Read-only (DOM) | ❌ None |
| Offscreen Document | ✅ Via message | ❌ None (inference) |
| Background SW | ❌ Never | ❌ None |
| Popup | ❌ Never | ❌ None |
| Model Download | ❌ N/A | ✅ One-time (jsDelivr CDN) |

### Privacy Guarantees
- **Zero email content** leaves the browser
- **Zero analytics/telemetry**
- **Model cached locally** in IndexedDB
- **Settings only** in `chrome.storage.sync`

## Known Security Considerations

### CSP Configuration
```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; object-src 'self'; worker-src 'self' blob:"
}
```
- `'wasm-unsafe-eval'` required for ONNX Runtime WebAssembly
- CDN allowlisted for Transformers.js library only
- No inline scripts, no eval() in our code

### Permissions Justification
| Permission | Justification |
|------------|---------------|
| `activeTab` | Scan currently opened email |
| `scripting` | Inject content script for DOM access |
| `storage` | User preferences (synced) |
| `offscreen` | Run ML inference (WASM needs document) |
| `host_permissions` | Access Gmail/Outlook DOM |

### Model Supply Chain
- Model: `onnx-community/phishing-email-detection-distilbert_v2.4.1-ONNX`
- Source: Hugging Face Hub → jsDelivr CDN
- Verification: Transformers.js validates model integrity
- Alternative: Self-host model (see DEPLOYMENT.md)

## Security Best Practices for Contributors

1. **Never** add external requests in content/offscreen scripts
2. **Never** log email content (even in errors)
3. **Always** sanitize DOM input before injection
4. **Always** use `chrome.runtime.sendMessage` for cross-context communication
5. **Test** CSP compliance: `chrome://extensions/` → Details → Errors

## Dependency Security

### Runtime Dependencies (CDN)
- `@huggingface/transformers@3.0.0` — jsDelivr CDN
- ONNX Runtime Web — bundled with transformers.js

### Dev Dependencies (Not Shipped)
- `cairosvg` / `Pillow` — icon generation only

Run `npm audit` on dev dependencies periodically.

## Incident Response

If a vulnerability is discovered in production:
1. **Contain**: Disable affected feature via remote config if possible
2. **Assess**: Determine scope and impact
3. **Fix**: Develop and test patch
4. **Release**: Emergency Chrome Web Store update
5. **Disclose**: Publish advisory after fix deployed

## Security Audit Checklist (Per Release)

- [ ] No new host permissions added
- [ ] CSP unchanged or tightened
- [ ] No inline scripts added
- [ ] No email content in logs/storage
- [ ] Model integrity verified
- [ ] Settings schema unchanged
- [ ] Offscreen document reasons minimal
- [ ] Content script matches unchanged

## Contact

Security concerns: **security@phishnet.example.com**
General issues: GitHub Issues