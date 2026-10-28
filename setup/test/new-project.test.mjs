// new-project.mjs の振る舞い: AGENTS.md を作業対象に、PROGRESS.md を置き場（<home>/.copilot/projects/<名前>/）に置く。
// 既存は触らない、--force と --dry-run、.git/info/exclude への追記。
// 実環境の ~/.copilot には触れない（毎回、一時 HOME を --home で渡す）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT } from './helpers.mjs';

const SCRIPT = join(ROOT, 'setup', 'new-project.mjs');

const tmps = [];
const scratch = () => { const d = mkdtempSync(join(tmpdir(), 'le-proj-')); tmps.push(d); return d; };
after(() => tmps.forEach((d) => rmSync(d, { recursive: true, force: true })));

// --home を渡していなければ、呼び出しごとの一時 HOME を足す。返り値の home に使った HOME が入る
const run = (...args) => {
  const i = args.indexOf('--home');
  const home = i >= 0 ? args[i + 1] : scratch();
  const full = i >= 0 ? args : [...args, '--home', home];
  const r = spawnSync(process.execPath, [SCRIPT, ...full], { encoding: 'utf8', windowsHide: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, home };
};

const slash = (p) => p.replaceAll('\\', '/');
// 置き場の PROGRESS.md のパス
const place = (home, name) => join(home, '.copilot', 'projects', name, 'PROGRESS.md');
const read = (dir, f) => readFileSync(join(dir, f), 'utf8');

const git = (dir, ...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true });
const gitInit = (dir) => {
  mkdirSync(dir, { recursive: true });
  const r = git(dir, 'init', '-q');
  assert.equal(r.status, 0, r.stderr);
};
const excludeOf = (dir) => join(dir, '.git', 'info', 'exclude');
const lines = (s) => s.split(/\r?\n/);

test('新しいフォルダ: フォルダごと作り、AGENTS.md を作業対象に、PROGRESS.md を置き場に置く（CLAUDE.md は置かない）', () => {
  const dir = join(scratch(), 'myapp');
  const r = run(dir, '--verify', 'npm test');
  assert.equal(r.status, 0, r.stderr);
  const pp = place(r.home, 'myapp');
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  assert.ok(existsSync(pp), '置き場に PROGRESS.md ができる');
  assert.ok(!existsSync(join(dir, 'PROGRESS.md')), '作業対象には PROGRESS.md を置かない（git に入れない）');
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')), 'CLAUDE.md を並べて置かない（同じ指示が二重になる）');
  assert.ok(!existsSync(join(dir, '.github', 'copilot-instructions.md')), '.github/copilot-instructions.md を並べて置かない');

  const agents = read(dir, 'AGENTS.md');
  const progress = readFileSync(pp, 'utf8');
  assert.ok(agents.startsWith('# myapp の開発ルール'), '名前はフォルダ名');
  assert.ok(agents.includes('npm test'));
  assert.ok(progress.includes('# 進捗メモ — myapp'));
  assert.ok(progress.includes('`npm test` が PASS する'));
  for (const s of [agents, progress]) {
    assert.ok(!s.includes('{{'), 'プレースホルダが残らない');
    assert.ok(!s.includes('\r'), '改行は LF');
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.ok(progress.includes(`### ${today}`), `日付の見出しはローカルの今日（${today}）`);
  assert.match(r.stdout, /AGENTS\.md: 作成/);
  assert.match(r.stdout, /PROGRESS\.md: 作成/);
  assert.ok(r.stdout.includes(`[new-project] 作業対象: ${dir}\n`), '作業対象の行');
  assert.ok(r.stdout.includes(`[new-project] 置き場: ${pp}\n`), '置き場の行');
  assert.doesNotMatch(r.stdout, /copilot-instructions/, '.github/copilot-instructions.md が無ければその注意は出ない');
  assert.ok(r.stdout.trimEnd().endsWith('[new-project] 置き場の PROGRESS.md の「目的」「完了条件」「やらないこと」「前提」を埋めてから着手する。'), '最後の行');
});

test('置き場の PROGRESS.md と作業対象の AGENTS.md に、置き場のパス（{{PROGRESS_PATH}}）と作業対象のパス（{{TARGET_DIR}}）が / 区切りで埋まる', () => {
  const dir = join(scratch(), 'paths');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const pp = slash(place(r.home, 'paths'));
  const progress = readFileSync(place(r.home, 'paths'), 'utf8');
  assert.ok(progress.includes(pp), '置き場の PROGRESS.md に自分のパス');
  assert.ok(progress.includes(slash(dir)), '置き場の PROGRESS.md に作業対象のパス');
  assert.ok(read(dir, 'AGENTS.md').includes(pp), 'AGENTS.md に置き場のパス');
  assert.ok(!progress.includes('\\'), 'パスの区切りは / に揃う');
});

test('置き場のフォルダ名は --name、無ければ作業対象のフォルダ名。--home の下の .copilot/projects/ に作る', () => {
  const home = scratch();
  const a = join(scratch(), 'folder-a');
  const b = join(scratch(), 'folder-b');
  assert.equal(run(a, '--home', home).status, 0);
  assert.equal(run(b, '--home', home, '--name', 'custom').status, 0);
  assert.ok(existsSync(place(home, 'folder-a')));
  assert.ok(existsSync(place(home, 'custom')));
  assert.ok(!existsSync(place(home, 'folder-b')));
  assert.ok(read(b, 'AGENTS.md').startsWith('# custom の開発ルール'), '雛形に埋める名前も --name');
});

test('--name に区切り文字や .. を含む → 失敗し、何も書かない（置き場の外へ出さない）', () => {
  const dir = join(scratch(), 'p');
  for (const bad of ['../evil', 'a/b', 'a\\b', '..', '.']) {
    const r = run(dir, '--name', bad);
    assert.equal(r.status, 2, `${bad}: ${r.stdout}`);
    assert.match(r.stderr, /名前が置き場のフォルダ名に使えない/);
    assert.ok(!existsSync(join(r.home, '.copilot')), `${bad}: 置き場を作らない`);
  }
  assert.ok(!existsSync(dir), '作業対象のフォルダも作らない');
});

test('PROGRESS.md の雛形は loop-harness と同じ反復ブロックの形を持つ', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir);
  const p = readFileSync(place(r.home, 'p'), 'utf8');
  for (const h of ['## 目的', '## 完了条件', '## やらないこと', '## 検証コマンド', '## 前提', '## 進捗', '## 残課題']) {
    assert.ok(p.includes(h), h);
  }
  for (const b of ['**やったこと**', '**分かったこと**', '**次にやること**']) assert.ok(p.includes(b), b);
});

test('PROGRESS.md の雛形 → 「ドキュメント」の欄があり、作る / 後回し / 要らない の 3 通りの返事を書けと案内する', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir);
  const p = readFileSync(place(r.home, 'p'), 'utf8');
  assert.match(p, /^## ドキュメント$/m);
  assert.match(p, /作る \/ 後回し \/ 要らない/);
  assert.ok(p.indexOf('## ドキュメント') > p.indexOf('## やらないこと') && p.indexOf('## ドキュメント') < p.indexOf('## 進捗'), '進捗より前に置く');
});

test('PROGRESS.md の雛形 → 「前提」の節に、古い記録を置き場の progress-archive/ へ移す前に今後も効く決定をこの節へ写せと案内する', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir);
  const p = readFileSync(place(r.home, 'p'), 'utf8');
  const premise = p.slice(p.indexOf('## 前提'), p.indexOf('## 進捗'));
  assert.match(premise, /作業記録が 6 つを越えて古いものを置き場の `progress-archive\/` へ移すときは/);
  assert.match(premise, /今後も効くものをこの節へ写す/);
});

test('PROGRESS.md の雛形 → 「費用・所要」は想定と実績を対にした 1 行（規模と根拠入り）で、次の提案が grep で拾うと案内する', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir);
  const p = readFileSync(place(r.home, 'p'), 'utf8');
  const cost = p.slice(p.indexOf('**費用・所要**'), p.indexOf('## 残課題'));
  assert.match(cost, /^- 想定 <費用> \/ <所要>（<規模>。根拠: 実績 N 件か概算） → 実績 <費用> \/ <所要>（差が出た理由）$/m);
  assert.match(cost, /想定なし/);
  assert.match(cost, /grep -rn "→ 実績" PROGRESS\.md progress-archive\//);
});

test('既存の AGENTS.md は触らず、置き場の PROGRESS.md だけ作る', () => {
  const dir = scratch();
  writeFileSync(join(dir, 'AGENTS.md'), '# 自分のルール\n');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'AGENTS.md'), '# 自分のルール\n');
  assert.ok(existsSync(place(r.home, basename(dir))));
  assert.match(r.stdout, /AGENTS\.md: 既にあるので触らない/);
  assert.match(r.stdout, /PROGRESS\.md: 作成/);
});

test('置き場に PROGRESS.md が既にある → 上書きせず「既にあるので触らない（上書きするなら --force）」と出す。--force なら上書きする', () => {
  const home = scratch();
  const dir = join(scratch(), 'keep');
  const pp = place(home, 'keep');
  mkdirSync(join(pp, '..'), { recursive: true });
  writeFileSync(pp, '前回までの進捗\n');

  const r = run(dir, '--home', home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(pp, 'utf8'), '前回までの進捗\n', '触らない');
  assert.match(r.stdout, /PROGRESS\.md: 既にあるので触らない（上書きするなら --force）/);
  assert.ok(existsSync(join(dir, 'AGENTS.md')), 'AGENTS.md は置く');

  const f = run(dir, '--home', home, '--force');
  assert.equal(f.status, 0, f.stderr);
  assert.ok(readFileSync(pp, 'utf8').includes('# 進捗メモ — keep'), '上書きされる');
  assert.match(f.stdout, /PROGRESS\.md: 上書き/);
});

// テスト名はテスト仕様書の照合に使うので、テンプレートリテラルで埋めずに固定の文字列で書く
const keepsOwnClaudeMd = (existing) => () => {
    const dir = scratch();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, existing), '# 自分のルール\n');
    const r = run(dir, '--force');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(join(dir, 'AGENTS.md')), '置くと同じ指示が二重になる');
    assert.equal(read(dir, existing), '# 自分のルール\n');
    assert.ok(existsSync(place(r.home, basename(dir))), '置き場の PROGRESS.md は置く');
    assert.match(r.stdout, /AGENTS\.md: .*CLAUDE.*があるので置かない（同じ指示が二重になるため。/);
    assert.match(r.stdout, /をプロジェクト側の AGENTS\.md として使う/);
    assert.match(r.stdout, /git mv CLAUDE\.md AGENTS\.md/);
    assert.match(r.stdout, /\.git\/info\/exclude: AGENTS\.md を置いていないので足さない/);
};
test('作業対象に CLAUDE.md がある → AGENTS.md を置かない（--force でも）。CLAUDE.md をそのまま使う旨と移し方を出す', keepsOwnClaudeMd('CLAUDE.md'));
test('作業対象に CLAUDE.local.md がある → AGENTS.md を置かない（--force でも）', keepsOwnClaudeMd('CLAUDE.local.md'));
test('作業対象に .claude/CLAUDE.md がある → AGENTS.md を置かない（--force でも）', keepsOwnClaudeMd('.claude/CLAUDE.md'));

test('上位のフォルダに CLAUDE.md がある → AGENTS.md は置き、警告は出さない（Copilot は上位の CLAUDE.md を既定では読まない）', () => {
  const parent = scratch();
  writeFileSync(join(parent, 'CLAUDE.md'), '# 上位\n');
  const dir = join(parent, 'child');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  assert.doesNotMatch(r.stdout, /があるので置かない/);
  assert.doesNotMatch(r.stdout, /copilot-instructions/);
});

test('作業対象に .github/copilot-instructions.md がある → AGENTS.md は置き、内容を重ねないよう注意を 1 行出す', () => {
  const dir = scratch();
  mkdirSync(join(dir, '.github'), { recursive: true });
  writeFileSync(join(dir, '.github', 'copilot-instructions.md'), '# 自分の指示\n');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'AGENTS.md')), '置く・置かないの判定には使わない');
  assert.equal(read(dir, '.github/copilot-instructions.md'), '# 自分の指示\n');
  assert.match(r.stdout, /\[new-project\] 注意: \.github\/copilot-instructions\.md がある。Copilot はこれも読むので、AGENTS\.md と内容を重ねない/);
});

test('--force: 既存のファイルを上書きする（作業対象の AGENTS.md と置き場の PROGRESS.md）', () => {
  const home = scratch();
  const dir = scratch();
  writeFileSync(join(dir, 'AGENTS.md'), '古い内容\n');
  const pp = place(home, 'renamed');
  mkdirSync(join(pp, '..'), { recursive: true });
  writeFileSync(pp, '古い内容\n');
  const r = run(dir, '--home', home, '--force', '--name', 'renamed');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(pp, 'utf8').includes('# 進捗メモ — renamed'));
  assert.ok(read(dir, 'AGENTS.md').startsWith('# renamed の開発ルール'));
  assert.match(r.stdout, /PROGRESS\.md: 上書き/);
  assert.match(r.stdout, /AGENTS\.md: 上書き/);
});

test('--dry-run: 何も書かない（作業対象のフォルダも、置き場も作らない）', () => {
  const dir = join(scratch(), 'nothing');
  const r = run(dir, '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(dir));
  assert.ok(!existsSync(join(r.home, '.copilot')), '置き場を作らない');
  assert.match(r.stdout, /dry-run/);
  assert.ok(r.stdout.includes(`[new-project] 置き場: ${place(r.home, 'nothing')}`), '置き場のパスは表示する');
});

test('--dry-run（git リポジトリ）: AGENTS.md も置き場も .git/info/exclude も書かず、足す予定だけ表示する', () => {
  const dir = scratch();
  gitInit(dir);
  const before = readFileSync(excludeOf(dir), 'utf8');
  const r = run(dir, '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(dir, 'AGENTS.md')));
  assert.ok(!existsSync(join(r.home, '.copilot')));
  assert.equal(readFileSync(excludeOf(dir), 'utf8'), before, '除外リストは変わらない');
  assert.match(r.stdout, /AGENTS\.md: 作成/);
  assert.match(r.stdout, /\.git\/info\/exclude: AGENTS\.md を足した/);
});

test('検証コマンド未指定: 未設定の目印が入る', () => {
  const dir = join(scratch(), 'q');
  const r = run(dir);
  assert.ok(readFileSync(place(r.home, 'q'), 'utf8').includes('未設定'));
});

test('引数なし・不明な引数・値の無い --home: 使い方か理由を出して失敗し、何も書かない', () => {
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /使い方/);
  const dir = scratch();
  const r = run(dir, '--bogus');
  assert.notEqual(r.status, 0);
  assert.ok(!existsSync(join(dir, 'AGENTS.md')));
  assert.ok(!existsSync(join(r.home, '.copilot')));
  const h = run(dir, '--home');
  assert.equal(h.status, 2);
  assert.match(h.stderr, /--home に値がありません/);
  assert.ok(!existsSync(join(dir, 'AGENTS.md')));
});

test('PROGRESS.md の雛形 → 「CI」の欄があり、入れる / 後回し / 要らない の 3 通りの返事を書けと案内する', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir);
  const p = readFileSync(place(r.home, 'p'), 'utf8');
  assert.match(p, /^## CI$/m);
  assert.match(p, /入れる \/ 後回し \/ 要らない/);
  assert.ok(p.indexOf('## CI') > p.indexOf('## ドキュメント') && p.indexOf('## CI') < p.indexOf('## 検証コマンド'), 'ドキュメントの次、検証コマンドの前に置く');
});

// ---------- .git/info/exclude への追記 ----------

test('git リポジトリ: .git/info/exclude に AGENTS.md の 1 行が足され、git status に AGENTS.md が出ない（既存の内容は残る）', () => {
  const dir = scratch();
  gitInit(dir);
  const before = readFileSync(excludeOf(dir), 'utf8');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const after = readFileSync(excludeOf(dir), 'utf8');
  assert.ok(after.startsWith(before), '既存の内容は残る');
  assert.equal(lines(after).filter((l) => l.trim() === 'AGENTS.md').length, 1);
  assert.ok(after.endsWith('AGENTS.md\n'));
  assert.match(r.stdout, /\.git\/info\/exclude: AGENTS\.md を足した/);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  const st = git(dir, 'status', '--porcelain', '--untracked-files=all');
  assert.equal(st.status, 0, st.stderr);
  assert.equal(st.stdout.trim(), '', 'AGENTS.md は git から外れている（PROGRESS.md は作業対象に無い）');
});

test('除外リストに AGENTS.md（または /AGENTS.md）の行が既にある → 重ねて足さず「既にあるので足さない」と出す', () => {
  for (const existing of ['AGENTS.md\n', '/AGENTS.md\n', '  AGENTS.md  \r\n', 'node_modules\nAGENTS.md']) {
    const dir = scratch();
    gitInit(dir);
    writeFileSync(excludeOf(dir), existing);
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(excludeOf(dir), 'utf8'), existing, `${JSON.stringify(existing)}: 変わらない`);
    assert.match(r.stdout, /\.git\/info\/exclude: AGENTS\.md は既にあるので足さない/);
  }
  // 続けて 2 回実行しても 1 行のまま
  const dir = scratch();
  gitInit(dir);
  run(dir);
  const second = run(dir);
  assert.equal(lines(readFileSync(excludeOf(dir), 'utf8')).filter((l) => l.trim() === 'AGENTS.md').length, 1);
  assert.match(second.stdout, /既にあるので足さない/);
});

test('除外リストの末尾が改行で終わっていない（または空・無い）→ 改行を補って AGENTS.md を 1 行足す', () => {
  const dir = scratch();
  gitInit(dir);
  writeFileSync(excludeOf(dir), 'node_modules');
  assert.equal(run(dir).status, 0);
  assert.equal(readFileSync(excludeOf(dir), 'utf8'), 'node_modules\nAGENTS.md\n');

  const empty = scratch();
  gitInit(empty);
  writeFileSync(excludeOf(empty), '');
  assert.equal(run(empty).status, 0);
  assert.equal(readFileSync(excludeOf(empty), 'utf8'), 'AGENTS.md\n');

  const none = scratch();
  gitInit(none);
  rmSync(excludeOf(none), { force: true });
  assert.equal(run(none).status, 0);
  assert.equal(readFileSync(excludeOf(none), 'utf8'), 'AGENTS.md\n', '無ければ作る');
});

test('作業対象に .git が無い → 除外リストへの追記を飛ばして注意を出し、AGENTS.md と置き場の PROGRESS.md は置く（exit 0）', () => {
  const dir = scratch();
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`[new-project] 注意: ${dir} は git リポジトリではないので .git/info/exclude への追記を飛ばした（git init のあとにもう一度実行する）`), r.stdout);
  assert.ok(existsSync(join(dir, 'AGENTS.md')));
  assert.ok(existsSync(place(r.home, basename(dir))));
  assert.ok(!existsSync(join(dir, '.git')), '.git を勝手に作らない');

  // git init のあとにもう一度実行する → 既存は触らず、除外リストだけ足される
  gitInit(dir);
  const again = run(dir, '--home', r.home);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /AGENTS\.md: 既にあるので触らない/);
  assert.match(again.stdout, /PROGRESS\.md: 既にあるので触らない/);
  assert.match(again.stdout, /\.git\/info\/exclude: AGENTS\.md を足した/);
  assert.ok(lines(readFileSync(excludeOf(dir), 'utf8')).includes('AGENTS.md'));
});

test('作業対象が git の worktree（.git がファイル）→ 共通の .git/info/exclude に足され、worktree の git status に AGENTS.md が出ない', () => {
  const base = scratch();
  const main = join(base, 'main');
  gitInit(main);
  const c = git(main, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-q', '-m', 'init');
  assert.equal(c.status, 0, c.stderr);
  const wt = join(base, 'wt');
  const w = git(main, 'worktree', 'add', '-q', wt, '-b', 'feature');
  assert.equal(w.status, 0, w.stderr);
  assert.ok(statSync(join(wt, '.git')).isFile(), 'worktree の .git はファイル');

  const r = run(wt);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /git リポジトリではない/);
  assert.ok(lines(readFileSync(excludeOf(main), 'utf8')).includes('AGENTS.md'), '共通の除外リストに足される');
  assert.ok(existsSync(join(wt, 'AGENTS.md')));
  const st = git(wt, 'status', '--porcelain', '--untracked-files=all');
  assert.equal(st.stdout.trim(), '');
});

// --ci: GitHub Actions のワークフロー（.github/workflows/verify.yml）を置く
const WF = join('.github', 'workflows', 'verify.yml');

test('--ci なし → .github は作らない', () => {
  const dir = join(scratch(), 'p');
  run(dir, '--verify', 'npm test');
  assert.ok(!existsSync(join(dir, '.github')));
});

test('--ci（既定）→ PR と main への push で、Ubuntu / Node 22 で検証コマンドを回すワークフローを置く', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir, '--verify', 'node --test "test/*.test.mjs"', '--ci');
  assert.equal(r.status, 0, r.stderr);
  const y = read(dir, WF);
  assert.match(y, /^on:$/m);
  assert.match(y, /^  pull_request:$/m);
  assert.match(y, /^  push:\n    branches: \[main\]$/m);
  assert.match(y, /os: \[ubuntu-latest\]/);
  assert.ok(y.includes('runs-on: ${{ matrix.os }}'));
  assert.ok(y.includes('actions/checkout@v4'));
  assert.ok(y.includes('actions/setup-node@v4'));
  assert.match(y, /node-version: 22$/m);
  assert.match(y, /run: \|\n +node --test "test\/\*\.test\.mjs"$/m, '検証コマンドは原文のままブロックで書く');
  assert.ok(y.includes("hashFiles('package-lock.json') != ''") && y.includes('npm ci'), 'package-lock.json があるときだけ npm ci');
  assert.ok(!/(?<!\$)\{\{/.test(y), 'プレースホルダが残らない（${{ }} は Actions の式なので除く）');
  assert.ok(!y.includes('\r'), '改行は LF');
  assert.match(r.stdout, /\.github\/workflows\/verify\.yml: 作成/);
});

test('--ci-os / --ci-on / --ci-node → OS の並び、きっかけ、Node の版を変えられる', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir, '--verify', 'npm test', '--ci', '--ci-os', 'ubuntu,windows', '--ci-on', 'pr', '--ci-node', '20');
  assert.equal(r.status, 0, r.stderr);
  const y = read(dir, WF);
  assert.match(y, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(y, /^  pull_request:$/m);
  assert.ok(!/^  push:/m.test(y), 'push では回さない');
  assert.match(y, /node-version: 20$/m);
});

test('--ci-run を重ねる → 検証コマンドの代わりに、渡した順に 1 コマンド 1 step で回す', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir, '--verify', 'npm test', '--ci', '--ci-run', 'npm run typecheck', '--ci-run', 'npm run unit');
  assert.equal(r.status, 0, r.stderr);
  const y = read(dir, WF);
  const a = y.indexOf('npm run typecheck');
  const b = y.indexOf('npm run unit');
  assert.ok(a > 0 && b > a, '渡した順');
  assert.equal(y.match(/run: \|/g).length, 2, 'npm ci を除いて step は 2 つ');
  assert.ok(!/^ +npm test$/m.test(y), '--ci-run があれば --verify は回さない');
});

test('--ci で回すコマンドが無い（--verify も --ci-run も無い）→ 失敗し、何も書かない', () => {
  const dir = join(scratch(), 'p');
  const r = run(dir, '--ci');
  assert.notEqual(r.status, 0);
  assert.ok(!existsSync(dir));
  assert.ok(!existsSync(join(r.home, '.copilot')), '置き場も作らない');
});

test('--ci-os / --ci-on に知らない値 → 失敗し、何も書かない', () => {
  const dir = join(scratch(), 'p');
  assert.notEqual(run(dir, '--verify', 'npm test', '--ci', '--ci-os', 'solaris').status, 0);
  assert.notEqual(run(dir, '--verify', 'npm test', '--ci', '--ci-on', 'cron').status, 0);
  assert.ok(!existsSync(dir));
});

test('--ci: 既存のワークフローは触らない。--force で上書き、--dry-run では書かない', () => {
  const dir = scratch();
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, WF), 'name: mine\n');
  const r = run(dir, '--verify', 'npm test', '--ci');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, WF), 'name: mine\n');
  assert.match(r.stdout, /verify\.yml: 既にあるので触らない/);
  const f = run(dir, '--verify', 'npm test', '--ci', '--force');
  assert.match(f.stdout, /verify\.yml: 上書き/);
  assert.ok(read(dir, WF).includes('npm test'));

  const fresh = join(scratch(), 'dry');
  run(fresh, '--verify', 'npm test', '--ci', '--dry-run');
  assert.ok(!existsSync(fresh));
});

test('検証コマンドに $& や $$ を含んでも、雛形にそのまま入る（置換パターンとして解釈しない）', () => {
  const dir = join(scratch(), 'dollar');
  const r = run(dir, '--verify', 'echo "$$ $& $1"');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(read(dir, 'AGENTS.md').includes('echo "$$ $& $1"'));
  assert.ok(readFileSync(place(r.home, 'dollar'), 'utf8').includes('echo "$$ $& $1"'));
});

test('雛形の正本にはプレースホルダが揃っている', () => {
  const c = readFileSync(join(ROOT, 'setup', 'project', 'AGENTS.md'), 'utf8');
  const p = readFileSync(join(ROOT, 'setup', 'project', 'PROGRESS.md'), 'utf8');
  for (const k of ['{{PROJECT_NAME}}', '{{VERIFY_CMD}}', '{{PROGRESS_PATH}}']) { assert.ok(c.includes(k), `AGENTS.md に ${k}`); assert.ok(p.includes(k), `PROGRESS.md に ${k}`); }
  assert.ok(p.includes('{{DATE}}'));
  assert.ok(p.includes('{{TARGET_DIR}}'));
  assert.ok(!existsSync(join(ROOT, 'setup', 'project', 'CLAUDE.md')), '雛形は AGENTS.md だけ');
  assert.match(c, /\.git\/info\/exclude/, 'git から外す旨の文言');
  assert.match(c, /`\.github\/copilot-instructions\.md` を並べて置かない/);
  mkdirSync(join(scratch(), 'unused')); // scratch の後始末経路を通す
});
