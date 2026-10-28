# {{PROJECT_NAME}} の開発ルール

このプロジェクトの AI エージェント（GitHub Copilot）向けの約束。PC 全体のルール（loop_engineer_copilot_public 由来の指示ファイル `C:/Users/<ユーザー>/.copilot/instructions/loop_engineer_copilot_public.instructions.md`）に加えて適用する。
このファイルは git に入れない（`.git/info/exclude` に `AGENTS.md` を書いて除外する。`new-project.mjs` が書く）。同じ内容の CLAUDE.md や `.github/copilot-instructions.md` を並べて置かない（Copilot は指示ファイルを重ねて読むので同じ約束が二重に入る）。

## 検証コマンド（これだけが真実）

```bash
{{VERIFY_CMD}}
```

変更のあとは必ずこれを実行し、PASS を確認してから完了とする。「できました」だけでは完了扱いにしない。
検証しにくいもの（見た目、対話 UI）は、先に検証できる入口（非対話モード、実動チェック）を用意してからこのコマンドに含める。

## 進捗メモ（リポジトリの外）

- 進捗メモは `{{PROGRESS_PATH}}`（置き場。git に入らない）。着手時に読み、作業の区切り（最終報告の前を含む。意味は PC 全体のルールの冒頭）ごとに更新する
- 完了条件、やらないこと（依頼の範囲外）、自分で決めた前提、残課題は会話ではなくそこに書く。リポジトリには入れず、PR 本文に完了条件の照合と前提を写す

## このプロジェクト固有の約束

- （例: 依存パッケージを増やさない。`test/` は変更しない。対象は `src/` 配下だけ）
