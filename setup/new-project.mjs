#!/usr/bin/env node
// new-project.mjs — 作業対象にプロジェクト用の AGENTS.md を置き、進捗メモ（PROGRESS.md）を置き場に置く
//   - AGENTS.md は作業対象に置き、作業対象の除外リスト（.git/info/exclude）に AGENTS.md を足して git から外す
//   - PROGRESS.md は作業対象ではなく置き場 <home>/.copilot/projects/<名前>/PROGRESS.md に置く（git に入らない）
//   作業対象に CLAUDE.md（CLAUDE.local.md、.claude/CLAUDE.md を含む）があれば AGENTS.md は置かない（同じ指示が二重になるため。CLAUDE.md をプロジェクト側の AGENTS.md として使う）
//   作業対象に .github/copilot-instructions.md があれば、最後に注意を 1 行出す（置く・置かないの判定には使わない）
//   作業対象が git リポジトリでない（.git が無い）ときは除外リストへの追記を飛ばして注意を出す（git init のあとにもう一度実行する）
//
// 使い方:
//   node setup/new-project.mjs <作業対象dir> [--name <名前>] [--verify "<検証コマンド>"] [--home <dir>] [--force] [--dry-run]
//     [--ci] [--ci-os <ubuntu,windows,macos のカンマ区切り。既定 ubuntu>]
//     [--ci-on <pr,push のカンマ区切り。既定 pr,push>] [--ci-node <版。既定 22>]
//     [--ci-run "<コマンド>"]（重ねて指定できる）
//
//   --name    雛形に埋める名前と置き場のフォルダ名（既定は <作業対象dir> のフォルダ名）
//   --verify  検証コマンド（既定は「未設定」の目印。あとで PROGRESS.md と AGENTS.md を直す）
//   --home    置き場の親（<dir>/.copilot/projects/<名前>/）を決めるホーム（既定は os.homedir()。検証用）
//   --force   既にあるファイルも上書きする（既定は上書きせず飛ばす。置き場の PROGRESS.md も同じ）
//   --dry-run 何を書くかを表示するだけ（置き場も除外リストも書かない）
//   --ci      GitHub Actions のワークフロー（.github/workflows/verify.yml）を置く。これは作業対象に置く（git に入れる）。
//             回すコマンドは --ci-run（重ねられる）。無ければ --verify のコマンドを回す。どちらも無ければ失敗する
//   --ci-os   ワークフローで回す OS（ubuntu / windows / macos のカンマ区切り。既定 ubuntu）
//   --ci-on   ワークフローのきっかけ（pr / push のカンマ区切り。既定 pr,push。push は main への push）
//   --ci-node ワークフローで使う Node.js の版（既定 22）
//
// 雛形の正本は setup/project/。既存プロジェクトに置くときは置き場の PROGRESS.md を先に読んでから使う。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const USAGE = '使い方: node setup/new-project.mjs <作業対象dir> [--name <名前>] [--verify "<検証コマンド>"] [--home <dir>] [--force] [--dry-run]'
  + ' [--ci] [--ci-os <ubuntu,windows,macos>] [--ci-on <pr,push>] [--ci-node <版>] [--ci-run "<コマンド>"]';

const argv = process.argv.slice(2);
let target = null;
let name = null;
let verifyRaw = null;
let homeRaw = null;
let force = false;
let dryRun = false;
let ci = false;
let ciOsRaw = 'ubuntu';
let ciOnRaw = 'pr,push';
let ciNode = '22';
const ciRun = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  // 値を取るオプションは、値が無ければ使い方の誤りとして止める
  const val = () => {
    if (i + 1 >= argv.length) { console.error(`[new-project] ${a} に値がありません`); process.exit(2); }
    return argv[++i];
  };
  if (a === '--name') name = val();
  else if (a === '--verify') verifyRaw = val();
  else if (a === '--home') homeRaw = val();
  else if (a === '--force') force = true;
  else if (a === '--dry-run') dryRun = true;
  else if (a === '--ci') ci = true;
  else if (a === '--ci-os') ciOsRaw = val();
  else if (a === '--ci-on') ciOnRaw = val();
  else if (a === '--ci-node') ciNode = val();
  else if (a === '--ci-run') ciRun.push(val());
  else if (a.startsWith('--')) { console.error(`[new-project] 不明な引数: ${a}`); process.exit(2); }
  else if (target === null) target = a;
  else { console.error(`[new-project] 作業対象は 1 つだけ指定する: ${a}`); process.exit(2); }
}
if (!target) {
  console.error(USAGE);
  process.exit(2);
}

// --ci の中身を先に検証する。ここで失敗するときは何も書かない（フォルダも作らない）
const CI_OS_MAP = { ubuntu: 'ubuntu-latest', windows: 'windows-latest', macos: 'macos-latest' };
const CI_ON_ORDER = ['pr', 'push'];
let ciOsList = [];
let ciOnList = [];
let ciCommands = [];
if (ci) {
  ciOsList = ciOsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const os of ciOsList) {
    if (!CI_OS_MAP[os]) { console.error(`[new-project] --ci-os に知らない値: ${os}（ubuntu / windows / macos のいずれか）`); process.exit(2); }
  }
  if (ciOsList.length === 0) { console.error('[new-project] --ci-os が空: OS を 1 つ以上指定する'); process.exit(2); }

  ciOnList = ciOnRaw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const on of ciOnList) {
    if (!CI_ON_ORDER.includes(on)) { console.error(`[new-project] --ci-on に知らない値: ${on}（pr / push のいずれか）`); process.exit(2); }
  }
  if (ciOnList.length === 0) { console.error('[new-project] --ci-on が空: きっかけを 1 つ以上指定する'); process.exit(2); }

  ciCommands = ciRun.length > 0 ? ciRun : (verifyRaw ? [verifyRaw] : []);
  if (ciCommands.length === 0) {
    console.error('[new-project] --ci で回すコマンドが無い: --ci-run を渡すか、--verify で検証コマンドを指定する');
    process.exit(2);
  }
}

const dir = resolve(target);
name ??= basename(dir);
// 名前は置き場のフォルダ名になるので、パスの区切りや Windows で使えない文字、. と .. は受け付けない（置き場の外へ出さない）
if (name === '' || name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) {
  console.error(`[new-project] 名前が置き場のフォルダ名に使えない: "${name}"（--name で区切り文字や :*?"<>| を含まない名前を渡す）`);
  process.exit(2);
}
const home = resolve(homeRaw ?? homedir());
const progressPath = join(home, '.copilot', 'projects', name, 'PROGRESS.md');
const slash = (p) => String(p).replaceAll('\\', '/');
const verify = verifyRaw ?? '（未設定。検証コマンドをここに書く）';
// ローカルの日付（toISOString は UTC なので、JST の朝 9 時前に実行すると前日になる）
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// 置換は関数で渡す（値に含まれる $& や $$ を置換パターンとして解釈させない）
const fill = (text) => text
  .replaceAll('\r\n', '\n')
  .replaceAll('{{PROJECT_NAME}}', () => name)
  .replaceAll('{{VERIFY_CMD}}', () => verify)
  .replaceAll('{{DATE}}', () => date)
  .replaceAll('{{PROGRESS_PATH}}', () => slash(progressPath))
  .replaceAll('{{TARGET_DIR}}', () => slash(dir))
  .replaceAll('{{LOOP_ENGINEER_COPILOT_DIR}}', () => slash(ROOT));

// 作業対象に CLAUDE.md（CLAUDE.local.md、.claude/CLAUDE.md を含む）があれば AGENTS.md は置かない（同じ指示が二重になるため）。
// <home>/.claude/CLAUDE.md（PC 全体のルール）は数えない
const CLAUDE_FILES = ['CLAUDE.md', 'CLAUDE.local.md', join('.claude', 'CLAUDE.md')];
const userClaudeMd = join(home, '.claude', 'CLAUDE.md');
const claudeMdIn = (d) => CLAUDE_FILES.map((f) => join(d, f)).filter((p) => p !== userClaudeMd && existsSync(p));
const ownClaudeMd = claudeMdIn(dir);

const files = [
  { name: 'AGENTS.md', path: join(dir, 'AGENTS.md'), content: fill(readFileSync(join(ROOT, 'setup', 'project', 'AGENTS.md'), 'utf8')) },
  // 進捗メモは作業対象ではなく置き場に置く（git に入れない）
  { name: 'PROGRESS.md', path: progressPath, content: fill(readFileSync(join(ROOT, 'setup', 'project', 'PROGRESS.md'), 'utf8')) },
];

if (ci) {
  const onBlock = CI_ON_ORDER.filter((on) => ciOnList.includes(on)).map((on) => {
    if (on === 'pr') return '  pull_request:';
    return '  push:\n    branches: [main]';
  }).join('\n');
  const osBlock = ciOsList.map((os) => CI_OS_MAP[os]).join(', ');
  const stepsBlock = ciCommands.map((cmd) => `      - run: |\n          ${cmd}`).join('\n');
  const ciContent = readFileSync(join(ROOT, 'setup', 'project', 'ci', 'node.yml'), 'utf8')
    .replaceAll('\r\n', '\n')
    .replaceAll('{{CI_ON}}', () => onBlock)
    .replaceAll('{{CI_OS}}', () => osBlock)
    .replaceAll('{{CI_NODE}}', () => ciNode)
    .replaceAll('{{CI_STEPS}}', () => stepsBlock);
  files.push({
    name: '.github/workflows/verify.yml',
    path: join(dir, '.github', 'workflows', 'verify.yml'),
    content: ciContent,
  });
}

// 作業対象の除外リストのパス。git に聞く（worktree でも正しい場所になる）。取れなければ <作業対象>/.git/info/exclude
function excludePath() {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--git-path', 'info/exclude'], { encoding: 'utf8', windowsHide: true });
  const out = r.status === 0 ? String(r.stdout).trim() : '';
  return out ? resolve(dir, out) : join(dir, '.git', 'info', 'exclude');
}

console.log(`[new-project] 作業対象: ${dir}${dryRun ? '（dry-run、書き込みなし）' : ''}`);
console.log(`[new-project] 置き場: ${progressPath}`);
console.log(`[new-project] 名前: ${name} / 検証コマンド: ${verify}`);
if (!dryRun) mkdirSync(dir, { recursive: true });
let agentsPlaced = false; // AGENTS.md を置いた、または既にある（除外リストに足す対象がある）
for (const f of files) {
  const existed = existsSync(f.path);
  if (f.name === 'AGENTS.md' && ownClaudeMd.length > 0 && !existed) {
    const found = ownClaudeMd.map((p) => basename(dirname(p)) === '.claude' ? '.claude/CLAUDE.md' : basename(p)).join('、');
    console.log(`  - AGENTS.md: ${found} があるので置かない（同じ指示が二重になるため。${found} をプロジェクト側の AGENTS.md として使う。`
      + '移すなら git mv CLAUDE.md AGENTS.md）');
    continue;
  }
  if (f.name === 'AGENTS.md') agentsPlaced = true;
  if (existed && !force) {
    console.log(`  - ${f.name}: 既にあるので触らない（上書きするなら --force）`);
    continue;
  }
  if (!dryRun) {
    mkdirSync(dirname(f.path), { recursive: true });
    writeFileSync(f.path, f.content, 'utf8');
  }
  console.log(`  - ${f.name}: ${existed ? '上書き' : '作成'}`);
}

// ---------- 除外リスト（.git/info/exclude）に AGENTS.md を足す ----------
if (!agentsPlaced) {
  console.log('  - .git/info/exclude: AGENTS.md を置いていないので足さない');
} else if (!existsSync(join(dir, '.git'))) {
  // .git はディレクトリでもファイル（worktree、submodule）でもよい。無ければ git リポジトリではない
  console.log(`[new-project] 注意: ${dir} は git リポジトリではないので .git/info/exclude への追記を飛ばした（git init のあとにもう一度実行する）`);
} else {
  const ex = excludePath();
  let cur = '';
  try { if (existsSync(ex)) cur = readFileSync(ex, 'utf8'); } catch { cur = ''; }
  const has = cur.split(/\r?\n/).some((l) => ['AGENTS.md', '/AGENTS.md'].includes(l.trim()));
  if (has) {
    console.log('  - .git/info/exclude: AGENTS.md は既にあるので足さない');
  } else {
    try {
      if (!dryRun) {
        mkdirSync(dirname(ex), { recursive: true });
        // 末尾が改行で終わっていなければ改行を補ってから 1 行足す
        writeFileSync(ex, `${cur}${cur !== '' && !cur.endsWith('\n') ? '\n' : ''}AGENTS.md\n`, 'utf8');
      }
      console.log(`  - .git/info/exclude: AGENTS.md を足した（${ex}）`);
    } catch (e) {
      console.log(`[new-project] 注意: ${ex} に書けなかったので AGENTS.md の除外を飛ばした（${e.message}）。手で .git/info/exclude に AGENTS.md の行を足す`);
    }
  }
}

if (existsSync(join(dir, '.github', 'copilot-instructions.md'))) {
  console.log('[new-project] 注意: .github/copilot-instructions.md がある。Copilot はこれも読むので、AGENTS.md と内容を重ねない');
}
console.log('[new-project] 置き場の PROGRESS.md の「目的」「完了条件」「やらないこと」「前提」を埋めてから着手する。');
