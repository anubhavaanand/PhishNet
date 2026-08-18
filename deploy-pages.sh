#!/bin/bash
# GitHub Pages Deployment Script for PhishNet
# Run this to deploy the project website

set -e

echo "🚀 Deploying PhishNet to GitHub Pages..."

# Check we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Run from PhishNet project root"
    exit 1
fi

# Create docs folder for GitHub Pages
echo "📁 Preparing docs/ folder..."
rm -rf docs
mkdir -p docs

# Copy static assets
cp -r public/* docs/
cp README.md docs/index.md

# Create index.html from template
cat > docs/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PhishNet - Privacy-First Phishing Detection</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; }
    .hero { background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 80px 20px; text-align: center; }
    .hero h1 { font-size: 48px; margin-bottom: 16px; }
    .hero p { font-size: 20px; opacity: 0.9; max-width: 600px; margin: 0 auto 32px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 9999px; font-size: 14px; margin: 0 8px; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    .section { margin-bottom: 60px; }
    .section h2 { font-size: 32px; margin-bottom: 24px; color: #111827; }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 40px; }
    .feature { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .feature h3 { font-size: 18px; margin-bottom: 12px; color: #0ea5e9; }
    .feature p { color: #6b7280; }
    .install { background: #1f2937; color: white; padding: 32px; border-radius: 12px; margin: 40px 0; }
    .install h3 { margin-bottom: 16px; }
    .install code { background: #374151; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
    .install ol { margin-left: 20px; margin-top: 16px; }
    .install li { margin-bottom: 8px; }
    .links { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 24px; }
    .btn { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #0284c7; }
    .btn-secondary { background: #374151; }
    .btn-secondary:hover { background: #4b5563; }
    .screenshot { background: #e5e7eb; border-radius: 8px; height: 300px; margin: 24px 0; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 18px; }
    footer { text-align: center; padding: 40px 20px; color: #9ca3af; border-top: 1px solid #e5e7eb; margin-top: 60px; }
    @media (max-width: 600px) {
      .hero h1 { font-size: 32px; }
      .hero p { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🎣 PhishNet</h1>
    <p>Privacy-first phishing email detector using on-device AI</p>
    <span class="badge">Chrome Extension (MV3)</span>
    <span class="badge">Transformers.js</span>
    <span class="badge">ONNX Runtime Web</span>
    <span class="badge">DistilBERT</span>
  </div>

  <div class="container">
    <div class="section">
      <h2>🛡️ Why PhishNet?</h2>
      <p style="font-size: 18px; color: #4b5563; margin-bottom: 24px; max-width: 700px; margin-left: auto; margin-right: auto;">
        Phishing emails cause <strong>$2.9B+ in annual losses</strong>. Existing solutions send your private emails to cloud servers or rely on easily-bypassed blocklists.
      </p>
      <p style="font-size: 18px; color: #4b5563; max-width: 700px; margin-left: auto; margin-right: auto;">
        PhishNet runs a quantized DistilBERT model <strong>entirely in your browser</strong> — zero network requests, zero data leaves your machine, works offline.
      </p>
    </div>

    <div class="section">
      <h2>✨ Features</h2>
      <div class="feature-grid">
        <div class="feature">
          <h3>🔒 100% Private</h3>
          <p>No email content ever leaves your browser. Model runs in isolated offscreen document.</p>
        </div>
        <div class="feature">
          <h3>⚡ Instant Detection</h3>
          <p>~200ms inference after model loads. Real-time badges on every email.</p>
        </div>
        <div class="feature">
          <h3>🌐 Gmail & Outlook</h3>
          <p>Works on mail.google.com, outlook.live.com, and outlook.office.com.</p>
        </div>
        <div class="feature">
          <h3>🔗 Link Analysis</h3>
          <p>Heuristic detection of suspicious URLs with visual highlighting.</p>
        </div>
        <div class="feature">
          <h3>⚙️ Customizable</h3>
          <p>Sensitivity threshold, auto-scan toggle, link highlighting.</p>
        </div>
        <div class="feature">
          <h3>🌙 Offline-Ready</h3>
          <p>Works without internet after ~50MB model cached in IndexedDB.</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📸 Screenshots</h2>
      <div class="screenshot">🛡️ Safe badge on legitimate GitHub email</div>
      <div class="screenshot">⚠️ Phishing badge with tooltip showing confidence & reasons</div>
      <div class="screenshot">🔗 Suspicious link highlighted with red wavy underline</div>
      <div class="screenshot">📱 Popup with model status & settings</div>
    </div>

    <div class="install section">
      <h3>🚀 Install in 3 Steps</h3>
      <ol>
        <li>Clone this repo: <code>git clone https://github.com/anubhavaanand/PhishNet.git</code></li>
        <li>Open Chrome → <code>chrome://extensions/</code> → Enable <strong>Developer mode</strong></li>
        <li>Click <strong>Load unpacked</strong> → Select the PhishNet folder</li>
      </ol>
      <p style="margin-top: 16px; opacity: 0.8;">On first use, the ~50MB model downloads automatically. Then it works offline!</p>
    </div>

    <div class="links section">
      <a href="https://github.com/anubhavaanand/PhishNet" class="btn" target="_blank">View on GitHub</a>
      <a href="https://github.com/anubhavaanand/PhishNet/releases" class="btn btn-secondary" target="_blank">Releases</a>
      <a href="https://github.com/anubhavaanand/PhishNet/issues" class="btn btn-secondary" target="_blank">Report Issue</a>
    </div>

    <div class="section">
      <h2>🏗️ Architecture</h2>
      <p style="margin-bottom: 16px;">PhishNet uses a privacy-first architecture with Chrome MV3:</p>
      <pre style="background: #1f2937; color: #e5e7eb; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.8;">
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                     │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ content.js       │  │ background.js (Service Worker) │  │
│  │ - DOM extraction │  │ - Model lifecycle              │  │
│  │ - UI injection   │◀─│ - Message routing              │  │
│  │ - Badge rendering│  │ - Settings persistence         │  │
│  └──────────────────┘  └────────────────────────────────┘  │
│         │                       │                            │
│         ▼                       ▼                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  offscreen.js (Offscreen Document)                     │ │
│  │  - Transformers.js + ONNX Runtime Web                  │ │
│  │  - DistilBERT (quantized, ~50MB)                       │ │
│  │  - Non-blocking inference                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
      </pre>
    </div>

    <div class="section">
      <h2>🔒 Privacy Guarantees</h2>
      <ul style="max-width: 700px; margin-left: 20px; line-height: 2;">
        <li>✅ Zero network requests for inference</li>
        <li>✅ Model cached locally in IndexedDB</li>
        <li>✅ No email content ever leaves browser</li>
        <li>✅ No analytics, tracking, or telemetry</li>
        <li>✅ Open source — fully auditable</li>
        <li>✅ Model downloads once from jsDelivr CDN</li>
      </ul>
    </div>

    <div class="links section">
      <a href="https://github.com/anubhavaanand/PhishNet/blob/main/PRIVACY_POLICY.md" class="btn btn-secondary" target="_blank">Read Privacy Policy</a>
    </div>
  </div>

  <footer>
    <p><strong>PhishNet</strong> — Built for Pixel Forge AI Hackathon 2026</p>
    <p style="margin-top: 8px;">MIT License • Open Source • Privacy-First</p>
    <p style="margin-top: 16px; font-size: 14px;">
      <a href="https://github.com/anubhavaanand/PhishNet" style="color: #0ea5e9;">GitHub</a> •
      <a href="https://github.com/anubhavaanand/PhishNet/issues" style="color: #0ea5e9;">Issues</a> •
      <a href="https://github.com/anubhavaanand/PhishNet/blob/main/PRIVACY_POLICY.md" style="color: #0ea5e9;">Privacy Policy</a>
    </p>
  </footer>
</body>
</html>
EOF

echo "✅ GitHub Pages site generated in docs/"
echo ""
echo "To deploy:"
echo "  1. git add docs/"
echo "  2. git commit -m 'docs: deploy GitHub Pages site'"
echo "  3. git push origin main"
echo "  4. Enable GitHub Pages in repo settings (source: main branch, /docs folder)"
echo ""
echo "🌐 Site will be available at: https://anubhavaanand.github.io/PhishNet/"