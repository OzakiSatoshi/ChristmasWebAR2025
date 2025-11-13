// Christmas WebAR - capture, preview, and share (clean UTF-8)
class ChristmasAR {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.capturedImage = null;
    this.svgImages = {};
    this.isCapturing = false;
    this._shareUrl = '';
    this._uploadFailedNotified = false;

    // Face overlays / detection
    this.fd = null;
    this._fdBusy = false;
    this.lastDetection = null;
    this.headChoice = Math.random() < 0.5 ? 'antlers' : 'santa';
    this.headImg = new Image();
    this.titleImg = new Image();
    this.headEl = null;
    this.noseEl = null;

    this.init();
  }

  async init() {
    this.video = document.getElementById('camera-video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.setupEventListeners();
    await this.preloadImages();
    await this.startCamera();
    await this.setupFaceOverlays();
    this.startFaceDetectionLoop();
    this.createSnowflakes();
  }

  async preloadImages() {
    const images = {
      tree: 'tree.png',
      snowman: 'snowman.png',
      santa: 'santa.svg',
      star: 'star.svg',
      snowflake: 'snowflake.svg',
      title: 'MerryChristmas2025.png',
      antlers: 'tonakai_tsuno.png',
      hat: 'Santabou.png'
    };
    for (const [name, path] of Object.entries(images)) {
      const img = new Image();
      img.src = path;
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      this.svgImages[name] = img;
    }
    this.titleImg = this.svgImages.title;
    this.headImg = this.headChoice === 'antlers' ? this.svgImages.antlers : this.svgImages.hat;
  }

  async startCamera() {
    try {
      const constraints = { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise((resolve) => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
      const loading = document.querySelector('.loading');
      if (loading) loading.remove();
      document.getElementById('controls').classList.remove('hidden');
    } catch (e) {
      console.error('Camera access error:', e);
      this.showError('Camera access was denied. Please allow camera usage in your browser settings.');
    }
  }

  async setupFaceOverlays() {
    const overlay = document.getElementById('overlay');
    // Head gear element
    this.headEl = document.createElement('img');
    this.headEl.id = 'head-gear';
    this.headEl.className = 'head-gear';
    this.headEl.alt = this.headChoice === 'antlers' ? 'Reindeer Antlers' : 'Santa Hat';
    this.headEl.src = this.headImg && this.headImg.src ? this.headImg.src : '';
    this.headEl.style.display = 'none';
    overlay.appendChild(this.headEl);

    // Nose only for antlers
    if (this.headChoice === 'antlers') {
      this.noseEl = document.createElement('div');
      this.noseEl.id = 'nose-dot';
      this.noseEl.className = 'nose-dot';
      this.noseEl.style.display = 'none';
      overlay.appendChild(this.noseEl);
    }

    // Setup MediaPipe Face Detection (if loaded)
    if (window.FaceDetection && window.FaceDetection.FaceDetection) {
      this.fd = new window.FaceDetection.FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
      });
      this.fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
      this.fd.onResults((results) => this.onFaceResults(results));
    } else {
      console.warn('MediaPipe Face Detection library not found.');
    }
  }

  startFaceDetectionLoop() {
    if (!this.fd) return;
    const loop = async () => {
      if (!this.video || !this.video.videoWidth) { requestAnimationFrame(loop); return; }
      if (!this._fdBusy) {
        this._fdBusy = true;
        try {
          await this.fd.send({ image: this.video });
        } catch (e) {
          // ignore
        } finally {
          this._fdBusy = false;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  onFaceResults(results) {
    const det = results && results.detections && results.detections[0];
    const vw = this.video.videoWidth || 0;
    const vh = this.video.videoHeight || 0;
    if (!det || !vw || !vh) {
      this.lastDetection = null;
      if (this.headEl) this.headEl.style.display = 'none';
      if (this.noseEl) this.noseEl.style.display = 'none';
      return;
    }

    // Relative bounding box to pixels
    const bb = det.boundingBox || {};
    const w = (bb.width || ((bb.xMax || 0) - (bb.xMin || 0))) * vw;
    const h = (bb.height || ((bb.yMax || 0) - (bb.yMin || 0))) * vh;
    const xCenter = (bb.xCenter !== undefined ? bb.xCenter * vw : ((bb.xMin || 0) * vw + w / 2));
    const yCenter = (bb.yCenter !== undefined ? bb.yCenter * vh : ((bb.yMin || 0) * vh + h / 2));
    const yMin = yCenter - h / 2;

    // Position head element
    const headScale = this.headChoice === 'antlers' ? 1.6 : 1.4;
    const gearW = w * headScale;
    const ratio = (this.headImg && this.headImg.naturalWidth) ? (this.headImg.naturalHeight / this.headImg.naturalWidth) : 1;
    const gearH = gearW * ratio;
    const gearX = xCenter - gearW / 2;
    const gearY = yMin - gearH * 0.35;
    if (this.headEl) {
      this.headEl.style.display = 'block';
      this.headEl.style.left = `${gearX}px`;
      this.headEl.style.top = `${gearY}px`;
      this.headEl.style.width = `${gearW}px`;
      this.headEl.style.height = 'auto';
    }

    if (this.headChoice === 'antlers' && this.noseEl) {
      const d = Math.max(16, w * 0.12);
      const noseX = xCenter - d / 2;
      const noseY = yCenter + h * 0.05 - d / 2;
      this.noseEl.style.display = 'block';
      this.noseEl.style.left = `${noseX}px`;
      this.noseEl.style.top = `${noseY}px`;
      this.noseEl.style.width = `${d}px`;
      this.noseEl.style.height = `${d}px`;
    }

    this.lastDetection = { xCenter, yCenter, w, h };
  }

  setupEventListeners() {
    document.getElementById('btn-capture').addEventListener('click', () => this.capturePhoto());
    const save = document.getElementById('btn-save'); if (save) save.addEventListener('click', () => this.saveImage());
    const retake = document.getElementById('btn-retake'); if (retake) retake.addEventListener('click', () => this.hidePreview());
    const shareApp = document.getElementById('btn-share-app'); if (shareApp) shareApp.addEventListener('click', () => this.shareImageToApps());
    const shareX = document.getElementById('btn-share-x'); if (shareX) shareX.addEventListener('click', () => this.shareToX());
    const shareFB = document.getElementById('btn-share-fb'); if (shareFB) shareFB.addEventListener('click', () => this.shareToFacebook());
    const shareIG = document.getElementById('btn-share-ig'); if (shareIG) shareIG.addEventListener('click', () => this.shareToInstagram());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 100));
  }

  capturePhoto() {
    if (this.isCapturing) return;
    this.isCapturing = true;
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    this.drawDecorations();
    this.drawTitleOverlay();
    this.drawFaceOverlaysOnCanvas();
    this.capturedImage = this.canvas.toDataURL('image/png');
    this.flashEffect();
    this.showPreview();
    this.isCapturing = false;
  }

  drawDecorations() {
    const w = this.canvas.width, h = this.canvas.height;
    const items = [
      { img: this.svgImages.tree, x: w * 0.02, y: h * 0.7,  W: w * 0.30, H: w * 0.30 },
      { img: this.svgImages.snowman, x: w * 0.85, y: h * 0.65, W: w * 0.40,  H: w * 0.40 },
      { img: this.svgImages.santa, x: w * 0.02, y: h * 0.05, W: w * 0.15, H: w * 0.15 },
      { img: this.svgImages.star, x: w * 0.8,  y: h * 0.1,  W: w * 0.08, H: w * 0.08 },
      { img: this.svgImages.star, x: w * 0.85, y: h * 0.25, W: w * 0.06, H: w * 0.06 },
    ];
    items.forEach(({ img, x, y, W, H }) => { if (img && img.complete) this.ctx.drawImage(img, x, y, W, H); });
  }

  drawTitleOverlay() {
    const w = this.canvas.width, h = this.canvas.height;
    if (this.titleImg && this.titleImg.complete) {
      const maxW = Math.min(w * 0.6, this.titleImg.naturalWidth || w * 0.6);
      const imgW = maxW;
      const imgH = imgW * ((this.titleImg.naturalHeight || imgW) / (this.titleImg.naturalWidth || imgW));
      const x = (w - imgW) / 2;
      const y = h * 0.03;
      this.ctx.drawImage(this.titleImg, x, y, imgW, imgH);
    }
    this.ctx.save();
    this.ctx.font = `bold ${Math.floor(w * 0.022)}px Arial`;
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    this.ctx.lineWidth = 2;
    const powered = 'WebAR Powered by Qukuri';
    const px = w - w * 0.02, py = h - h * 0.02;
    this.ctx.strokeText(powered, px, py);
    this.ctx.fillText(powered, px, py);
    this.ctx.restore();
  }

  drawFaceOverlaysOnCanvas() {
    if (!this.lastDetection || !this.headImg || !this.headImg.complete) return;
    const { xCenter, yCenter, w, h } = this.lastDetection;
    const headScale = this.headChoice === 'antlers' ? 1.6 : 1.4;
    const gearW = w * headScale;
    const ratio = (this.headImg && this.headImg.naturalWidth) ? (this.headImg.naturalHeight / this.headImg.naturalWidth) : 1;
    const gearH = gearW * ratio;
    const gearX = xCenter - gearW / 2;
    const gearY = (yCenter - h / 2) - gearH * 0.35;
    this.ctx.drawImage(this.headImg, gearX, gearY, gearW, gearH);

    if (this.headChoice === 'antlers') {
      const d = Math.max(16, w * 0.12);
      const noseX = xCenter;
      const noseY = yCenter + h * 0.05;
      this.ctx.save();
      const grd = this.ctx.createRadialGradient(noseX - d * 0.15, noseY - d * 0.15, d * 0.05, noseX, noseY, d * 0.5);
      grd.addColorStop(0, '#ff8080');
      grd.addColorStop(0.6, '#e00000');
      grd.addColorStop(1, '#940000');
      this.ctx.fillStyle = grd;
      this.ctx.beginPath();
      this.ctx.arc(noseX, noseY, d / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  saveImage() {
    if (!this.capturedImage) { alert('Please capture a photo first.'); return; }
    const a = document.createElement('a');
    a.download = `christmas_${Date.now()}.png`;
    a.href = this.capturedImage; a.click();
  }

  async shareImageToApps() {
    if (!this.capturedImage) { alert('Please capture a photo first.'); return; }
    const shareUrl = await this.getShareUrl();
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          const text = `Merry Christmas 2025! #Christmas #WebAR\n${shareUrl}`;
          await navigator.share({ title: 'Christmas WebAR', text, files: [file] });
          return;
        }
      } catch (_) {}
    }
    this.showShareFallback();
  }

  async shareToX() {
    const shareUrl = await this.getShareUrl();
    const text = `Merry Christmas 2025! ${shareUrl}`;
    if (navigator.share && navigator.canShare && this.capturedImage) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Christmas WebAR', text, files: [file] });
          return;
        }
      } catch (_) {}
    }
    const web = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    const scheme = `twitter://post?message=${encodeURIComponent(text)}`;
    const intentAndroid = `intent://post?message=${encodeURIComponent(text)}#Intent;package=com.twitter.android;scheme=twitter;end`;
    this.openAppOrWeb(scheme, web, intentAndroid);
  }

  async shareToFacebook() {
    const url = await this.getShareUrl();
    const text = 'Merry Christmas 2025!';
    if (navigator.share && navigator.canShare && this.capturedImage) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Christmas WebAR', text: `${text} ${url}`, files: [file] });
          return;
        }
      } catch (_) {}
    }
    const web = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    const scheme = `fb://facewebmodal/f?href=${encodeURIComponent(web)}`;
    this.openAppOrWeb(scheme, web);
  }

  async shareToInstagram() {
    if (navigator.share && navigator.canShare && this.capturedImage)) {
      try {
        const url = await this.getShareUrl();
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Christmas WebAR', text: url, files: [file] });
          return;
        }
      } catch (_) {}
    }
    alert('For Instagram, please save the image first, then select it in the Instagram app. Opening the app...');
    const scheme = 'instagram://library';
    const web = 'https://www.instagram.com/';
    const intentAndroid = 'intent://library#Intent;package=com.instagram.android;scheme=instagram;end';
    this.openAppOrWeb(scheme, web, intentAndroid);
  }

  openAppOrWeb(schemeUrl, webUrl, intentUrl) {
    const start = Date.now();
    const fallback = setTimeout(() => { if (Date.now() - start < 1600) window.location.href = webUrl; }, 1200);
    try {
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      if (isAndroid && intentUrl) {
        window.location.href = intentUrl;
      } else {
        window.location.href = schemeUrl;
      }
    } catch (_) {
      clearTimeout(fallback);
      window.location.href = webUrl;
    }
  }

  async getShareUrl() {
    if (this._shareUrl) return this._shareUrl;
    if (!this.capturedImage) throw new Error('no image');
    const apiBase = (window.SHARE_API_BASE || window.__API_BASE__ || '').replace(/\/$/, '');
    try {
      if (!apiBase) throw new Error('no api base');
      const blob = await this.dataURLtoBlob(this.capturedImage);
      const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      if (!data.ok || !data.shareUrl) throw new Error('upload failed');
      this._shareUrl = data.shareUrl; return this._shareUrl;
    } catch (e) {
      console.warn('Upload unavailable; falling back to page URL.', e);
      if (!this._uploadFailedNotified) { this._uploadFailedNotified = true; alert('Upload server not configured. Sharing page URL instead. Set window.SHARE_API_BASE to enable image cards.'); }
      this._shareUrl = window.location.href; return this._shareUrl;
    }
  }

  async dataURLtoBlob(dataURL) {
    const [meta, data] = dataURL.split(',');
    const mime = /:(.*?);/.exec(meta)[1];
    const bin = atob(data); const len = bin.length; const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  showShareFallback() { alert('This browser cannot share files directly. Save the image and share from the app.'); }

  flashEffect() {
    const flash = document.createElement('div');
    Object.assign(flash.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'white', opacity: '0.8', zIndex: '999', pointerEvents: 'none' });
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.transition = 'opacity 0.3s'; flash.style.opacity = '0'; setTimeout(() => flash.remove(), 300); }, 100);
    this.playShutterSound();
  }

  playShutterSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 1000; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } catch (_) {}
  }

  createSnowflakes() {
    const overlay = document.getElementById('overlay');
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('img'); s.src = 'snowflake.svg'; s.className = 'snowflake';
      s.style.left = Math.random() * 100 + '%'; s.style.animationDuration = (Math.random() * 3 + 5) + 's'; s.style.animationDelay = Math.random() * 5 + 's'; s.style.opacity = Math.random() * 0.6 + 0.4; overlay.appendChild(s);
    }
  }

  resizeCanvas() { if (this.video && this.canvas) { this.canvas.width = this.video.videoWidth; this.canvas.height = this.video.videoHeight; } }

  showError(msg) { const div = document.createElement('div'); div.className = 'loading'; div.textContent = msg; document.body.appendChild(div); }
}

document.addEventListener('DOMContentLoaded', () => {
  const isSecure = location.protocol === 'https:' || ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if (!isSecure) {
    // Allow running for local/dev hosts even on http; some browsers may still block.
    console.warn('Running without HTTPS. Camera may be blocked by the browser.');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert('Camera API is not supported.'); return; }
  new ChristmasAR();
});
