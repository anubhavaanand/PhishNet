# PhishNet 🎣🛡️

> **Privacy-First AI Phishing Email Detector** — Runs entirely on-device in your browser. Zero email content or metadata ever leaves your machine.

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![Transformers.js](https://img.shields.io/badge/ML-Transformers.js-orange)](https://huggingface.co/docs/transformers.js)
[![ONNX](https://img.shields.io/badge/Format-ONNX%20Quantized-blue)](https://onnx.ai/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 Why PhishNet?
Phishing emails account for billions in losses annually. Traditional anti-phishing tools either:
- ☁️ **Compromise Privacy**: Transmit your sensitive emails to remote third-party cloud APIs.
- 📋 **Rely on Static Lists**: Easily outpaced by novel phishing domains and homograph attacks.
- 🔒 **Target Enterprises Only**: Expensive, complex solutions inaccessible to individual users.

**PhishNet brings enterprise-grade AI threat detection directly to your browser.**

---

## ✨ Features
- 🔒 **100% On-Device Privacy**: No email content, sender data, or link metadata is ever transmitted over the network.
- ⚡ **Instant Inference**: Real-time evaluation using client-side AI + local heuristics.
- 🌐 **Gmail & Outlook Compatible**: Seamlessly supports web Gmail, Outlook.com, and Office 365.
- 🔍 **Interactive Threat Inspector**: Click any badge to view confidence meters, link integrity analysis, and actionable safety steps.
- 🔗 **Smart Link Flagging**: Highlights suspicious, shortener, and deceptive URLs inline.
- 📎 **Attachment Risk Analyzer**: Flags weaponized scripts, executables, and deceptive double extensions.
- 📊 **Local Scan Dashboard**: Track protection stats and recent scans stored purely in local browser storage.
- ⭐ **Trusted Senders Whitelist**: One-click trust for verified colleagues and newsletters.
- 📱 **Multi-Device & Mobile Ready**: Compatible with desktop Chrome/Edge/Brave and mobile Chromium browsers (Kiwi Browser, Orion for iOS).
- 🌙 **Modern Cyber Dark UI**: Clean, high-contrast visual indicators and responsive overlays.

---

## 🚀 Quick Start (Developer Mode)

### 1. Installation
1. Clone or download this repository:
   ```bash
   git clone https://github.com/anubhavaanand/PhishNet.git
   cd PhishNet
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Toggle on **Developer mode** in the top right.
4. Click **Load unpacked** and select the `PhishNet` root folder.
5. Pin **PhishNet** to your extension toolbar.

### 2. Usage
1. Open [Gmail](https://mail.google.com) or [Outlook](https://outlook.live.com).
2. Open any email.
3. PhishNet automatically evaluates the email and displays an inline badge:
   - 🛡️ **Safe** — Verified authentic patterns
   - ⚠️ **Phishing** — Potential threat detected
   - ❓ **Uncertain** — Low confidence / manual review advised
   - ⭐ **Trusted** — Sender on your personal whitelist
4. Click the badge or extension popup anytime to inspect details.

---

## 🔒 Privacy & Security Commitments

| Metric | Guarantee |
|---|---|
| **Email Privacy** | 100% processed locally on-device. Zero telemetry. |
| **Inference Egress** | Zero bytes uploaded to external APIs during scanning. |
| **Model Storage** | Cached on-device in browser IndexedDB. |
| **Permissions** | Strictly scoped to email web tabs and isolated offscreen computing. |

---

## 🧪 Testing & Validation

PhishNet includes a built-in interactive playground:
- Open `public/test-emails.html` in your browser to test live email samples in real-time.

To run automated unit tests:
```bash
node tests/unit.test.js
```

---

## 📄 License
Released under the [MIT License](LICENSE).