// Simple upload + share-card server
// Usage: npm i && npm start, then open http://localhost:3000/
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Static files for the web app and uploaded assets
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use(express.static(__dirname, { extensions: ['html'] }));

// Basic CORS for API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const id = nanoid(10);
    const ext = path.extname(file.originalname || '.png') || '.png';
    cb(null, `${id}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// Upload endpoint -> returns share URL
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'no_file' });
  const fileName = path.basename(req.file.filename);
  const id = path.parse(fileName).name; // id from filename
  const origin = getOrigin(req);
  const imageUrl = `${origin}/uploads/${fileName}`;
  const shareUrl = `${origin}/share/${id}`;
  res.json({ ok: true, id, imageUrl, shareUrl });
});

// Share page with dynamic OG/Twitter meta
app.get('/share/:id', (req, res) => {
  const id = req.params.id;
  const file = findUploadById(id);
  if (!file) return res.status(404).send('Not found');
  const origin = getOrigin(req);
  const imageUrl = `${origin}/uploads/${file}`;
  const title = 'Christmas WebAR Photo Frame 2025';
  const description = 'クリスマスのフレームで撮影した写真をシェア！';
  const url = `${origin}/share/${id}`;
  const html = `<!DOCTYPE html>
  <html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:alt" content="Christmas WebAR captured image">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta http-equiv="refresh" content="0; url=${origin}">
    <style>body{font-family:sans-serif;padding:24px} .box{max-width:640px;margin:auto;text-align:center}</style>
  </head>
  <body>
    <div class="box">
      <h1>共有ページ</h1>
      <p>数秒後にアプリに戻ります。表示されない場合は <a href="${origin}">こちら</a>。</p>
      <img src="${escapeHtml(imageUrl)}" alt="shared image" style="max-width:100%;height:auto;border-radius:8px"/>
    </div>
  </body>
  </html>`;
  res.set('Cache-Control', 'public, max-age=300');
  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

function getOrigin(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function findUploadById(id) {
  const files = fs.readdirSync(UPLOAD_DIR);
  return files.find(f => path.parse(f).name === id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
