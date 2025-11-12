# Christmas WebAR Photo Frame 2025

## 概要
スマートフォンのブラウザでアクセスすると、クリスマスのSVGフレームが重なった状態で写真を撮影できるWebARアプリケーションです。

## 機能
- 📷 リアルタイムカメラプレビュー with クリスマスフレーム
- 💾 撮影した画像を端末に保存
- 🐦 X（Twitter）でページURLをシェア
- 👍 FacebookでページURLをシェア
- 📱 各種SNSアプリへ画像を直接共有（Web Share API対応）
- 🎄 美しいSVGアニメーション効果

## 必要なファイル
1. `index.html` - メインHTMLファイル
2. `styles.css` - スタイルシート
3. `app.js` - JavaScriptアプリケーションロジック
4. `tree.svg` - クリスマスツリーのSVG
5. `snowman.svg` - 雪だるまのSVG
6. `santa.svg` - サンタクロースのSVG
7. `star.svg` - 星のSVG
8. `snowflake.svg` - 雪の結晶のSVG

## セットアップ手順

### 1. HTTPSサーバーの準備
カメラAPIを使用するため、HTTPS接続が必須です。

#### ローカル開発環境
```bash
# Python 3を使用した場合
python3 -m http.server 8000

# Node.jsのhttp-serverを使用した場合
npm install -g http-server
http-server -S -C cert.pem -K key.pem
```

#### 本番環境
- **VPS**: Nginx/Apache with SSL証明書（Let's Encrypt推奨）
- **S3 + CloudFront**: AWS S3に静的ファイルをアップロードし、CloudFront経由で配信
- **Netlify/Vercel**: 自動HTTPS対応の静的ホスティングサービス

### 2. ファイルの配置
すべてのファイルを同じディレクトリに配置してください。

```
/your-web-root/
├── index.html
├── styles.css
├── app.js
├── tree.svg
├── snowman.svg
├── santa.svg
├── star.svg
└── snowflake.svg
```

### 3. アクセスと動作確認
1. HTTPSでサイトにアクセス
2. カメラの使用許可を与える
3. 撮影ボタンで写真を撮る
4. 保存・シェア機能を利用

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

## カスタマイズ

### テキストの変更
`index.html`と`app.js`内の以下の箇所を編集：
- "Merry Christmas 2025" → お好みのメッセージ
- "WebAR Powered by Qukuri" → ブランド表記

### デザインの調整
`styles.css`で以下を変更可能：
- ボタンの色・サイズ
- SVGの配置・サイズ
- アニメーション速度
- フォントスタイル

### SVGの差し替え
同じ`viewBox`サイズを維持しつつ、独自のSVGファイルに差し替え可能です。

## トラブルシューティング

### カメラが起動しない
- HTTPS接続を確認
- ブラウザのカメラ権限を確認
- 他のアプリがカメラを使用していないか確認

### 画像共有ができない
- Web Share APIは一部のブラウザで未対応
- フォールバック：画像を保存してから手動で共有

### SVGが表示されない
- ファイルパスが正しいか確認
- SVGファイルが正しくアップロードされているか確認

## ライセンス
このプロジェクトはサンプルコードとして提供されています。
商用利用の際は適切なライセンス表記とクレジットをお願いします。

## サポート
問題が発生した場合は、ブラウザのコンソールでエラーメッセージを確認してください。

---
WebAR Powered by Qukuri © 2025