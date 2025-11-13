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
    this._fdLoopStarted = false;
    this.lastDetection = null;
    this.titleImg = new Image();
    // Multi-face support
    this.faces = []; // [{choice, headEl, noseEl, headImg, smooth, miss}]
    this.lastDetections = [];
    // Smoothing / stability
    this._smooth = null; // {x,y,w,angle,nx,ny}
    this._lastDetTs = 0;
    this._missCount = 0;
    // Mirroring options
    this.mirror = true; // mirror live preview
    this.mirrorCapture = true; // mirror saved image
    this._mpBase = null;
    // Max faces (cap detections per frame). Can be overridden by window.MAX_FACES
    this.maxFaces = (window.MAX_FACES && Number(window.MAX_FACES)) || 1;
    // Gating: require detection to persist before creating a new track
    this._pendingNew = null; // {x,y,count}
    // Stable single-face mode: revert to known-stable pipeline
    this.useStableSingleFace = true;
    this.headChoice = Math.random() < 0.5 ? 'antlers' : 'santa';
    this.headImg = null;
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
    // assign headImg for stable mode
    this.headImg = this.headChoice === 'antlers' ? this.svgImages.antlers : this.svgImages.hat;
  }

  async startCamera() {
    try {
      const constraints = { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise((resolve) => { this.video.onloadedmetadata = () => { this.video.play(); resolve(); }; });
      if (this.mirror) this.video.classList.add('mirrored');
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
    // Elements for faces
    if (this.useStableSingleFace) {
      // Single overlay elements
      this.headEl = document.createElement('img');
      this.headEl.className = 'head-gear';
      this.headEl.alt = this.headChoice === 'antlers' ? 'Reindeer Antlers' : 'Santa Hat';
      this.headEl.src = (this.headChoice === 'antlers' ? this.svgImages.antlers : this.svgImages.hat).src;
      this.headEl.style.display = 'none';
      overlay.appendChild(this.headEl);
      if (this.headChoice === 'antlers') {
        this.noseEl = document.createElement('div');
        this.noseEl.className = 'nose-dot';
        this.noseEl.style.display = 'none';
        overlay.appendChild(this.noseEl);
      }
    }

    // Setup MediaPipe Face Detection (try both namespaces + dynamic load)
    const initFD = async () => {
      // Support both patterns:
      // 1) window.FaceDetection is a constructor (UMD exposing class directly)
      // 2) window.FaceDetection.FaceDetection is the constructor (namespace)
      // 3) window.faceDetection.FaceDetection (lowercase namespace)
      let Ctor = null;
      if (typeof window.FaceDetection === 'function') {
        Ctor = window.FaceDetection;
      } else if (window.FaceDetection && typeof window.FaceDetection.FaceDetection === 'function') {
        Ctor = window.FaceDetection.FaceDetection;
      } else if (window.faceDetection && typeof window.faceDetection.FaceDetection === 'function') {
        Ctor = window.faceDetection.FaceDetection;
      }
      if (!Ctor) return false;
      const base = this._mpBase || 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/';
      this.fd = new Ctor({ locateFile: (file) => `${base}${file}` });
      if (typeof this.fd.setOptions === 'function') this.fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
      if (typeof this.fd.onResults === 'function') this.fd.onResults((results) => {
        if (this.useStableSingleFace) this.onFaceResultsSingle(results); else this.onFaceResults(results);
      });
      if (typeof this.fd.initialize === 'function') { try { await this.fd.initialize(); } catch (_) {} }
      return true;
    };

    let ok = await initFD();
    const loadScript = (src) => new Promise((resolve) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = resolve; document.head.appendChild(s); });

    if (!ok) {
      // Build source candidates depending on environment flags
      const localBase = window.MP_LOCAL_BASE || '';
      const cdnCandidates = [
        { src: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js', base: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/' },
        { src: 'https://unpkg.com/@mediapipe/face_detection@0.4/face_detection.js', base: 'https://unpkg.com/@mediapipe/face_detection@0.4/' },
        { src: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js', base: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/' }
      ];
      const localCandidates = localBase
        ? [{ src: (localBase.endsWith('/') ? localBase : localBase + '/') + 'face_detection.js', base: (localBase.endsWith('/') ? localBase : localBase + '/') }]
        : [];
      const defaultLocal = [
        { src: './mediapipe/face_detection.js', base: './mediapipe/' },
        { src: './libs/mediapipe/face_detection.js', base: './libs/mediapipe/' }
      ];
      const candidates = [...cdnCandidates, ...localCandidates, ...defaultLocal];
      for (const c of candidates) {
        await loadScript(c.src);
        this._mpBase = c.base;
        ok = await initFD();
        if (ok) break;
      }
    }

    // Fallback to built-in FaceDetector
    const tryFaceDetector = () => {
      if (!('FaceDetector' in window)) return false;
      try {
        this._faceDetector = new window.FaceDetector({ fastMode: true });
        this.fd = {
          send: async ({ image }) => {
            try {
              const faces = await this._faceDetector.detect(image);
              if (faces && faces.length) {
                const f = faces[0].boundingBox || faces[0].boundingRect || faces[0].box || faces[0];
                const vwCSS = this.video.clientWidth || overlay.clientWidth || 1;
                const vhCSS = this.video.clientHeight || overlay.clientHeight || 1;
                const bb = {
                  xCenter: (f.x + f.width / 2) / vwCSS,
                  yCenter: (f.y + f.height / 2) / vhCSS,
                  width: f.width / vwCSS,
                  height: f.height / vhCSS,
                };
                this.onFaceResults({ detections: [{ boundingBox: bb }] });
              } else {
                this.onFaceResults({ detections: [] });
              }
            } catch (_e) {
              this.onFaceResults({ detections: [] });
            }
          }
        };
        return true;
      } catch (_) { return false; }
    };

    if (ok || (ok = tryFaceDetector())) {
      this.startFaceDetectionLoop();
    } else {
      // Retry a few times in case the CDN script loads slowly
      console.warn('MediaPipe Face Detection library not found. Retrying...');
      this._fdRetryCount = 0;
      const retry = async () => {
        if (this.fd) return; // already initialized
        this._fdRetryCount++;
        const ok2 = await initFD();
        if (ok2 || tryFaceDetector()) {
          this.startFaceDetectionLoop();
          return;
        }
        if (this._fdRetryCount < 6) {
          setTimeout(retry, 500);
        } else {
          console.warn('Face detection unavailable after retries. Proceeding without tracking.');
          const overlayMsg = document.createElement('div');
          overlayMsg.className = 'loading';
          overlayMsg.textContent = 'FaceTracking unavailable. Ensure CDN reachable or place mediapipe/ locally.';
          overlayMsg.style.pointerEvents = 'none';
          overlayMsg.style.opacity = '0.9';
          setTimeout(() => overlayMsg.remove(), 2500);
          document.body.appendChild(overlayMsg);
        }
      };
      setTimeout(retry, 500);
    }
  }

  startFaceDetectionLoop() {
    if (!this.fd || this._fdLoopStarted) return;
    this._fdLoopStarted = true;
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
    const dets = (results && results.detections) ? results.detections.slice(0, this.maxFaces) : [];
    const vw = this.video.videoWidth || 0;
    const vh = this.video.videoHeight || 0;
    if (!vw || !vh) return;

    const overlay = document.getElementById('overlay');
    const ow = overlay.clientWidth || window.innerWidth;
    const oh = overlay.clientHeight || window.innerHeight;
    const scale = Math.max(ow / vw, oh / vh);
    const offX = (ow - vw * scale) / 2;
    const offY = (oh - vh * scale) / 2;

    // Prepare existing faces match flags（即時非表示はしない。未マッチが続いたときに隠す）
    this.faces.forEach(f => { f.matched = false; });

    const normDets = [];
    for (const det of dets) {
      const conf = det && (det.score || (det.scores && det.scores[0]) || (det.categories && det.categories[0] && det.categories[0].score)) || 1;
      if (conf < 0.7) continue;
      const relKP = det.keypoints || det.relativeKeypoints || (det.locationData && det.locationData.relativeKeypoints) || [];
      const getKP = (idx) => (relKP[idx] && typeof relKP[idx].x === 'number' && typeof relKP[idx].y === 'number')
        ? { x: relKP[idx].x * vw, y: relKP[idx].y * vh }
        : null;
      const kpRightEye = getKP(0);
      const kpLeftEye  = getKP(1);
      const kpNose     = getKP(2);
      const kpRightEar = getKP(4);
      const kpLeftEar  = getKP(5);
      const bb = det.boundingBox || (det.locationData && det.locationData.relativeBoundingBox) || {};
      const has = (v) => typeof v === 'number' && !isNaN(v);
      let w = (has(bb.width) ? bb.width : ((has(bb.xMax) && has(bb.xMin)) ? (bb.xMax - bb.xMin) : 0)) * vw;
      let h = (has(bb.height) ? bb.height : ((has(bb.yMax) && has(bb.yMin)) ? (bb.yMax - bb.yMin) : 0)) * vh;
      let xCenter = has(bb.xCenter) ? bb.xCenter * vw : (has(bb.xMin) ? (bb.xMin * vw + w / 2) : vw / 2);
      let yCenter = has(bb.yCenter) ? bb.yCenter * vh : (has(bb.yMin) ? (bb.yMin * vh + h / 2) : vh / 2);
      let yMin = yCenter - h / 2;
      if (kpLeftEar && kpRightEar) {
        const dx = kpLeftEar.x - kpRightEar.x;
        const dy = kpLeftEar.y - kpRightEar.y;
        const earDist = Math.hypot(dx, dy);
        w = Math.max(w, earDist * 1.15);
        xCenter = (kpLeftEar.x + kpRightEar.x) / 2;
        yCenter = (kpLeftEar.y + kpRightEar.y) / 2 + (h ? h * 0.05 : 0);
        yMin = yCenter - (h || earDist) / 2;
      } else if (kpLeftEye && kpRightEye) {
        const dx = kpLeftEye.x - kpRightEye.x;
        const dy = kpLeftEye.y - kpRightEye.y;
        const eyeDist = Math.hypot(dx, dy);
        w = Math.max(w, eyeDist * 2.2);
        xCenter = (kpLeftEye.x + kpRightEye.x) / 2;
        yCenter = (kpLeftEye.y + kpRightEye.y) / 2 + (h ? h * 0.2 : eyeDist * 0.8);
        yMin = yCenter - (h || eyeDist * 2.0) / 2;
      }
      const eyesMid = (kpLeftEye && kpRightEye) ? { x: (kpLeftEye.x + kpRightEye.x) / 2, y: (kpLeftEye.y + kpRightEye.y) / 2 } : { x: xCenter, y: yMin + (h * 0.3) };
      const v1 = (kpLeftEye && kpRightEye) ? { x: kpLeftEye.x - kpRightEye.x, y: kpLeftEye.y - kpRightEye.y }
                : (kpLeftEar && kpRightEar) ? { x: kpLeftEar.x - kpRightEar.x, y: kpLeftEar.y - kpRightEar.y }
                : null;
      const angleRad = v1 ? Math.atan2(v1.y, v1.x) : 0;
      const angleDeg = angleRad * 180 / Math.PI;
      // 極小顔は無視（ちらつき抑制）
      if ((w < 80) || (h < 80)) continue;
      normDets.push({ det, xCenter, yCenter, yMin, w, h, kp: { nose: kpNose, leftEye: kpLeftEye, rightEye: kpRightEye, leftEar: kpLeftEar, rightEar: kpRightEar }, eyesMid, angleDeg });
    }

    // Deduplicate very close detections (keep first)
    const dedup = [];
    const diag = Math.hypot(ow, oh);
    const dupDist2 = Math.pow(diag * 0.05, 2); // 5% of diagonal
    for (const nd of normDets) {
      const px = offX + nd.eyesMid.x * scale;
      const py = offY + nd.eyesMid.y * scale;
      let tooClose = false;
      for (const kept of dedup) {
        const kx = offX + kept.eyesMid.x * scale;
        const ky = offY + kept.eyesMid.y * scale;
        const d2 = (kx - px) * (kx - px) + (ky - py) * (ky - py);
        if (d2 < dupDist2) { tooClose = true; break; }
      }
      if (!tooClose) dedup.push(nd);
    }
    
    const norm = dedup;

    // Match and update/create faces
    const used = new Set();
    for (const nd of norm) {
      const px = offX + nd.eyesMid.x * scale;
      const py = offY + nd.eyesMid.y * scale;
      let bestIdx = -1; let bestDist = Infinity;
      this.faces.forEach((f, idx) => {
        if (used.has(idx)) return;
        if (!f.smooth) return;
        const sx = this.mirror ? (ow - f.smooth.x - f.smooth.w) : f.smooth.x;
        const dx = (sx + f.smooth.w/2) - px;
        const dy = f.smooth.y - py;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestDist) { bestDist = d2; bestIdx = idx; }
      });
      const threshold = Math.pow(Math.hypot(ow, oh) * 0.06, 2); // 6% of diagonal
      let face = null;
      if (bestIdx >= 0 && bestDist < threshold) {
        face = this.faces[bestIdx];
        used.add(bestIdx);
        face.matched = true; face.miss = 0;
      } else {
        // Gating: create a new face only if detection persists across frames
        const okToCreate = (() => {
          if (!this._pendingNew) {
            this._pendingNew = { x: px, y: py, count: 1 };
            return false;
          }
          const dx = this._pendingNew.x - px; const dy = this._pendingNew.y - py;
          const d2 = dx*dx + dy*dy;
          if (d2 < Math.pow(Math.hypot(ow, oh) * 0.04, 2)) { // 4% of diagonal
            this._pendingNew.count++;
          } else {
            this._pendingNew = { x: px, y: py, count: 1 };
          }
          return this._pendingNew.count >= 2; // 2フレーム連続で安定したら生成
        })();
        if (okToCreate) {
          const choice = Math.random() < 0.5 ? 'antlers' : 'santa';
          face = this.createFaceOverlay(choice);
          this.faces.push(face);
          face.matched = true; face.miss = 0;
          used.add(this.faces.length - 1);
          this._pendingNew = null;
        } else {
          // まだ生成しない（この検出は一時的と判断）
          continue;
        }
      }
      this.updateFaceOverlay(face, nd, { ow, oh, offX, offY, scale });

      // 近接重複トラックの整理（同じ位置に別choiceが残らないよう削除）
      const fx = face.smooth ? (this.mirror ? (ow - face.smooth.x - face.smooth.w) : face.smooth.x) + (face.smooth.w / 2) : px;
      const fy = face.smooth ? face.smooth.y : py;
      for (let i = this.faces.length - 1; i >= 0; i--) {
        const f2 = this.faces[i];
        if (f2 === face || !f2.smooth) continue;
        const sx = this.mirror ? (ow - f2.smooth.x - f2.smooth.w) : f2.smooth.x;
        const cx = sx + f2.smooth.w / 2;
        const cy = f2.smooth.y;
        const d2 = (cx - fx) * (cx - fx) + (cy - fy) * (cy - fy);
        if (d2 < Math.pow(Math.hypot(ow, oh) * 0.05, 2)) {
          // 重複とみなして f2 を破棄
          if (f2.headEl && f2.headEl.parentNode) f2.headEl.parentNode.removeChild(f2.headEl);
          if (f2.noseEl && f2.noseEl.parentNode) f2.noseEl.parentNode.removeChild(f2.noseEl);
          this.faces.splice(i, 1);
          // used セットは安全のためクリアせず、次フレームで再構築される
        }
      }
    }

    // Unmatched faces: increment miss and remove if too old
    for (let i = this.faces.length - 1; i >= 0; i--) {
      const f = this.faces[i];
      if (f.matched) continue;
      f.miss = (f.miss || 0) + 1;
      // 1フレーム落ち程度では隠さない。連続未検出で非表示に
      if (f.miss >= 2) {
        if (f.headEl) f.headEl.style.display = 'none';
        if (f.noseEl) f.noseEl.style.display = 'none';
      }
      if (f.miss > 10) {
        if (f.headEl && f.headEl.parentNode) f.headEl.parentNode.removeChild(f.headEl);
        if (f.noseEl && f.noseEl.parentNode) f.noseEl.parentNode.removeChild(f.noseEl);
        this.faces.splice(i, 1);
      }
    }

    // Save for capture
    this.lastDetections = this.faces.filter(f => f.smooth).map(f => ({
      choice: f.choice,
      faceWidthForGear: f.lastFaceWidth || 0,
      xCenter: f.lastCenters ? f.lastCenters.xCenter : 0,
      yCenter: f.lastCenters ? f.lastCenters.yCenter : 0,
      w: f.lastWH ? f.lastWH.w : 0,
      h: f.lastWH ? f.lastWH.h : 0,
      kp: f.lastKP || null,
      eyesMid: f.lastEyesMid || null,
      angleDeg: f.smooth ? f.smooth.angle : 0
    }));
  }

  // Stable single-face pipeline (reduced complexity)
  onFaceResultsSingle(results) {
    const det = results && results.detections && results.detections[0];
    const vw = this.video.videoWidth || 0;
    const vh = this.video.videoHeight || 0;
    if (!vw || !vh) return;
    const overlay = document.getElementById('overlay');
    const ow = overlay.clientWidth || window.innerWidth;
    const oh = overlay.clientHeight || window.innerHeight;
    const scale = Math.max(ow / vw, oh / vh);
    const offX = (ow - vw * scale) / 2;
    const offY = (oh - vh * scale) / 2;
    if (!det) {
      // 2フレーム未検出で非表示にする（ちらつき抑制）
      this._missCount = Math.min(10, (this._missCount || 0) + 1);
      if (this._missCount >= 2) {
        if (this.headEl) this.headEl.style.display = 'none';
        if (this.noseEl) this.noseEl.style.display = 'none';
      }
      return;
    }
    const conf = det && (det.score || (det.scores && det.scores[0]) || (det.categories && det.categories[0] && det.categories[0].score)) || 1;
    if (conf < 0.7) return;
    const relKP = det.keypoints || det.relativeKeypoints || (det.locationData && det.locationData.relativeKeypoints) || [];
    const getKP = (idx) => (relKP[idx] && typeof relKP[idx].x === 'number' && typeof relKP[idx].y === 'number') ? { x: relKP[idx].x * vw, y: relKP[idx].y * vh } : null;
    const kpRightEye = getKP(0), kpLeftEye = getKP(1), kpNose = getKP(2), kpRightEar = getKP(4), kpLeftEar = getKP(5);
    const bb = det.boundingBox || (det.locationData && det.locationData.relativeBoundingBox) || {};
    const has = (v) => typeof v === 'number' && !isNaN(v);
    let w = (has(bb.width) ? bb.width : ((has(bb.xMax) && has(bb.xMin)) ? (bb.xMax - bb.xMin) : 0)) * vw;
    let h = (has(bb.height) ? bb.height : ((has(bb.yMax) && has(bb.yMin)) ? (bb.yMax - bb.yMin) : 0)) * vh;
    let xCenter = has(bb.xCenter) ? bb.xCenter * vw : (has(bb.xMin) ? (bb.xMin * vw + w / 2) : vw / 2);
    let yCenter = has(bb.yCenter) ? bb.yCenter * vh : (has(bb.yMin) ? (bb.yMin * vh + h / 2) : vh / 2);
    let yMin = yCenter - h / 2;
    if (w < 80 || h < 80) return;
    if (kpLeftEar && kpRightEar) {
      const dx = kpLeftEar.x - kpRightEar.x, dy = kpLeftEar.y - kpRightEar.y;
      const earDist = Math.hypot(dx, dy);
      w = Math.max(w, earDist * 1.15);
      xCenter = (kpLeftEar.x + kpRightEar.x) / 2;
      yCenter = (kpLeftEar.y + kpRightEar.y) / 2 + (h ? h * 0.05 : 0);
      yMin = yCenter - (h || earDist) / 2;
    } else if (kpLeftEye && kpRightEye) {
      const dx = kpLeftEye.x - kpRightEye.x, dy = kpLeftEye.y - kpRightEye.y;
      const eyeDist = Math.hypot(dx, dy);
      w = Math.max(w, eyeDist * 2.2);
      xCenter = (kpLeftEye.x + kpRightEye.x) / 2;
      yCenter = (kpLeftEye.y + kpRightEye.y) / 2 + (h ? h * 0.2 : eyeDist * 0.8);
      yMin = yCenter - (h || eyeDist * 2.0) / 2;
    }
    const eyesMid = (kpLeftEye && kpRightEye) ? { x: (kpLeftEye.x + kpRightEye.x) / 2, y: (kpLeftEye.y + kpRightEye.y) / 2 } : { x: xCenter, y: yMin + (h * 0.3) };
    const v1 = (kpLeftEye && kpRightEye) ? { x: kpLeftEye.x - kpRightEye.x, y: kpLeftEye.y - kpRightEye.y } : (kpLeftEar && kpRightEar) ? { x: kpLeftEar.x - kpRightEar.x, y: kpLeftEar.y - kpRightEar.y } : null;
    const angleDeg = (v1 ? Math.atan2(v1.y, v1.x) : 0) * 180 / Math.PI;

    // head sizing/positioning (video space → CSS)
    const headScale = (this.headChoice === 'antlers') ? 1.9 : 1.9375;
    const ratio = (this.headImg && this.headImg.naturalWidth) ? (this.headImg.naturalHeight / this.headImg.naturalWidth) : 1;
    const faceWidthForGear = (kpLeftEar && kpRightEar)
      ? Math.hypot(kpLeftEar.x - kpRightEar.x, kpLeftEar.y - kpRightEar.y) * 1.15
      : (kpLeftEye && kpRightEye ? Math.hypot(kpLeftEye.x - kpRightEye.x, kpLeftEye.y - kpRightEye.y) * 2.2 : w);
    const gearW_v = faceWidthForGear * headScale;
    const gearH_v = gearW_v * ratio;
    const yOffset = (this.headChoice === 'antlers') ? 1.15 : 1.35;
    const gearX_v = eyesMid.x - gearW_v / 2;
    const gearY_v = eyesMid.y - gearH_v * yOffset;

    const cur = {
      x: offX + gearX_v * scale,
      y: offY + gearY_v * scale,
      w: gearW_v * scale,
      angle: angleDeg,
      nx: offX + (((kpNose ? kpNose.x : xCenter) - Math.max(16, (faceWidthForGear || w) * 0.36) / 2) * scale),
      ny: offY + (((kpNose ? kpNose.y : (yMin + h * 0.55)) - Math.max(16, (faceWidthForGear || w) * 0.36) / 2) * scale),
      nd: Math.max(16, (faceWidthForGear || w) * 0.36) * scale
    };

    // smoothing
    const a = 0.12; const lerp = (p, c) => p + (c - p) * a;
    if (!this._smooth) {
      this._smooth = cur;
    } else {
      let pd = this._smooth.angle, cd = cur.angle;
      let diff = ((cd - pd + 540) % 360) - 180; const maxStep = 6;
      if (diff > maxStep) diff = maxStep; if (diff < -maxStep) diff = -maxStep;
      const ang = pd + diff * a;
      this._smooth = {
        x: lerp(this._smooth.x, cur.x), y: lerp(this._smooth.y, cur.y), w: lerp(this._smooth.w, cur.w), angle: ang,
        nx: lerp(this._smooth.nx, cur.nx), ny: lerp(this._smooth.ny, cur.ny), nd: lerp(this._smooth.nd, cur.nd)
      };
    }
    this._missCount = 0;

    // apply to DOM
    if (this.headEl) {
      const hx = this.mirror ? (ow - this._smooth.x - this._smooth.w) : this._smooth.x;
      const ang = this.mirror ? -this._smooth.angle : this._smooth.angle;
      this.headEl.style.display = 'block';
      this.headEl.style.left = `${hx}px`;
      this.headEl.style.top = `${this._smooth.y}px`;
      this.headEl.style.width = `${this._smooth.w}px`;
      this.headEl.style.height = 'auto';
      this.headEl.style.transform = `rotate(${ang}deg)`;
    }
    if (this.headChoice === 'antlers' && this.noseEl) {
      const nx = this.mirror ? (ow - this._smooth.nx - this._smooth.nd) : this._smooth.nx;
      this.noseEl.style.display = 'block';
      this.noseEl.style.left = `${nx}px`;
      this.noseEl.style.top = `${this._smooth.ny}px`;
      this.noseEl.style.width = `${this._smooth.nd}px`;
      this.noseEl.style.height = `${this._smooth.nd}px`;
    }

    // save for capture (single-face)
    this.lastDetection = {
      xCenter, yCenter, w, h,
      kp: { nose: kpNose },
      faceWidthForGear,
      eyesMid,
      angleDeg
    };
  }

  createFaceOverlay(choice) {
    const overlay = document.getElementById('overlay');
    const headEl = document.createElement('img');
    headEl.className = 'head-gear';
    headEl.alt = choice === 'antlers' ? 'Reindeer Antlers' : 'Santa Hat';
    headEl.src = (choice === 'antlers' ? this.svgImages.antlers : this.svgImages.hat).src;
    headEl.style.display = 'none';
    overlay.appendChild(headEl);
    let noseEl = null;
    if (choice === 'antlers') {
      noseEl = document.createElement('div');
      noseEl.className = 'nose-dot';
      noseEl.style.display = 'none';
      overlay.appendChild(noseEl);
    }
    return { choice, headEl, noseEl, headImg: (choice === 'antlers' ? this.svgImages.antlers : this.svgImages.hat), smooth: null, miss: 0 };
  }

  updateFaceOverlay(face, nd, geom) {
    const { ow, oh, offX, offY, scale } = geom;
    const { xCenter, yCenter, yMin, w, h, kp, eyesMid, angleDeg } = nd;
    const headImg = face.headImg;
    const headScale = face.choice === 'antlers' ? 1.9 : 1.9375;
    const ratio = (headImg && headImg.naturalWidth) ? (headImg.naturalHeight / headImg.naturalWidth) : 1;
    const faceWidthForGear = (kp && kp.leftEar && kp.rightEar)
      ? Math.hypot(kp.leftEar.x - kp.rightEar.x, kp.leftEar.y - kp.rightEar.y) * 1.15
      : (kp && kp.leftEye && kp.rightEye ? Math.hypot(kp.leftEye.x - kp.rightEye.x, kp.leftEye.y - kp.rightEye.y) * 2.2 : w);
    const gearW_v = faceWidthForGear * headScale;
    const gearH_v = gearW_v * ratio;
    const yOffset = face.choice === 'antlers' ? 1.15 : 1.35;
    const gearX_v = (eyesMid.x) - gearW_v / 2;
    const gearY_v = (eyesMid.y) - gearH_v * yOffset;
    const noseD = Math.max(16, (faceWidthForGear || w) * 0.36);
    const noseC = (kp && kp.nose) ? kp.nose : { x: xCenter, y: yMin + h * 0.55 };
    const cur = {
      x: offX + gearX_v * scale,
      y: offY + gearY_v * scale,
      w: gearW_v * scale,
      angle: angleDeg,
      nx: offX + ( (noseC.x - noseD / 2) * scale ),
      ny: offY + ( (noseC.y - noseD / 2) * scale ),
      nd: noseD * scale
    };
    if (!face.smooth) {
      face.smooth = { ...cur, cx: offX + eyesMid.x * scale, cy: offY + eyesMid.y * scale };
    } else {
      const a = 0.1; const lerp = (p, c) => p + (c - p) * a;
      let pd = face.smooth.angle, cd = cur.angle; let diff = ((cd - pd + 540) % 360) - 180; const maxStep = 8; if (diff > maxStep) diff = maxStep; if (diff < -maxStep) diff = -maxStep;
      const ang = pd + diff * a;
      face.smooth = { x: lerp(face.smooth.x, cur.x), y: lerp(face.smooth.y, cur.y), w: lerp(face.smooth.w, cur.w), angle: ang, nx: lerp(face.smooth.nx, cur.nx), ny: lerp(face.smooth.ny, cur.ny), nd: lerp(face.smooth.nd, cur.nd) };
      face.smooth.cx = lerp(face.smooth.cx ?? (offX + eyesMid.x * scale), offX + eyesMid.x * scale, a);
      face.smooth.cy = lerp(face.smooth.cy ?? (offY + eyesMid.y * scale), offY + eyesMid.y * scale, a);
    }
    if (face.headEl) {
      const hx = this.mirror ? (ow - face.smooth.x - face.smooth.w) : face.smooth.x;
      const ang = this.mirror ? -face.smooth.angle : face.smooth.angle;
      face.headEl.style.display = 'block';
      face.headEl.style.left = `${hx}px`;
      face.headEl.style.top = `${face.smooth.y}px`;
      face.headEl.style.width = `${face.smooth.w}px`;
      face.headEl.style.height = 'auto';
      face.headEl.style.transform = `rotate(${ang}deg)`;
    }
    if (face.choice === 'antlers' && face.noseEl) {
      const nx = this.mirror ? (ow - face.smooth.nx - face.smooth.nd) : face.smooth.nx;
      face.noseEl.style.display = 'block';
      face.noseEl.style.left = `${nx}px`;
      face.noseEl.style.top = `${face.smooth.ny}px`;
      face.noseEl.style.width = `${face.smooth.nd}px`;
      face.noseEl.style.height = `${face.smooth.nd}px`;
    }
    // save for capture
    face.lastFaceWidth = faceWidthForGear;
    face.lastCenters = { xCenter, yCenter };
    face.lastWH = { w, h };
    face.lastKP = { nose: noseC };
    face.lastEyesMid = eyesMid;
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
    // Canvas size = overlay display size for WYSIWYG
    const overlay = document.getElementById('overlay');
    const ow = overlay.clientWidth || this.video.clientWidth || this.video.videoWidth;
    const oh = overlay.clientHeight || this.video.clientHeight || this.video.videoHeight;
    this.canvas.width = ow;
    this.canvas.height = oh;
    const vw = this.video.videoWidth || ow, vh = this.video.videoHeight || oh;
    const scale = Math.max(ow / vw, oh / vh);
    const dw = vw * scale, dh = vh * scale;
    const offX = (ow - dw) / 2, offY = (oh - dh) / 2;
    this.ctx.save();
    if (this.mirrorCapture) {
      this.ctx.translate(ow, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(this.video, offX, offY, dw, dh);
    this.ctx.restore();
    this.drawDecorations();
    this.drawFaceOverlaysOnCanvas();
    this.drawTitleOverlay();
    this.capturedImage = this.canvas.toDataURL('image/png');
    this.flashEffect();
    this.showPreview();
    this.isCapturing = false;
  }

  drawDecorations() {
    const w = this.canvas.width, h = this.canvas.height;
    const items = [
      { img: this.svgImages.tree, x: w * 0.02, y: h * 0.7,  W: w * 0.30, H: w * 0.30 },
      { img: this.svgImages.snowman, x: w * 0.58, y: h * 0.65, W: w * 0.40,  H: w * 0.40 },
      { img: this.svgImages.santa, x: w * 0.02, y: h * 0.05, W: w * 0.15, H: w * 0.15 },
      { img: this.svgImages.star, x: w * 0.8,  y: h * 0.1,  W: w * 0.08, H: w * 0.08 },
      { img: this.svgImages.star, x: w * 0.85, y: h * 0.25, W: w * 0.06, H: w * 0.06 },
    ];
    items.forEach(({ img, x, y, W, H }) => { if (img && img.complete) this.ctx.drawImage(img, x, y, W, H); });
  }

  drawTitleOverlay() {
    const w = this.canvas.width, h = this.canvas.height;
    if (this.titleImg && this.titleImg.complete) {
      const maxW = Math.min(w * 0.75, this.titleImg.naturalWidth || w * 0.75); // ~1.25x larger
      const imgW = maxW;
      const imgH = imgW * ((this.titleImg.naturalHeight || imgW) / (this.titleImg.naturalWidth || imgW));
      const x = (w - imgW) / 2;
      const y = h * 0.008; // tighter top margin
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
    if (this.useStableSingleFace) {
      // Use smoothed CSS-space values for WYSIWYG
      if (!this._smooth || !this.headImg || !this.headImg.complete) return;
      const w = this._smooth.w; const y = this._smooth.y; const ang = this._smooth.angle || 0;
      let leftX = this._smooth.x;
      let rot = ang;
      if (this.mirrorCapture) { leftX = this.canvas.width - leftX - w; rot = -rot; }
      const cx = leftX + w / 2; const cy = y;
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(rot * Math.PI / 180);
      // headImg height is auto; compute height from ratio
      const ratio = (this.headImg && this.headImg.naturalWidth) ? (this.headImg.naturalHeight / this.headImg.naturalWidth) : 1;
      const gearH = w * ratio;
      this.ctx.drawImage(this.headImg, -w / 2, 0, w, gearH);
      this.ctx.restore();
      if (this.headChoice === 'antlers') {
        let nx = this._smooth.nx; let ny = this._smooth.ny; const nd = this._smooth.nd;
        if (this.mirrorCapture) nx = this.canvas.width - nx - nd;
        this.ctx.save();
        const grd = this.ctx.createRadialGradient(nx - nd * 0.15, ny - nd * 0.15, nd * 0.05, nx, ny, nd * 0.5);
        grd.addColorStop(0, '#ff8080'); grd.addColorStop(0.6, '#e00000'); grd.addColorStop(1, '#940000');
        this.ctx.fillStyle = grd; this.ctx.beginPath(); this.ctx.arc(nx + nd/2, ny + nd/2, nd / 2, 0, Math.PI * 2); this.ctx.fill(); this.ctx.restore();
      }
      return;
    }
    if (!this.lastDetections || !this.lastDetections.length) return;
    for (const item of this.lastDetections) {
      const { choice, xCenter, yCenter, w, h, kp, faceWidthForGear, eyesMid, angleDeg } = item;
      const headImg = (choice === 'antlers') ? this.svgImages.antlers : this.svgImages.hat;
      if (!headImg || !headImg.complete) continue;
      const headScale = (choice === 'antlers') ? 1.9 : 1.9375;
      const ratio = headImg.naturalWidth ? (headImg.naturalHeight / headImg.naturalWidth) : 1;
      const gearW = (faceWidthForGear || w) * headScale;
      const gearH = gearW * ratio;
      const eyesMidV = eyesMid || { x: xCenter, y: (yCenter - h * 0.2) };
      const yOffset = (choice === 'antlers') ? 1.15 : 1.35;
      let cx = eyesMidV.x;
      const cy = eyesMidV.y - gearH * yOffset;
      let rot = angleDeg || 0;
      if (this.mirrorCapture) { cx = this.canvas.width - cx; rot = -rot; }
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(rot * Math.PI / 180);
      this.ctx.drawImage(headImg, -gearW / 2, 0, gearW, gearH);
      this.ctx.restore();

      if (choice === 'antlers') {
        const d = Math.max(16, (faceWidthForGear || w) * 0.36);
        const noseC = (kp && kp.nose) ? kp.nose : { x: xCenter, y: (yCenter + h * 0.05) };
        let noseX = noseC.x;
        const noseY = noseC.y;
        if (this.mirrorCapture) noseX = this.canvas.width - noseX;
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
  }

  saveImage() {
    if (!this.capturedImage) { alert('Please capture a photo first.'); return; }
    const a = document.createElement('a');
    a.download = `christmas_${Date.now()}.png`;
    a.href = this.capturedImage; a.click();
  }

  showPreview() {
    const prev = document.getElementById('preview');
    const img = document.getElementById('preview-image');
    if (img && this.capturedImage) img.src = this.capturedImage;
    if (prev) prev.classList.remove('hidden');
    const controls = document.getElementById('controls');
    if (controls) controls.classList.add('hidden');
  }

  hidePreview() {
    const prev = document.getElementById('preview');
    if (prev) prev.classList.add('hidden');
    const controls = document.getElementById('controls');
    if (controls) controls.classList.remove('hidden');
    this.capturedImage = null;
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
    const apiBaseConfigured = !!(window.SHARE_API_BASE || window.__API_BASE__);
    const shareUrl = apiBaseConfigured ? (await this.getShareUrl()) : window.location.href;
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
    const url = (window.SHARE_API_BASE || window.__API_BASE__) ? (await this.getShareUrl()) : window.location.href;
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
    if (navigator.share && navigator.canShare && this.capturedImage) {
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
