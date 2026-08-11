# Codexでの開発開始手順 — 確定版

## 1. 採用スタック

- Electron
- TypeScript
- Electron Forge
- Webpack
- Vanilla HTML / CSS / TypeScript
- Vitest
- npm
- Node.js 24 LTS
- Forge ZIP maker

Phase00の詳細は `05_Phase00実装仕様.md` に固定してあります。

## 2. 推奨配置

このフォルダのファイルをGitリポジトリ直下へ配置してください。
`AGENTS.md` は必ずリポジトリルートに置きます。

## 3. Codexで最初に実行するタスク

`PHASE00_CODEX_PROMPT.txt` の内容をCodexへ渡してください。

Codexにはcommitをさせず、まず実装・テスト・差分確認まで行わせます。

## 4. Phase00後

1. CodexのPASS / FAIL / NOT VERIFIEDを確認
2. `npm run check` の結果を確認
3. `npm run package` / `npm run make` の結果を確認
4. `git diff`を人間が確認
5. 問題がなければ人間がcommit
6. 別CodexタスクでPhase00レビューを実施してもよい
7. Phase01へ進む

## 5. AI駆動開発の推奨サイクル

```text
実装Codexタスク
    ↓
自動テスト / typecheck / network check
    ↓
レビューCodexタスク
    ↓
必要な指摘のみ修正
    ↓
人間レビュー
    ↓
commit
    ↓
次Phase
```

## 6. 機密情報

完成アプリは完全オフラインですが、Codexを使う開発工程ではリポジトリ内容がAI処理対象になる場合があります。
実在顧客の日報・案件名・業務情報・認証情報をリポジトリ、テスト、ログ、スクリーンショットへ入れないでください。
開発データは `案件A`、`案件B` 等のダミーデータだけを使用します。
