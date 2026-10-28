// setup/test/helpers.mjs — install.mjs / check.mjs / uninstall.mjs を一時 HOME に対して実行する補助
// 実環境の ~/.copilot には触れない（--home で一時ディレクトリを渡す）。git fetch は呼ばない（--no-git）
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INSTALL = join(ROOT, 'setup', 'install.mjs');
export const CHECK = join(ROOT, 'setup', 'check.mjs');
export const UNINSTALL = join(ROOT, 'setup', 'uninstall.mjs');

// 配置先（~/.copilot の下の相対パス）
export const RULES_REL = join('instructions', 'loop_engineer_copilot_public.instructions.md');
// 旧版（loop_engineer_copilot）の配置先。併存の警告のテストで一時 HOME に置く
export const LEGACY_REL = join('instructions', 'loop_engineer_copilot.instructions.md');

export function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'lec-setup-'));
  const cdir = join(home, '.copilot');
  return {
    home,
    cdir,
    rules: join(cdir, RULES_REL),
    path: (...p) => join(cdir, ...p),
    read: (...p) => readFileSync(join(cdir, ...p), 'utf8'),
    readRules: () => readFileSync(join(cdir, RULES_REL), 'utf8'),
    write: (rel, content) => {
      const p = join(cdir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content, 'utf8');
    },
    writeRules: (content) => {
      const p = join(cdir, RULES_REL);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content, 'utf8');
    },
    writeLegacy: (content = '旧版のルール\n') => {
      const p = join(cdir, LEGACY_REL);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content, 'utf8');
    },
    legacyPath: join(cdir, LEGACY_REL),
    json: (...p) => JSON.parse(readFileSync(join(cdir, ...p), 'utf8')),
    exists: (...p) => existsSync(join(cdir, ...p)),
    existsRules: () => existsSync(join(cdir, RULES_REL)),
    // <配置先>.bak-<日時> の一覧（配置先と同じフォルダ）
    backups: () => {
      const d = dirname(join(cdir, RULES_REL));
      const name = 'loop_engineer_copilot_public.instructions.md';
      return (existsSync(d) ? readdirSync(d) : []).filter((f) => f.startsWith(`${name}.bak-`));
    },
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

function run(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', windowsHide: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

export const install = (h, ...args) => run(INSTALL, ['--home', h.home, ...args]);
export const check = (h, ...args) => run(CHECK, ['--home', h.home, '--no-git', ...args]);
export const uninstall = (h, ...args) => run(UNINSTALL, ['--home', h.home, ...args]);
