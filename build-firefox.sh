#!/usr/bin/env bash
# Build a Firefox-ready package of PhishNet into dist-firefox/ (+ .zip).
# Firefox MV3 differences handled here:
#   - event-page background script instead of service worker
#   - "offscreen" permission removed (unsupported -> install error)
#   - gecko browser_specific_settings added
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist-firefox
mkdir -p dist-firefox

cp -r src public vendor LICENSE PRIVACY_POLICY.md README.md dist-firefox/
rm -f dist-firefox/src/background.js   # Chrome SW variant not used on Gecko

python3 - <<'PY'
import json, os, zipfile

m = json.load(open('manifest.json'))

# Event page instead of service worker (Firefox ignores `scripts` key in Chrome)
m['background'] = { 'scripts': ['src/background-firefox.js'] }

# 'offscreen' is not a known permission in Gecko and blocks installation
m['permissions'] = [p for p in m['permissions'] if p != 'offscreen']

# Required for temporary/permanent installs on AMO
m['browser_specific_settings'] = {
    'gecko': {
        'id': 'phishnet@anubhavaanand.dev',
        'strict_min_version': '121.0'
    }
}

# Keep CSP; Firefox 102+ supports 'wasm-unsafe-eval' which ORT needs.
json.dump(m, open('dist-firefox/manifest.json', 'w'), indent=2)
print('manifest.firefox written')

os.chdir('dist-firefox')
with zipfile.ZipFile('../phishnet-v1.0.0-firefox.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk('.'):
        for f in files:
            z.write(os.path.join(root, f))
print('zip written:', len(z.namelist()), 'files')
PY

echo "✅ dist-firefox/ + phishnet-v1.0.0-firefox.zip built"
