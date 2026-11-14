/**
 * Package integrity tests.
 *
 * These guard the invariants that make the built artifact loadable at all —
 * the class of bug where the manifest points at a file that was never built.
 * Run `npm test` (which builds first) so dist/ is populated.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));

const REQUIRED_FIELDS = [
  'manifest_version',
  'name',
  'version',
  'description',
  'icons',
  'action',
  'background',
  'content_scripts',
  'permissions',
  'host_permissions',
  'content_security_policy',
];

describe('manifest', () => {
  test('is manifest version 3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  test('declares every required field', () => {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in manifest, `manifest is missing "${field}"`);
    }
  });

  test('version matches package.json', () => {
    assert.equal(manifest.version, pkg.version, 'manifest and package.json versions must agree');
  });

  test('every manifest-referenced file exists', () => {
    const refs = [
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon || {}),
      manifest.action.default_popup,
      manifest.background.service_worker,
      ...manifest.content_scripts.flatMap((cs) => [...cs.js, ...(cs.css || [])]),
    ].filter(Boolean);

    const missing = refs.filter((p) => !exists(p));
    assert.deepEqual(missing, [], `missing files: ${missing.join(', ')}`);
  });

  test('popup and options pages are built into dist/', () => {
    assert.equal(manifest.action.default_popup, 'dist/popup.html');
    assert.ok(exists('dist/popup.html'), 'run `npm run build` before `npm test`');
    assert.ok(exists('dist/options.html'), 'run `npm run build` before `npm test`');
  });

  test('built HTML references only files that exist', () => {
    for (const page of ['dist/popup.html', 'dist/options.html']) {
      if (!exists(page)) continue;
      const html = read(page);
      const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
      assert.ok(refs.length > 0, `${page} references no assets`);
      for (const ref of refs) {
        const target = path.join('dist', ref.replace(/^\.\//, ''));
        assert.ok(exists(target), `${page} references missing ${ref}`);
      }
    }
  });

  test('declares only the API permissions the worker actually uses', () => {
    for (const perm of ['storage', 'offscreen']) {
      assert.ok(manifest.permissions.includes(perm), `missing permission: ${perm}`);
    }
    for (const perm of ['activeTab', 'scripting']) {
      assert.ok(!manifest.permissions.includes(perm), `unused permission: ${perm}`);
    }
  });

  test('registers content scripts for Gmail and Outlook', () => {
    const matches = manifest.content_scripts.flatMap((cs) => cs.matches).join(' ');
    assert.match(matches, /mail\.google\.com/);
    assert.match(matches, /outlook\.live\.com/);
    assert.match(matches, /outlook\.office\.com/);
  });
});

describe('content security policy', () => {
  const csp = manifest.content_security_policy.extension_pages;
  const S = (s) => `'${s}'`;
  const ALLOWED = {
    'script-src': [S('self'), S('wasm-unsafe-eval'), S('wasm-eval'), S('none'), S('inline-speculation-rules')],
    'object-src': [S('self'), S('none')],
    'worker-src': [S('self'), S('none')],
  };

  test('allows wasm but no remote script sources', () => {
    for (const directive of csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d.length)) {
      const [name, ...values] = directive;
      assert.ok(name in ALLOWED, `unknown CSP directive: ${name}`);
      for (const value of values) {
        assert.ok(!/^https?:\/\//.test(value), `remote URL in ${name}: ${value}`);
        assert.ok(ALLOWED[name].includes(value), `disallowed value ${value} in ${name}`);
      }
    }
  });

  test('permits wasm-unsafe-eval for the ONNX runtime', () => {
    assert.ok(csp.includes("'wasm-unsafe-eval'"));
  });
});

describe('production source hygiene', () => {
  const SRC_FILES = [
    'src/background.js',
    'src/offscreen.js',
    'src/content.js',
    'src/popup.js',
    'src/selectors.js',
    'src/utils/logger.js',
    'src/utils/error-boundary.js',
    'src/utils/heuristic-detector.js',
  ].filter(exists);

  test('contains no eval or new Function', () => {
    for (const file of SRC_FILES) {
      const src = read(file);
      assert.ok(!/\beval\s*\(/.test(src), `${file} uses eval()`);
      assert.ok(!/new\s+Function\s*\(/.test(src), `${file} uses new Function()`);
    }
  });

  test('contains no unguarded console.log', () => {
    for (const file of SRC_FILES) {
      const src = read(file);
      // logger.js is the logging facade; its console calls are IS_DEBUG-gated.
      const offenders = src
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /console\.log\s*\(/.test(line) && !/IS_DEBUG/.test(line));
      assert.deepEqual(
        offenders.map((o) => `line ${o.n}`),
        [],
        `${file} has console.log`
      );
    }
  });

  test('no source file uses innerHTML with interpolated data', () => {
    for (const file of SRC_FILES) {
      const src = read(file);
      assert.ok(!/\.innerHTML\s*=/.test(src), `${file} assigns innerHTML`);
    }
  });
});

describe('marketing site security', () => {
  const site = read('docs/index.html');

  test('mock phishing links use a listener rather than an inline handler', () => {
    assert.doesNotMatch(site, /\sonclick\s*=/i);
    assert.match(site, /data-preview-link="inert"/);
    assert.match(site, /querySelector\('\[data-preview-link="inert"\]'\)\?\.addEventListener\('click',\s*\(event\)\s*=>\s*event\.preventDefault\(\)\)/);
  });

  test('preview diagnostics are opt-in and do not publish a frame counter', () => {
    assert.match(site, /const demoDebug = new URLSearchParams/);
    assert.match(site, /if \(demoDebug\) console\.warn\(/);
    assert.doesNotMatch(site, /window\.__pnRenders/);
  });
});

describe('history privacy reset', () => {
  test('Firefox clears extension-local data, matching the Chrome worker', () => {
    const firefox = read('src/background-firefox.js');
    assert.match(firefox, /case 'CLEAR_HISTORY':\s*await browser\.storage\.local\.clear\(\)/);
  });
});

describe('test-email playground DOM safety', () => {
  test('clears test messages without assigning HTML strings', () => {
    const source = read('public/test-emails.html');
    assert.doesNotMatch(source, /\.innerHTML\s*=/);
    assert.match(source, /list\.replaceChildren\(\)/);
  });
});

describe('module syntax', () => {
  test('every ES module source parses', () => {
    const esm = ['src/background.js', 'src/offscreen.js', 'src/utils/logger.js'];
    for (const file of esm) {
      assert.doesNotThrow(
        () => execFileSync(process.execPath, ['--check', '--input-type', 'module'], {
          input: read(file),
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
        `${file} has a syntax error`
      );
    }
  });

  test('every classic script source parses', () => {
    const scripts = [
      'src/selectors.js',
      'src/utils/error-boundary.js',
      'src/utils/heuristic-detector.js',
      'src/content.js',
    ];
    for (const file of scripts) {
      assert.doesNotThrow(
        () => execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' }),
        `${file} has a syntax error`
      );
    }
  });
});

describe('required project files', () => {
  test('Firefox packaging excludes the email test playground', () => {
    const buildScript = read('build-firefox.sh');
    assert.match(buildScript, /rm -f dist-firefox\/public\/test-emails\.html/);
  });

  test('Dependabot does not silently exclude all major dependency updates', () => {
    const config = read('.github/dependabot.yml');
    assert.doesNotMatch(config, /dependency-name:\s*["']?\*["']?/);
  });

  test('ships the files the store listing and license require', () => {
    for (const file of ['LICENSE', 'README.md', 'PRIVACY_POLICY.md', 'CHANGELOG.md', 'CONTRIBUTING.md']) {
      assert.ok(exists(file), `missing ${file}`);
    }
  });

  test('ships icons at every declared size', () => {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    for (const size of [16, 32, 48, 128]) {
      const p = `public/icons/icon-${size}.png`;
      assert.ok(exists(p), `missing ${p}`);
      const bytes = fs.readFileSync(path.join(ROOT, p));
      assert.equal(bytes[0], 0x89, `${p} is not a PNG`);
      assert.equal(bytes.readUInt32BE(1), 0x504e470d, `${p} is not a PNG`);
    }
  });
});
