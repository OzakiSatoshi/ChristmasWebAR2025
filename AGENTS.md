# Repository Guidelines

## プロジェクト構成とモジュール配置
- HTML エントリ: `index.html`, `preview.html`。
- スタイル: `styles.css`。
- スクリプト: `app.js`（DOM とインタラクションの処理。インラインスクリプトは避ける）。
- アセット: ルート配下の `*.svg`。ファイル名は小文字-kebab-case（例: `snowflake.svg`）。

## ビルド・テスト・開発コマンド
- 静的サイトのためビルド不要。ローカルでは `file://` を避け、HTTP で配信。
- Python: `python -m http.server 8080` → `http://localhost:8080` を開く。
- Node（インストール済みの場合）: `npx http-server .` または `npx serve .`。
- エディタの Live Server プラグインも利用可。

## コーディングスタイルと命名規則
- インデント: HTML/CSS/JS すべて 2 スペース。
- JavaScript: ES2015+。`const`/`let`、厳密等価（`===`）、小さな関数。グローバル回避し `app.js` に集約。
- CSS: クラス名は kebab-case。flex/grid を優先。共通ルールや変数は先頭で整理。
- ファイル名: 小文字-kebab-case。例: `santa.svg`, `snowman.svg`。
- HTML のインライン style/script は避け、`styles.css` と `app.js` をリンク。

## テスト方針
- テストフレームワーク未設定。最新の Chrome/Firefox/Edge で手動確認。
- レスポンシブ確認: 約 360px / 768px / 1280px 幅。
- 見た目の即時確認には `preview.html` を使用。
- JS 変更時は PR に手動手順と期待結果を記載。

## コミットと Pull Request ガイドライン
- 可能なら Conventional Commits を推奨:
  - `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`
- PR には以下を含める:
  - 変更内容と背景の明確な説明。
  - 視覚的変更のスクリーンショット/GIF。
  - 実施した手動テストと既知の制限。
  - Issue 連携（例: `Closes #123`）。

## アセットとパフォーマンスのヒント
- コミット前に SVG を最適化（例: `svgo`）。
- DOM クエリはスコープを絞り、非重要な JS は遅延実行。
- 小さな SVG はインライン化し、大きなものは参照にして HTML を軽量化。
