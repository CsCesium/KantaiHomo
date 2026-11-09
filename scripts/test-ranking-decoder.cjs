// node scripts/test-ranking-decoder.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');

function harness(memberId) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative + '.ts');
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { exports, require(spec) {
      if (spec === '../../state') return { getAdmiral: () => memberId ? { memberId } : null };
      if (spec === '../../utils/common') return {
        parseSvdata: raw => { try { return JSON.parse(raw.replace(/^svdata=/, '')); } catch (_) { return null; } },
        makeEventId: parts => parts.join(':'),
      };
      return load(path.relative(root, path.resolve(path.dirname(file), spec)));
    } }, { filename: file });
    return exports;
  }
  return load('features/parsers/module/ranking').parseRanking;
}

function dump(entries, endpoint = 'obfuscated') {
  return { type: 'API_DUMP', url: `https://game.example/kcsapi/api_req_ranking/${endpoint}`,
    requestBody: '', responseText: 'svdata=' + JSON.stringify({ api_result: 1, api_data: { api_list: entries } }) };
}
function row(rank, score, nickname = 'テスト提督') {
  return { api_mxltvkpyuklh: rank, api_mtjmdcwtvhdr: nickname, api_wuhnhojjxmke: score,
    api_pcumlrymlujh: 1, api_itslcqtmrxtf: 0 };
}

// Fixed vectors from the official main.js last modified 2026-10-30T08:47:27Z.
// SHA-256: 112ba72efcdc74272688169d32e68d6d43d2ff1d603761721d58f9f60d8bfa4f
// PORT_API_SEED: [5560,8863,7748,8399,9742,7258,3474,6103,7002,2282].
const VIEWER_SCORES = [821459980, 1314335968, 1150043972, 1239657788, 1448756692,
  1075365792, 507811624, 911073796, 1045494520, 328583992];

test('current encrypted ranking scores decode for all ten viewer account suffixes', () => {
  for (let suffix = 0; suffix < 10; suffix++) {
    const parse = harness(1000000 + suffix);
    const entry = { ...row(1, VIEWER_SCORES[suffix]), api_member_id: 9999999 };
    const events = parse(dump([entry]));
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'RANKING_SNAPSHOT');
    assert.equal(events[0].payload.entries[0].senka, 12345, `viewer suffix ${suffix}`);
    assert.equal(events[0].payload.entries[0].rank, 1);
    assert.equal(events[0].payload.entries[0].nickname, entry.api_mtjmdcwtvhdr);
  }
});

test('all thirteen ranking seed positions preserve low and zero scores', () => {
  const parse = harness(1000007);
  const scores = [6740012, 6557988, 29019774, 26477355, 27710592, 22360343,
    27307504, 34392105, 28175900, 30262832, 35272518, 41379838, 56658264];
  const events = parse(dump(scores.map((score, index) => row(index + 1, score))));
  assert.equal(events[0].payload.entries.length, 13);
  events[0].payload.entries.forEach((entry, index) => {
    assert.equal(entry.senka, index + 1, `rank ${index + 1}`);
  });
  // The official encoder's rank-1, viewer-suffix-7 representation of zero.
  assert.equal(parse(dump([row(1, 6666751)]))[0].payload.entries[0].senka, 0);
});

test('field-name fallback uses the updated viewer seed when a ranking endpoint changes', () => {
  const parse = harness(1000007);
  const events = parse(dump([{ api_new_rank: 500, api_new_name: '提督', api_new_comment: 'ランキングのコメント',
    api_new_class: 1, api_new_flag: 0, api_new_score: 2866734284 }], 'new_client_endpoint'));
  assert.equal(events[0].payload.entries[0].rank, 500);
  assert.equal(events[0].payload.entries[0].nickname, '提督');
  assert.equal(events[0].payload.entries[0].senka, 12345);
});

test('legacy unencrypted ranking responses keep their member id and score', () => {
  const events = harness(1000007)(dump([{ api_no: 500, api_nickname: '提督', api_rate: 5432,
    api_member_id: '1234567' }]));
  assert.equal(events[0].payload.entries[0].memberId, '1234567');
  assert.equal(events[0].payload.entries[0].senka, 5432);
});

test('unrelated endpoints and invalid responses do not emit ranking snapshots', () => {
  const parse = harness(1000007);
  assert.equal(parse({ ...dump([row(1, VIEWER_SCORES[7])]), url: '/api_port/port' }).length, 0);
  for (const responseText of ['', 'offline', '{}', '{"api_data":{"api_list":[]}}']) {
    assert.equal(parse({ ...dump([]), responseText }).length, 0);
  }
});
