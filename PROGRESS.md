# 進捗メモ — loop_engineer_copilot_public

このファイルはセッションや反復をまたぐ唯一の記憶。着手時に読み、作業の区切り（最終報告の前を含む）ごとに更新する。
次のセッションがこのファイルだけで続きから始められる状態を保つ。
計画の経緯（PROGRESS.md を git に入れない運用の検討、Copilot 専用の前提）は loop_engineer_copilot 側のセッション（2026-10-28）で話し、この節の「前提」に結論だけ写した。

## 目的

loop_engineer_copilot（GitHub Copilot 向けの開発ルールと配置の道具）の変種を作る。違いは、作業対象のリポジトリにルール由来のファイルを入れないこと:
プロジェクト側の AGENTS.md は作業対象に置いて `.git/info/exclude` で git から外し、PROGRESS.md は置き場 `~/.copilot/projects/<作業フォルダ名>/` に置く。
公開リポジトリで使う前提で、Copilot 専用（ほかのエージェントアプリは使わない）。

- 全体の進捗: 0%（10% 刻み。100% の条件: 完了条件 1〜9 をすべて満たす。見立て: フォルダとリポジトリ → 正本と道具 → テスト PASS → 配置と確認 → PR）

## 完了条件

1. ローカルの `C:/_Copilot/loop_engineer_copilot_public` と GitHub の `ume5555/loop_engineer_copilot_public`（private。後で Public にする）があり、履歴に個人のメールアドレスが無い（作者・コミッターは noreply）
2. 正本 `setup/copilot-instructions.user.md`（Copilot 専用、置き場方式）と、loop_engineer_copilot との差分表 `docs/diff-from-copilot.md` がある（由来: loop_engineer_copilot v1.1.1）
3. 配置の道具（`setup/install.mjs`、`setup/check.mjs`、`setup/uninstall.mjs`）が配置先 `~/.copilot/instructions/loop_engineer_copilot_public.instructions.md` と目印 `loop_engineer_copilot_public:begin/end` で動き、
   旧版 `loop_engineer_copilot.instructions.md` が同じフォルダにあれば警告する。`node --test "setup/test/*.test.mjs"` が PASS する
4. `setup/new-project.mjs` が AGENTS.md を作業対象に置いて `.git/info/exclude` に `AGENTS.md` を足し、PROGRESS.md を置き場に置く（`--home` で置き場の HOME を変えられる。`--ci` はそのまま）
5. 雛形 `setup/project/AGENTS.md`、`setup/project/PROGRESS.md` が置き場方式の文面で、`{{PROGRESS_PATH}}` と `{{TARGET_DIR}}` が埋まる
6. `docs/README.md`、`docs/apply-guide.md`（導入、確認、更新、取り消し、置き場の扱い）がある
7. 置き場に PROGRESS.md が既にあるとき、上書きせず飛ばす（`--force` なら上書き）。テストで確認
8. `.git/info/exclude` に `AGENTS.md` が既にあるとき、重ねて足さない。テストで確認
9. 作業対象が git リポジトリでない（`.git` が無い）とき、exclude への追記を飛ばして AGENTS.md と置き場の PROGRESS.md だけ置き、その旨を出す。テストで確認

## やらないこと（依頼の範囲外）

- loop_engineer_copilot と loop_engineer（Claude Code 版）の変更（この変種は別リポジトリとして持つ。由来の版が進んだときの追従は残課題）
- 既存の 2 リポジトリの履歴から個人のメールアドレスを消すこと（`git filter-repo` は破壊的。やるなら別の作業として指示をもらう）
- Copilot のフック（SessionStart で置き場の PROGRESS.md を流し込む、worktree へ AGENTS.md を写す）: 由来の T0 で Stop の差し戻しが効かなかったため後回し。読む手順は正本の本文で AI 自身に行わせる
- `probe/t0/` の移植、Copilot CLI での非対話の確認
- 置き場のバックアップの仕組み（置き場は git に入らない。`~/.copilot/projects/` を private リポジトリにする案は `docs/apply-guide.md` に書くだけ）

## ドキュメント

- 後回し（2026-10-28 の提案に「異常系全部、すすめて」。文書に触れていない）。最終報告で、作れる文書（設計書 `docs/design.md`、テスト仕様書 `docs/test-report/test-spec.md`）の一覧を出して 1 回だけ確認する

## CI

- 後回し（同上）。入れるなら loop_engineer_copilot の `.github/workflows/node.yml` と同じ（`node --test "setup/test/*.test.mjs"`、PR と main への push、Ubuntu、Node 22）。Private の間は Actions の無料枠を消費する

## 検証コマンド

```bash
node --test "setup/test/*.test.mjs"
```

## 前提（自分で決めたこと）

- 置き場所は `C:/_Copilot/loop_engineer_copilot_public`、GitHub は `ume5555/loop_engineer_copilot_public`（private で作成。公開するかはユーザーが決める）。
  履歴は loop_engineer_copilot から持ち込まず `git init` から始めた（由来の履歴に個人のメールアドレスが入っているため）。ファイルだけ写した
- 名前の「public」は「公開リポジトリで使う前提のルール集」の意味。リポジトリ自体の公開範囲とは別
- 正本の由来は loop_engineer_copilot v1.1.1。差分表は Claude Code 版ではなく loop_engineer_copilot との違いを記録する（`docs/diff-from-copilot.md`）
- 置き場は `~/.copilot/projects/<作業フォルダ名>/`（ユーザーの指定）。作業フォルダ名は作業対象のフォルダ名（worktree なら clone 本体）。Claude の自動メモリのような cwd を潰した名前は使わない（人が読める名前にする）
- 配置は旧版（loop_engineer_copilot v1.1.1 の指示ファイル）と置き換える。並存させると Copilot が両方読んで矛盾するので、`install.mjs` と `check.mjs` が旧版の存在を警告する（消さない。外すのは旧版の `uninstall.mjs`）
- このリポジトリ自身は道具のリポジトリなので、置き場方式の例外として AGENTS.md と PROGRESS.md を追跡する（開発は Claude Code で行い、その Stop フックが `<cwd>/PROGRESS.md` を見るため）
- 名乗りは「指揮役: <モデル名>（Copilot 開発ルール public vX.Y.Z）」。版は 1.0.0 から
- プレースホルダ `{{LOOP_ENGINEER_COPILOT_DIR}}`（この clone のパス）の名前は由来のまま（道具とテストの変更を小さくするため）
- 公開前提: 追跡ファイル・コミット・PR 本文にユーザー名入りのローカルパスや個人のメールアドレスを書かない。置き場のパスは `C:/Users/<ユーザー>/...` の形で書く

## 進捗

### 2026-10-28（その 1）— 着手: フォルダと リポジトリ、正本と道具の置き場対応（中規模、対話。手足: Sonnet 1 回）

**やったこと**
- （作業の区切りで埋める）

**分かったこと**
- 

**次にやること**
- 

**費用・所要**
- 想定 Sonnet の手足 1〜2 回 $0.3〜0.6 / 約 50〜70 分（中。根拠: 実績 1 件。loop_engineer_copilot その 1） → 実績 （作業の区切りで埋める）

## 残課題

- 由来（loop_engineer_copilot）の版が進んだときの追従の手順（差分表を見ながら手で写す。手順は未定）
- Copilot の SessionStart フックの出力が文脈に入るかの確認（入るなら、置き場の PROGRESS.md の先頭を流し込み、worktree へ AGENTS.md を写せる）
- 置き場のバックアップ（`~/.copilot/projects/` を private リポジトリにするか）
