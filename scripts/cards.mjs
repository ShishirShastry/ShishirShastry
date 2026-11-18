#!/usr/bin/env node
/**
 * Profile cards: live, self-hosted SVG cards for the GitHub profile README.
 *
 *   node scripts/cards.mjs --out dist               live data from the GitHub GraphQL API
 *   node scripts/cards.mjs --sample --out preview   built-in fixture, no network access
 *
 * Options:
 *   --out <dir>       output folder (default: dist)
 *   --login <name>    GitHub login (default: $GITHUB_REPOSITORY_OWNER, else ShishirShastry)
 *   --sample          render from the deterministic built-in fixture
 *   --no-font         do not embed Inter (to check the layout with the fallback font stack)
 *
 * Live mode reads the token from GITHUB_TOKEN (or GH_TOKEN). The token is never printed.
 * Writes stats-, languages-, streak- and activity- cards, each as -dark.svg and -light.svg.
 * Node built-ins only: no npm packages, nothing third party at render time.
 */
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86_400_000;
const DEFAULT_LOGIN = 'ShishirShastry';
const API_URL = 'https://api.github.com/graphql';

/* ------------------------------------------------------------------ design tokens */

export const ACCENT = ['#7c5cff', '#a63cff', '#ef67a8', '#ff9d5c'];
export const COOL = ['#2a62ff', '#00e4ff'];
const FLAME = ['#ff9d5c', '#ef67a8', '#a63cff'];

export const THEMES = {
  dark: {
    id: 'dark',
    bg: '#0a0912',
    surface: '#12101c',
    border: 'rgba(255,255,255,0.10)',
    hair: 'rgba(255,255,255,0.06)',
    text: '#f5f4fb',
    muted: '#a9a5bd',
    faint: '#6f6a86',
    success: '#3ddc97',
    track: 'rgba(255,255,255,0.07)',
    empty: '#1b1829',
    floorTop: ['#161323', '#0f0d19'],
    floorSide: '#0c0a14',
    shade: '#0b0618',
    shadeRight: 0.24,
    shadeFront: 0.44,
    topLift: 0.07,
    topEdge: 'rgba(255,255,255,0.22)',
    reflect: 0.3,
    dropShadow: 0.6,
    glowA: 0.2,
    glowB: 0.1,
    edge: 0.7,
    chip: 0.16,
    areaTop: 0.42,
    icons: ['#9b82ff', '#c06bff', '#ff7db5', '#ffad72', '#6b93ff', '#3fe3ff'],
  },
  light: {
    id: 'light',
    bg: '#ffffff',
    surface: '#f6f5fb',
    border: 'rgba(16,12,40,0.10)',
    hair: 'rgba(16,12,40,0.06)',
    text: '#16131f',
    muted: '#5d5873',
    faint: '#9a96ad',
    success: '#12a36a',
    track: 'rgba(16,12,40,0.07)',
    empty: '#ebe9f3',
    floorTop: ['#f7f6fc', '#efedf7'],
    floorSide: '#e2dff0',
    shade: '#24124d',
    shadeRight: 0.14,
    shadeFront: 0.3,
    topLift: 0.04,
    topEdge: 'rgba(255,255,255,0.55)',
    reflect: 0.16,
    dropShadow: 0.13,
    glowA: 0.09,
    glowB: 0.06,
    edge: 0.55,
    chip: 0.1,
    areaTop: 0.3,
    icons: ['#6a48f0', '#9330ec', '#d4448a', '#d9702a', '#2a62ff', '#0b8fb0'],
  },
};

const FONT_STACK = "Inter,'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/* ------------------------------------------------------------------ small helpers */

export class CardsError extends Error {}

/** Escape text for XML text nodes and attribute values; drops characters XML forbids. */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Compact number: 999, 1.2k, 12.3k, 123k, 1.2M. */
export function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const sign = v < 0 ? '-' : '';
  let a = Math.abs(v);
  if (Math.round(a) < 1000) return sign + String(Math.round(a));
  const units = ['k', 'M', 'B', 'T'];
  let u = -1;
  while (a >= 1000 && u < units.length - 1) {
    a /= 1000;
    u += 1;
  }
  let s = a < 100 ? Math.round(a * 10) / 10 : Math.round(a);
  if (s >= 1000 && u < units.length - 1) {
    s = 1;
    u += 1;
  }
  return sign + String(s) + units[u];
}

/** Integer with thousands separators: 1284 -> "1,284" (locale independent). */
export function formatInt(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};
const r2 = (n) => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? '0' : String(v);
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function parseDay(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

function fmtDay(s, withYear = false) {
  const d = new Date(parseDay(s));
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}
function fmtMonthYear(s) {
  const d = new Date(parseDay(s));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* Approximate advance widths of Inter (em) so labels can be placed and truncated. */
const NARROW = new Set([...`iljI.,:;|!'’ `]);
const SEMI = new Set([...'frt()[]-/']);
const WIDE = new Set([...'mwMW@%']);
export function textWidth(str, size, weight = 600) {
  let em = 0;
  for (const ch of String(str)) {
    if (NARROW.has(ch)) em += ch === ' ' ? 0.27 : 0.26;
    else if (SEMI.has(ch)) em += 0.37;
    else if (WIDE.has(ch)) em += 0.88;
    else if (/[0-9]/.test(ch)) em += 0.63;
    else if (/[A-Z]/.test(ch)) em += 0.7;
    else em += 0.57;
  }
  return em * size * (weight >= 800 ? 1.05 : 1);
}
function truncate(str, maxWidth, size, weight) {
  const s = String(str);
  if (textWidth(s, size, weight) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && textWidth(`${out}…`, size, weight) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/* ------------------------------------------------------------------ colour */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  return `#${rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}
export function gradientAt(stops, t) {
  const x = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Nudge a colour toward black/white until it separates from the background. */
function ensureContrast(color, bg, min) {
  const towards = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  let c = color;
  for (let i = 0; i < 24 && contrast(c, bg) < min; i += 1) c = mix(c, towards, 0.07);
  return c;
}

/* ------------------------------------------------------------------ data model */

/**
 * Streaks over a contribution calendar.
 * `today` defaults to the last calendar date. The current streak may end today or
 * yesterday (a streak is still alive until a full day passes without contributions).
 */
export function computeStreaks(days, { today } = {}) {
  const counts = new Map();
  for (const d of days ?? []) {
    if (!d?.date) continue;
    const key = String(d.date).slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + Math.max(0, Number(d.count) || 0));
  }
  const keys = [...counts.keys()].sort();
  const none = () => ({ length: 0, start: null, end: null });
  if (!keys.length) {
    return { current: none(), longest: none(), total: 0, activeDays: 0, firstDate: null, lastDate: today ?? null };
  }
  const first = parseDay(keys[0]);
  const last = Math.max(first, parseDay(today ?? keys[keys.length - 1]));
  const at = (t) => counts.get(dayKey(t)) ?? 0;

  let total = 0;
  let activeDays = 0;
  let run = 0;
  let runStart = first;
  let longest = none();
  for (let t = first; t <= last; t += DAY) {
    const c = at(t);
    total += c;
    if (c > 0) {
      activeDays += 1;
      if (run === 0) runStart = t;
      run += 1;
      if (run >= longest.length) longest = { length: run, start: dayKey(runStart), end: dayKey(t) };
    } else {
      run = 0;
    }
  }

  let current = none();
  const end = at(last) > 0 ? last : last - DAY;
  if (end >= first && at(end) > 0) {
    let s = end;
    while (s - DAY >= first && at(s - DAY) > 0) s -= DAY;
    current = { length: Math.round((end - s) / DAY) + 1, start: dayKey(s), end: dayKey(end) };
  }
  return { current, longest, total, activeDays, firstDate: keys[0], lastDate: dayKey(last) };
}

/** Split `scale` units across values proportionally so the parts sum exactly to `scale`. */
function largestRemainder(values, scale) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * scale);
  const out = raw.map(Math.floor);
  let left = scale - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), values[i], i]).sort((a, b) => b[0] - a[0] || b[1] - a[1] || a[2] - b[2]);
  for (let k = 0; left > 0 && k < order.length; k += 1, left -= 1) out[order[k][2]] += 1;
  return out;
}

/**
 * Aggregate language byte counts (by name), keep the top `top`, fold the rest into "Other".
 * Percentages carry one decimal and always sum to exactly 100.
 */
export function foldLanguages(entries, { top = 6 } = {}) {
  const agg = new Map();
  for (const e of entries ?? []) {
    const bytes = Number(e?.bytes) || 0;
    const name = typeof e?.name === 'string' ? e.name.trim() : '';
    if (!name || bytes <= 0) continue;
    const cur = agg.get(name) ?? { name, color: null, bytes: 0 };
    cur.bytes += bytes;
    if (!cur.color && typeof e.color === 'string' && HEX.test(e.color)) cur.color = e.color.toLowerCase();
    agg.set(name, cur);
  }
  const sorted = [...agg.values()].sort((a, b) => b.bytes - a.bytes || (a.name < b.name ? -1 : 1));
  const total = sorted.reduce((s, l) => s + l.bytes, 0);
  if (!total) return { items: [], total: 0, count: 0 };
  const items = sorted.slice(0, top).map((l) => ({ ...l, other: false }));
  const rest = sorted.slice(top);
  if (rest.length) items.push({ name: 'Other', color: null, bytes: rest.reduce((s, l) => s + l.bytes, 0), other: true, folded: rest.length });
  const tenths = largestRemainder(items.map((i) => i.bytes), 1000);
  return { items: items.map((i, k) => ({ ...i, percent: tenths[k] / 10 })), total, count: sorted.length };
}

/** A year of empty weeks ending on `endIso` (GitHub-style: weeks start on Sunday). */
function emptyCalendar(endIso) {
  const end = parseDay(String(endIso ?? '').slice(0, 10));
  if (!Number.isFinite(end)) return [];
  let start = end - 364 * DAY;
  while (new Date(start).getUTCDay() !== 0) start -= DAY;
  const weeks = [];
  for (let t = start; t <= end; t += DAY) {
    if (new Date(t).getUTCDay() === 0 || !weeks.length) weeks.push([]);
    weeks[weeks.length - 1].push({ date: dayKey(t), count: 0 });
  }
  return weeks;
}

/** Turn raw data (live or fixture) into everything the renderers need. */
export function buildModel(raw) {
  let weeks = (raw?.contributions?.weeks ?? []).filter((w) => Array.isArray(w) && w.length);
  if (!weeks.length) weeks = emptyCalendar(raw?.generatedAt);
  const days = [];
  weeks.forEach((week, w) => {
    for (const day of week) {
      if (!day?.date) continue;
      const count = Math.max(0, Number(day.count) || 0);
      days.push({ date: String(day.date).slice(0, 10), count, w, d: new Date(parseDay(day.date)).getUTCDay() });
    }
  });
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const weekly = weeks.map((week) => week.reduce((s, d) => s + Math.max(0, Number(d?.count) || 0), 0));
  const weekStarts = weeks.map((week) => String(week[0].date).slice(0, 10));
  const today = days.length ? days[days.length - 1].date : String(raw?.generatedAt ?? '').slice(0, 10) || null;
  const streaks = computeStreaks(days, { today: today ?? undefined });
  const calendarTotal = Number(raw?.contributions?.total);
  const contributions = Number.isFinite(calendarTotal) && calendarTotal >= 0 ? calendarTotal : streaks.total;

  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) byWeekday[d.d] += d.count;
  const best = days.reduce((b, d) => (d.count > (b?.count ?? 0) || (b && d.count === b.count && d.count > 0) ? d : b), null);

  return {
    login: String(raw?.login ?? DEFAULT_LOGIN),
    createdYear: raw?.createdAt ? new Date(raw.createdAt).getUTCFullYear() : null,
    followers: Number(raw?.followers) || 0,
    generatedAt: String(raw?.generatedAt ?? '').slice(0, 10) || today,
    totals: {
      stars: Number(raw?.repos?.stars) || 0,
      repos: Number(raw?.repos?.total) || 0,
      commits: Number(raw?.contributions?.commits) || 0,
      prs: Number(raw?.contributions?.pullRequests) || 0,
      issues: Number(raw?.contributions?.issues) || 0,
      reposCreated: Number(raw?.contributions?.repositories) || 0,
      contributions,
    },
    days,
    weekCount: weeks.length,
    weekly,
    weekStarts,
    today,
    streaks,
    activeDays: streaks.activeDays,
    bestDay: best && best.count > 0 ? best : null,
    busiestWeekday: byWeekday.some((v) => v > 0) ? byWeekday.indexOf(Math.max(...byWeekday)) : null,
    languages: foldLanguages(raw?.repos?.languages ?? []),
  };
}

/* ------------------------------------------------------------------ GitHub API */

const PROFILE_QUERY = `query Profile($login: String!) {
  user(login: $login) {
    login
    createdAt
    followers { totalCount }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const REPOS_QUERY = `query Repos($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        stargazerCount
        languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function redact(message, token) {
  let m = String(message ?? '');
  if (token) m = m.split(token).join('***');
  return m.replace(/\b(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '***');
}

async function graphql(token, query, variables, { fetchImpl = globalThis.fetch, attempts = 3 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          authorization: `bearer ${token}`,
          'content-type': 'application/json',
          'user-agent': 'profile-cards (node)',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (attempt < attempts) {
        await sleep(1500 * attempt);
        continue;
      }
      const why = err?.name === 'TimeoutError' ? 'the request timed out' : redact(err?.message, token);
      throw new CardsError(`could not reach the GitHub API (${why}).`);
    }
    if (res.status >= 500 && attempt < attempts) {
      await sleep(1500 * attempt);
      continue;
    }
    const body = await res.text();
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {
      json = null;
    }
    if (!res.ok) {
      const detail = redact(json?.message ?? body.slice(0, 200), token).trim();
      const hint = res.status === 401 ? ' Check that GITHUB_TOKEN is set to a valid token.' : '';
      throw new CardsError(`GitHub API request failed: HTTP ${res.status}${detail ? ` (${detail})` : ''}.${hint}`);
    }
    if (json?.errors?.length) {
      throw new CardsError(`GitHub API returned an error: ${redact(json.errors.map((e) => e.message).join('; '), token)}`);
    }
    if (!json?.data) throw new CardsError('GitHub API returned an empty response.');
    return json.data;
  }
}

/** Fetch everything the cards need for `login` and return the raw shape used by the fixture too. */
export async function fetchRaw(login, token, options = {}) {
  const profile = await graphql(token, PROFILE_QUERY, { login }, options);
  const user = profile.user;
  if (!user) throw new CardsError(`GitHub user "${login}" was not found.`);
  const cc = user.contributionsCollection;

  let stars = 0;
  let total = 0;
  const languages = [];
  let after = null;
  for (let page = 0; page < 20; page += 1) {
    const data = await graphql(token, REPOS_QUERY, { login, after }, options);
    const repos = data.user?.repositories;
    if (!repos) break;
    total = repos.totalCount;
    for (const repo of repos.nodes ?? []) {
      stars += repo?.stargazerCount ?? 0;
      for (const edge of repo?.languages?.edges ?? []) {
        languages.push({ name: edge?.node?.name, color: edge?.node?.color, bytes: edge?.size });
      }
    }
    if (!repos.pageInfo?.hasNextPage) break;
    after = repos.pageInfo.endCursor;
  }

  return {
    login: user.login,
    createdAt: user.createdAt,
    followers: user.followers?.totalCount ?? 0,
    generatedAt: new Date().toISOString(),
    contributions: {
      commits: cc.totalCommitContributions,
      pullRequests: cc.totalPullRequestContributions,
      issues: cc.totalIssueContributions,
      repositories: cc.totalRepositoryContributions,
      total: cc.contributionCalendar.totalContributions,
      weeks: cc.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
    },
    repos: { total, stars, languages },
  };
}

/* ------------------------------------------------------------------ sample fixture */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A realistic, deterministic year of activity (no network). Used by --sample and the tests. */
export function sampleRaw() {
  const rand = mulberry32(20261118);
  const end = Date.UTC(2026, 10, 18);
  let start = end - 364 * DAY;
  while (new Date(start).getUTCDay() !== 0) start -= DAY;
  const bump = (t, centre, width, height) => height * Math.exp(-(((t - centre) / (width * DAY)) ** 2));
  const phase = (t) =>
    0.18 +
    bump(t, Date.UTC(2026, 0, 20), 18, 0.45) +
    bump(t, Date.UTC(2026, 3, 28), 26, 0.8) +
    bump(t, Date.UTC(2026, 6, 1), 12, 0.3) +
    bump(t, Date.UTC(2026, 9, 25), 24, 0.75);
  const weekdayFactor = [0.35, 1, 1, 1, 0.95, 0.85, 0.55];
  const weeks = [];
  for (let t = start; t <= end; t += DAY) {
    const date = new Date(t);
    if (date.getUTCDay() === 0 || !weeks.length) weeks.push([]);
    const p = phase(t);
    const vacation = t >= Date.UTC(2026, 7, 3) && t <= Date.UTC(2026, 7, 16);
    let count = 0;
    if (!vacation && rand() < clamp(0.2 + 0.7 * p, 0, 0.97) * weekdayFactor[date.getUTCDay()]) {
      count = 1 + Math.floor(rand() ** 1.6 * (4 + 18 * p));
    }
    if (t > end - 13 * DAY) count = Math.max(count, 1 + Math.floor(rand() * 7));
    if (t >= Date.UTC(2026, 3, 13) && t <= Date.UTC(2026, 4, 8)) count = Math.max(count, 2 + Math.floor(rand() * 9));
    if (t === Date.UTC(2026, 4, 6)) count = 31;
    if (t === end - 13 * DAY) count = 0;
    weeks[weeks.length - 1].push({ date: dayKey(t), count });
  }
  const total = weeks.flat().reduce((s, d) => s + d.count, 0);
  const lang = (name, color, bytes) => ({ name, color, bytes });
  return {
    login: DEFAULT_LOGIN,
    createdAt: '2021-06-14T09:12:00Z',
    followers: 18,
    generatedAt: '2026-11-18T03:17:00Z',
    contributions: {
      commits: Math.round(total * 0.79),
      pullRequests: 46,
      issues: 19,
      repositories: 7,
      total,
      weeks,
    },
    repos: {
      total: 24,
      stars: 41,
      languages: [
        lang('TypeScript', '#3178c6', 1_486_000),
        lang('JavaScript', '#f1e05a', 912_000),
        lang('JavaScript', '#f1e05a', 341_000),
        lang('Python', '#3572A5', 618_000),
        lang('HTML', '#e34c26', 402_000),
        lang('CSS', '#663399', 297_000),
        lang('C', '#555555', 141_000),
        lang('Jupyter Notebook', '#DA5B0B', 88_000),
        lang('Shell', '#89e051', 21_000),
        lang('SCSS', '#c6538c', 12_500),
        lang('Dockerfile', '#384d54', 3_100),
      ],
    },
  };
}

/* ------------------------------------------------------------------ SVG building blocks */

function loadFonts() {
  const dir = path.join(HERE, 'fonts');
  const fonts = {};
  for (const weight of [600, 800]) {
    const file = path.join(dir, `inter-latin-${weight}-normal.woff2`);
    if (existsSync(file)) fonts[weight] = readFileSync(file).toString('base64');
  }
  return Object.keys(fonts).length ? fonts : null;
}

function fontFaces(fonts) {
  if (!fonts) return '';
  return Object.entries(fonts)
    .map(([weight, b64]) => `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`)
    .join('');
}

function baseCss(t, fonts) {
  return `${fontFaces(fonts)}
text{font-family:${FONT_STACK};font-weight:600}
.ttl{font-size:16px;fill:${t.text};letter-spacing:-.01em}
.meta{font-size:12px;fill:${t.muted}}
.num{font-weight:800;fill:${t.text};letter-spacing:-.025em}
.lbl{font-size:12px;fill:${t.muted}}
.txt{fill:${t.text}}
.mut{fill:${t.muted}}
.tnum{font-variant-numeric:tabular-nums}
.in{animation:fadeUp .7s cubic-bezier(.2,.75,.25,1) both}
.fade{animation:fadeIn .8s ease-out both}
.live{opacity:0;transform-box:fill-box;transform-origin:center;animation:ping 2.6s cubic-bezier(.2,.6,.35,1) infinite}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes ping{0%{opacity:.6;transform:scale(1)}75%,100%{opacity:0;transform:scale(2.8)}}`;
}

const REDUCED = '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';

function svgDoc({ w, h, t, fonts, title, desc, defs = '', css = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(desc)}</desc>
<style>${baseCss(t, fonts)}
${css}
${REDUCED}</style>
<defs>
<clipPath id="card"><rect width="${w}" height="${h}" rx="18"/></clipPath>
<radialGradient id="glowA" cx="0.06" cy="0" r="0.75"><stop offset="0" stop-color="${ACCENT[0]}" stop-opacity="${t.glowA}"/><stop offset="1" stop-color="${ACCENT[0]}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowB" cx="1" cy="1" r="0.7"><stop offset="0" stop-color="${ACCENT[2]}" stop-opacity="${t.glowB}"/><stop offset="1" stop-color="${ACCENT[2]}" stop-opacity="0"/></radialGradient>
<linearGradient id="edge" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${ACCENT[0]}" stop-opacity="0"/><stop offset=".3" stop-color="${ACCENT[0]}"/><stop offset=".62" stop-color="${ACCENT[2]}"/><stop offset="1" stop-color="${ACCENT[3]}" stop-opacity="0"/></linearGradient>
<linearGradient id="pill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${ACCENT[0]}"/><stop offset=".55" stop-color="${ACCENT[2]}"/><stop offset="1" stop-color="${ACCENT[3]}"/></linearGradient>
${defs}
</defs>
<rect width="${w}" height="${h}" rx="18" fill="${t.bg}"/>
<g clip-path="url(#card)"><rect width="${w}" height="${h}" fill="url(#glowA)"/><rect width="${w}" height="${h}" fill="url(#glowB)"/></g>
<rect x="40" y="0" width="${w - 80}" height="1" fill="url(#edge)" opacity="${t.edge}"/>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="17.5" stroke="${t.border}"/>
${body}
</svg>
`;
}

function cardHeader(t, w, title, meta, { live = false } = {}) {
  let out = `<rect x="28" y="26" width="4" height="18" rx="2" fill="url(#pill)"/>
<text x="42" y="40.5" class="ttl">${escapeXml(title)}</text>`;
  if (meta) {
    out += `\n<text x="${w - 28}" y="40" class="meta" text-anchor="end">${escapeXml(meta)}</text>`;
    if (live) {
      const x = w - 28 - textWidth(meta, 12) - 11;
      out += `\n<circle cx="${r1(x)}" cy="35.5" r="3.5" fill="${t.success}" class="live"/><circle cx="${r1(x)}" cy="35.5" r="3.5" fill="${t.success}"/>`;
    }
  }
  return out;
}

/* 24x24 stroke icons */
const ICONS = {
  pulse: '<path d="M2.5 12.5h4.2l2.6-6.8 5.2 12.6 2.6-5.8h4.4"/>',
  commit: '<circle cx="12" cy="12" r="3.6"/><path d="M2.5 12h5.9M15.6 12h5.9"/>',
  pr: '<circle cx="6" cy="5.8" r="2.4"/><circle cx="6" cy="18.2" r="2.4"/><circle cx="18" cy="18.2" r="2.4"/><path d="M6 8.2v7.6M18 15.8v-6.3a3 3 0 0 0-3-3h-4.2M12.9 4.4 10.8 6.5l2.1 2.1"/>',
  issue: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z"/>',
  repo: '<path d="M5 18.5V5.2A2.2 2.2 0 0 1 7.2 3H19v14.6H7.1A2.1 2.1 0 0 0 5 19.7 2.1 2.1 0 0 0 7.1 21.8H19v-4.2"/><path d="M9 7.2h6"/>',
};

function icon(name, x, y, size, color) {
  const s = size / 24;
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${r2(s)})" stroke="${color}" color="${color}" stroke-width="${r2(1.65 / s)}" stroke-linecap="round" stroke-linejoin="round" fill="none">${ICONS[name]}</g>`;
}

/** Monotone cubic interpolation (no overshoot below the baseline). */
function monotonePath(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const tan = [m[0]];
  for (let i = 1; i < n - 1; i += 1) {
    if (m[i - 1] * m[i] <= 0) tan[i] = 0;
    else {
      const a = 2 * dx[i] + dx[i - 1];
      const b = dx[i] + 2 * dx[i - 1];
      tan[i] = (a + b) / (a / m[i - 1] + b / m[i]);
    }
  }
  tan[n - 1] = m[n - 2];
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += `C${r1(pts[i][0] + h)} ${r1(pts[i][1] + tan[i] * h)} ${r1(pts[i + 1][0] - h)} ${r1(pts[i + 1][1] - tan[i + 1] * h)} ${r1(pts[i + 1][0])} ${r1(pts[i + 1][1])}`;
  }
  return d;
}

/* ------------------------------------------------------------------ stats card */

export function renderStats(model, t, fonts) {
  const W = 1000;
  const H = 230;
  const T = model.totals;
  const tiles = [
    { label: 'Contributions', value: T.contributions, icon: 'pulse' },
    { label: 'Commits', value: T.commits, icon: 'commit' },
    { label: 'Pull requests', value: T.prs, icon: 'pr' },
    { label: 'Issues', value: T.issues, icon: 'issue' },
    { label: 'Total stars', value: T.stars, icon: 'star' },
    { label: 'Public repos', value: T.repos, icon: 'repo' },
  ];
  const gx = 24;
  const gy = 60;
  const tw = 184;
  const th = 70;
  const gap = 12;
  const updated = model.generatedAt && Number.isFinite(parseDay(model.generatedAt)) ? `Updated ${fmtDay(model.generatedAt, true)}` : 'Live';
  let body = cardHeader(t, W, 'GitHub at a glance', updated, { live: true });

  tiles.forEach((tile, i) => {
    const x = gx + (i % 3) * (tw + gap);
    const y = gy + Math.floor(i / 3) * (th + 10);
    const c = t.icons[i];
    body += `
<g transform="translate(${x} ${y})"><g class="in" style="animation-delay:${r2(0.08 + i * 0.07)}s">
<rect x=".5" y=".5" width="${tw - 1}" height="${th - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>
<rect x="14" y="17" width="36" height="36" rx="11" fill="${c}" fill-opacity="${t.chip}"/>
<rect x="14.5" y="17.5" width="35" height="35" rx="10.5" stroke="${c}" stroke-opacity=".28"/>
${icon(tile.icon, 23, 26, 18, c)}
<text x="64" y="38" class="num tnum" font-size="25">${formatNumber(tile.value)}</text>
<text x="64" y="56" class="lbl">${escapeXml(tile.label)}</text>
</g></g>`;
  });

  // weekly sparkline panel
  const px = 612;
  const py = 60;
  const pw = W - 24 - px;
  const ph = 150;
  const weekly = model.weekly;
  const max = Math.max(0, ...weekly);
  const peakIndex = weekly.indexOf(max);
  const cx0 = px + 18;
  const cx1 = px + pw - 18;
  const cy0 = py + 44;
  const cy1 = py + 118;
  const n = weekly.length;
  const pts = weekly.map((v, i) => [n > 1 ? cx0 + ((cx1 - cx0) * i) / (n - 1) : (cx0 + cx1) / 2, max ? cy1 - ((cy1 - cy0) * v) / max : cy1]);
  const line = monotonePath(pts);
  const area = pts.length ? `${line}L${r1(pts[pts.length - 1][0])} ${cy1}L${r1(pts[0][0])} ${cy1}Z` : '';
  const peakLabel = max ? `Peak ${formatInt(max)} / week` : 'No activity yet';

  let ticks = '';
  model.weekStarts.forEach((ws, i) => {
    const d = new Date(parseDay(ws));
    const prev = i ? new Date(parseDay(model.weekStarts[i - 1])) : null;
    const month = d.getUTCMonth();
    if (i > 1 && i < n - 2 && prev && prev.getUTCMonth() !== month && month % 3 === 0) {
      ticks += `<text x="${r1(pts[i][0])}" y="${py + ph - 14}" class="lbl" font-size="11" text-anchor="middle">${MONTHS[month]}</text>`;
      ticks += `<path d="M${r1(pts[i][0])} ${cy0 - 6}V${cy1}" stroke="${t.hair}" stroke-dasharray="2 3"/>`;
    }
  });

  const last = pts[pts.length - 1];
  const peak = pts[peakIndex];
  body += `
<g class="in" style="animation-delay:.2s">
<rect x="${px + 0.5}" y="${py + 0.5}" width="${pw - 1}" height="${ph - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>
<text x="${px + 18}" y="${py + 25}" class="lbl">Weekly contributions</text>
<text x="${px + pw - 18}" y="${py + 25}" class="lbl" text-anchor="end">${escapeXml(peakLabel)}</text>
${ticks}
<path d="M${cx0} ${cy1 + 0.5}H${cx1}" stroke="${t.border}"/>
${
  max
    ? `<path d="${area}" fill="url(#spark)" mask="url(#fadeDown)" class="fade" style="animation-delay:.6s"/>
<path d="${line}" stroke="url(#spark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="draw"/>
<g class="orb" opacity="0"><circle r="7" fill="${ACCENT[2]}" opacity=".28"/><circle r="3" fill="#ffffff" stroke="${ACCENT[2]}" stroke-width="1.5"/>
<animateMotion dur="8s" begin="2.4s" repeatCount="indefinite" path="${line}" keyPoints="0;1;1" keyTimes="0;.62;1" calcMode="linear"/>
<animate attributeName="opacity" dur="8s" begin="2.4s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;.06;.56;.62;1"/></g>
<circle cx="${r1(peak[0])}" cy="${r1(peak[1])}" r="3.4" fill="${t.surface}" stroke="${gradientAt(ACCENT, peakIndex / Math.max(1, n - 1))}" stroke-width="2" class="fade" style="animation-delay:1.2s"/>
<circle cx="${r1(last[0])}" cy="${r1(last[1])}" r="3.6" fill="${ACCENT[3]}" class="live" style="animation-delay:1.6s"/>
<circle cx="${r1(last[0])}" cy="${r1(last[1])}" r="3.6" fill="${ACCENT[3]}" stroke="${t.surface}" stroke-width="1.5" class="fade" style="animation-delay:1.4s"/>`
    : `<text x="${(cx0 + cx1) / 2}" y="${(cy0 + cy1) / 2 + 4}" class="lbl" text-anchor="middle">Contributions will appear here</text>`
}
</g>`;

  const defs = `<linearGradient id="spark" gradientUnits="userSpaceOnUse" x1="${cx0}" x2="${cx1}" y1="0" y2="0"><stop offset="0" stop-color="${ACCENT[0]}"/><stop offset=".38" stop-color="${ACCENT[1]}"/><stop offset=".72" stop-color="${ACCENT[2]}"/><stop offset="1" stop-color="${ACCENT[3]}"/></linearGradient>
<linearGradient id="fadeV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.areaTop}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="fadeDown" maskUnits="userSpaceOnUse" x="${px}" y="${cy0 - 4}" width="${pw}" height="${cy1 - cy0 + 8}"><rect x="${px}" y="${cy0 - 4}" width="${pw}" height="${cy1 - cy0 + 4}" fill="url(#fadeV)"/></mask>`;

  const css = `.draw{stroke-dasharray:1 1;animation:draw 1.6s cubic-bezier(.45,0,.2,1) .35s both}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.orb{display:none}}`;

  const desc = `GitHub statistics for ${model.login}: ${formatInt(T.contributions)} contributions, ${formatInt(T.commits)} commits, ${formatInt(T.prs)} pull requests and ${formatInt(T.issues)} issues in the last 12 months; ${formatInt(T.stars)} stars across ${formatInt(T.repos)} public repositories. Weekly contributions peak at ${formatInt(max)}.`;
  return svgDoc({ w: W, h: H, t, fonts, title: 'GitHub at a glance', desc, defs, css, body });
}

/* ------------------------------------------------------------------ languages card */

export function renderLanguages(model, t, fonts) {
  const W = 490;
  const H = 230;
  const { items, count } = model.languages;
  const cx = 112;
  const cy = 140;
  const r = 56;
  const sw = 17;
  const otherColor = t.id === 'dark' ? '#3a3550' : '#d6d2e4';
  const colorOf = (item) => (item.other ? otherColor : !item.color ? t.faint : ensureContrast(item.color, t.bg, 1.55));

  let segs = '';
  let start = 0;
  const gapU = items.length > 1 ? 0.9 : 0;
  for (const item of items) {
    const len = item.percent;
    const draw = Math.max(0.35, len - gapU);
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${colorOf(item)}" stroke-width="${sw}" pathLength="100" stroke-dasharray="${r2(draw)} ${r2(100 - draw)}" stroke-dashoffset="${r2(-start)}"/>`;
    start += len;
  }

  let body = cardHeader(t, W, 'Top languages', `${formatInt(model.totals.repos)} public ${model.totals.repos === 1 ? 'repo' : 'repos'}`);
  body += `
<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${t.track}" stroke-width="${sw}"/>
<g transform="rotate(-90 ${cx} ${cy})">
${t.id === 'dark' && items.length ? `<g filter="url(#soft)" opacity=".5" class="breathe">${segs}</g>` : ''}
<g mask="url(#sweep)">${segs}</g>
</g>
<circle cx="${cx}" cy="${cy}" r="${r - sw / 2 - 0.5}" stroke="${t.hair}"/>
<text x="${cx}" y="${cy + 4}" class="num" font-size="30" text-anchor="middle">${formatInt(count)}</text>
<text x="${cx}" y="${cy + 22}" class="lbl" font-size="11.5" text-anchor="middle">${count === 1 ? 'language' : 'languages'}</text>`;

  if (!items.length) {
    body += `<text x="${(214 + W - 28) / 2}" y="${cy + 4}" class="lbl" font-size="13" text-anchor="middle">No public code yet</text>`;
  }
  const x0 = 210;
  const x1 = W - 28;
  const rowH = items.length > 5 ? 22 : 26;
  const top = cy - ((items.length - 1) * rowH) / 2 + 1;
  const maxPct = Math.max(...items.map((i) => i.percent), 1);
  items.forEach((item, i) => {
    const y = top + i * rowH;
    const c = colorOf(item);
    const pct = item.percent > 0 ? `${item.percent.toFixed(1)}%` : '<0.1%';
    const name = truncate(item.name, 150, 13, 600);
    const bar = Math.max(2, ((x1 - x0 - 22) * item.percent) / maxPct);
    body += `
<g class="in" style="animation-delay:${r2(0.35 + i * 0.06)}s">
<circle cx="${x0 + 5}" cy="${r1(y - 4.5)}" r="4.5" fill="${c}"/>
<text x="${x0 + 18}" y="${r1(y)}" font-size="13" class="txt">${escapeXml(name)}</text>
<text x="${x1}" y="${r1(y)}" font-size="12.5" class="mut tnum" text-anchor="end">${pct}</text>
<rect x="${x0 + 18}" y="${r1(y + 6)}" width="${r1(x1 - x0 - 18)}" height="2" rx="1" fill="${t.track}"/>
<rect x="${x0 + 18}" y="${r1(y + 6)}" width="${r1(bar)}" height="2" rx="1" fill="${c}" opacity=".85"/>
</g>`;
  });

  const defs = `<mask id="sweep" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><circle cx="${cx}" cy="${cy}" r="${r}" stroke="#fff" stroke-width="${sw + 4}" pathLength="100" stroke-dasharray="100 100" class="sweep"/></mask>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>`;
  const css = `.sweep{animation:sweep 1.4s cubic-bezier(.55,.05,.25,1) .15s both}
@keyframes sweep{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.breathe{animation:breathe 6s ease-in-out 1.6s infinite}
@keyframes breathe{0%,100%{opacity:.5}50%{opacity:.22}}`;
  const desc = items.length
    ? `Top languages for ${model.login} by bytes of code across owned public repositories: ${items.map((i) => `${i.name} ${i.percent.toFixed(1)}%`).join(', ')}.`
    : `No language data yet for ${model.login}.`;
  return svgDoc({ w: W, h: H, t, fonts, title: 'Top languages', desc, defs, css, body });
}

/* ------------------------------------------------------------------ streak card */

const FLAME_PATH =
  'M12 1.6c.5 3.3 2.4 5.2 4.3 7.4 1.7 2 2.7 4.1 2.7 6.3A7 7 0 0 1 12 22.3a7 7 0 0 1-7-7c0-2.6 1.2-4.7 2.9-6.3.1 2.1 1 3.5 2.4 4.2-.7-4.4.4-8.1 1.7-11.6z';
const FLAME_CORE = 'M12 12.2c1.2 1.7 3 2.9 3 5.1a3 3 0 0 1-6 0c0-1.5.8-2.4 1.6-3.3.2.9.6 1.4 1.1 1.7-.2-1.2-.1-2.3.3-3.5z';

function rangeText(range, lastDate) {
  if (!range?.start) return '';
  const end = range.end === lastDate ? 'Today' : fmtDay(range.end);
  if (range.start === range.end) return end === 'Today' ? 'Today' : fmtDay(range.start);
  return `${fmtDay(range.start)} – ${end}`;
}

export function renderStreak(model, t, fonts) {
  const W = 490;
  const H = 230;
  const { current, longest } = model.streaks;
  const last = model.today;
  const total = model.totals.contributions;
  const cols = [92, 245, 398];
  const cy = 120;
  const ringR = 41;
  const pct = longest.length ? clamp(current.length / longest.length, 0, 1) * 100 : 0;
  const alive = current.length > 0;

  let body = cardHeader(t, W, 'Streak', 'Last 12 months');
  body += `
<path d="M168.5 78V200M321.5 78V200" stroke="${t.hair}"/>
<g class="in" style="animation-delay:.1s">
<text x="${cols[0]}" y="${cy + 10}" class="num tnum" font-size="${total >= 100_000 ? 26 : 30}" text-anchor="middle">${total >= 100_000 ? formatNumber(total) : formatInt(total)}</text>
<text x="${cols[0]}" y="${cy + 28}" class="lbl" font-size="11.5" text-anchor="middle">contributions</text>
<text x="${cols[0]}" y="187" font-size="13" class="txt" text-anchor="middle">Total</text>
<text x="${cols[0]}" y="205" class="lbl" font-size="11.5" text-anchor="middle">${escapeXml(total > 0 && model.streaks.firstDate ? `${fmtMonthYear(model.streaks.firstDate)} – Today` : 'No contributions yet')}</text>
</g>
<g class="in" style="animation-delay:.2s">
<circle cx="${cols[1]}" cy="${cy}" r="${ringR}" stroke="${t.track}" stroke-width="7"/>
${pct > 0 ? `<circle cx="${cols[1]}" cy="${cy}" r="${ringR}" stroke="url(#ring)" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="${r2(pct)} 100" transform="rotate(-90 ${cols[1]} ${cy})" class="ringfill"/>` : ''}
<circle cx="${cols[1]}" cy="${cy - ringR}" r="15.5" fill="${t.bg}"/>
<g transform="translate(${cols[1] - 11.5} ${cy - ringR - 13.5}) scale(.96)"><g class="${alive ? 'flame' : ''}">
<path d="${FLAME_PATH}" fill="${alive ? 'url(#flame)' : t.faint}"/>
<path d="${FLAME_CORE}" fill="${alive ? '#ffe2b8' : t.bg}" opacity="${alive ? 0.9 : 0.6}"/>
</g></g>
<text x="${cols[1]}" y="${cy + 10}" class="num tnum" font-size="30" text-anchor="middle">${formatInt(current.length)}</text>
<text x="${cols[1]}" y="${cy + 28}" class="lbl" font-size="11.5" text-anchor="middle">${current.length === 1 ? 'day' : 'days'}</text>
<text x="${cols[1]}" y="187" font-size="13" class="txt" text-anchor="middle">Current streak</text>
<text x="${cols[1]}" y="205" class="lbl" font-size="11.5" text-anchor="middle">${escapeXml(alive ? rangeText(current, last) : total ? 'Start one today' : 'No contributions yet')}</text>
</g>
<g class="in" style="animation-delay:.3s">
<text x="${cols[2]}" y="${cy + 10}" class="num tnum" font-size="30" text-anchor="middle">${formatInt(longest.length)}</text>
<text x="${cols[2]}" y="${cy + 28}" class="lbl" font-size="11.5" text-anchor="middle">${longest.length === 1 ? 'day' : 'days'}</text>
<text x="${cols[2]}" y="187" font-size="13" class="txt" text-anchor="middle">Longest streak</text>
<text x="${cols[2]}" y="205" class="lbl" font-size="11.5" text-anchor="middle">${escapeXml(longest.length ? rangeText(longest, last) : '—')}</text>
</g>`;

  const defs = `<linearGradient id="ring" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="${ACCENT[0]}"/><stop offset=".5" stop-color="${ACCENT[2]}"/><stop offset="1" stop-color="${ACCENT[3]}"/></linearGradient>
<linearGradient id="flame" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="${FLAME[2]}"/><stop offset=".55" stop-color="${FLAME[1]}"/><stop offset="1" stop-color="${FLAME[0]}"/></linearGradient>`;
  const css = `.ringfill{animation:ring 1.5s cubic-bezier(.55,.05,.25,1) .35s both}
@keyframes ring{from{stroke-dasharray:0 100}to{stroke-dasharray:${r2(pct)} 100}}
.flame{transform-box:fill-box;transform-origin:50% 100%;animation:flicker 2.8s ease-in-out infinite}
@keyframes flicker{0%,100%{transform:scale(1,1) skewX(0deg)}30%{transform:scale(.97,1.05) skewX(-1.5deg)}60%{transform:scale(1.02,.97) skewX(1deg)}}`;
  const desc = `Contribution streaks for ${model.login}: current streak ${current.length} ${current.length === 1 ? 'day' : 'days'}${alive ? ` (${rangeText(current, last)})` : ''}, longest streak ${longest.length} ${longest.length === 1 ? 'day' : 'days'}${longest.length ? ` (${rangeText(longest, last)})` : ''}, ${formatInt(total)} contributions in the last 12 months.`;
  return svgDoc({ w: W, h: H, t, fonts, title: 'Contribution streak', desc, defs, css, body });
}

/* ------------------------------------------------------------------ isometric activity card */

const LEVELS = 12;

export function renderActivity(model, t, fonts) {
  const W = 1000;
  const H = 360;
  const nW = Math.max(1, model.weekCount);
  const PHI = (17 * Math.PI) / 180;
  const EL = (35 * Math.PI) / 180;
  const S = 15.6;
  const wv = [S * Math.cos(PHI), S * Math.sin(PHI) * Math.sin(EL)];
  const dv = [-S * Math.sin(PHI), S * Math.cos(PHI) * Math.sin(EL)];
  const HMAX = 54;
  const HMIN = 4;
  const M = 0.6; // floor margin in cells
  const SLAB = 7;

  // centre the floor horizontally; the back-left corner sits just under the header
  const minX = -M * wv[0] + (7 + M) * dv[0];
  const maxX = (nW + M) * wv[0] - M * dv[0];
  const ox = (W - (maxX - minX)) / 2 - minX + 6;
  const oy = 130;
  const P = (w, d, h = 0) => [ox + w * wv[0] + d * dv[0], oy + w * wv[1] + d * dv[1] - h];
  const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

  const thetaW = (Math.atan2(wv[1], wv[0]) * 180) / Math.PI;
  const thetaD = (Math.atan2(dv[1], dv[0]) * 180) / Math.PI;

  // heights: robust reference (95th percentile of active days) so one outlier does not flatten the city
  const active = model.days.filter((d) => d.count > 0).map((d) => d.count).sort((a, b) => a - b);
  const ref = active.length ? Math.max(1, active[Math.min(active.length - 1, Math.floor(active.length * 0.95))]) : 1;
  const level = (count) => (count > 0 ? Math.pow(Math.min(1, count / ref), 0.8) : 0);

  // colour ramp
  const shades = [];
  for (let k = 0; k < LEVELS; k += 1) {
    const base = gradientAt(ACCENT, k / (LEVELS - 1));
    shades.push({ top: mix(base, '#ffffff', t.topLift), right: mix(base, t.shade, t.shadeRight), front: mix(base, t.shade, t.shadeFront) });
  }
  let css = shades.map((s, k) => `.t${k}{fill:${s.top}}.r${k}{fill:${s.right}}.f${k}{fill:${s.front}}`).join('');

  const g = 0.1; // gap inside each cell
  const floorLayer = [];
  const reflections = [];
  const prisms = [];
  let todayInfo = null;
  let peakInfo = null;
  const tilePath = (w, d, h) => {
    const a = P(w + g, d + 1 - g, h);
    const b = P(w + 1 - g, d + 1 - g, h);
    const c = P(w + 1 - g, d + g, h);
    const e = P(w + g, d + g, h);
    return `M${pt(a)}L${pt(b)}L${pt(c)}L${pt(e)}Z`;
  };

  for (const day of model.days) {
    const { w, d, count } = day;
    if (count <= 0) {
      floorLayer.push(tilePath(w, d, 0));
    } else {
      const lv = level(count);
      const k = Math.round(lv * (LEVELS - 1));
      const h = HMIN + (HMAX - HMIN) * lv;
      const A = P(w + g, d + 1 - g);
      const B = P(w + 1 - g, d + 1 - g);
      const C = P(w + 1 - g, d + g);
      const ab = [B[0] - A[0], B[1] - A[1]];
      const bc = [C[0] - B[0], C[1] - B[1]];
      const delay = 0.25 + w * 0.026 + d * 0.03;
      const style = `transform-origin:${r1(B[0])}px ${r1(B[1])}px;--h:${r1(h)}px;animation-delay:${r2(delay)}s`;
      prisms.push(
        `<g style="${style}"><path class="pf f${k}" d="M${pt(A)}l${r2(ab[0])} ${r2(ab[1])}v${r1(-h)}l${r2(-ab[0])} ${r2(-ab[1])}z"/><path class="pf r${k} rr" d="M${pt(B)}l${r2(bc[0])} ${r2(bc[1])}v${r1(-h)}l${r2(-bc[0])} ${r2(-bc[1])}z"/><path class="pt t${k}" d="${tilePath(w, d, h)}"/></g>`,
      );
      reflections.push(
        `<g style="${style}"><path class="pf" fill="url(#rf${k})" d="M${pt(A)}l${r2(ab[0])} ${r2(ab[1])}v${r1(h * 0.8)}l${r2(-ab[0])} ${r2(-ab[1])}z"/><path class="pf rr" fill="url(#rr${k})" d="M${pt(B)}l${r2(bc[0])} ${r2(bc[1])}v${r1(h * 0.8)}l${r2(-bc[0])} ${r2(-bc[1])}z"/></g>`,
      );
      if (!peakInfo || count > peakInfo.count || (count === peakInfo.count && day.date > peakInfo.date)) {
        peakInfo = { ...day, top: P(w + 0.5, d + 0.5, h), h };
      }
    }
    if (day.date === model.today) {
      const lv = level(count);
      const h = count > 0 ? HMIN + (HMAX - HMIN) * lv : 0;
      todayInfo = { ...day, top: P(w + 0.5, d + 0.5, h), h };
    }
  }

  // floor slab
  const f00 = P(-M, -M);
  const f10 = P(nW + M, -M);
  const f11 = P(nW + M, 7 + M);
  const f01 = P(-M, 7 + M);
  const floorPoly = `M${pt(f00)}L${pt(f10)}L${pt(f11)}L${pt(f01)}Z`;
  const slabFront = `M${pt(f01)}L${pt(f11)}l0 ${SLAB}L${r1(f01[0])} ${r1(f01[1] + SLAB)}Z`;
  const slabRight = `M${pt(f11)}L${pt(f10)}l0 ${SLAB}L${r1(f11[0])} ${r1(f11[1] + SLAB)}Z`;
  const shadowPoly = `M${r1(f00[0] + 10)} ${r1(f00[1] + 26)}L${r1(f10[0] + 10)} ${r1(f10[1] + 26)}L${r1(f11[0] + 6)} ${r1(f11[1] + 30)}L${r1(f01[0] + 6)} ${r1(f01[1] + 30)}Z`;

  // month labels painted along the front edge of the slab
  let months = '';
  let lastLabel = -9;
  model.weekStarts.forEach((ws, i) => {
    if (i === 0 || i > nW - 2) return;
    const month = new Date(parseDay(ws)).getUTCMonth();
    if (month === new Date(parseDay(model.weekStarts[i - 1])).getUTCMonth() || i - lastLabel < 3) return;
    lastLabel = i;
    const p = P(i + 0.1, 7 + M);
    months += `<text transform="translate(${r1(p[0])} ${r1(p[1] + SLAB + 13)}) skewY(${r2(thetaW)})" class="lbl" font-size="11">${MONTHS[month]}</text>`;
  });

  // reflection gradients (fade from the base downward)
  let defs = shades
    .map(
      (s, k) =>
        `<linearGradient id="rf${k}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.front}" stop-opacity="${t.reflect}"/><stop offset="1" stop-color="${s.front}" stop-opacity="0"/></linearGradient><linearGradient id="rr${k}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.right}" stop-opacity="${t.reflect}"/><stop offset="1" stop-color="${s.right}" stop-opacity="0"/></linearGradient>`,
    )
    .join('\n');
  defs += `
<clipPath id="floorClip"><path d="${floorPoly}"/></clipPath>
<linearGradient id="floorTop" gradientUnits="userSpaceOnUse" x1="${r1(f00[0])}" y1="${r1(f00[1])}" x2="${r1(f11[0])}" y2="${r1(f11[1])}"><stop offset="0" stop-color="${t.floorTop[0]}"/><stop offset="1" stop-color="${t.floorTop[1]}"/></linearGradient>
<linearGradient id="slabEdge" gradientUnits="userSpaceOnUse" x1="${r1(f01[0])}" y1="0" x2="${r1(f11[0])}" y2="0"><stop offset="0" stop-color="${ACCENT[0]}"/><stop offset=".4" stop-color="${ACCENT[1]}"/><stop offset=".75" stop-color="${ACCENT[2]}"/><stop offset="1" stop-color="${ACCENT[3]}"/></linearGradient>
<filter id="blur18" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;

  css += `
.pf{transform-origin:inherit;animation:rise .95s cubic-bezier(.25,1.2,.45,1) both;animation-delay:inherit}
.rr{animation-name:riseR}
.pt{animation:lift .95s cubic-bezier(.25,1.2,.45,1) both;animation-delay:inherit${t.id === 'dark' ? `;stroke:${t.topEdge};stroke-width:.5` : ''}}
@keyframes rise{from{transform:skewY(${r2(thetaW)}deg) scaleY(0) skewY(${r2(-thetaW)}deg)}to{transform:skewY(${r2(thetaW)}deg) scaleY(1) skewY(${r2(-thetaW)}deg)}}
@keyframes riseR{from{transform:skewY(${r2(thetaD)}deg) scaleY(0) skewY(${r2(-thetaD)}deg)}to{transform:skewY(${r2(thetaD)}deg) scaleY(1) skewY(${r2(-thetaD)}deg)}}
@keyframes lift{from{transform:translateY(var(--h))}to{transform:translateY(0)}}
.beacon{animation:fadeIn .6s ease-out 2.2s both}`;

  // header + side information
  const T = model.totals;
  let body = cardHeader(t, W, 'Contribution skyline', '');
  body += `
<text x="${W - 28}" y="46" class="num tnum" font-size="30" text-anchor="end">${formatInt(T.contributions)}</text>
<text x="${W - 28}" y="66" class="lbl" text-anchor="end">contributions in the last year</text>`;

  // legend: tiny prisms
  const legendX = W - 28 - 5 * 16 - 30;
  const ly0 = 100;
  let legend = `<text x="${legendX - 8}" y="${ly0 - 2}" class="lbl" font-size="11" text-anchor="end">Less</text>`;
  for (let i = 0; i < 5; i += 1) {
    const k = Math.round((i / 4) * (LEVELS - 1));
    const hx = legendX + i * 16;
    const hh = 4 + i * 3.4;
    const s = shades[k];
    legend += `<path d="M${hx} ${ly0}l5.5 2.4v-${r1(hh)}l-5.5-2.4z" fill="${s.front}"/><path d="M${hx + 5.5} ${ly0 + 2.4}l5.5-2.4v-${r1(hh)}l-5.5 2.4z" fill="${s.right}"/><path d="M${hx} ${r1(ly0 - hh)}l5.5 2.4 5.5-2.4-5.5-2.4z" fill="${s.top}"/>`;
  }
  legend += `<text x="${legendX + 5 * 16 + 4}" y="${ly0 - 2}" class="lbl" font-size="11">More</text>`;
  body += `<g class="fade" style="animation-delay:.4s">${legend}</g>`;

  body += `
<path d="${shadowPoly}" fill="${t.id === 'dark' ? '#000' : t.shade}" opacity="${t.dropShadow}" filter="url(#blur18)"/>
<path d="${slabFront}" fill="${t.floorSide}"/>
<path d="${slabFront}" fill="url(#slabEdge)" opacity="${t.id === 'dark' ? 0.55 : 0.75}"/>
<path d="${slabRight}" fill="${t.floorSide}"/>
<path d="${slabRight}" fill="${ACCENT[3]}" opacity="${t.id === 'dark' ? 0.3 : 0.45}"/>
<path d="${floorPoly}" fill="url(#floorTop)" stroke="${t.border}"/>
<path d="${floorLayer.join('')}" fill="${t.empty}"/>
<g clip-path="url(#floorClip)">${reflections.join('')}</g>
<path d="M${pt(f01)}L${pt(f11)}" stroke="#fff" stroke-width="5" stroke-linecap="round" pathLength="1" class="runner" filter="url(#blur3)"/>
<path d="M${pt(f01)}L${pt(f11)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" pathLength="1" class="runner"/>
${prisms.join('\n')}
${months}`;
  css += `
.runner{stroke-dasharray:.05 2;stroke-dashoffset:.05;opacity:0;animation:run 9s cubic-bezier(.45,.05,.55,.95) 3s infinite}
@keyframes run{0%{stroke-dashoffset:.05;opacity:0}6%{opacity:.6}52%{opacity:.6}58%,100%{stroke-dashoffset:-1;opacity:0}}`;

  // mini stats in the open space bottom-left
  const best = model.bestDay;
  const stats = [
    { value: best ? formatInt(best.count) : '0', label: best ? `Best day · ${fmtDay(best.date)}` : 'Best day' },
    { value: formatInt(model.activeDays), label: 'Active days' },
    { value: model.busiestWeekday == null ? '—' : WEEKDAYS[model.busiestWeekday].slice(0, 3), label: 'Busiest weekday' },
  ];
  let mini = '';
  stats.forEach((s, i) => {
    const x = 28 + i * 112;
    mini += `<text x="${x}" y="314" class="num tnum" font-size="22">${escapeXml(s.value)}</text><text x="${x}" y="334" class="lbl" font-size="11.5">${escapeXml(s.label)}</text>`;
  });
  body += `<g class="fade" style="animation-delay:.6s">${mini}</g>`;

  // today beacon and best-day marker
  if (todayInfo) {
    const [bx, by] = todayInfo.top;
    const yTop = by - 30;
    const todayW = textWidth(`Today · ${formatInt(todayInfo.count)}`, 11) + 20;
    body += `
<g class="beacon">
<path d="M${r1(bx)} ${r1(by - 2)}V${r1(yTop + 4)}" stroke="url(#beam)" stroke-width="1.5"/>
<circle cx="${r1(bx)}" cy="${r1(yTop)}" r="4" fill="${t.success}" class="live" style="animation-delay:2.6s"/>
<circle cx="${r1(bx)}" cy="${r1(yTop)}" r="4" fill="${t.success}" stroke="${t.bg}" stroke-width="1.5"/>
<rect x="${r1(bx - 12 - todayW)}" y="${r1(yTop - 10)}" width="${r1(todayW)}" height="20" rx="10" fill="${t.surface}" stroke="${t.border}"/>
<text x="${r1(bx - 12 - todayW / 2)}" y="${r1(yTop + 4)}" class="lbl" font-size="11" text-anchor="middle"><tspan class="txt">Today</tspan> · ${formatInt(todayInfo.count)}</text>
</g>`;
    defs += `<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(by)}" x2="0" y2="${r1(yTop)}"><stop offset="0" stop-color="${t.success}" stop-opacity="0"/><stop offset="1" stop-color="${t.success}"/></linearGradient>`;
  }
  if (peakInfo && (!todayInfo || peakInfo.date !== todayInfo.date)) {
    const [px, py] = peakInfo.top;
    const label = `${formatInt(peakInfo.count)} on ${fmtDay(peakInfo.date)}`;
    const lw = textWidth(label, 11) + 18;
    const ly = Math.max(74, py - 34);
    body += `
<g class="beacon" style="animation-delay:2.4s">
<path d="M${r1(px)} ${r1(py - 3)}V${r1(ly + 10)}" stroke="${t.muted}" stroke-opacity=".55" stroke-dasharray="2 2"/>
<circle cx="${r1(px)}" cy="${r1(py - 1.5)}" r="2" fill="${t.text}"/>
<rect x="${r1(px - lw / 2)}" y="${r1(ly - 9)}" width="${r1(lw)}" height="20" rx="10" fill="${t.surface}" stroke="${t.border}"/>
<text x="${r1(px)}" y="${r1(ly + 5)}" class="lbl" font-size="11" text-anchor="middle">${escapeXml(label)}</text>
</g>`;
  }

  if (!active.length) {
    const msg = 'No contributions yet: the skyline grows with every commit';
    const mw = textWidth(msg, 12.5) + 32;
    const c = P(nW / 2, 3.5);
    body += `<g class="fade" style="animation-delay:.5s"><rect x="${r1(c[0] - mw / 2)}" y="${r1(c[1] - 15)}" width="${r1(mw)}" height="30" rx="15" fill="${t.surface}" stroke="${t.border}"/><text x="${r1(c[0])}" y="${r1(c[1] + 4.5)}" class="lbl" font-size="12.5" text-anchor="middle">${msg}</text></g>`;
  }

  const desc = `Isometric chart of ${model.login}'s daily GitHub contributions over the last 52 weeks: ${formatInt(T.contributions)} contributions on ${formatInt(model.activeDays)} active days${best ? `, best day ${formatInt(best.count)} on ${fmtDay(best.date, true)}` : ''}.`;
  return svgDoc({ w: W, h: H, t, fonts, title: 'Contribution skyline', desc, defs, css, body });
}

/* ------------------------------------------------------------------ output */

/** Render every card for both themes. Returns { filename: svg }. */
export function renderAll(model, { fonts = null } = {}) {
  const out = {};
  for (const t of [THEMES.dark, THEMES.light]) {
    out[`stats-${t.id}.svg`] = renderStats(model, t, fonts);
    out[`languages-${t.id}.svg`] = renderLanguages(model, t, fonts);
    out[`streak-${t.id}.svg`] = renderStreak(model, t, fonts);
    out[`activity-${t.id}.svg`] = renderActivity(model, t, fonts);
  }
  return out;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        sample: { type: 'boolean', default: false },
        out: { type: 'string', default: 'dist' },
        login: { type: 'string' },
        'no-font': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    }));
  } catch (err) {
    throw new CardsError(`${err.message}. Usage: node scripts/cards.mjs [--sample] [--out dir] [--login name]`);
  }
  if (args.help) {
    console.log('Usage: node scripts/cards.mjs [--sample] [--out dir] [--login name] [--no-font]');
    return;
  }

  let raw;
  if (args.sample) {
    raw = sampleRaw();
  } else {
    const login = (args.login || env.GITHUB_REPOSITORY_OWNER || DEFAULT_LOGIN).trim();
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login)) throw new CardsError(`"${login}" is not a valid GitHub login.`);
    const token = (env.GITHUB_TOKEN || env.GH_TOKEN || '').trim();
    if (!token) throw new CardsError('GITHUB_TOKEN is not set. Set it to a GitHub token, or run with --sample to render from built-in fixture data.');
    console.log(`Fetching GitHub data for ${login}...`);
    raw = await fetchRaw(login, token);
  }

  const model = buildModel(raw);
  const fonts = args['no-font'] ? null : loadFonts();
  if (!fonts && !args['no-font']) console.warn('Note: scripts/fonts/*.woff2 not found; cards will use the fallback font stack.');
  const files = renderAll(model, { fonts });
  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    await writeFile(path.join(outDir, name), svg, 'utf8');
    console.log(`  wrote ${path.join(args.out, name)} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`);
  }
  console.log(
    `Done: ${formatInt(model.totals.contributions)} contributions, streak ${model.streaks.current.length}/${model.streaks.longest.length} days, ${model.languages.items.length} language slices.`,
  );
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    const message = err instanceof CardsError ? err.message : `unexpected error: ${err?.stack || err}`;
    console.error(`cards: ${redact(message, token)}`);
    process.exit(1);
  });
}
