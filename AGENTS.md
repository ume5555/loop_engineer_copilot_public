# loop_engineer_copilot_public の開発ルール

このプロジェクトの AI エージェント（Claude Code、GitHub Copilot など）向けの約束。各ツールの PC 全体のルールに加えて適用する。
このリポジトリにも上位のフォルダにも CLAUDE.md を置かない（Claude Code がこのファイルを読まなくなる）。

このリポジトリは loop_engineer_copilot（https://github.com/ume5555/loop_engineer_copilot、GitHub Copilot 向け）の変種。
違いは「作業対象のリポジトリにルール由来のファイル（AGENTS.md、PROGRESS.md）を入れない」こと（詳細は `docs/diff-from-copilot.md`）。
開発そのものは Claude Code のセッションで進めてよい（このファイルは両方のツールが読む）。

## 検証コマンド（これだけが真実）

```bash
node --test "setup/test/*.test.mjs"
```

変更のあとは必ずこれを実行し、PASS を確認してから完了とする。「できました」だけでは完了扱いにしない。
VS Code の Copilot チャットが指示ファイルを読むかどうかは非対話で確かめられないので、合言葉方式のユーザー操作で確かめる（手順は `docs/apply-guide.md`）。

## 進捗メモ

- このリポジトリ自身は道具のリポジトリなので、配置先のルール（置き場方式）の例外として `PROGRESS.md` と `AGENTS.md` を追跡する
- `PROGRESS.md` がセッションや反復をまたぐ唯一の記憶。着手時に読み、作業の区切り（最終報告の前を含む。意味は PC 全体のルールの冒頭）ごとに更新する
- 完了条件、やらないこと（依頼の範囲外）、自分で決めた前提、残課題は会話ではなく `PROGRESS.md` に書く

## このプロジェクト固有の約束

- 依存パッケージを増やさない（`setup/` は Node.js 標準モジュールだけ）
- ルールの正本は `setup/copilot-instructions.user.md`。由来は loop_engineer_copilot v1.1.1 で、変換で生成せず手で書き換えた別物として持つ。
  正本を変えたら `docs/diff-from-copilot.md`（loop_engineer_copilot との差分表）の該当行も直す
- 配置先（ユーザー側の指示ファイル）を手で直さない。正本を直して `node setup/install.mjs` を再実行する
- 配置先の旧版（`~/.copilot/instructions/loop_engineer_copilot.instructions.md`）と並存させない。切り替えるときは旧版の clone で `node setup/uninstall.mjs` を実行してからこちらを配置する
- このリポジトリは後で Public にする。追跡ファイル、コミットメッセージ、PR 本文に、ユーザー名入りのローカルパス（`C:/Users/<実名>/...`）や個人のメールアドレスを書かない。
  置き場のパスは `C:/Users/<ユーザー>/.copilot/projects/<名前>/` の形で書く。コミットの作者は GitHub の noreply アドレスにする（PC 全体の git の設定）
- Windows の Bash ツールはバックスラッシュを落とすので、ファイルは Write ツールで書く（PC 全体のルールの「道具の癖」のとおり）
