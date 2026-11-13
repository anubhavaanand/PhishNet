/**
 * Issue self-assignment bot.
 *
 * GitHub has never allowed non-collaborators to be assigned to issues
 * (isaacs/github#100, open since 2013), and `gh issue edit
 * --add-assignee` silently ignores everyone outside the collaborator list.
 * So the claim is modelled as a label the commenter applies to themselves:
 *
 *   claimed              marks the issue as taken
 *   claimed/@<user>      names the holder, so the cap is one label query
 *
 * Commands, as the first token of an issue comment:
 *   /assign-me | /assign | /claim | /take   claim the issue
 *   /release | /unassign | /stop | /drop    give it back
 *
 * The decision table is pure and unit-tested in tests/assign.test.js; the
 * network half lives below `main` and is not exercised by `npm test`.
 */
'use strict';

const MAX_CLAIMS = 3;
const CLAIM_WINDOW_DAYS = 7;

const CLAIM_COMMANDS = new Set(['assign-me', 'assign', 'claim', 'take']);
const RELEASE_COMMANDS = new Set(['release', 'unassign', 'stop', 'drop', 'unclaim']);

// Labels that make an issue unavailable for self-assignment regardless of who
// asks. Deliberately narrow: this repo also uses `security`, `privacy`, `bug`
// and friends as topic labels, so none of those may appear here.
const BLOCKING_LABELS = new Set([
  'blocked',
  'wontfix',
  'duplicate',
  'invalid',
  'maintainer-only',
]);

const WRITE_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const claimLabel = (login) => `claimed/@${login}`;

function parseCommand(body) {
  if (typeof body !== 'string') return { kind: null };
  const match = body.trim().match(/^(\/[a-z-]+)(?:\s+|$)/i);
  if (!match) return { kind: null };
  const raw = match[1].slice(1).toLowerCase();
  if (CLAIM_COMMANDS.has(raw)) return { kind: 'claim', raw };
  if (RELEASE_COMMANDS.has(raw)) return { kind: 'release', raw };
  return { kind: null };
}

function holderOf(labels) {
  const names = labels.map((l) => (typeof l === 'string' ? l : l && l.name) || '');
  for (const name of names) {
    if (!name.startsWith('claimed/@')) continue;
    const login = name.slice('claimed/@'.length);
    if (login) return login;
  }
  return null;
}

function claimCountIssue(issues) {
  return issues.filter((i) => !i.pull_request).length;
}

/**
 * Issues held by the commenter other than the one being claimed.
 * The label may already be on the issue when the bot runs (a second
 * /assign-me, or a slow event), and counting it would inflate the cap.
 */
function otherClaims(issues, number) {
  return issues.filter((i) => !i.pull_request && i.number !== number);
}

/**
 * Decide what a `/assign-me` should do. Pure: no clock, no network.
 *
 * @param {object}   input
 * @param {string[]} input.labels            label names currently on the issue
 * @param {string}   input.commenter         login issuing the command
 * @param {object[]} [input.activeClaims]    issues the commenter already holds
 * @param {string}   [input.issueState]      'open' | 'closed'
 * @returns {{action: 'assign'|'reject'|'noop', reason: string, holder?: string|null}}
 */
function evaluateClaim({ labels, commenter, activeClaims = [], issueState = 'open' }) {
  const names = labels.map((l) => (typeof l === 'string' ? l : l && l.name) || '');
  const holder = holderOf(names);

  if (issueState === 'closed') {
    return { action: 'reject', reason: 'closed' };
  }
  if (holder && holder.toLowerCase() === commenter.toLowerCase()) {
    return { action: 'noop', reason: 'already-yours', holder };
  }
  if (holder) {
    return { action: 'reject', reason: 'claimed-by-other', holder };
  }
  const blocking = names.find((n) => BLOCKING_LABELS.has(n));
  if (blocking) {
    return { action: 'reject', reason: 'blocked', holder: null, blocking };
  }
  const mine = activeClaims.filter((n) => !n.pull_request);
  if (mine.length >= MAX_CLAIMS) {
    return { action: 'reject', reason: 'cap', holder: null, count: mine.length };
  }
  return { action: 'assign', reason: 'ok', holder: null, count: mine.length + 1 };
}

/**
 * Decide what `/release` should do.
 * @param {object} input
 * @param {string[]} input.labels
 * @param {string}   input.commenter
 * @param {string}   input.association  author_association of the commenter
 */
function evaluateRelease({ labels, commenter, association = 'NONE' }) {
  const holder = holderOf(labels);
  if (!holder) return { action: 'noop', reason: 'not-claimed', holder: null };
  const isHolder = holder.toLowerCase() === commenter.toLowerCase();
  if (!isHolder && !WRITE_ASSOCIATIONS.has(association)) {
    return { action: 'reject', reason: 'not-yours', holder };
  }
  return { action: 'release', reason: 'ok', holder };
}

function isBot(user) {
  if (!user) return true;
  if (user.type === 'Bot') return true;
  return typeof user.login === 'string' && user.login.endsWith('[bot]');
}

module.exports = {
  MAX_CLAIMS,
  CLAIM_WINDOW_DAYS,
  CLAIM_COMMANDS,
  RELEASE_COMMANDS,
  BLOCKING_LABELS,
  WRITE_ASSOCIATIONS,
  claimLabel,
  parseCommand,
  holderOf,
  claimCountIssue,
  otherClaims,
  evaluateClaim,
  evaluateRelease,
  isBot,
};

/* ------------------------------------------------------------------ *
 * GitHub I/O — only reached when the file is run as a workflow step.
 * ------------------------------------------------------------------ */

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !eventPath || !repo) {
    throw new Error('GITHUB_TOKEN, GITHUB_EVENT_PATH and GITHUB_REPOSITORY are required');
  }

  const event = JSON.parse(require('node:fs').readFileSync(eventPath, 'utf8'));
  if (event.action && event.action !== 'created') {
    console.log(`ignoring action=${event.action}`);
    return;
  }

  const issue = event.issue;
  const comment = event.comment;
  if (!issue || !comment) {
    console.log('not an issue comment event');
    return;
  }
  if (issue.pull_request) {
    console.log('issue is a pull request; nothing to claim');
    return;
  }
  if (isBot(comment.user)) {
    console.log('ignoring bot comment');
    return;
  }

  const cmd = parseCommand(comment.body);
  if (!cmd.kind) return;

  const commenter = comment.user.login;
  const association = comment.author_association || 'NONE';
  const number = issue.number;

  if (cmd.kind === 'claim') {
    await handleClaim({ repo, token, issue, commenter, number });
  } else {
    await handleRelease({ repo, token, issue, commenter, association, number });
  }
}

async function handleClaim({ repo, token, issue, commenter, number }) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  const held = await listOpenIssues(repo, token, claimLabel(commenter));
  const activeClaims = otherClaims(held, number);

  const verdict = evaluateClaim({
    labels,
    commenter,
    activeClaims,
    issueState: issue.state,
  });

  if (verdict.action === 'assign') {
    await ensureLabel(repo, token, claimLabel(commenter));
    await addLabels(repo, token, number, ['claimed', claimLabel(commenter)]);
    await react(repo, token, number, 'rocket');
    await commentOn(repo, token, number, assignBody({ issue, commenter, count: verdict.count }));
    console.log(`assigned #${number} to ${commenter} (${verdict.count}/${MAX_CLAIMS})`);
    return;
  }

  if (verdict.action === 'noop') {
    await react(repo, token, number, 'eyes');
    await commentOn(repo, token, number, `This one is already yours, @${commenter}. Happy hunting.`);
    console.log(`noop on #${number}: ${commenter} already holds it`);
    return;
  }

  await commentOn(repo, token, number, rejectBody({ verdict, commenter, number }));
  console.log(`rejected ${commenter} on #${number}: ${verdict.reason}`);
}

async function handleRelease({ repo, token, issue, commenter, association, number }) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  const verdict = evaluateRelease({ labels, commenter, association });

  if (verdict.action === 'noop') {
    await commentOn(repo, token, number, `Nothing to release on #${number}, @${commenter} — no claim is recorded here.`);
    return;
  }
  if (verdict.action === 'reject') {
    await commentOn(
      repo,
      token,
      number,
      `#${number} is held by @${verdict.holder}, not you. Only the holder or a maintainer can release it.`
    );
    return;
  }

  await removeLabel(repo, token, number, claimLabel(verdict.holder));
  const stillHeld = (await listOpenIssues(repo, token, claimLabel(verdict.holder))).filter(
    (i) => !i.pull_request && i.number !== number
  );
  if (stillHeld.length === 0) {
    await removeLabel(repo, token, number, 'claimed').catch(() => {});
  }
  // GitHub accepts only +1, -1, laugh, confused, heart, hooray, rocket, eyes.
  await react(repo, token, number, 'hooray');
  await commentOn(
    repo,
    token,
    number,
    `Released by @${commenter}. #${number} is up for grabs again — comment \`/assign-me\` to take it.`
  );
  console.log(`released #${number} from ${verdict.holder}`);
}

function assignBody({ issue, commenter, count }) {
  const left = MAX_CLAIMS - count;
  const due = new Date(Date.now() + CLAIM_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  return [
    `### Assigned to @${commenter}`,
    '',
    `You're on **#${issue.number} — ${issue.title}**.`,
    '',
    `- Open a PR by **${due}**, or comment \`/release\` to hand it back sooner.`,
    `- You now hold **${count} of ${MAX_CLAIMS}** active claims${left === 0 ? ' — that is the cap, so release one before taking another' : ''}.`,
    '',
    `Comment \`/release\` any time to free it up.`,
  ].join('\n');
}

function rejectBody({ verdict, commenter, number }) {
  if (verdict.reason === 'cap') {
    return [
      `@${commenter} you already hold **${verdict.count}** claims, which is the cap of ${MAX_CLAIMS}.`,
      '',
      'Finish one or comment `/release` on it before taking on more.',
    ].join('\n');
  }
  if (verdict.reason === 'claimed-by-other') {
    return `#${number} is already claimed by @${verdict.holder}. Comment \`/release\` on it if they are happy to hand it over.`;
  }
  if (verdict.reason === 'closed') {
    return `#${number} is closed, so there is nothing to claim.`;
  }
  if (verdict.reason === 'blocked') {
    return `#${number} carries the \`${verdict.blocking}\` label and cannot be self-assigned. A maintainer will follow up there.`;
  }
  return `Could not assign #${number}.`;
}

function apiUrl(repo, path) {
  return `https://api.github.com/repos/${repo}${path}`;
}

async function github(repo, token, path, { method = 'GET', body } = {}) {
  const res = await fetch(apiUrl(repo, path), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'phishnet-assign-bot',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function listOpenIssues(repo, token, label) {
  const out = [];
  for (let page = 1; page <= 10; page += 1) {
    const qs = new URLSearchParams({
      state: 'open',
      labels: label,
      per_page: '100',
      page: String(page),
    });
    const batch = await github(repo, token, `/issues?${qs}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function ensureLabel(repo, token, name) {
  try {
    await github(repo, token, '/labels', {
      method: 'POST',
      body: { name, color: '0e8a16', description: 'Self-assigned via /assign-me' },
    });
  } catch (err) {
    if (!/422/.test(String(err.message))) throw err;
  }
}

async function addLabels(repo, token, number, labels) {
  await github(repo, token, `/issues/${number}/labels`, {
    method: 'POST',
    body: { labels },
  });
}

async function removeLabel(repo, token, number, name) {
  await github(repo, token, `/issues/${number}/labels/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

async function react(repo, token, number, content) {
  await github(repo, token, `/issues/${number}/reactions`, {
    method: 'POST',
    body: { content },
  });
}

async function commentOn(repo, token, number, body) {
  await github(repo, token, `/issues/${number}/comments`, {
    method: 'POST',
    body: { body },
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}