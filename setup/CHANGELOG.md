# 開発ルールの変更履歴

正本 3 つ（`setup/copilot-instructions.user.md`、`setup/rules/proposal.md`、`setup/rules/proposal-docs-ci.md`）を変えたら、`setup/version.json` の版番号と hash を直し、ここに見出しと変更点を足す（足さないとテストが FAIL する）。新しい版を上に書く。
上げる規則: 振る舞いが変わる変更は 2 桁目、文言だけの変更は 3 桁目、作り直しは 1 桁目。

## 1.0.0 — 2026-10-28

- loop_engineer_copilot v1.1.1 の `setup/copilot-instructions.user.md` から、公開リポジトリで使う前提（ルール由来のファイルを git に入れない）に書き換えた最初の版
- プロジェクト側の AGENTS.md は作業対象に置くが `.git/info/exclude` で git から外す。PROGRESS.md は置き場 `~/.copilot/projects/<名前>/` に置く（`setup/new-project.mjs` が両方を行う）
- 配置先は `~/.copilot/instructions/loop_engineer_copilot_public.instructions.md`。名乗りは「指揮役: <モデル名>（Copilot 開発ルール public vX.Y.Z）」
- 「PROGRESS.md だけの更新で PR を作らない」「worktree の締めで本体へ写す」のように PROGRESS.md が git に入っている前提の決まりを外し、置き場の読み書きに置き換えた
- 「Codex のハーネスと Codex CLI は使わない」の節を外した（Copilot 専用で、ほかのエージェントを使わない前提）
