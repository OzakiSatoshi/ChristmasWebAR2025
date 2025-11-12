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
      this.showError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。');
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
      alert('先に写真を撮影してください。');
      return;
    }
    const link = document.createElement('a');
    link.download = `christmas_${Date.now()}.png`;
    link.href = this.capturedImage;
    link.click();
  }

  async shareImageToApps(opts = {}) {
    if (!this.capturedImage) {
      alert('先に写真を撮影してください。');
      return;
    }
    // シェアURLを事前に取得してテキストに含める
    const shareUrl = await this.getShareUrl();
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await this.dataURLtoBlob(this.capturedImage);
        const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          const text = `Merry Christmas 2025! 🎄✨ #Christmas #WebAR\n${shareUrl}`;
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
    const text = `Merry Christmas 2025! 🎄✨ ${shareUrl}`;
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
    // Fallback: X intent (imageは添付不可)
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    // Attempt app deep link first
    const scheme = `twitter://post?message=${encodeURIComponent(text)}`;
    this.openAppOrWeb(scheme, intent);
  }

  async shareToFacebook() {
    const shareUrl = await this.getShareUrl();
    const text = 'Merry Christmas 2025! 🎄✨';
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
    // Fallback: Facebookシェアダイアログ（画像は添付不可）
    const web = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
    // Try to open app via facewebmodal
    const scheme = `fb://facewebmodal/f?href=${encodeURIComponent(web)}`;
    this.openAppOrWeb(scheme, web);
  }

  async shareToInstagram() {
    // InstagramはWebから画像添付の直接指定は不可。Web Share APIで対応端末は画像添付可能。
    if (navigator.share && navigator.canShare && this.capturedImage) {
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
    // Fallback: Instagramアプリ起動（画像は自動添付不可のため、保存→選択を案内）
    alert('Instagramで共有するには、まず画像を保存し、Instagramアプリで選択してください。アプリを開きます。');
    const scheme = 'instagram://library';
    const web = 'https://www.instagram.com/';
    this.openAppOrWeb(scheme, web);
  }

  // Upload image to server and return share URL
  async getShareUrl() {
    if (this._shareUrl) return this._shareUrl;
    if (!this.capturedImage) throw new Error('no image');
    const blob = await this.dataURLtoBlob(this.capturedImage);
    const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    if (!data.ok) throw new Error('upload failed');
    this._shareUrl = data.shareUrl;
    return this._shareUrl;
  }

  openAppOrWeb(schemeUrl, webUrl) {
    // Try to open app scheme, then fallback to web after a short delay.
    const now = Date.now();
    const timeout = setTimeout(() => {
      if (Date.now() - now < 1600) {
        window.location.href = webUrl;
      }
    }, 1200);
    // Some browsers block window.open for schemes; use location change.
    try {
      window.location.href = schemeUrl;
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
    alert('このブラウザでは画像の直接共有に対応していません。保存後、X/Facebook/Instagram アプリで画像を添付して共有してください。');
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
    alert('このアプリはHTTPS接続が必要です。');
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('お使いのブラウザはカメラAPIに対応していません。');
    return;
  }
  new ChristmasAR();
});
