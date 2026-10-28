#!/usr/bin/env node
// uninstall.mjs — install.mjs が配置したものを除く（他の内容は残す）
//
// 使い方:
//   node setup/uninstall.mjs               ~/.copilot から開発ルールのブロックと記録を除く
//   node setup/uninstall.mjs --dry-run     除く内容を表示するだけ
//   node setup/uninstall.mjs --home <dir>  ~/.copilot の代わりに <dir>/.copilot を対象にする（検証用）
//
// 配置先にブロックがあれば除き、frontmatter 以外の内容が残らなければファイルごと消す。
// 書き換え・削除の前に *.bak-<日時> を残す（.bak は残したまま）。導入の記録と check.mjs の状態ファイルも消す。

import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  BEGIN_RE, END_MARK, MANIFEST_NAME, CHECK_STATE_NAME, BACKUP_KEEP,
  copilotDir, rulesPath, staleBackups, checkArgs,
} from './lib.mjs';

const argv = process.argv.slice(2);
checkArgs(argv, { flags: ['--dry-run'], opts: ['--home'] },
  '使い方: node setup/uninstall.mjs [--dry-run] [--home <dir>]');
const dryRun = argv.includes('--dry-run');
const i = argv.indexOf('--home');
const home = i >= 0 ? argv[i + 1] : homedir();

const cdir = copilotDir(home);
const target = rulesPath(cdir);
const changes = [];

if (existsSync(target)) {
  const cur = readFileSync(target, 'utf8');
  const m = cur.match(BEGIN_RE);
  if (m) {
    const start = m.index;
    const endAt = cur.indexOf(END_MARK, start);
    if (endAt < 0) {
      console.error(`[uninstall] ${target} に終了目印（${END_MARK}）が見つかりません。何も除かずに終了します。`);
      process.exit(1);
    }
    let end = endAt + END_MARK.length;
    if (cur[end] === '\r') end++;
    if (cur[end] === '\n') end++;
    const before = cur.slice(0, start).trimEnd();
    const after = cur.slice(end).trim();
    const rest = [before, after].filter(Boolean).join('\n\n');
    const body = rest.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '');
    const onlyFrontmatter = body.trim() === '';
    const name = 'instructions/loop_engineer_copilot_public.instructions.md';
    changes.push(onlyFrontmatter ? `  - ${name}: ルールブロックしか無いので削除` : `  - ${name}: ルールブロックを除く（他の内容は残す）`);
    if (!dryRun) {
      copyFileSync(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
      if (onlyFrontmatter) rmSync(target, { force: true });
      else writeFileSync(target, rest + '\n');
      for (const old of staleBackups(target, BACKUP_KEEP)) rmSync(old, { force: true });
    }
  }
}

for (const name of [MANIFEST_NAME, CHECK_STATE_NAME]) {
  const p = join(cdir, name);
  if (existsSync(p)) {
    changes.push(`  - ${name}: 削除`);
    if (!dryRun) rmSync(p, { force: true });
  }
}

console.log(`[uninstall] 対象: ${cdir}${dryRun ? '（dry-run、書き込みなし）' : ''}`);
if (changes.length) {
  console.log(changes.join('\n'));
  console.log('[uninstall] *.bak-<日時> は残しています。不要なら手で消してください。');
} else {
  console.log('[uninstall] 変更なし（導入されていない）');
}
