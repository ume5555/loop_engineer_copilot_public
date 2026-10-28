# 導入と確認の手順

この PC の GitHub Copilot に開発ルールを配置し、読まれていることを確かめ、更新し、取り消すまでの手順と、置き場の扱い。
「AI が守ること」と「ユーザーがやること」を分けて書く。

## 前提

- VS Code 1.140 以上と GitHub Copilot Chat（Session Target に Local がある版）。配置先の形が読まれることは、由来の loop_engineer_copilot の T0（2026-10-02、VS Code 1.140.0 / Copilot Chat 0.68.0）で確認した
- Node.js 22 以上（`node --version`）
- この clone（例: `C:/_Copilot/loop_engineer_copilot_public`）。clone を動かすと配置済みのパスが古くなるので、動かしたら `node setup/install.mjs` をやり直す
- 旧版 loop_engineer_copilot の指示ファイル（`~/.copilot/instructions/loop_engineer_copilot.instructions.md`）が配置されている PC では、先にそれを外す（下の「導入」）。並存させると Copilot が両方読んで矛盾する

## 導入

**ユーザーがやること**:

1. 旧版が配置されていれば、旧版の clone（例: `C:/_Copilot/loop_engineer_copilot`）で外す:

   ```bash
   node setup/uninstall.mjs
   ```

2. この clone のフォルダで次を順に実行する。1 つ目は何を書くかを見るだけで、何も書かない。

   ```bash
   node setup/install.mjs --dry-run
   ```

   ```bash
   node setup/install.mjs
   ```

配置されるもの:

- `~/.copilot/instructions/loop_engineer_copilot_public.instructions.md`: frontmatter（`applyTo: '**'`）と目印ブロック（`<!-- loop_engineer_copilot_public:begin hash=… version=… -->` 〜 `<!-- loop_engineer_copilot_public:end -->`）。
  同名のファイルが既にあれば、目印ブロックだけを置き換えるか末尾に足し、他の内容は残す。書き換える前に `.bak-<日時>` を同じフォルダに残す（直近 3 個）
- `~/.copilot/loop_engineer_copilot_public-install.json`: 導入の記録（参照先の clone、版番号）

旧版が残っていると `install.mjs` が注意の 1 行を出す（消しはしない）。

**AI が守ること**: 特になし（導入はユーザーの操作。AI が `~/.copilot` を手で書き換えない）。

## 確認（合言葉方式）

VS Code のチャットは非対話で呼べないので、実際に 1 回聞いて確かめる。

**ユーザーがやること**:

1. 任意のプロジェクトを VS Code で開く
2. Copilot チャットでモードを Agent、Session Target を Local にし、「このプロジェクトの検証コマンドは何？」のような短い質問を送る
3. 返答の 1 行目が次の形なら読まれている:

   > 指揮役: <モデル名>（Copilot 開発ルール public v1.0.0）

   出ないときは、`~/.copilot/instructions/loop_engineer_copilot_public.instructions.md` があるか、VS Code の設定で指示ファイルの読み込みが切られていないか（`github.copilot.chat.codeGeneration.useInstructionFiles`）を見る。
   「（Copilot 開発ルール v1.1.1）」のように public の付かない形で出るなら、旧版が読まれている（旧版の `uninstall.mjs` を実行する）

**AI が守ること**: 名乗りの行を書いたあと、`node <clone>/setup/check.mjs` を 1 回実行し、1 行出たらそのまま写してユーザーに提案する。続けて置き場の PROGRESS.md があれば読む（ルール本文の冒頭の手順）。

## 更新

正本が進んだとき（`git pull` で `setup/` が変わったとき）は、配置をやり直す。

**ユーザーがやること**:

```bash
git pull --ff-only
```

```bash
node setup/install.mjs
```

古いままだと、AI が実行する `check.mjs` が「[loop_engineer_copilot_public] 開発ルールが古い可能性があります（…）」の 1 行を出し、AI が上の 2 つを提案する。

## 取り消し

**ユーザーがやること**:

```bash
node setup/uninstall.mjs --dry-run
```

```bash
node setup/uninstall.mjs
```

目印ブロックだけを除く。他に何も残らなければファイルごと消す。記録ファイルも消す。`.bak-<日時>` と置き場（`~/.copilot/projects/`）は残す（不要なら手で消す）。

## 新しいプロジェクトで始める

**AI が守ること**: 進め方の提案に返事をもらった直後に、雛形を置く。

```bash
node <clone>/setup/new-project.mjs <作業対象> --verify "<検証コマンド>"
```

できるもの:

- `<作業対象>/AGENTS.md`（検証コマンドとプロジェクト固有の約束）。同時に `<作業対象>/.git/info/exclude` に `AGENTS.md` の行を足し、git から外す
- `~/.copilot/projects/<名前>/PROGRESS.md`（進捗メモ。`<名前>` は `--name` か作業対象のフォルダ名）

既にあるファイルは触らない（上書きするなら `--force`）。作業対象に `.git` が無ければ exclude への追記は飛ばして注意を出すので、`git init` のあとにもう一度実行する。
CI のワークフローも置くなら `--ci`（`--ci-os ubuntu,windows` などで内容を変える。`.github/workflows/verify.yml` は成果物として追跡する）。
作業対象に CLAUDE.md があれば AGENTS.md は置かない（Copilot は両方を重ねて読むので同じ指示が二重になる）。

## 置き場（`~/.copilot/projects/`）の扱い

- 1 プロジェクトに 1 フォルダ。中身は `PROGRESS.md` と、作業記録が 6 つを越えたときの `progress-archive/<年>-<月>.md`
- git に入らないので、履歴・バックアップ・別の PC への同期は無い。残したいなら `~/.copilot/projects/` 自体を private リポジトリにする（このリポジトリの範囲外。ユーザーが決める）
- clone し直した PC や新しい worktree には作業対象の AGENTS.md が無い。置き場の PROGRESS.md の「検証コマンド」と「前提」から作り直す（`new-project.mjs` をもう一度実行すると雛形が置かれる）
- クラウドのコーディングエージェント（GitHub 上で動くもの）は置き場も除外した AGENTS.md も読めない。この運用はローカルのチャットだけで進める前提
- `.gitignore` ではなく `.git/info/exclude` を使うのは、`.gitignore` がコミットされて `AGENTS.md` の行が公開リポジトリに残るため

## 用語

- 指揮役: ユーザーと直接やりとりするチャットセッションの AI
- 手足: 指揮役が起動するサブエージェントやカスタムエージェント
- 置き場: 進捗メモを置くリポジトリの外のフォルダ `~/.copilot/projects/<作業フォルダ名>/`
- 正本: ルール本文の元ファイル（`setup/copilot-instructions.user.md`）。配置先を手で直さず、正本を直して `install.mjs` をやり直す
- 目印ブロック: 配置先の中で、この仕組みが書いた範囲を示すコメント。hash と版番号を持ち、`check.mjs` が正本と比べる
