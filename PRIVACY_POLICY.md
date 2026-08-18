# PhishNet Privacy Policy

**Last Updated**: 2026-08-18

## Overview
PhishNet is a privacy-first browser extension that detects phishing emails using on-device machine learning. This policy explains what data we collect, how we use it, and your rights.

## Data Collection
**PhishNet collects ZERO personal data.**

- No email content is ever transmitted, stored, or analyzed externally
- No sender information, subject lines, or email bodies leave your browser
- No browsing history, cookies, or tracking identifiers are collected
- No analytics, telemetry, or usage statistics are gathered

## Local Processing
All phishing detection runs entirely on your device:

1. **Model**: A quantized DistilBERT model (~50MB) runs via Transformers.js and ONNX Runtime Web
2. **Inference**: Happens in an isolated offscreen document within Chrome's sandbox
3. **Storage**: Model weights cached in IndexedDB (browser-managed, user-clearable)
4. **Output**: Only classification results (Safe/Phishing/Uncertain) shown in UI

## Model Download
On first use, the extension downloads the ONNX model from Hugging Face via jsDelivr CDN:
- **Source**: `https://cdn.jsdelivr.net/npm/@huggingface/transformers/*`
- **Size**: ~50MB (one-time download)
- **Caching**: Stored locally via browser cache and IndexedDB
- **Offline**: Works completely offline after initial download

## Permissions Used
| Permission | Purpose |
|------------|---------|
| `activeTab` | Access current email tab for scanning |
| `scripting` | Inject content script for DOM extraction |
| `storage` | Save user preferences (synced across your devices) |
| `offscreen` | Run ML inference in background context |
| `host_permissions` | Access Gmail/Outlook DOM for email extraction |

## Third Parties
- **Hugging Face / jsDelivr CDN**: Hosts the Transformers.js library and model files
- **No analytics providers** (Google Analytics, Mixpanel, etc.)
- **No advertising networks**
- **No crash reporting services**

## Data Retention
- **Model cache**: Managed by browser (clearable via Chrome settings → Clear browsing data)
- **User preferences**: Stored in `chrome.storage.sync` (synced to your Google account, deletable)
- **No server-side storage** whatsoever

## Your Rights
- **Access**: All code is open source — inspect at https://github.com/yourusername/phishnet
- **Deletion**: Uninstall extension → all local data removed
- **Portability**: Export settings via Chrome's extension management
- **Opt-out**: Disable auto-scan or uninstall anytime

## Children's Privacy
PhishNet does not knowingly collect data from children under 13. No data is collected from any user.

## Changes to This Policy
Updates will be posted to the GitHub repository. Continued use after changes constitutes acceptance.

## Contact
- **GitHub Issues**: https://github.com/yourusername/phishnet/issues
- **Email**: your.email@example.com

## Compliance
- **GDPR**: No personal data processed → no GDPR obligations
- **CCPA**: No sale of personal information → no CCPA obligations
- **Chrome Web Store**: Compliant with Developer Program Policies