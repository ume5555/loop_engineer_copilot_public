#!/usr/bin/env node
// check.mjs — 配置済みの開発ルールが古くないかを見て、古ければ 1 行出す（最新なら無言。常に exit 0）
//
// 使い方:
//   node setup/check.mjs                 配置済みブロックの hash と clone の遅れを確認
//   node setup/check.mjs --home <dir>    ~/.copilot の代わりに <dir>/.copilot を見る（検証用）
//   node setup/check.mjs --no-git        git fetch / rev-list を呼ばない（状態ファイルも読み書きしない）

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { ROOT, CHECK_STATE_NAME, copilotDir, rulesPath, legacyRulesPath, loadTemplates, installedHash, installedVersion } from './lib.mjs';

const argv = process.argv.slice(2);
const i = argv.indexOf('--home');
const home = i >= 0 && argv[i + 1] ? argv[i + 1] : homedir();
const noGit = argv.includes('--no-git');
const SIX_HOURS = 6 * 60 * 60 * 1000;

const reasons = [];
let legacy = null;
try {
  const cdir = copilotDir(home);
  const target = rulesPath(cdir);
  if (existsSync(legacyRulesPath(cdir))) legacy = resolve(legacyRulesPath(cdir));
  const t = loadTemplates(ROOT);
  const h = installedHash(target);
  if (h === null) reasons.push('ルールが未導入');
  else if (h !== t.hash) {
    const v = installedVersion(target);
    reasons.push(`ルールが正本と異なる（配置済み ${v ? `v${v}` : '版番号なし'} → 正本 v${t.version}）`);
  }

  if (!noGit) {
    const statePath = join(cdir, CHECK_STATE_NAME);
    let state = {};
    try { if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = {}; }
    const git = (args, timeout) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout, windowsHide: true });
    const now = Date.now();
    if (now - (state.lastFetch ?? 0) > SIX_HOURS) {
      git(['fetch', '--quiet', 'origin', 'main'], 6000);
      state.lastFetch = now;
      mkdirSync(cdir, { recursive: true });
      writeFileSync(statePath, JSON.stringify(state));
    }
    const behind = git(['rev-list', '--count', 'HEAD..origin/main'], 3000);
    if (behind.status === 0 && Number(behind.stdout.trim()) > 0) {
      reasons.push(`clone が origin/main より ${behind.stdout.trim()} コミット遅れている`);
    }
  }
} catch (e) {
  reasons.push(`確認中にエラー: ${e.message}`);
}

if (reasons.length) {
  console.log(`[loop_engineer_copilot_public] 開発ルールが古い可能性があります（${reasons.join('、')}）。`
    + `ユーザーに「${ROOT} で git pull と node setup/install.mjs を実行しますか」と 1 行で提案してください`
    + '（未コミットの変更があると git pull が失敗するので、先に git status で確認）。');
}
// 旧版（loop_engineer_copilot）の指示ファイルが同じフォルダに残っていると、Copilot が両方読んで矛盾する
if (legacy) {
  console.log(`[loop_engineer_copilot_public] 旧版の指示ファイル（${legacy}）が残っています。`
    + '両方読まれて矛盾します。旧版の clone で node setup/uninstall.mjs を実行してください');
}
process.exit(0);
