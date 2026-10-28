// install.mjs の振る舞い: 新規導入、既存内容の保持、冪等性、dry-run、--dir、.bak の上限、引数検査
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, makeHome, install } from './helpers.mjs';
import { BEGIN_RE, END_MARK, MANIFEST_NAME, BACKUP_KEEP, loadTemplates } from '../lib.mjs';

const homes = [];
const fresh = () => { const h = makeHome(); homes.push(h); return h; };
after(() => homes.forEach((h) => h.cleanup()));

const T = loadTemplates(ROOT);

test('新規 HOME: 配置先に frontmatter と目印ブロックが作られ、内容が正本と一致する', () => {
  const h = fresh();
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);

  const md = h.readRules();
  assert.ok(md.startsWith('---\n'), '先頭に frontmatter がある');
  assert.ok(md.includes("applyTo: '**'"), 'frontmatter の applyTo がすべてのファイルに効く');
  assert.match(md, BEGIN_RE);
  assert.equal(md.match(BEGIN_RE)[1], T.hash, 'hash は正本の hash');
  assert.ok(md.includes(END_MARK));
  assert.ok(md.includes(T.body.trimEnd()), 'ルール本文が入っている');
  assert.ok(!md.includes('{{LOOP_ENGINEER_COPILOT_DIR}}'), 'プレースホルダが残っていない');
  assert.ok(!md.includes('{{RULES_VERSION}}'), '版番号のプレースホルダが残っていない');
  assert.ok(md.includes(ROOT.replaceAll('\\', '/')), 'clone のパスが / 区切りで埋まっている');
  assert.ok(md.indexOf('---\n', 4) < md.search(BEGIN_RE), 'frontmatter の後ろにブロックがある');

  const m = h.json(MANIFEST_NAME);
  assert.equal(m.dir, ROOT, '導入の記録に参照先がある');
  assert.equal(m.version, T.version, '導入の記録に版番号がある');

  assert.match(r.stdout, /ルールブロックを配置/);
  assert.match(r.stdout, /\[install\] 参照先: /);
  assert.match(r.stdout, /\[install\] 配置先: /);
  assert.equal(h.backups().length, 0, '新規作成では .bak を作らない');
});

test('再実行: 変更なしと報告し、ファイルも .bak も変わらない', () => {
  const h = fresh();
  install(h);
  const before = h.readRules();
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /変更なし/);
  assert.equal(h.readRules(), before);
  assert.equal(h.backups().length, 0);
});

test('既存の配置先（ブロック無し）: 他の内容を残して末尾にブロックを追記し、.bak を残す', () => {
  const h = fresh();
  const own = "---\nname: 'mine'\napplyTo: '**'\n---\n\n# 自分のルール\n\n- コミットは日本語で書く\n";
  h.writeRules(own);

  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  const md = h.readRules();
  assert.ok(md.startsWith(own.trimEnd()), '既存内容が先頭に残る（frontmatter を二重に足さない）');
  assert.equal(md.match(/loop_engineer_copilot_public:begin/g).length, 1, 'ブロックは 1 つ');
  assert.equal(h.backups().length, 1, '.bak が 1 つ');
});

test('古いブロック: その場で置き換え、前後の内容と順序を保つ', () => {
  const h = fresh();
  const before = "---\napplyTo: '**'\n---\n\n# 前の内容\n";
  const afterText = '# 後の内容\n- ブロックの後ろに書いた行\n';
  h.writeRules(`${before}\n<!-- loop_engineer_copilot_public:begin hash=000000000000 version=0.0.1 -->\n古いルール本文\n${END_MARK}\n\n${afterText}`);

  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  const md = h.readRules();
  assert.equal(md.match(/loop_engineer_copilot_public:begin/g).length, 1, 'ブロックは増えない');
  assert.equal(md.match(BEGIN_RE)[1], T.hash, 'hash が正本に更新される');
  assert.ok(!md.includes('古いルール本文'));
  const b = md.indexOf('# 前の内容'), blk = md.search(BEGIN_RE), a = md.indexOf(afterText.trim());
  assert.ok(b >= 0 && b < blk && blk < a, '前 → ブロック → 後 の順序が保たれる');
  assert.ok(md.trimEnd().endsWith(afterText.trim()), 'ブロックの後ろの内容が末尾に残る');
  assert.match(r.stdout, /ルールブロックを配置/);
});

test('--dry-run: 変更内容を報告するが何も書かない', () => {
  const h = fresh();
  const r = install(h, '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry-run/);
  assert.match(r.stdout, /ルールブロックを配置/);
  assert.ok(!h.existsRules(), '配置先を作らない');
  assert.ok(!h.exists(MANIFEST_NAME), '記録も書かない');
});

test('--dir: 参照先のパスが本文に / 区切りで埋まり、hash が参照先に依存する', () => {
  const h = fresh();
  const dir = 'D:\\work\\loop_engineer_copilot_public';
  const r = install(h, '--dir', dir);
  assert.equal(r.status, 0, r.stderr);
  const md = h.readRules();
  assert.ok(md.includes('D:/work/loop_engineer_copilot_public'), 'Markdown は / 区切り');
  assert.ok(!md.includes(dir), '元の区切り（\\）のままでは入れない');
  assert.notEqual(md.match(BEGIN_RE)[1], T.hash);
  assert.equal(md.match(BEGIN_RE)[1], loadTemplates(dir).hash);
  assert.equal(h.json(MANIFEST_NAME).dir, dir, '記録の参照先は渡したまま');
});

test('記録と違う参照先で導入し直す: 切り替わりを旧 → 新で知らせる', () => {
  const h = fresh();
  install(h, '--dir', 'D:/old/clone');
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /参照先が D:\/old\/clone から .+ に切り替わります/);
  assert.equal(h.json(MANIFEST_NAME).dir, ROOT);
  const again = install(h);
  assert.doesNotMatch(again.stdout, /切り替わります/, '同じ参照先なら知らせない');
});

test('.bak は直近 3 個だけ残す（古いものは消す）', () => {
  const h = fresh();
  install(h);
  for (let i = 0; i < BACKUP_KEEP + 2; i++) {
    // ブロックを壊して再導入すると、毎回 .bak が 1 つできる（日時が同じにならないよう少し待つ）
    h.writeRules(h.readRules().replace(/hash=[0-9a-f]+/, 'hash=000000000000'));
    const r = install(h);
    assert.equal(r.status, 0, r.stderr);
    const until = Date.now() + 5;
    while (Date.now() < until) { /* 日時の刻みを進める */ }
  }
  assert.equal(h.backups().length, BACKUP_KEEP, `直近 ${BACKUP_KEEP} 個だけ残る`);
});

test('知らない引数（--help を含む）: 使い方を出して終了し、何も書かない', () => {
  const h = fresh();
  const r1 = install(h, '--help');
  assert.equal(r1.status, 0, '--help は正常終了');
  assert.match(r1.stderr, /使い方:/);
  assert.match(r1.stderr, /--dry-run/);
  const r2 = install(h, '--bogus');
  assert.equal(r2.status, 2, '知らない引数は失敗で終了');
  assert.match(r2.stderr, /知らない引数: --bogus/);
  const r3 = install(h, '--home');
  assert.equal(r3.status, 2, '値の無いオプションは失敗で終了');
  assert.ok(!h.existsRules(), '何も書かれない');
});

test('旧版（loop_engineer_copilot.instructions.md）が同じフォルダにある: 注意を 1 行出すが、消さず、exit 0 で配置は済む', () => {
  const h = fresh();
  h.writeLegacy('旧版のルール\n');
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  const warn = r.stdout.split('\n').filter((l) => l.startsWith('[install] 注意: 旧版 '));
  assert.equal(warn.length, 1, '注意は 1 行');
  assert.ok(warn[0].includes('旧版 loop_engineer_copilot.instructions.md が同じフォルダにあります。'), warn[0]);
  assert.ok(warn[0].includes('両方読まれて矛盾するので、旧版の clone で node setup/uninstall.mjs を実行して外してください'), warn[0]);
  assert.equal(readFileSync(h.legacyPath, 'utf8'), '旧版のルール\n', '旧版は消さない・書き換えない');
  assert.ok(h.existsRules(), '新しい指示ファイルは配置される');
});

test('旧版が無い: 注意は出ない', () => {
  const h = fresh();
  const r = install(h);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes('旧版'), r.stdout);
});
