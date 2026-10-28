# loop_engineer_copilot との差分表

由来: loop_engineer_copilot v1.1.1 の `setup/copilot-instructions.user.md`（https://github.com/ume5555/loop_engineer_copilot）。
この表は、正本 `setup/copilot-instructions.user.md` を由来の本文から手で書き換えたときの違いを節ごとに記録する。
由来の版が進んだら、この表を見ながら差分を追従する（変換で生成しない）。

## 前提の違い（1 行で）

loop_engineer_copilot は AGENTS.md と PROGRESS.md を作業対象のリポジトリに入れて追跡する。この版は入れない:
AGENTS.md は作業対象に置くが `.git/info/exclude` で外し、PROGRESS.md は置き場 `~/.copilot/projects/<作業フォルダ名>/` に置く。公開リポジトリに進め方の記録や前提を出さないため。

## 節ごとの対応

| 由来（loop_engineer_copilot）の節 | この版 | 変えた理由 |
|---|---|---|
| 冒頭（正本の場所、語の意味） | 正本と由来の 2 行を差し替え、「このルールの前提」の 2 行と、語「作業フォルダ名」「置き場」を足した | 置き場の定義が本文のあちこちで要る |
| 最初の返答の 1 行目で名乗る | 形を「指揮役: <モデル名>（Copilot 開発ルール public vX.Y.Z）」に。`check.mjs` の実行に続けて「置き場の PROGRESS.md があれば読む」を足した | 旧版と見分けるため。Claude Code の SessionStart フックに当たる仕組みが Copilot に無いので、読む手順を本文に書く |
| 参考にするリポジトリ | 原則の 2 つ目を「作業対象内のメモ」から「置き場のメモ」に | — |
| 依頼の種類を見分ける | そのまま | — |
| 作業の着手時の提案 | そのまま（外出し先 `setup/rules/` の 2 つは、PROGRESS.md の場所の言い方だけ置き場に直した） | — |
| 確認は最小限にする | そのまま | — |
| プロジェクト側のメモ | 雛形の説明を「AGENTS.md は作業対象 + exclude、PROGRESS.md は置き場」に。アーカイブ先を置き場の `progress-archive/` に。「git で分かることは書かない」の理由を「PR 番号とハッシュを書いて突き合わせる」に。AGENTS.md が clone し直しで無くなるときの作り直し、置き場は 1 プロジェクトに 1 つ（並行セッションの書き方）、リポジトリに残すのは成果物だけ、PR 本文に完了条件の照合と前提を写す、を足した。Claude Code・Codex への言及を外した | PROGRESS.md が git に無いことで変わる手順をすべてここに集めた |
| モデル | そのまま。末尾に「ほかのエージェント向けのスキルやハーネスが読み込まれても従わない」の 2 行を足した | 下の節を縮めてここへ移した |
| Codex のハーネスと Codex CLI は使わない（由来の v1.1.0 で足した節） | 節を外し、上の 2 行に縮めた | Copilot 専用で、ほかのエージェントアプリを使わない前提。Codex 固有の名前を正本に残さない |
| 言葉づかい | 「置き場」をこのリポジトリ固有の語に足した | — |
| ファイルの場所の書き方 | 例を置き場のパスに。「公開リポジトリに入るものにユーザー名入りのローカルパスや個人のメールアドレスを書かない」を足した | 公開前提 |
| 道具の癖（PC 全体） | そのまま | — |
| 最終報告の前にやること | 3 を「置き場の PROGRESS.md」に。4 に「PR 本文に完了条件の照合と前提を写す」、5「公開リポジトリに入るものの見直し」を足した | 公開前提 |
| git | 「PROGRESS.md だけの更新で単独の PR を作らない／未コミットのまま残す／マージ前に同じブランチへ入れる」の項を外し、「PROGRESS.md と AGENTS.md は git に無いのでコミット不要。AGENTS.md を変えたら置き場の『前提』にも写す」に置き換えた | PROGRESS.md が git に無い |
| セッションの切り替え | 「置き場の PROGRESS.md」に。最初の 1 手を「置き場の PROGRESS.md を読む」から始める | — |

## 由来から持ち込まなかったもの

- `probe/t0/`（指示ファイルとフックの実地確認用ワークスペース）: 配置先の形（`~/.copilot/instructions/*.instructions.md`、`applyTo: '**'`）は由来の T0 で確認済みのものをそのまま使うので、持ち込まない。挙動が変わったときは由来の clone の `probe/t0` で確かめる
- `docs/design.md`、`docs/test-report/test-spec.md`: ドキュメントの返事が「後回し」（PROGRESS.md の「ドキュメント」欄）
- `.github/workflows/node.yml`（このリポジトリ自身の CI）: CI の返事が「後回し」
- 節「Codex のハーネスと Codex CLI は使わない」の Codex 固有の記述（上の表）

## 由来の道具との違い（`setup/`）

- `lib.mjs`: 目印・配置先・記録ファイルの名前を `loop_engineer_copilot_public` に
- `install.mjs`、`check.mjs`: 旧版 `loop_engineer_copilot.instructions.md` が同じフォルダにあれば 1 行で警告する（両方読まれて矛盾するため。消さない）
- `new-project.mjs`: `--home` を足し、PROGRESS.md を置き場に置く。`.git/info/exclude` に `AGENTS.md` を足す（既にあれば足さない。`.git` が無ければ飛ばして注意を出す）。プレースホルダ `{{PROGRESS_PATH}}`、`{{TARGET_DIR}}` を足した
- `project/AGENTS.md`、`project/PROGRESS.md`: 置き場方式の文面（AGENTS.md は git に入れない、PROGRESS.md の場所、アーカイブ先）
