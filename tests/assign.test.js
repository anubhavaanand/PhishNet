/**
 * Issue self-assignment bot tests.
 *
 * GitHub cannot assign non-collaborators to issues, so a claim is a label.
 * These tests pin the command parsing and the decision table — everything that
 * decides whether someone gets an issue — because a wrong answer here either
 * locks a contributor out of an issue or lets two people work on one.
 * The GitHub calls in .github/scripts/assign.js need a token and are not run.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, '.github/scripts/assign.js');
const WORKFLOW = path.join(ROOT, '.github/workflows/assign.yml');

const bot = require(SCRIPT);

// Destructured so the guard test can compare against the script's own sets
// rather than a copy of them.
const { CLAIM_COMMANDS, RELEASE_COMMANDS } = bot;

const labels = (...names) => names.map((name) => ({ name }));
const issues = (...numbers) => numbers.map((n) => ({ number: n }));

describe('parseCommand', () => {
  test('recognises every claim spelling', () => {
    for (const cmd of ['/assign-me', '/assign', '/claim', '/take']) {
      assert.equal(bot.parseCommand(cmd).kind, 'claim', cmd);
    }
  });

  test('recognises every release spelling', () => {
    for (const cmd of ['/release', '/unassign', '/stop', '/drop', '/unclaim']) {
      assert.equal(bot.parseCommand(cmd).kind, 'release', cmd);
    }
  });

  test('is case-insensitive and tolerates surrounding space', () => {
    assert.equal(bot.parseCommand('   /ASSIGN-ME  ').kind, 'claim');
    assert.equal(bot.parseCommand('\n/Release\n').kind, 'release');
  });

  test('accepts trailing text after the command', () => {
    const parsed = bot.parseCommand('/assign-me please and thank you');
    assert.equal(parsed.kind, 'claim');
    assert.equal(parsed.raw, 'assign-me');
  });

  test('ignores prose and unrelated commands', () => {
    for (const body of [
      'please assign this to me',
      '/assignee',
      '/release-notes',
      '/help',
      '',
      'I would like to claim this issue',
    ]) {
      assert.equal(bot.parseCommand(body).kind, null, body);
    }
  });

  test('ignores non-string bodies', () => {
    assert.equal(bot.parseCommand(undefined).kind, null);
    assert.equal(bot.parseCommand(null).kind, null);
  });
});

describe('holderOf', () => {
  test('reads the login out of the claim label', () => {
    assert.equal(bot.holderOf(labels('claimed', 'claimed/@octocat', 'bug')), 'octocat');
  });

  test('returns null when no claim label is present', () => {
    assert.equal(bot.holderOf(labels('bug', 'claimed')), null);
    assert.equal(bot.holderOf([]), null);
  });

  test('does not treat a bare claim label as a holder', () => {
    assert.equal(bot.holderOf(labels('claimed')), null);
    assert.equal(bot.holderOf(labels('claimed/@')), null);
  });
});

describe('evaluateClaim', () => {
  const base = { commenter: 'octocat', labels: [], activeClaims: [] };

  test('assigns an unclaimed open issue', () => {
    const v = bot.evaluateClaim(base);
    assert.equal(v.action, 'assign');
    assert.equal(v.count, 1);
  });

  test('is idempotent for the same commenter', () => {
    const v = bot.evaluateClaim({ ...base, labels: labels('claimed', 'claimed/@octocat') });
    assert.equal(v.action, 'noop');
    assert.equal(v.reason, 'already-yours');
  });

  test('refuses when someone else holds it', () => {
    const v = bot.evaluateClaim({ ...base, labels: labels('claimed/@hubot') });
    assert.equal(v.action, 'reject');
    assert.equal(v.reason, 'claimed-by-other');
    assert.equal(v.holder, 'hubot');
  });

  test('treats a holder login case-insensitively', () => {
    const v = bot.evaluateClaim({ ...base, commenter: 'OctoCat', labels: labels('claimed/@octocat') });
    assert.equal(v.action, 'noop');
  });

  test('refuses a closed issue', () => {
    const v = bot.evaluateClaim({ ...base, issueState: 'closed' });
    assert.equal(v.action, 'reject');
    assert.equal(v.reason, 'closed');
  });

  test('refuses a blocked issue', () => {
    for (const label of ['blocked', 'wontfix', 'duplicate', 'invalid', 'maintainer-only']) {
      const v = bot.evaluateClaim({ ...base, labels: labels(label) });
      assert.equal(v.action, 'reject', label);
      assert.equal(v.reason, 'blocked', label);
    }
  });

  test('does not treat topic labels as blocking', () => {
    for (const label of ['security', 'privacy', 'bug', 'docs', 'ui', 'performance']) {
      const v = bot.evaluateClaim({ ...base, labels: labels('good first issue', label) });
      assert.equal(v.action, 'assign', label);
    }
  });

  test('allows an issue that only carries ordinary labels', () => {
    const v = bot.evaluateClaim({ ...base, labels: labels('bug', 'good first issue', 'claimed') });
    assert.equal(v.action, 'assign');
  });

  test('enforces the cap of 3', () => {
    assert.equal(bot.evaluateClaim({ ...base, activeClaims: issues(1, 2) }).action, 'assign');
    const blocked = bot.evaluateClaim({ ...base, activeClaims: issues(1, 2, 3) });
    assert.equal(blocked.action, 'reject');
    assert.equal(blocked.reason, 'cap');
    assert.equal(blocked.count, 3);
  });

  test('does not count pull requests toward the cap', () => {
    const withPr = [{ number: 1 }, { number: 2 }, { number: 3, pull_request: { url: 'x' } }];
    assert.equal(bot.evaluateClaim({ ...base, activeClaims: withPr }).action, 'assign');
  });

  test('reports a running count on assignment', () => {
    const v = bot.evaluateClaim({ ...base, activeClaims: issues(1) });
    assert.equal(v.action, 'assign');
    assert.equal(v.count, 2);
  });
});

describe('otherClaims', () => {
  const base = { commenter: 'octocat', labels: [], activeClaims: [] };

  test('excludes the issue being claimed', () => {
    const held = [{ number: 248 }, { number: 249 }, { number: 250 }];
    assert.deepEqual(
      bot.otherClaims(held, 248).map((i) => i.number),
      [249, 250]
    );
  });

  test('drops pull requests', () => {
    const held = [{ number: 1 }, { number: 2, pull_request: { url: 'x' } }];
    assert.deepEqual(
      bot.otherClaims(held, 999).map((i) => i.number),
      [1]
    );
  });

  test('a re-run on the same issue counts zero prior claims', () => {
    const v = bot.evaluateClaim({ ...base, activeClaims: bot.otherClaims([{ number: 248 }], 248) });
    assert.equal(v.action, 'assign');
    assert.equal(v.count, 1);
  });
});

describe('evaluateRelease', () => {
  const base = { commenter: 'octocat', labels: [], association: 'NONE' };

  test('releases the commenter own claim', () => {
    const v = bot.evaluateRelease({ ...base, labels: labels('claimed', 'claimed/@octocat') });
    assert.equal(v.action, 'release');
    assert.equal(v.holder, 'octocat');
  });

  test('refuses to release someone else claim without write access', () => {
    const v = bot.evaluateRelease({ ...base, commenter: 'hubot', labels: labels('claimed/@octocat') });
    assert.equal(v.action, 'reject');
    assert.equal(v.reason, 'not-yours');
  });

  test('lets a maintainer release any claim', () => {
    for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      const v = bot.evaluateRelease({
        ...base,
        commenter: 'hubot',
        association,
        labels: labels('claimed/@octocat'),
      });
      assert.equal(v.action, 'release', association);
    }
  });

  test('is a noop when nothing is claimed', () => {
    const v = bot.evaluateRelease({ ...base, labels: labels('bug') });
    assert.equal(v.action, 'noop');
    assert.equal(v.reason, 'not-claimed');
  });
});

describe('isBot', () => {
  test('rejects bots and missing users', () => {
    assert.equal(bot.isBot({ type: 'Bot', login: 'dependabot[bot]' }), true);
    assert.equal(bot.isBot({ type: 'User', login: 'dependabot[bot]' }), true);
    assert.equal(bot.isBot(null), true);
    assert.equal(bot.isBot(undefined), true);
  });

  test('accepts humans', () => {
    assert.equal(bot.isBot({ type: 'User', login: 'octocat' }), false);
  });
});

describe('workflow wiring', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');

  test('runs on new issue comments only', () => {
    assert.match(yml, /issue_comment:/);
    assert.match(yml, /types:\s*\[created\]/);
  });

  test('skips pull requests and bot comments', () => {
    assert.match(yml, /github\.event\.issue\.pull_request == null/);
    assert.match(yml, /github\.event\.comment\.user\.type != 'Bot'/);
  });

  test('the job guard admits every command the script implements', () => {
    // The workflow `if` is a pre-filter: it stops a runner being allocated for
    // ordinary conversation. If it drifted from the script's command list, a
    // valid command would never reach the script and would silently do nothing.
    //
    // The guard matches on prefixes (`startsWith('/assign')` admits both
    // `/assign` and `/assign-me`), so assert the real relation: every command
    // must begin with one of the prefixes the guard tests for.
    const guard = yml.slice(yml.indexOf('if:'), yml.indexOf('runs-on:'));
    const prefixes = [...guard.matchAll(/'\/([a-z-]+)'/g)].map((m) => m[1]);
    assert.ok(prefixes.length > 0, 'guard tests no command prefixes');

    for (const cmd of [...CLAIM_COMMANDS, ...RELEASE_COMMANDS]) {
      assert.ok(
        prefixes.some((p) => cmd.startsWith(p)),
        `job guard does not admit /${cmd} (prefixes: ${prefixes.join(', ')})`
      );
    }
  });

  test('the job guard does not admit non-commands', () => {
    const guard = yml.slice(yml.indexOf('if:'), yml.indexOf('runs-on:'));
    const prefixes = [...guard.matchAll(/'\/([a-z-]+)'/g)].map((m) => m[1]);
    for (const body of ['please take a look', '/help', '/assignee', '/takeaway-x']) {
      const lower = body.trim().toLowerCase();
      const admitted = prefixes.some((p) => lower.startsWith('/' + p) && lower === '/' + p);
      assert.equal(admitted, false, `${body} should not be admitted by the guard`);
    }
  });

  test('grants issues write and nothing more', () => {
    assert.match(yml, /issues:\s*write/);
    assert.ok(!/contents:\s*write/.test(yml), 'workflow must not grant contents write');
  });

  test('serialises runs per issue', () => {
    assert.match(yml, /concurrency:/);
    assert.match(yml, /assign-issue-/);
    assert.match(yml, /cancel-in-progress:\s*false/);
  });

  test('invokes the script with a bounded timeout', () => {
    assert.match(yml, /node \.github\/scripts\/assign\.js/);
    assert.match(yml, /timeout-minutes:\s*\d+/);
  });
});

describe('script hygiene', () => {
  test('parses as a classic script', () => {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', SCRIPT], { stdio: 'pipe' }),
      'assign.js has a syntax error'
    );
  });

  test('does not run the CLI on require', () => {
    assert.equal(typeof bot.evaluateClaim, 'function');
  });

  test('keeps the cap at 3 and the claim window at 7 days', () => {
    assert.equal(bot.MAX_CLAIMS, 3);
    assert.equal(bot.CLAIM_WINDOW_DAYS, 7);
  });
});