// check.mjs の振る舞い: 導入済みなら無言、ずれや未導入なら 1 行で理由を出す。常に exit 0
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, makeHome, install, check } from './helpers.mjs';
import { CHECK_STATE_NAME } from '../lib.mjs';

const homes = [];
const fresh = () => { const h = makeHome(); homes.push(h); return h; };
after(() => homes.forEach((h) => h.cleanup()));

test('未導入の HOME: ルールが未導入と出て、git pull と install.mjs を提案する', () => {
  const h = fresh();
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^\[loop_engineer_copilot_public\] 開発ルールが古い可能性があります/);
  assert.match(r.stdout, /ルールが未導入/);
  assert.match(r.stdout, /git pull と node setup\/install\.mjs を実行しますか/);
  assert.ok(r.stdout.includes(ROOT), '提案に clone のパスが入る');
  assert.equal(r.stdout.trim().split('\n').length, 1, '出力は 1 行');
});

test('導入直後: 何も出さない', () => {
  const h = fresh();
  install(h);
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});

test('配置済みブロックの hash が違う: 正本と異なると出て、配置済みと正本の版番号を添える', () => {
  const h = fresh();
  install(h);
  h.writeRules(h.readRules().replace(/hash=[0-9a-f]+ version=[0-9.]+/, 'hash=000000000000 version=0.9.0'));
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ルールが正本と異なる/);
  assert.match(r.stdout, /配置済み v0\.9\.0 → 正本 v\d+\.\d+\.\d+/);
});

test('ブロックが手で消された（ファイルは残る）: 未導入と出る', () => {
  const h = fresh();
  install(h);
  h.writeRules("---\napplyTo: '**'\n---\n# ブロックを消した\n");
  const r = check(h);
  assert.match(r.stdout, /ルールが未導入/);
});

test('別の参照先で導入した: hash が参照先を含むので異なると出る', () => {
  const h = fresh();
  install(h, '--dir', 'D:\\other\\clone');
  const r = check(h);
  assert.match(r.stdout, /ルールが正本と異なる/);
});

test('状態ファイル: --no-git では git の記録を書かず、既にあっても壊さない', () => {
  const h = fresh();
  install(h);
  h.write(CHECK_STATE_NAME, JSON.stringify({ lastFetch: 1 }));
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.deepEqual(h.json(CHECK_STATE_NAME), { lastFetch: 1 });
});

test('旧版（loop_engineer_copilot.instructions.md）が残っている: 導入済み・最新でも、旧版のフルパスを添えた 1 行を出す（exit 0）', () => {
  const h = fresh();
  install(h);
  h.writeLegacy();
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 1, '最新なら「古い」の行は出ず、旧版の 1 行だけ');
  assert.ok(lines[0].startsWith(`[loop_engineer_copilot_public] 旧版の指示ファイル（${h.legacyPath}）が残っています。`), lines[0]);
  assert.ok(lines[0].endsWith('両方読まれて矛盾します。旧版の clone で node setup/uninstall.mjs を実行してください'), lines[0]);
});

test('旧版が残っていて、ルールも古い: 「古い」の行と旧版の行の両方が出る（exit 0）', () => {
  const h = fresh();
  h.writeLegacy();
  const r = check(h);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('開発ルールが古い可能性があります'));
  assert.ok(lines[1].includes('旧版の指示ファイル'));
});
