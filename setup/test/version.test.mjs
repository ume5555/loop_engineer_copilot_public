// 開発ルールの版番号: 正本（setup/version.json）と変更履歴（setup/CHANGELOG.md）の整合、配置と表示
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, makeHome, install, check } from './helpers.mjs';
import { BEGIN_RE, loadTemplates, installedHash, installedVersion, sourceHash } from '../lib.mjs';

const homes = [];
const fresh = () => { const h = makeHome(); homes.push(h); return h; };
after(() => homes.forEach((h) => h.cleanup()));

const VERSION_JSON = JSON.parse(readFileSync(join(ROOT, 'setup', 'version.json'), 'utf8'));
const V = VERSION_JSON.version;

test('setup/version.json: 版番号が x.y.z の形になっている', () => {
  assert.match(V, /^\d+\.\d+\.\d+$/);
});

test('正本（copilot-instructions.user.md、rules/proposal.md、rules/proposal-docs-ci.md）を変えた → setup/version.json の版番号と hash を直していなければ FAIL', () => {
  const now = sourceHash();
  assert.match(now, /^[0-9a-f]{12}$/);
  assert.equal(VERSION_JSON.hash, now,
    `正本が変わっています。setup/version.json の version を上げ（振る舞いが変わるなら 2 桁目、文言だけなら 3 桁目）、hash を "${now}" に直し、setup/CHANGELOG.md に見出しと変更点を足してください`);
});

test('sourceHash: 参照先のパスと改行コードに依存しない', () => {
  assert.equal(sourceHash(), sourceHash());
  assert.equal(loadTemplates('D:/other/clone').sourceHash, loadTemplates(ROOT).sourceHash);
});

test('setup/CHANGELOG.md: いまの版の見出し（## <版番号> — <日付>）が先頭にあり、その下に変更点の箇条書きが 1 つ以上ある', () => {
  const log = readFileSync(join(ROOT, 'setup', 'CHANGELOG.md'), 'utf8').replaceAll('\r\n', '\n');
  const heads = [...log.matchAll(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/gm)];
  const i = heads.findIndex((m) => m[1] === V);
  assert.ok(i >= 0, `setup/CHANGELOG.md に「## ${V} — <YYYY-MM-DD>」の見出しがありません`);
  assert.equal(i, 0, 'いまの版の見出しが先頭（新しい版が上）にある');
  const start = heads[i].index + heads[i][0].length;
  const end = heads[i + 1]?.index ?? log.length;
  assert.match(log.slice(start, end), /^- \S/m, `「## ${V}」の下に変更点の箇条書きがありません`);
});

test('loadTemplates: 版番号を返し、本文のプレースホルダをすべて埋め、名乗りの形に版番号が入る', () => {
  const t = loadTemplates(ROOT);
  assert.equal(t.version, V);
  assert.ok(!t.body.includes('{{RULES_VERSION}}'), '版番号のプレースホルダが残っていない');
  assert.ok(!t.body.includes('{{LOOP_ENGINEER_COPILOT_DIR}}'), '参照先のプレースホルダが残っていない');
  assert.ok(t.body.includes(`（Copilot 開発ルール public v${V}）`), '名乗りの形に版番号が入っている');
  assert.ok(t.body.includes(`${ROOT.replaceAll('\\', '/')}/setup/check.mjs`), 'check.mjs を呼ぶ手順に clone のパスが入っている');
});

test('install: 目印ブロックに版番号が入り、名乗りの形が「指揮役: <自分のモデル名>（Copilot 開発ルール public v<版番号>）」になっている', () => {
  const h = fresh();
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  const md = h.readRules();
  assert.ok(md.includes(`<!-- loop_engineer_copilot_public:begin hash=${loadTemplates(ROOT).hash} version=${V} -->`));
  assert.ok(md.includes(`> 指揮役: <自分のモデル名>（Copilot 開発ルール public v${V}）`));
  assert.equal(installedVersion(h.rules), V);
  assert.equal(installedHash(h.rules), loadTemplates(ROOT).hash);
  assert.ok(md.match(BEGIN_RE));
});

test('install: 報告に「[install] Copilot 開発ルール public v<版番号>」の 1 行が出る（変更なしのときも）', () => {
  const h = fresh();
  assert.ok(install(h).stdout.includes(`[install] Copilot 開発ルール public v${V}\n`));
  const again = install(h);
  assert.match(again.stdout, /変更なし/);
  assert.ok(again.stdout.includes(`[install] Copilot 開発ルール public v${V}\n`));
});

test('check: 最新なら無言。ルールが正本と違うときは「配置済み v<x> → 正本 v<y>」を添える', () => {
  const h = fresh();
  install(h);
  assert.equal(check(h).stdout, '');
  h.writeRules(h.readRules().replace(/hash=[0-9a-f]+ version=[0-9.]+/, 'hash=000000000000 version=0.9.0'));
  const r = check(h);
  assert.ok(r.stdout.includes(`配置済み v0.9.0 → 正本 v${V}`), r.stdout);
});
