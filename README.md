# Christmas WebAR Photo Frame 2025

## 概要
スマートフォンのブラウザでアクセスすると、クリスマスのフレームとエフェクトを重ねて写真撮影できる WebAR アプリケーションです。額にサンタ帽またはトナカイの角（赤鼻付き）がランダムで表示され、撮影画像にも合成されます。

## 機能
- 📷 リアルタイムカメラプレビュー with クリスマスフレーム
- 💾 撮影した画像を端末に保存
- 🐦 X（Twitter）でページURLをシェア
- 👍 FacebookでページURLをシェア
- 📱 各種SNSアプリへ画像を直接共有（Web Share API対応）
- 🎄 美しい装飾（ツリー/雪だるま/サンタ/星/雪）
- 🤳 顔トラッキング（MediaPipe Face Detection or FaceDetector 互換）

## 必要なファイル
1. `index.html` - メインHTMLファイル
2. `styles.css` - スタイルシート
3. `app3.js` - JavaScriptアプリケーションロジック（本番用）
4. `styles.css` - スタイルシート
5. 画像アセット
   - `MerryChristmas2025.png`（タイトル画像）
   - `tree.png`（ツリー、以前の `tree.svg` から差し替え）
   - `snowman.png`（雪だるま、以前の `snowman.svg` から差し替え）
   - `santa.svg`, `star.svg`, `snowflake.svg`
   - `tonakai_tsuno.png`（トナカイの角）
   - `Santabou.png`（サンタ帽）
6. `santa.svg` - サンタクロースのSVG
7. `star.svg` - 星のSVG
8. `snowflake.svg` - 雪の結晶のSVG

## セットアップ手順

### 1. 開発サーバーの準備
カメラAPIは「HTTPSまたは localhost 等のセキュア同等コンテキスト」で動作します。開発では HTTP の `http://localhost` を利用してください（LAN の IP 直アクセスは不可の場合があります）。

#### ローカル開発環境
```bash
# Python 3 を使用する場合（例: 8080）
python -m http.server 8080

# Node.js の http-server / serve を使用する場合
npx http-server .
# または
npx serve .
```

#### 本番環境
- **VPS**: Nginx/Apache with SSL証明書（Let's Encrypt推奨）
- **S3 + CloudFront**: AWS S3に静的ファイルをアップロードし、CloudFront経由で配信
- **Netlify/Vercel**: 自動HTTPS対応の静的ホスティングサービス

### 2. ファイルの配置
すべてのファイルを同じディレクトリに配置してください。

```
./
├── index.html
├── preview.html
├── styles.css
├── app3.js
├── MerryChristmas2025.png
├── tree.png
├── snowman.png
├── santa.svg
├── star.svg
├── snowflake.svg
├── tonakai_tsuno.png
└── Santabou.png
```

### 3. アクセスと動作確認
1. `http://localhost:8080` にアクセス（または HTTPS ホスティング）
2. カメラの使用許可を与える
3. 画面上部にタイトル画像、左下にツリー、右下に雪だるまが表示されることを確認
4. 顔を写すと、ランダムに「サンタ帽」または「トナカイの角 + 赤鼻」が追従表示
5. 撮影ボタンで写真を撮る（オーバーレイは画像へ合成されます）
6. 保存・シェア機能を利用

## 対応環境

### 対応ブラウザ
- iOS Safari 14+
- Chrome 80+ (Android/Desktop)
- Firefox 78+ (Android/Desktop)
- Edge 79+

### 必要なAPI
- MediaDevices.getUserMedia() - カメラアクセス
- Canvas API - 画像合成
- Web Share API - SNS共有（オプション）
- MediaPipe Face Detection（CDN）または `FaceDetector`（フォールバック）

## カスタマイズ

### テキストの変更
`index.html` と `app3.js` 内の以下を編集：
- タイトル画像（`MerryChristmas2025.png`）の差し替え
- クレジット表記（"WebAR Powered by Qukuri"）の変更

### デザインの調整
`styles.css` で以下を変更可能：
- ボタンの色・サイズ
- 装飾画像（ツリー/雪だるま/サンタ/星）の配置・サイズ
- アニメーション速度
- フォントスタイル

### SVGの差し替え
`tree.png`, `snowman.png` など画像の差し替え可能です（解像度に注意）。

### フェイストラッキングの挙動
- 起動時にランダムで以下いずれかを表示します：
  - トナカイの角（`tonakai_tsuno.png`）＋ 赤鼻（球体グラデーション）
  - サンタ帽（`Santabou.png`）
- ライブは DOM オーバーレイで追従、撮影時は Canvas に合成されます。

### メディアライブラリ
- 既定では CDN から MediaPipe Face Detection を読み込みます。
- CDN が使えない場合はブラウザ組み込み `FaceDetector` を使用（未対応環境ではトラッキングなしで撮影のみ可能）。

## トラブルシューティング

### カメラが起動しない
- `http://localhost` でアクセスしているか（または HTTPS）
- ブラウザのカメラ権限を確認
- 他アプリがカメラを占有していないか確認

### 画像共有ができない
- Web Share APIは一部のブラウザで未対応
- フォールバック：画像を保存してから手動で共有

### フェイストラッキングが動かない
- ネットワークで `@mediapipe/face_detection/face_detection.js` が取得できているか
- ブラウザが `FaceDetector` に対応しているか（iOS Safari は非対応の場合あり）
- いずれも不可の場合はトラッキング無しで撮影のみ動作（仕様）

## ライセンス
このプロジェクトはサンプルコードとして提供されています。
商用利用の際は適切なライセンス表記とクレジットをお願いします。

## サポート
問題が発生した場合は、ブラウザのコンソールでエラーメッセージを確認してください。

---
WebAR Powered by Qukuri © 2025
