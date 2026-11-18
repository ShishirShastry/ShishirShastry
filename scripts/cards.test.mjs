// Run: node --test scripts/cards.test.mjs
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CardsError,
  buildModel,
  computeStreaks,
  escapeXml,
  fetchRaw,
  foldLanguages,
  formatInt,
  formatNumber,
  main,
  renderAll,
  sampleRaw,
} from './cards.mjs';

/** Consecutive days starting at `start` with the given counts. */
function days(start, counts) {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return counts.map((count, i) => ({ date: new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), count }));
}

/** Minimal XML well-formedness check: balanced tags, quoted attributes, escaped & and <. */
function assertWellFormed(xml, label) {
  const stack = [];
  const token = /<!--[\s\S]*?-->|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>|<|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g;
  let m;
  while ((m = token.exec(xml))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const open = stack.pop();
      assert.equal(m[1], open, `${label}: </${m[1]}> closes <${open}> at ${m.index}`);
    } else if (m[2]) {
      if (!m[4]) stack.push(m[2]);
    } else {
      assert.fail(`${label}: unescaped "${m[0]}" at ${m.index}: ${xml.slice(Math.max(0, m.index - 40), m.index + 40)}`);
    }
  }
  assert.deepEqual(stack, [], `${label}: unclosed tags ${stack.join(', ')}`);
}

describe('computeStreaks', () => {
  test('a gap breaks the streak; longest keeps the most recent run on ties', () => {
    const s = computeStreaks(days('2026-01-01', [2, 1, 0, 3, 1, 4]));
    assert.deepEqual(s.current, { length: 3, start: '2026-01-04', end: '2026-01-06' });
    assert.deepEqual(s.longest, { length: 3, start: '2026-01-04', end: '2026-01-06' });
    assert.equal(s.total, 11);
    assert.equal(s.activeDays, 5);
  });

  test('longest streak can be older than the current one', () => {
    const s = computeStreaks(days('2026-03-01', [1, 1, 1, 1, 0, 0, 5, 5]));
    assert.deepEqual(s.longest, { length: 4, start: '2026-03-01', end: '2026-03-04' });
    assert.equal(s.current.length, 2);
  });

  test('today counts when it has contributions', () => {
    const s = computeStreaks(days('2026-11-15', [1, 1, 1, 2]));
    assert.deepEqual(s.current, { length: 4, start: '2026-11-15', end: '2026-11-18' });
  });

  test('a streak ending yesterday is still current when today is empty', () => {
    const s = computeStreaks(days('2026-11-15', [1, 1, 1, 0]));
    assert.deepEqual(s.current, { length: 3, start: '2026-11-15', end: '2026-11-17' });
  });

  test('no contributions today or yesterday means no current streak', () => {
    const s = computeStreaks(days('2026-11-14', [3, 1, 1, 0, 0]));
    assert.equal(s.current.length, 0);
    assert.equal(s.current.start, null);
    assert.equal(s.longest.length, 3);
  });

  test('an explicit today after the last calendar day counts the missing days as empty', () => {
    const s = computeStreaks(days('2026-11-10', [1, 1, 1]), { today: '2026-11-14' });
    assert.equal(s.current.length, 0);
    assert.equal(s.lastDate, '2026-11-14');
    const y = computeStreaks(days('2026-11-10', [1, 1, 1]), { today: '2026-11-13' });
    assert.equal(y.current.length, 3);
  });

  test('missing dates inside the range are treated as zero days', () => {
    const list = days('2026-05-01', [1, 1, 1, 1]);
    list.splice(1, 1); // drop May 2
    const s = computeStreaks(list);
    assert.equal(s.longest.length, 2);
    assert.equal(s.current.length, 2);
  });

  test('empty and all-zero calendars', () => {
    const e = computeStreaks([]);
    assert.deepEqual(e.current, { length: 0, start: null, end: null });
    assert.deepEqual(e.longest, { length: 0, start: null, end: null });
    assert.equal(e.total, 0);
    const z = computeStreaks(days('2026-01-01', Array(30).fill(0)));
    assert.equal(z.current.length, 0);
    assert.equal(z.longest.length, 0);
    assert.equal(computeStreaks(undefined).total, 0);
  });
});

describe('foldLanguages', () => {
  test('aggregates by name, keeps the top six and folds the rest into Other', () => {
    const entries = [
      { name: 'TypeScript', color: '#3178c6', bytes: 500 },
      { name: 'JavaScript', color: '#f1e05a', bytes: 200 },
      { name: 'JavaScript', color: '#f1e05a', bytes: 200 },
      { name: 'Python', color: '#3572A5', bytes: 300 },
      { name: 'HTML', color: '#e34c26', bytes: 100 },
      { name: 'CSS', color: '#663399', bytes: 90 },
      { name: 'C', color: '#555555', bytes: 80 },
      { name: 'Shell', color: '#89e051', bytes: 20 },
      { name: 'Dockerfile', color: '#384d54', bytes: 10 },
    ];
    const { items, total, count } = foldLanguages(entries);
    assert.equal(total, 1500);
    assert.equal(count, 8);
    assert.deepEqual(items.map((i) => i.name), ['TypeScript', 'JavaScript', 'Python', 'HTML', 'CSS', 'C', 'Other']);
    assert.equal(items[1].bytes, 400);
    assert.equal(items[6].bytes, 30);
    assert.equal(items[6].other, true);
    assert.equal(items[6].folded, 2);
    assert.equal(Math.round(items.reduce((s, i) => s + i.percent * 10, 0)), 1000);
  });

  test('percentages always sum to exactly 100 (one decimal)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 300; run += 1) {
      const n = 1 + Math.floor(rand() * 14);
      const entries = Array.from({ length: n }, (_, i) => ({ name: `L${i}`, color: '#123456', bytes: 1 + Math.floor(rand() ** 3 * 1e6) }));
      const { items } = foldLanguages(entries);
      const tenths = items.reduce((s, i) => s + Math.round(i.percent * 10), 0);
      assert.equal(tenths, 1000, `run ${run}: ${items.map((i) => i.percent).join(' + ')}`);
      assert.ok(items.length <= 7);
      for (const i of items) assert.equal(Math.round(i.percent * 10), i.percent * 10);
    }
  });

  test('no Other slice when there are six languages or fewer', () => {
    const { items } = foldLanguages([
      { name: 'A', bytes: 1 },
      { name: 'B', bytes: 1 },
      { name: 'C', bytes: 1 },
    ]);
    assert.deepEqual(items.map((i) => i.name), ['A', 'B', 'C']);
    assert.deepEqual(items.map((i) => i.percent), [33.4, 33.3, 33.3]);
  });

  test('ignores empty entries and rejects colours that are not hex', () => {
    const { items } = foldLanguages([
      { name: 'Evil', color: 'red;stroke:url(x)', bytes: 10 },
      { name: '', bytes: 50 },
      { name: 'Zero', bytes: 0 },
      null,
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].color, null);
    assert.equal(items[0].percent, 100);
    assert.deepEqual(foldLanguages([]).items, []);
    assert.deepEqual(foldLanguages(undefined).items, []);
  });
});

describe('formatting', () => {
  test('formatNumber gives compact numbers', () => {
    const cases = [
      [0, '0'],
      [7, '7'],
      [999, '999'],
      [999.6, '1k'],
      [1000, '1k'],
      [1234, '1.2k'],
      [1250, '1.3k'],
      [12_345, '12.3k'],
      [99_960, '100k'],
      [123_456, '123k'],
      [999_950, '1M'],
      [1_234_567, '1.2M'],
      [-1500, '-1.5k'],
      [Number.NaN, '0'],
      [undefined, '0'],
    ];
    for (const [n, want] of cases) assert.equal(formatNumber(n), want, `formatNumber(${n})`);
  });

  test('formatInt adds thousands separators', () => {
    assert.equal(formatInt(0), '0');
    assert.equal(formatInt(999), '999');
    assert.equal(formatInt(1284), '1,284');
    assert.equal(formatInt(1_234_567), '1,234,567');
    assert.equal(formatInt(-4200), '-4,200');
  });

  test('escapeXml escapes markup characters and drops control characters', () => {
    assert.equal(escapeXml(`A&B <x> "q" 'y'`), 'A&amp;B &lt;x&gt; &quot;q&quot; &#39;y&#39;');
    assert.equal(escapeXml('ok\u0001\u0008'), 'ok');
    assert.equal(escapeXml(null), '');
  });
});

describe('rendering', () => {
  const files = renderAll(buildModel(sampleRaw()));

  test('renders all eight cards', () => {
    const names = ['stats', 'languages', 'streak', 'activity'].flatMap((n) => [`${n}-dark.svg`, `${n}-light.svg`]);
    assert.deepEqual(Object.keys(files).sort(), names.sort());
  });

  for (const [name, svg] of Object.entries(files)) {
    test(`${name} is a well-formed, self-contained, accessible SVG`, () => {
      assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(svg.trimEnd().endsWith('</svg>'));
      assert.match(svg, /viewBox="0 0 \d+ \d+"/);
      assert.match(svg, /<title id="title">[^<]+<\/title>/);
      assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
      assert.match(svg, /prefers-reduced-motion:reduce/);
      assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/);
      assert.doesNotMatch(svg, /<script|<foreignObject|javascript:/i);
      const urls = svg.match(/https?:\/\/[^\s"')]+/g) ?? [];
      assert.deepEqual([...new Set(urls)], ['http://www.w3.org/2000/svg']);
      assert.ok(Buffer.byteLength(svg) < 500 * 1024, `${name} is ${Buffer.byteLength(svg)} bytes`);
      assertWellFormed(svg, name);
    });
  }

  test('names with & < > are escaped and the SVG stays well-formed', () => {
    const raw = sampleRaw();
    raw.login = 'R&D <team>';
    raw.repos.languages = [
      { name: 'C++ & <Rust> "x"', color: '#f34b7d', bytes: 900 },
      { name: "Ren'Py", color: '#ff7f7f', bytes: 100 },
    ];
    const out = renderAll(buildModel(raw));
    for (const [name, svg] of Object.entries(out)) {
      assertWellFormed(svg, name);
      assert.ok(!svg.includes('<Rust>') && !svg.includes('<team>'), `${name} leaks raw markup`);
    }
    assert.ok(out['languages-dark.svg'].includes('C++ &amp; &lt;Rust&gt; &quot;x&quot;'));
    assert.ok(out['languages-dark.svg'].includes('Ren&#39;Py'));
    assert.ok(out['stats-light.svg'].includes('R&amp;D &lt;team&gt;'));
  });

  test('fixture output is deterministic and independent of the clock', () => {
    const again = renderAll(buildModel(sampleRaw()));
    assert.deepEqual(again, files);
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2031-02-03T04:05:06Z') });
    try {
      assert.deepEqual(renderAll(buildModel(sampleRaw())), files);
    } finally {
      mock.timers.reset();
    }
    assert.deepEqual(sampleRaw(), sampleRaw());
  });

  test('fixture model matches its hand-checked facts', () => {
    const m = buildModel(sampleRaw());
    assert.equal(m.weekCount, 53);
    assert.equal(m.today, '2026-11-18');
    assert.equal(m.streaks.current.end, '2026-11-18');
    assert.ok(m.streaks.current.length >= 12);
    assert.ok(m.streaks.longest.length >= m.streaks.current.length);
    assert.equal(m.languages.items.at(-1).name, 'Other');
    assert.equal(m.totals.contributions, m.streaks.total);
  });

  test('zero and missing data render without errors', () => {
    const raw = sampleRaw();
    raw.contributions = { commits: 0, pullRequests: 0, issues: 0, repositories: 0, total: 0, weeks: raw.contributions.weeks.map((w) => w.map((d) => ({ ...d, count: 0 }))) };
    raw.repos = { total: 0, stars: 0, languages: [] };
    for (const input of [raw, {}, { generatedAt: '2026-11-18T00:00:00Z' }, { contributions: { weeks: [[]] } }]) {
      const out = renderAll(buildModel(input));
      for (const [name, svg] of Object.entries(out)) {
        assertWellFormed(svg, name);
        assert.doesNotMatch(svg, /NaN|undefined|Infinity/, name);
      }
    }
    const m = buildModel({ generatedAt: '2026-11-18T00:00:00Z' });
    assert.equal(m.weekCount, 53, 'an empty calendar is synthesised so the skyline keeps its size');
    assert.equal(m.streaks.current.length, 0);
  });
});

describe('GitHub API client (fake fetch, no network)', () => {
  const TOKEN = 'ghs_' + 'x'.repeat(36);
  const calendar = { totalContributions: 3, weeks: [{ contributionDays: [{ date: '2026-11-17', contributionCount: 1 }, { date: '2026-11-18', contributionCount: 2 }] }] };
  const profile = {
    user: {
      login: 'ShishirShastry',
      createdAt: '2021-06-14T09:12:00Z',
      followers: { totalCount: 5 },
      contributionsCollection: {
        totalCommitContributions: 2,
        totalPullRequestContributions: 1,
        totalIssueContributions: 0,
        totalRepositoryContributions: 1,
        contributionCalendar: calendar,
      },
    },
  };
  const repoPage = (stars, langs, next) => ({
    user: {
      repositories: {
        totalCount: 3,
        pageInfo: { hasNextPage: Boolean(next), endCursor: next ?? null },
        nodes: [{ stargazerCount: stars, languages: { edges: langs.map(([name, size]) => ({ size, node: { name, color: '#123456' } })) } }],
      },
    },
  });
  const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  test('fetches the profile and every repository page', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ url, auth: init.headers.authorization, after: body.variables.after ?? null, query: body.query.split('(')[0] });
      if (body.query.startsWith('query Profile')) return respond(200, { data: profile });
      return respond(200, { data: body.variables.after ? repoPage(4, [['C', 50]], null) : repoPage(6, [['Python', 100], ['C', 25]], 'CUR1') });
    };
    const raw = await fetchRaw('ShishirShastry', TOKEN, { fetchImpl });
    assert.equal(seen.length, 3);
    assert.ok(seen.every((s) => s.url === 'https://api.github.com/graphql' && s.auth === `bearer ${TOKEN}`));
    assert.deepEqual(seen.map((s) => s.after), [null, null, 'CUR1']);
    assert.equal(raw.repos.stars, 10);
    assert.equal(raw.repos.total, 3);
    assert.equal(raw.contributions.total, 3);
    assert.deepEqual(raw.contributions.weeks, [[{ date: '2026-11-17', count: 1 }, { date: '2026-11-18', count: 2 }]]);
    const m = buildModel(raw);
    assert.deepEqual(m.languages.items.map((i) => [i.name, i.bytes]), [['Python', 100], ['C', 75]]);
    assert.equal(m.streaks.current.length, 2);
  });

  test('HTTP errors become a plain CardsError without the token', async () => {
    const fetchImpl = async () => respond(401, { message: `Bad credentials ${TOKEN}` });
    await assert.rejects(fetchRaw('ShishirShastry', TOKEN, { fetchImpl, attempts: 1 }), (err) => {
      assert.ok(err instanceof CardsError);
      assert.match(err.message, /HTTP 401/);
      assert.ok(!err.message.includes(TOKEN));
      return true;
    });
  });

  test('GraphQL errors, unknown users and network failures are reported clearly', async () => {
    await assert.rejects(
      fetchRaw('ShishirShastry', TOKEN, { fetchImpl: async () => respond(200, { errors: [{ message: 'Something went wrong' }] }), attempts: 1 }),
      /GitHub API returned an error: Something went wrong/,
    );
    await assert.rejects(fetchRaw('nobody-here', TOKEN, { fetchImpl: async () => respond(200, { data: { user: null } }), attempts: 1 }), /"nobody-here" was not found/);
    await assert.rejects(
      fetchRaw('ShishirShastry', TOKEN, {
        fetchImpl: async () => {
          throw new TypeError('fetch failed');
        },
        attempts: 1,
      }),
      /could not reach the GitHub API \(fetch failed\)/,
    );
  });

  test('retries a transient 5xx before succeeding', async () => {
    let calls = 0;
    const fetchImpl = async (url, init) => {
      calls += 1;
      if (calls === 1) return respond(502, { message: 'Bad gateway' });
      const body = JSON.parse(init.body);
      return respond(200, { data: body.query.startsWith('query Profile') ? profile : repoPage(1, [], null) });
    };
    const raw = await fetchRaw('ShishirShastry', TOKEN, { fetchImpl, attempts: 2 });
    assert.equal(raw.repos.stars, 1);
    assert.equal(calls, 3);
  });
});

describe('command line', () => {
  test('--sample writes all cards without network access', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cards-'));
    const log = mock.method(console, 'log', () => {});
    const fetchSpy = mock.method(globalThis, 'fetch', async () => {
      throw new Error('network used');
    });
    try {
      await main(['--sample', '--out', dir], {});
      const names = (await readdir(dir)).sort();
      assert.equal(names.length, 8);
      assert.equal(fetchSpy.mock.callCount(), 0);
      const svg = await readFile(path.join(dir, 'activity-dark.svg'), 'utf8');
      assert.match(svg, /font\/woff2;base64,/);
    } finally {
      log.mock.restore();
      fetchSpy.mock.restore();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('live mode without a token fails with a plain message', async () => {
    await assert.rejects(main(['--out', path.join(tmpdir(), 'never')], {}), (err) => err instanceof CardsError && /GITHUB_TOKEN is not set/.test(err.message));
  });

  test('rejects invalid logins and unknown options', async () => {
    await assert.rejects(main(['--login', 'bad name!'], { GITHUB_TOKEN: 'x' }), /not a valid GitHub login/);
    await assert.rejects(main(['--frobnicate'], {}), CardsError);
  });
});
