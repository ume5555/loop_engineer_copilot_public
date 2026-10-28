# loop_engineer_copilot_public

GitHub Copilot 向けの開発ルールと配置の道具。loop_engineer_copilot（https://github.com/ume5555/loop_engineer_copilot）の変種で、
**作業対象のリポジトリにルール由来のファイルを入れない**（公開リポジトリで使う前提）。Copilot 専用で、ほかのエージェントアプリは使わない前提。

- ルールの正本: `setup/copilot-instructions.user.md`（由来: loop_engineer_copilot v1.1.1 の `setup/copilot-instructions.user.md`）
- 配置先: `~/.copilot/instructions/loop_engineer_copilot_public.instructions.md`
- プロジェクト側: `AGENTS.md` は作業対象に置いて `.git/info/exclude` で git から外す。`PROGRESS.md` は置き場 `~/.copilot/projects/<作業フォルダ名>/` に置く（`setup/new-project.mjs` が両方を行う）

## 資料

| 知りたいこと | 資料 |
|---|---|
| 新しい PC での導入、読まれているかの確認、更新、取り消し、置き場の扱い | [apply-guide.md](apply-guide.md) |
| 検証コマンドと、このリポジトリで AI が守る約束 | [AGENTS.md](../AGENTS.md) |
| loop_engineer_copilot との違い、持ち込まなかったもの | [diff-from-copilot.md](diff-from-copilot.md) |
| 目的、完了条件、進捗、残課題 | [PROGRESS.md](../PROGRESS.md) |

## 構成

| ファイル | 役割 |
|---|---|
| `setup/copilot-instructions.user.md` | PC 全体のルールの正本 |
| `setup/rules/proposal.md`、`setup/rules/proposal-docs-ci.md` | 着手時の提案の書き方（配置されず、clone から直接読まれる） |
| `setup/install.mjs` / `check.mjs` / `uninstall.mjs` | 配置、古さの検査、取り消し（`setup/lib.mjs` が共通部分）。旧版 loop_engineer_copilot の指示ファイルが残っていれば警告する |
| `setup/version.json`、`setup/CHANGELOG.md` | 開発ルールの版番号と変更履歴 |
| `setup/new-project.mjs`、`setup/project/` | プロジェクト側の雛形を置く（AGENTS.md は作業対象 + `.git/info/exclude`、PROGRESS.md は置き場、CI のワークフローは `--ci` のとき） |
| `setup/test/` | 配置の道具のテスト（一時フォルダを HOME に見立てる。実環境の `~/.copilot` に触れない） |
| `docs/` | 資料（上の表） |

このリポジトリ自身は道具のリポジトリなので例外として `AGENTS.md` と `PROGRESS.md` を追跡する（配置先のルールの対象ではない）。
