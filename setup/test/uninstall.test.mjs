// uninstall.mjs の振る舞い: 導入で置いたものだけを除き、他の内容は残す
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, makeHome, install, check, uninstall } from './helpers.mjs';
import { MANIFEST_NAME, CHECK_STATE_NAME } from '../lib.mjs';

const homes = [];
const fresh = () => { const h = makeHome(); homes.push(h); return h; };
after(() => homes.forEach((h) => h.cleanup()));

test('新規 HOME に導入して除く: 配置先と記録が消え、frontmatter だけのファイルは残さない', () => {
  const h = fresh();
  install(h);
  assert.ok(h.exists(MANIFEST_NAME), '導入の記録がある');

  const r = uninstall(h);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!h.existsRules(), 'ブロックしか無かった配置先は消える');
  assert.ok(!h.exists(MANIFEST_NAME));
  assert.match(r.stdout, /ルールブロックしか無いので削除/);
  assert.equal(h.backups().length, 1, '消す前に .bak を残す');

  // check.mjs から見ると未導入
  assert.match(check(h).stdout, /ルールが未導入/);
});

test('既存の内容がある配置先: ブロックだけ除き、他の内容は残る', () => {
  const h = fresh();
  const own = "---\nname: 'mine'\napplyTo: '**'\n---\n\n# 自分のルール\n\n- コミットは日本語で書く\n";
  h.writeRules(own);
  install(h);

  const r = uninstall(h);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(h.readRules(), own, '配置先は元の内容だけになる');
  assert.ok(!h.exists(MANIFEST_NAME));
  assert.match(r.stdout, /ルールブロックを除く（他の内容は残す）/);
  assert.equal(h.backups().length, 2, '導入時と除去時の .bak が残る');
});

test('--dry-run: 報告だけで何も消さない', () => {
  const h = fresh();
  install(h);
  const r = uninstall(h, '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry-run/);
  assert.ok(h.existsRules());
  assert.ok(h.exists(MANIFEST_NAME));
});

test('導入していない HOME: 変更なしで終わる', () => {
  const h = fresh();
  const r = uninstall(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /変更なし/);
});

test('除いたあと再導入できる（往復で配置先は最初と同じ内容になる）', () => {
  const h = fresh();
  install(h);
  const afterFirst = h.readRules();
  uninstall(h);
  install(h);
  assert.equal(h.readRules(), afterFirst);
  assert.equal(check(h).stdout, '');
});

test('check.mjs の状態ファイルも消える', () => {
  const h = fresh();
  install(h);
  h.write(CHECK_STATE_NAME, JSON.stringify({ lastFetch: 1 }));
  uninstall(h);
  assert.ok(!h.exists(CHECK_STATE_NAME));
});

test('知らない引数（--help を含む）: 使い方を出して終了し、導入したものを除かない', () => {
  const h = fresh();
  install(h);
  const before = h.readRules();
  const r1 = uninstall(h, '--help');
  assert.equal(r1.status, 0, '--help は正常終了');
  assert.match(r1.stderr, /使い方:/);
  const r2 = uninstall(h, '--bogus');
  assert.equal(r2.status, 2, '知らない引数は失敗で終了');
  assert.match(r2.stderr, /知らない引数: --bogus/);
  assert.equal(h.readRules(), before, '何も除かれない');
  assert.ok(h.exists(MANIFEST_NAME), '導入の記録も残る');
});

test('旧版の指示ファイルは触らない（この clone が配置したものだけを除く）', () => {
  const h = fresh();
  install(h);
  h.writeLegacy('旧版のルール\n');
  const r = uninstall(h);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!h.existsRules());
  assert.equal(readFileSync(h.legacyPath, 'utf8'), '旧版のルール\n');
});
