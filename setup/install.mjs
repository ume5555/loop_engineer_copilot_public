#!/usr/bin/env node
// install.mjs — この PC の GitHub Copilot に loop_engineer_copilot_public の開発ルールを配置する
//
// 使い方:
//   node setup/install.mjs               この clone を参照先として ~/.copilot に配置
//   node setup/install.mjs --dry-run     変更内容を表示するだけ
//   node setup/install.mjs --home <dir>  ~/.copilot の代わりに <dir>/.copilot へ配置（検証用）
//   node setup/install.mjs --dir <path>  参照先の clone パスを明示（既定はこのスクリプトのある clone）
//
// 配置するもの:
//   ~/.copilot/instructions/loop_engineer_copilot_public.instructions.md
//                                  frontmatter（新規作成のときだけ）と目印ブロック。既にあるファイルは目印ブロックだけ置換か追記（他の内容は触らない）
//   ~/.copilot/loop_engineer_copilot_public-install.json
//                                  導入の記録（参照先、版番号、配置先）
// 書き換える前に配置先を *.bak-<日時> として同じ場所に残し、古いものは直近 3 個を残して消す。

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  ROOT, BEGIN_RE, END_MARK, MANIFEST_NAME, BACKUP_KEEP, FRONTMATTER, LEGACY_RULES_FILE,
  copilotDir, rulesPath, legacyRulesPath, loadTemplates, staleBackups, readManifest, normPath, checkArgs,
} from './lib.mjs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
checkArgs(argv, { flags: ['--dry-run'], opts: ['--home', '--dir'] },
  '使い方: node setup/install.mjs [--dry-run] [--home <dir>] [--dir <path>]');
const dryRun = argv.includes('--dry-run');
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const home = opt('--home') ?? homedir();
const dir = opt('--dir') ?? ROOT;

const cdir = copilotDir(home);
const target = rulesPath(cdir);
const t = loadTemplates(dir);
const block = `<!-- loop_engineer_copilot_public:begin hash=${t.hash} version=${t.version} -->\n${t.body.trimEnd()}\n${END_MARK}\n`;

const changes = [];
const log = [];

// ---------- 配置先 ----------
let next;
const exists = existsSync(target);
if (exists) {
  const cur = readFileSync(target, 'utf8');
  const m = cur.match(BEGIN_RE);
  if (m) {
    const start = m.index;
    const endAt = cur.indexOf(END_MARK, start);
    if (endAt < 0) {
      console.error(`[install] ${target} に終了目印（${END_MARK}）が見つかりません。何も書かずに終了します。`);
      process.exit(1);
    }
    let end = endAt + END_MARK.length;
    if (cur[end] === '\r') end++;
    if (cur[end] === '\n') end++;
    next = cur.slice(0, start) + block + cur.slice(end);
  } else {
    next = cur.trimEnd() + '\n\n' + block;
  }
} else {
  next = FRONTMATTER + '\n' + block;
}

let removedBak = 0;
if (!exists || readFileSync(target, 'utf8') !== next) {
  changes.push(`  - instructions/${target.split(/[\\/]/).pop()}: ルールブロックを配置（v${t.version}、hash ${t.hash}）`);
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true });
    if (exists) copyFileSync(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    writeFileSync(target, next);
    for (const old of staleBackups(target, BACKUP_KEEP)) { rmSync(old, { force: true }); removedBak++; }
  }
  if (removedBak) changes.push(`  - 古い .bak を ${removedBak} 個削除（直近 ${BACKUP_KEEP} 個を残す）`);
}

// ---------- 導入の記録 ----------
let prev = null;
try { prev = readManifest(cdir); } catch { /* 壊れた記録は上書きする */ }
const manifest = JSON.stringify({ dir, version: t.version, file: target }, null, 2) + '\n';
const manifestPath = join(cdir, MANIFEST_NAME);
if (!dryRun && (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifest)) {
  mkdirSync(cdir, { recursive: true });
  writeFileSync(manifestPath, manifest);
}

// ---------- 報告 ----------
console.log(`[install] 参照先: ${dir}`);
console.log(`[install] 配置先: ${target}${dryRun ? '（dry-run、書き込みなし）' : ''}`);
console.log(`[install] Copilot 開発ルール public v${t.version}`);
if (changes.length) console.log(changes.join('\n'));
else console.log('[install] 変更なし（導入済み・最新）');
if (prev?.dir && normPath(prev.dir) !== normPath(dir)) {
  console.log(`[install] 参照先が ${prev.dir} から ${dir} に切り替わります。`);
}
// 旧版（loop_engineer_copilot）の指示ファイルが同じフォルダに残っていると、Copilot が両方読んで矛盾する。消さずに知らせるだけ
if (existsSync(legacyRulesPath(cdir))) {
  console.log(`[install] 注意: 旧版 ${LEGACY_RULES_FILE} が同じフォルダにあります。`
    + '両方読まれて矛盾するので、旧版の clone で node setup/uninstall.mjs を実行して外してください');
}
console.log('[install] 新しいセッションから有効になります。');
