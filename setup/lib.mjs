// setup/lib.mjs — new-project.mjs / install.mjs / check.mjs / uninstall.mjs の共通部分
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// キャプチャ 1: hash。キャプチャ 2: 版番号
export const BEGIN_RE = /<!-- loop_engineer_copilot_public:begin hash=([0-9a-f]+) version=([0-9.]+) -->/;
export const END_MARK = '<!-- loop_engineer_copilot_public:end -->';
export const RULES_FILE = 'loop_engineer_copilot_public.instructions.md';
// 旧版（loop_engineer_copilot）の配置先。同じフォルダにあると Copilot が両方読んで矛盾する
export const LEGACY_RULES_FILE = 'loop_engineer_copilot.instructions.md';
export const MANIFEST_NAME = 'loop_engineer_copilot_public-install.json';
export const CHECK_STATE_NAME = 'loop_engineer_copilot_public-check.json';
export const BACKUP_KEEP = 3; // 配置先の .bak-<日時> を残す数

// 配置先を新規に作るときの先頭（Copilot がすべてのファイルに適用する instructions ファイルの形）
export const FRONTMATTER = [
  '---',
  "name: 'loop_engineer_copilot_public 開発ルール'",
  "description: 'この PC での開発ルール（loop_engineer_copilot_public 由来、公開リポジトリで使う）。すべての作業に適用する'",
  "applyTo: '**'",
  '---',
  '',
].join('\n');

export function copilotDir(home = homedir()) {
  return join(home, '.copilot');
}

export function rulesPath(cdir) {
  return join(cdir, 'instructions', RULES_FILE);
}

export function legacyRulesPath(cdir) {
  return join(cdir, 'instructions', LEGACY_RULES_FILE);
}

export function render(text, dir, version) {
  // autocrlf の設定差で hash が変わらないよう、改行は LF に揃える
  let out = text.replaceAll('\r\n', '\n').replaceAll('{{LOOP_ENGINEER_COPILOT_DIR}}', String(dir).replaceAll('\\', '/'));
  if (version !== undefined) out = out.replaceAll('{{RULES_VERSION}}', version);
  return out;
}

export function sha(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

// 正本 3 つの生の中身（プレースホルダは埋めない。参照先のパスに依存させない）から版番号の付け忘れを見つけるための hash
export function sourceHash() {
  const raw = (...p) => readFileSync(join(ROOT, ...p), 'utf8').replaceAll('\r\n', '\n');
  const parts = [
    raw('setup', 'copilot-instructions.user.md'),
    // 配置されず clone から直接読まれる外出し先（ルール本文の一部なので、変えたら版番号を上げる）
    raw('setup', 'rules', 'proposal.md'),
    raw('setup', 'rules', 'proposal-docs-ci.md'),
  ];
  return sha(parts.join('\n'));
}

function readVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'setup', 'version.json'), 'utf8')).version;
}

export function loadTemplates(dir) {
  const version = readVersion();
  const body = render(readFileSync(join(ROOT, 'setup', 'copilot-instructions.user.md'), 'utf8'), dir, version);
  return { body, hash: sha(body), version, sourceHash: sourceHash() };
}

export function installedHash(path) {
  if (!existsSync(path)) return null;
  const m = readFileSync(path, 'utf8').match(BEGIN_RE);
  return m ? m[1] : null;
}

// 配置済みブロックの版番号。ファイルやブロックが無ければ null
export function installedVersion(path) {
  if (!existsSync(path)) return null;
  const m = readFileSync(path, 'utf8').match(BEGIN_RE);
  return m && m[2] ? m[2] : null;
}

// <path>.bak-<日時> のうち古いものを返す（新しい keep 個は残す。消すのは呼び手）。日時は ISO 形式なので名前順が時刻順
export function staleBackups(path, keep = BACKUP_KEEP) {
  const dir = dirname(path);
  if (!existsSync(dir)) return [];
  const prefix = `${basename(path)}.bak-`;
  const names = readdirSync(dir).filter((f) => f.startsWith(prefix)).sort();
  return names.slice(0, Math.max(0, names.length - keep)).map((f) => join(dir, f));
}

// 導入の記録（install.mjs が書き、uninstall.mjs が消す）。無ければ null
export function readManifest(cdir) {
  const p = join(cdir, MANIFEST_NAME);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

// パスの比較用に正規化（区切りを / に、末尾の / を落とし、Windows では大文字小文字を無視）
export function normPath(p) {
  let s = String(p).replaceAll('\\', '/').replace(/\/+$/, '');
  if (process.platform === 'win32') s = s.toLowerCase();
  return s;
}

// 引数の検査。知らない引数（--help を含む）や値の無いオプションがあれば、使い方を stderr に出して終了する（何も書き換えない）
export function checkArgs(argv, { flags = [], opts = [] }, usage) {
  const bad = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.includes(a)) continue;
    if (opts.includes(a)) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) bad.push(`${a}（値がありません）`);
      i++;
      continue;
    }
    bad.push(a);
  }
  if (bad.length === 0) return;
  const help = argv.includes('--help') || argv.includes('-h');
  if (!help) console.error(`知らない引数: ${bad.join(' ')}`);
  console.error(usage);
  process.exit(help ? 0 : 2);
}
