# PhishNet 🎣🛡️

> **Privacy-first phishing email detector** — Runs entirely in your browser using on-device AI. No data ever leaves your machine.

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![Transformers.js](https://img.shields.io/badge/ML-Transformers.js-orange)](https://huggingface.co/docs/transformers.js)
[![ONNX](https://img.shields.io/badge/Format-ONNX%20Quantized-blue)](https://onnx.ai/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🎯 The Problem
Phishing emails cause **$2.9B+ in annual losses** (FBI IC3 2023). Existing solutions:
- ☁️ **Cloud APIs** — Send your private emails to external servers
- 📋 **Static blocklists** — Easily bypassed by new attacks
- 🔒 **Enterprise-only** — Expensive, not for individuals

## 💡 The Solution
**PhishNet** runs a quantized DistilBERT model **entirely in your browser** via Transformers.js + ONNX Runtime Web:

```
┌─────────────────────────────────────────────────────────────┐
│  Your Browser                                               │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │ Gmail/      │───▶│ Transformers.js  │───▶│ 🛡️ Safe    │ │
│  │ Outlook     │    │ + DistilBERT     │    │ ⚠️ Phishing│ │
│  │ (Content)   │    │ (Offscreen)      │    │ ❓ Uncertain│ │
│  └─────────────┘    └──────────────────┘    └────────────┘ │
│         │                   │                    │           │
│         ▼                   ▼                    ▼           │
│  Zero network requests  ~50MB model cached   Inline badges  │
│  Ever made              in IndexedDB         + highlights   │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features
- 🔒 **100% Private** — No email content leaves your browser
- ⚡ **Instant** — ~200ms inference after model loads
- 🌐 **Works on Gmail & Outlook** (web versions)
- 🎯 **Smart Detection** — Analyzes text, links, sender, urgency signals
- 🔗 **Link Highlighting** — Flags suspicious URLs inline
- ⚙️ **Customizable** — Sensitivity threshold, auto-scan toggle
- 📦 **Lightweight** — ~5MB extension, ~50MB model (cached)
- 🌙 **Offline-Ready** — Works without internet after first load

## 🚀 Quick Start

### Installation (Developer Mode)
1. Clone this repo:
   ```bash
   git clone https://github.com/yourusername/phishnet.git
   cd phishnet
   ```
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → Select the `phishnet` folder
5. Pin the extension to toolbar

### First Use
1. Open **Gmail** (`mail.google.com`) or **Outlook** (`outlook.live.com`)
2. Open any email
3. Wait for model to download (~50MB, one-time)
4. See badge appear: 🛡️ Safe / ⚠️ Phishing / ❓ Uncertain
5. Hover badge for confidence & reasons
6. Suspicious links highlighted with red wavy underline

## 🏗️ Architecture

```
phishnet/
├── manifest.json              # MV3 configuration
├── src/
│   ├── background.js          # Service worker (message routing)
│   ├── content.js             # DOM extraction (Gmail/Outlook)
│   ├── offscreen.js           # Model loading + inference
│   ├── worker.js              # WebWorker for non-blocking infer
│   ├── popup.html/js          # Extension popup UI
│   ├── selectors.js           # Provider-specific CSS selectors
│   └── styles.css             # Injected badge/link styles
├── public/
│   ├── offscreen.html         # Offscreen document container
│   └── icons/                 # Extension icons (16-128px)
└── doc/                       # Documentation (not tracked)
    ├── DESIGN.md
    ├── IMPLEMENTATION_PLAN.md
    ├── API_REFERENCE.md
    └── DEPLOYMENT.md
```

### Data Flow
```
Email Opened
     │
     ▼
Content Script (MutationObserver)
     │
     ▼
Extract: sender, subject, body, links
     │
     ▼
chrome.runtime.sendMessage → Background
     │
     ▼
Offscreen Document (transformers.js)
     │
     ▼
DistilBERT Inference (WebWorker)
     │
     ▼
{label, confidence, reasons}
     │
     ▼
Content Script → Inject Badge + Highlight Links
```

## 🤖 Model Details
- **Model**: `onnx-community/phishing-email-detection-distilbert_v2.4.1-ONNX`
- **Base**: `cybersectony/phishing-email-detection-distilbert_v2.4.1` (DistilBERT)
- **Task**: Multilabel classification (4 classes)
- **Format**: ONNX quantized (int8) via Transformers.js
- **Size**: ~50MB (cached in IndexedDB)
- **Classes**:
  - `legitimate_email` — Safe email content
  - `phishing_email` — Phishing email content
  - `legitimate_url` — Safe URL
  - `phishing_url` — Phishing URL
- **Accuracy**: 99.58% (reported by model author)
- **Inference**: ~100-200ms on modern CPU

## 🔒 Privacy Guarantees
| Aspect | Guarantee |
|--------|-----------|
| Email content | Never leaves browser |
| Network requests | Zero for inference |
| Model download | One-time from jsDelivr CDN |
| Storage | Local IndexedDB only |
| Analytics | None |
| Tracking | None |
| Open source | Fully auditable |

## ⚙️ Configuration
Click extension icon → Settings:
- **Auto-scan** — Automatically scan emails when opened (default: on)
- **Sensitivity** — Confidence threshold (default: 0.7)
- **Highlight links** — Underline suspicious URLs (default: on)
- **Show tooltips** — Hover for details (default: on)

Settings stored in `chrome.storage.sync` (synced across your devices).

## 🧪 Testing
```bash
# Manual testing checklist
1. Fresh Chrome profile → Load extension
2. Gmail: phishing test email → Red badge
3. Gmail: legitimate email → Green badge
4. Outlook.com: same tests
5. Settings persist after reload
6. No console errors
```

## 📦 Building for Distribution
```bash
# Create store-ready zip
zip -r phishnet-v1.0.0.zip \
  manifest.json src/ public/ \
  -x "*.git*" "node_modules/*" "doc/*" "*.md" ".gitignore"
```

## 🗺️ Roadmap
- [ ] Firefox support (Manifest V3 + polyfills)
- [ ] Yahoo Mail / Proton Mail support
- [ ] Custom model upload
- [ ] Phishing reporting to community DB (opt-in)
- [ ] Mobile Kiwi Browser support

## 🤝 Contributing
1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License
MIT License — See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments
- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face
- [Phishing Email Detection Model](https://huggingface.co/cybersectony/phishing-email-detection-distilbert_v2.4.1) by cybersectony
- [ONNX Runtime Web](https://onnxruntime.ai/) by Microsoft
- Inspired by [Inbox Triage Extension](https://github.com/mitchellfyi/inbox-triage-extension)

## 📞 Support
- **Issues**: [GitHub Issues](https://github.com/yourusername/phishnet/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/phishnet/discussions)
- **Email**: your.email@example.com

---

**Built for Pixel Forge AI Hackathon 2026** 🏆

*Protect your inbox. Own your data.*