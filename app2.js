// WebAR Christmas Frame Application (UTF-8 clean)
class ChristmasAR {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.capturedImage = null;
    this.svgImages = {};
    this.isCapturing = false;
    this._uploadFailedNotified = false;

    this.init();
  }

  async init() {
    this.video = document.getElementById('camera-video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.setupEventListeners();
    await this.preloadSVGs();
    await this.startCamera();
    this.createSnowflakes();
  }

  async preloadSVGs() {
    const svgs = {
      tree: 'tree.svg',
      snowman: 'snowman.svg',
      santa: 'santa.svg',
      star: 'star.svg',
      snowflake: 'snowflake.svg',
    };
    for (const [name, path] of Object.entries(svgs)) {
      const img = new Image();
      img.src = path;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => resolve();
      });
      this.svgImages[name] = img;
    }
  }

  async startCamera() {
    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      const loading = document.querySelector('.loading');
      if (loading) loading.remove();
      document.getElementById('controls').classList.remove('hidden');
    } catch (error) {
      console.error('Camera access error:', error);
      this.showError('繧ｫ繝｡繝ｩ縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ縺梧拠蜷ｦ縺輔ｌ縺ｾ縺励◆縲ゅヶ繝ｩ繧ｦ繧ｶ縺ｮ險ｭ螳壹〒繧ｫ繝｡繝ｩ縺ｮ菴ｿ逕ｨ繧定ｨｱ蜿ｯ縺励※縺上□縺輔＞縲・);
    }
  }

  setupEventListeners() {
    document.getElementById('btn-capture').addEventListener('click', () => this.capturePhoto());
    const save = document.getElementById('btn-save');
    if (save) save.addEventListener('click', () => this.saveImage());
    const retake = document.getElementById('btn-retake');
    if (retake) retake.addEventListener('click', () => this.hidePreview());
    const shareApp = document.getElementById('btn-share-app');
    if (shareApp) shareApp.addEventListener('click', () => this.shareImageToApps());
    const shareX = document.getElementById('btn-share-x');
    if (shareX) shareX.addEventListener('click', () => this.shareToX());
    const shareFB = document.getElementById('btn-share-fb');
    if (shareFB) shareFB.addEventListener('click', () => this.shareToFacebook());
    const shareIG = document.getElementById('btn-share-ig');
    if (shareIG) shareIG.addEventListener('click', () => this.shareToInstagram());

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resizeCanvas(), 100);
    });
  }

  capturePhoto() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    this.drawDecorations();
    this.drawTextOverlays();
    this.capturedImage = this.canvas.toDataURL('image/png');

    this.flashEffect();
    this.showPreview();
    this.isCapturing = false;
  }

  drawDecorations() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const decorations = [
      { img: this.svgImages.tree, x: width * 0.02, y: height * 0.7, w: width * 0.15, h: width * 0.15 },
      { img: this.svgImages.snowman, x: width * 0.75, y: height * 0.65, w: width * 0.2, h: width * 0.2 },
      { img: this.svgImages.santa, x: width * 0.02, y: height * 0.05, w: width * 0.15, h: width * 0.15 },
      { img: this.svgImages.star, x: width * 0.8, y: height * 0.1, w: width * 0.08, h: width * 0.08 },
      { img: this.svgImages.star, x: width * 0.85, y: height * 0.25, w: width * 0.06, h: width * 0.06 },
    ];
    decorations.forEach(({ img, x, y, w, h }) => {
      if (img && img.complete) this.ctx.drawImage(img, x, y, w, h);
    });
  }

  drawTextOverlays() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.save();

    // Top title
    this.ctx.font = `bold ${Math.floor(width * 0.06)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff0000';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    const christmasText = 'Merry Christmas 2025';
    const topTextX = width / 2;
    const topTextY = height * 0.08;
    this.ctx.strokeText(christmasText, topTextX, topTextY);
    this.ctx.fillText(christmasText, topTextX, topTextY);

    // Bottom right credit
    this.ctx.font = `bold ${Math.floor(width * 0.03)}px Arial`;
    this.ctx.textAlign = 'right';
    const poweredText = 'WebAR Powered by Qukuri';
    const bottomTextX = width - width * 0.02;
    const bottomTextY = height - height * 0.02;
    const textMetrics = this.ctx.measureText(poweredText);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(
      bottomTextX - textMetrics.width - 10,
      bottomTextY - 25,
      textMetrics.width + 20,
      35
    );
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.strokeText(poweredText, bottomTextX, bottomTextY);
    this.ctx.fillText(poweredText, bottomTextX, bottomTextY);

    this.ctx.restore();
  }

  saveImage() {
    if (!this.capturedImage) {
      alert('蜈医↓蜀咏悄繧呈聴蠖ｱ縺励※縺上□縺輔＞縲・);
      return;
    }
    const link = document.createElement('a');
    link.download = `christmas_${Date.now()}.png`;
    link.href = this.capturedImage;
    link.click();
  }

  async shareImageToApps(opts = {}) {
    if (!this.capturedImage) {
      alert('蜈医↓蜀咏悄繧呈聴蠖ｱ縺励※縺上□縺輔＞縲・);
      return;
    }
    // 繧ｷ繧ｧ繧｢URL繧剃ｺ句燕縺ｫ蜿門ｾ励＠縺ｦ繝・く繧ｹ繝医↓蜷ｫ繧√ｋ
    const shareUrl = await this.getShareUrl();
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          const text = `Merry Christmas 2025! 私笨ｨ #Christmas #WebAR\n${shareUrl}`;
          await navigator.share({ title: 'Christmas WebAR', text, files: [file] });
        } else {
          await navigator.share({ title: 'Christmas WebAR', url: shareUrl });
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          this.showShareFallback();
        }
      }
    } else {
      this.showShareFallback();
    }
  }

  // Platform-specific helpers
  async shareToX() {
    const shareUrl = await this.getShareUrl();
    const text = `Merry Christmas 2025! 私笨ｨ ${shareUrl}`;
    // Prefer Web Share with attached image
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
    // Fallback: X intent (image縺ｯ豺ｻ莉倅ｸ榊庄)
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    // Attempt app deep link first
    const scheme = `twitter://post?message=${encodeURIComponent(text)}`;
    this.openAppOrWeb(scheme, intent);
  }

  async shareToFacebook() {
    const shareUrl = await this.getShareUrl();
    const text = 'Merry Christmas 2025! 私笨ｨ';
    const url = shareUrl;
    // Prefer Web Share with attached image
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
    // Fallback: Facebook繧ｷ繧ｧ繧｢繝繧､繧｢繝ｭ繧ｰ・育判蜒上・豺ｻ莉倅ｸ榊庄・・    const web = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    // Try to open app via facewebmodal
    const scheme = `fb://facewebmodal/f?href=${encodeURIComponent(web)}`;
    this.openAppOrWeb(scheme, web);
  }

  async shareToInstagram() {
    // Instagram縺ｯWeb縺九ｉ逕ｻ蜒乗ｷｻ莉倥・逶ｴ謗･謖・ｮ壹・荳榊庄縲８eb Share API縺ｧ蟇ｾ蠢懃ｫｯ譛ｫ縺ｯ逕ｻ蜒乗ｷｻ莉伜庄閭ｽ縲・    if (navigator.share && navigator.canShare && this.capturedImage) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          const shareUrl = await this.getShareUrl();
          await navigator.share({ title: 'Christmas WebAR', text: shareUrl, files: [file] });
          return;
        }
      } catch (_) {}
    }
    // Fallback: Instagram繧｢繝励Μ襍ｷ蜍包ｼ育判蜒上・閾ｪ蜍墓ｷｻ莉倅ｸ榊庄縺ｮ縺溘ａ縲∽ｿ晏ｭ倪・驕ｸ謚槭ｒ譯亥・・・    alert('Instagram縺ｧ蜈ｱ譛峨☆繧九↓縺ｯ縲√∪縺夂判蜒上ｒ菫晏ｭ倥＠縲！nstagram繧｢繝励Μ縺ｧ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲ゅい繝励Μ繧帝幕縺阪∪縺吶・);
    const scheme = 'instagram://library';\n    const web = 'https://www.instagram.com/';\n    const intentAndroid = 'intent://library#Intent;package=com.instagram.android;scheme=instagram;end';\n    this.openAppOrWeb(scheme, web, intentAndroid);
  }

  // Upload image to server and return share URL
  async getShareUrl() {
    if (this._shareUrl) return this._shareUrl;
    if (!this.capturedImage) throw new Error('no image');
    const apiBase = (window.SHARE_API_BASE || window.__API_BASE__ || '').replace(/\/$/, '');
    try {
      if (!apiBase) throw new Error('no api base');
      const blob = await this.dataURLtoBlob(this.capturedImage);
      const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      if (!data.ok || !data.shareUrl) throw new Error('upload failed');
      this._shareUrl = data.shareUrl;
      return this._shareUrl;
    } catch (e) {
      console.warn('Upload unavailable, fallback to page URL:', e);
      const fallbackUrl = window.location.href;
      if (!this._uploadFailedNotified) {
        this._uploadFailedNotified = true;
        alert('逕ｻ蜒上・荳譎ゅい繝・・繝ｭ繝ｼ繝牙・縺梧悴險ｭ螳壹・縺溘ａ縲√・繝ｼ繧ｸURL縺ｧ蜈ｱ譛峨＠縺ｾ縺吶らｮ｡逅・・・ window.SHARE_API_BASE 繧定ｨｭ螳壹＠縺ｦ縺上□縺輔＞縲・);
      }
      this._shareUrl = fallbackUrl;
      return this._shareUrl;
    }
  }

  openAppOrWeb(schemeUrl, webUrl, intentUrl) {
    // Try to open app scheme, then fallback to web after a short delay.
    const now = Date.now();
    const timeout = setTimeout(() => {
      if (Date.now() - now < 1600) {
        window.location.href = webUrl;
      }
    }, 1200);
    // Some browsers block window.open for schemes; use location change.
    try {
      const ua = navigator.userAgent || '';\n      const isAndroid = /Android/i.test(ua);\n      if (isAndroid && intentUrl) {\n        window.location.href = intentUrl;\n      } else {\n        window.location.href = schemeUrl;\n      }
    } catch (_) {
      clearTimeout(timeout);
      window.location.href = webUrl;
    }
  }

  async dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  showShareFallback() {
    alert('縺薙・繝悶Λ繧ｦ繧ｶ縺ｧ縺ｯ逕ｻ蜒上・逶ｴ謗･蜈ｱ譛峨↓蟇ｾ蠢懊＠縺ｦ縺・∪縺帙ｓ縲ゆｿ晏ｭ伜ｾ後々/Facebook/Instagram 繧｢繝励Μ縺ｧ逕ｻ蜒上ｒ豺ｻ莉倥＠縺ｦ蜈ｱ譛峨＠縺ｦ縺上□縺輔＞縲・);
  }

  flashEffect() {
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      background: 'white', opacity: '0.8', zIndex: '999', pointerEvents: 'none'
    });
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.transition = 'opacity 0.3s';
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 300);
    }, 100);
    this.playShutterSound();
  }

  playShutterSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (_) {}
  }

  createSnowflakes() {
    const snowflakeCount = 10;
    const overlay = document.getElementById('overlay');
    for (let i = 0; i < snowflakeCount; i++) {
      const snowflake = document.createElement('img');
      snowflake.src = 'snowflake.svg';
      snowflake.className = 'snowflake';
      snowflake.style.left = Math.random() * 100 + '%';
      snowflake.style.animationDuration = (Math.random() * 3 + 5) + 's';
      snowflake.style.animationDelay = Math.random() * 5 + 's';
      snowflake.style.opacity = Math.random() * 0.6 + 0.4;
      overlay.appendChild(snowflake);
    }
  }

  resizeCanvas() {
    if (this.video && this.canvas) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
  }

  showPreview() {
    const preview = document.getElementById('preview');
    const img = document.getElementById('preview-image');
    const controls = document.getElementById('controls');
    if (img && this.capturedImage) img.src = this.capturedImage;
    if (controls) controls.classList.add('hidden');
    if (preview) preview.classList.remove('hidden');
  }

  hidePreview() {
    const preview = document.getElementById('preview');
    const controls = document.getElementById('controls');
    if (preview) preview.classList.add('hidden');
    if (controls) controls.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    alert('縺薙・繧｢繝励Μ縺ｯHTTPS謗･邯壹′蠢・ｦ√〒縺吶・);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('縺贋ｽｿ縺・・繝悶Λ繧ｦ繧ｶ縺ｯ繧ｫ繝｡繝ｩAPI縺ｫ蟇ｾ蠢懊＠縺ｦ縺・∪縺帙ｓ縲・);
    return;
  }
  new ChristmasAR();
});

