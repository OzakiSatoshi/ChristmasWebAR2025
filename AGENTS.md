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

## WebAR フェイストラッキング
- ライブラリ優先度:
  - 1) MediaPipe Face Detection（CDN: `@mediapipe/face_detection`）
  - 2) ブラウザ組み込み `FaceDetector` API（フォールバック）
- 読み込み方法:
  - まず `index.html` に CDN スクリプトを追加するか、アプリ側で動的にロードして初期化を試行。
  - MediaPipe が見つからない場合は `FaceDetector` で矩形検出 → 相対座標に変換して利用。
- セキュアコンテキスト:
  - カメラは HTTPS もしくは `localhost` 等のセキュア同等コンテキストが必要。
  - ローカル検証は `http://localhost:8080` を推奨。LAN IP 直アクセスはカメラ不可の場合あり。
- オーバーレイ設計:
  - ライブ表示は DOM オーバーレイ（`img.head-gear` と `div.nose-dot`）。
  - 撮影時は `canvas` にビデオ・装飾・タイトル・頭部装飾（および鼻）を合成。
- アセットとランダム表示:
  - 額: `tonakai_tsuno.png`（トナカイの角）または `Santabou.png`（サンタ帽）をランダム表示。
  - `tonakai_tsuno.png` 選択時は鼻に赤い球（グラデーションで球体表現）を追加。
- スタイル指針:
  - オーバーレイは `position: absolute; pointer-events: none;`、`transform-origin: center top;`。
  - サイズは顔のバウンディングボックス幅に応じてスケーリング（角: 約1.6倍、帽子: 約1.4倍）。
- パフォーマンス:
  - 検出は `requestAnimationFrame` ループで送出。処理中フラグで多重送信を防止。
  - 画像は事前プリロード。必要に応じて `ideal` 解像度で getUserMedia を要求。
- 既知の留意点:
  - CDN ブロック時は組み込み `FaceDetector` フォールバックを使用。両方無い環境ではトラッキングなしで撮影のみ動作。
  - iOS/Safari は `FaceDetector` 未対応の可能性があるため、CDN 到達性を確保する。
