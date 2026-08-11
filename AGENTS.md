# AGENTS.md — 日報生成アプリ Codex開発規約

## 1. このファイルの役割
このリポジトリで作業するCodexは、実装・修正・レビュー・テストの前に本ファイルを読むこと。
本ファイルはAIエージェント向けの最上位プロジェクト規約である。

仕様の優先順位:
1. `01_要件定義書.md`
2. `02_設計書.md`
3. `04_開発フェーズ計画書.md`
4. 対象フェーズの個別実装仕様（Phase00では `05_Phase00実装仕様.md`）
5. `screen_mockup_2.html`
6. 既存実装

矛盾を見つけた場合は上位文書を優先し、勝手に仕様を拡張しない。

## 2. 最重要制約 — 完全ローカル完結
完成アプリはネットワーク通信を一切行ってはならない。

禁止:
- 外部API通信
- Teams API連携
- telemetry / analytics / crash report送信
- auto update / update check
- `fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` 等による外部通信
- Google Fonts、CDN、外部画像、外部JavaScript/CSS等のリモートリソース
- APIキー、アクセストークン、外部サービス認証情報

許可:
- ローカルファイルI/O
- Electron内部IPC
- OSクリップボード
- アプリに同梱したローカル資産

依存追加時は、目的・必要性・通信有無を確認し、標準APIで代替できるなら依存を増やさない。

## 3. AI開発時の機密情報
- 実在の顧客名、案件名、業務内容、個人情報、認証情報をfixture・テスト・コメント・ログ・スクリーンショットに使用しない
- `案件A`, `案件B`, `要件確認MTG` 等のダミーデータを使用する
- 本番日報データを外部AIサービスへ送る機能を提案・実装しない
- 機密データをデバッグ出力しない

## 4. Codexの作業手順
1. `AGENTS.md` を確認
2. `01_要件定義書.md` と `02_設計書.md` の対象箇所を確認
3. `04_開発フェーズ計画書.md` の対象フェーズを確認
4. 対象フェーズの個別実装仕様があれば確認（Phase00は `05_Phase00実装仕様.md`）
5. 関連する既存コードとテストを読む
6. 変更予定ファイルと検証方法を短く整理
7. 対象フェーズに必要な最小差分で実装
8. 自動テスト・静的確認を実行
9. `git diff` で意図しない変更を確認
10. 完了条件ごとに PASS / FAIL / NOT VERIFIED を報告
11. スコープ外改善案は実装せず報告

## 5. スコープ管理
- 原則1タスク＝1フェーズ
- 対象フェーズ外を先回り実装しない
- 大規模リファクタリングを「ついで」に行わない
- スコープ外ファイル変更が必要なら理由を明示
- 最小差分を優先
- 不要な依存・抽象化・設定を増やさない

## 6. Electronセキュリティ
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- rendererからNode.js / filesystemへ直接アクセスさせない
- OS依存処理とファイルI/Oはmain側へ寄せる
- preloadは`contextBridge`で必要最小限のAPIのみ公開
- 任意コマンド実行や任意パスアクセスを許す汎用IPCを作らない
- rendererから受け取った値はmain側でも検証
- 外部URLへ遷移・新規ウィンドウを開く機能は原則実装しない

## 7. データ・ドメイン規約
- UIの基本単位は「作業ブロック」
- 同一案件の作業ブロックが1日に複数存在してよい
- 表示・出力は`startTime`昇順。未入力は末尾
- 保存はローカルJSON
- 日報は日付単位
- 出力時に同一案件をまとめない
- 整形ロジックをUIから分離して単体テスト可能にする

## 8. UI規約
- `screen_mockup_2.html` は見た目・操作感の参考
- 要件・設計と矛盾する場合は要件・設計を優先
- デザイントークンを利用
- 案件色を全画面で一貫
- 必須入力・時刻矛盾はその場で通知
- キーボード操作とフォーカス表示を損なわない
- 外部Webフォントは使用しない

## 9. テスト方針
最低限優先するケース:
- project CRUD
- report save/load
- 同一案件を複数回含むreport
- `startTime`ソート
- 時刻未入力ブロックが末尾
- 所要時間計算
- 終了時刻 < 開始時刻
- progressPercent 0 / 100 / 範囲外
- 日報整形
- clipboard境界
- ファイル書込失敗

テスト不能なら成功と推測せず `NOT VERIFIED` とする。

## 10. 通信禁止の静的チェック
フェーズ完了時は `npm run check:network` を実行する。
Phase00でWindows/Mac共通の `scripts/check-network.mjs` を作成し、それ以降はこのスクリプトを標準とする。

`grep` 等のOS依存コマンドだけを正式な検証手段にしない。
ヒットした場合は無害な文字列か実通信かを確認し、allowlistには理由を残す。
外部リソース参照があれば完了扱いにしない。


## 11. 技術スタック固定方針
- Electron
- TypeScript
- Electron Forge
- Webpack
- Vanilla HTML/CSS/TypeScript
- Vitest
- npm
- Node.js 24 LTS
- Forge ZIP maker
- React / Vue / UI frameworkは使用しない
- CSS frameworkは使用しない

Phase00の詳細は `05_Phase00実装仕様.md` を参照する。
依存追加・技術置換はユーザーの明示承認なしに行わない。

## 12. Git規約
- `main` は常に動作可能
- フェーズブランチ: `feature/phaseNN-<short-name>`
- コミット形式: `[Phase NN] <内容>`
- ユーザーから明示依頼されない限り、Codexはcommit / tag / mergeを自動実行しない
- 実装完了時はコミットメッセージ案を提示

## 13. 完了報告フォーマット
```text
実装:
- ...

変更ファイル:
- ...

検証:
- PASS: ...
- FAIL: ...
- NOT VERIFIED: ...

完了条件:
- [x] ...
- [ ] ...

スコープ外メモ:
- ...

コミット案:
[Phase NN] ...
```

完了条件が満たせない場合は完了と宣言しない。
