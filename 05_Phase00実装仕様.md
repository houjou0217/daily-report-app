# Phase 00 実装仕様 — Codex確定版

## 1. 目的

Phase 00では、以降の全フェーズの土台となるElectronアプリケーションを初期化し、
セキュリティ境界・ビルド・テスト・静的検査を最初に確立する。

このフェーズでは日報の業務機能は実装しない。

---

## 2. 採用技術スタック

| 項目 | 採用 |
|---|---|
| デスクトップ | Electron |
| 言語 | TypeScript |
| プロジェクト管理/パッケージング | Electron Forge |
| バンドラ | Webpack |
| UI | Vanilla HTML / CSS / TypeScript |
| テスト | Vitest |
| パッケージマネージャ | npm |
| Node.js | Node.js 24 LTS |
| 配布形式 | Electron Forge ZIP maker |
| データ保存 | Phase01からローカルJSON |
| UIフレームワーク | 使用しない |
| CSSフレームワーク | 使用しない |
| 外部Webフォント/CDN | 使用しない |

### 採用理由

- Electron Forgeのfirst-party TypeScript + Webpackテンプレートを利用し、初期構成の独自性を減らす
- React/Vue等を導入せず、この規模のアプリに不要な依存・抽象化を増やさない
- WebpackはElectron Forgeで安定したfirst-partyテンプレートとして利用できる
- Vitestはドメインロジック・データ層の高速な単体テストに利用する
- npm + package-lock.json で依存バージョンを固定する
- ZIP makerを利用し、インストーラなしで配布できる構成にする

---

## 3. 初期化方針

Codexは原則、Electron ForgeのTypeScript + Webpackテンプレート相当の構成を作成する。

新規リポジトリで実行可能な場合の基準コマンド:

```bash
npx create-electron-app@latest . --template=webpack-typescript
```

ただし、既に要件定義書・設計書・AGENTS.md等が存在するため、
上記コマンドが既存ファイルを上書きする可能性がある場合は無理に実行しない。
その場合はテンプレート相当の必要ファイルのみを追加する。

Codexは既存Markdown/HTML資料を削除・上書きしてはならない。

---

## 4. Phase00完了時のディレクトリ構成

```text
/
├─ AGENTS.md
├─ 01_要件定義書.md
├─ 02_設計書.md
├─ 04_開発フェーズ計画書.md
├─ 05_Phase00実装仕様.md
├─ CODEX_開発開始ガイド.md
├─ screen_mockup_2.html
├─ package.json
├─ package-lock.json
├─ forge.config.ts
├─ tsconfig.json
├─ webpack.main.config.ts
├─ webpack.renderer.config.ts
├─ webpack.rules.ts
├─ scripts/
│  └─ check-network.mjs
├─ src/
│  ├─ main/
│  │  └─ main.ts
│  ├─ preload/
│  │  └─ preload.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  ├─ index.ts
│  │  └─ styles.css
│  ├─ domain/
│  └─ data/
└─ tests/
   └─ smoke/
      └─ project.test.ts
```

テンプレートが生成するファイル名と多少異なる場合でも、
責務が明確で、main / preload / renderer が分離されていればよい。

---

## 5. package.json scripts

最低限、以下の意味を持つscriptsを定義する。

```json
{
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "check:network": "node scripts/check-network.mjs",
    "check": "npm run typecheck && npm run test && npm run check:network"
  }
}
```

テンプレート都合でコマンド表現が変わる場合でも、同等機能を維持する。

---

## 6. TypeScript

`tsconfig.json` は可能な範囲でstrictにする。

最低条件:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

Electron Forgeテンプレートとの互換性を優先し、
上記設定でテンプレート由来コードが破綻する場合は理由を説明した上で調整する。

`any` の安易な利用は禁止する。

---

## 7. BrowserWindow セキュリティ設定

Phase00で生成するウィンドウは以下を満たす。

```ts
webPreferences: {
  preload: PRELOAD_PATH,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

さらに以下を守る。

- `webSecurity` を無効化しない
- `allowRunningInsecureContent` を有効化しない
- `experimentalFeatures` を有効化しない
- `<webview>` を使用しない
- `shell.openExternal` を使用しない
- 任意URLへのnavigationを許可しない
- 新規window生成を許可しない
- rendererで`require()`を使用しない

Phase00では外部Webページを表示する要件はない。

---

## 8. preload / IPC

Phase00では業務用IPCをまだ作らない。

preloadは空に近い状態でよく、
将来IPCを追加するための安全な境界だけを作成する。

禁止例:

```ts
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer
})
```

```ts
contextBridge.exposeInMainWorld('api', {
  send: ipcRenderer.send,
  invoke: ipcRenderer.invoke
})
```

rendererへElectronの汎用APIを丸ごと公開しない。

Phase01以降でIPCを追加する場合は、
ユースケース単位の具体的な関数だけを公開する。

---

## 9. Content Security Policy

rendererのHTMLにCSPを設定する。

本番方針:

```text
default-src 'self';
connect-src 'none';
img-src 'self' data:;
font-src 'self';
style-src 'self';
script-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none';
```

Webpack dev serverとの関係で開発時だけ追加設定が必要な場合は、
本番ビルドのCSPを弱めないこと。

外部ドメインを許可する方法で解決してはならない。

---

## 10. Electron Fuses

Electron ForgeのFuses pluginを使用できる構成であれば、
少なくとも `RunAsNode` を無効化する。

その他のFuseは、Electron Forgeテンプレート・現在のElectronバージョンとの互換性を確認し、
安全性を高められるものを採用する。

Codexは互換性を確認せずFuse値を推測して設定しない。

---

## 11. 静的通信チェック

Unixの`grep`だけに依存せず、Windows/Mac双方で動くNode.jsスクリプト
`scripts/check-network.mjs` を作成する。

対象:
- `src/`
- renderer HTML/CSS
- `package.json`
- Forge設定
- その他アプリへ同梱されるテキスト資産

検出候補:
- `http://`
- `https://`
- `fetch(`
- `axios`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `sendBeacon`
- `autoUpdater`
- `crashReporter`
- Google Fonts
- CDN参照

注意:
- SVG namespace `http://www.w3.org/2000/svg` のような通信を発生させない文字列はallowlist化してよい
- ヒットを黙って無視せず、allowlist理由をコード上で明示する
- 禁止パターンが見つかった場合はexit code 1で失敗させる

---

## 12. テスト

Phase00では最低限以下を確認する。

### 自動テスト
- テストランナーが起動する
- ダミーのsmoke testがPASSする
- TypeScript typecheckがPASSする
- network static checkがPASSする

### 手動/実行確認
- `npm start` で空のアプリウィンドウが開く
- rendererにNode.js APIが露出していない
- DevTools consoleに重大なElectron security warningがない
- 外部通信がなくても画面が表示される

---

## 13. パッケージング

Phase00では現在の開発OS上で次を確認する。

```bash
npm run package
npm run make
```

Forge makerはZIPを基本とする。

最終的なWindows / Mac両OSの成果物確認はPhase09で行う。
Phase00で「Win/Mac双方で確認済み」と報告してはならない。

---

## 14. Phase00で実装しないもの

- project CRUD
- report CRUD
- 日報画面
- 案件管理画面
- clipboard
- 自動保存
- 日報整形
- 履歴
- Teams連携
- updater
- telemetry
- analytics
- 実データ

画面は「アプリが起動することを確認できる最小UI」だけでよい。

---

## 15. Phase00完了条件

すべて満たした場合のみPASS。

```text
[ ] Electron + TypeScript + Forge + Webpackで起動可能
[ ] main / preload / renderer が分離
[ ] contextIsolation=true
[ ] nodeIntegration=false
[ ] sandbox=true
[ ] rendererへ汎用Electron APIを公開していない
[ ] 外部リソース参照なし
[ ] npm run typecheck PASS
[ ] npm run test PASS
[ ] npm run check:network PASS
[ ] npm run package PASS
[ ] 現在の開発OSでnpm startの画面確認済み
[ ] git diffにスコープ外変更なし
[ ] Windows/Macの未実機側はNOT VERIFIEDと明記
```
