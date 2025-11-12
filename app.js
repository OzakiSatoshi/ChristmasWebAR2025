// WebAR Christmas Frame Application
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
        // Get DOM elements
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        // Setup event listeners
        this.setupEventListeners();

        // Preload SVG images
        await this.preloadSVGs();

        // Start camera
        await this.startCamera();

        // Create snowflakes
        this.createSnowflakes();
    }

    async preloadSVGs() {
        const svgs = {
            tree: 'tree.svg',
            snowman: 'snowman.svg',
            santa: 'santa.svg',
            star: 'star.svg',
            snowflake: 'snowflake.svg'
        };

        for (const [name, path] of Object.entries(svgs)) {
            const img = new Image();
            img.src = path;
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = () => {
                    console.warn(`Failed to load ${path}`);
                    resolve();
                };
            });
            this.svgImages[name] = img;
        }
    }

    async startCamera() {
        try {
            // Request camera permission with preference for front camera
            const constraints = {
                video: {
                    facingMode: 'user', // Use front camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            // Remove loading indicator
            const loading = document.querySelector('.loading');
            if (loading) {
                loading.remove();
            }

            // Show controls
            document.getElementById('controls').classList.remove('hidden');

        } catch (error) {
            console.error('Camera access error:', error);
            this.showError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。');
        }
    }

    setupEventListeners() {
        // Capture button
        document.getElementById('btn-capture').addEventListener('click', () => {
            this.capturePhoto();
        });

        // Save button
        document.getElementById('btn-save').addEventListener('click', () => {
            this.saveImage();
        });

        // Share buttons
        document.getElementById('btn-share-x').addEventListener('click', () => {
            this.sharePageToX();
        });

        document.getElementById('btn-share-fb').addEventListener('click', () => {
            this.sharePageToFacebook();
        });

        document.getElementById('btn-share-app').addEventListener('click', () => {
            this.shareImageToApps();
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.resizeCanvas();
            }, 100);
        });
    }

    capturePhoto() {
        if (this.isCapturing) return;
        
        this.isCapturing = true;
        
        // Setup canvas size
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Draw video frame
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Draw SVG decorations
        this.drawDecorations();

        // Draw text overlays
        this.drawTextOverlays();

        // Convert to data URL
        this.capturedImage = this.canvas.toDataURL('image/png');

        // Enable action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.disabled = false;
        });

        // Visual feedback
        this.flashEffect();
        
        this.isCapturing = false;
    }

    drawDecorations() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Calculate positions and sizes based on canvas dimensions
        const decorations = [
            {
                img: this.svgImages.tree,
                x: width * 0.02,
                y: height * 0.7,
                w: width * 0.15,
                h: width * 0.15
            },
            {
                img: this.svgImages.snowman,
                x: width * 0.75,
                y: height * 0.65,
                w: width * 0.2,
                h: width * 0.2
            },
            {
                img: this.svgImages.santa,
                x: width * 0.02,
                y: height * 0.05,
                w: width * 0.15,
                h: width * 0.15
            },
            // Add stars
            {
                img: this.svgImages.star,
                x: width * 0.8,
                y: height * 0.1,
                w: width * 0.08,
                h: width * 0.08
            },
            {
                img: this.svgImages.star,
                x: width * 0.85,
                y: height * 0.25,
                w: width * 0.06,
                h: width * 0.06
            }
        ];

        // Draw each decoration
        decorations.forEach(({ img, x, y, w, h }) => {
            if (img && img.complete) {
                this.ctx.drawImage(img, x, y, w, h);
            }
        });
    }

    drawTextOverlays() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Save context state
        this.ctx.save();

        // Draw "Merry Christmas 2025" at top
        this.ctx.font = `bold ${Math.floor(width * 0.06)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ff0000';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        
        const christmasText = 'Merry Christmas 2025';
        const topTextX = width / 2;
        const topTextY = height * 0.08;
        
        // Draw stroke first (outline)
        this.ctx.strokeText(christmasText, topTextX, topTextY);
        // Then draw fill
        this.ctx.fillText(christmasText, topTextX, topTextY);

        // Add shadow effect
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        this.ctx.fillText(christmasText, topTextX, topTextY);

        // Draw "WebAR Powered by Qukuri" at bottom right
        this.ctx.font = `bold ${Math.floor(width * 0.03)}px Arial`;
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        const poweredText = 'WebAR Powered by Qukuri';
        const bottomTextX = width - width * 0.02;
        const bottomTextY = height - height * 0.02;
        
        // Background for better visibility
        const textMetrics = this.ctx.measureText(poweredText);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(
            bottomTextX - textMetrics.width - 10,
            bottomTextY - 25,
            textMetrics.width + 20,
            35
        );
        
        // Draw text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeText(poweredText, bottomTextX, bottomTextY);
        this.ctx.fillText(poweredText, bottomTextX, bottomTextY);

        // Restore context state
        this.ctx.restore();
    }

    saveImage() {
        if (!this.capturedImage) {
            alert('先に写真を撮影してください。');
            return;
        }

        // Create download link
        const link = document.createElement('a');
        link.download = `christmas_${Date.now()}.png`;
        link.href = this.capturedImage;
        link.click();
    }

    sharePageToX() {
        const text = encodeURIComponent('Merry Christmas 2025! 🎄✨');
        const url = encodeURIComponent(window.location.href);
        const shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    sharePageToFacebook() {
        const url = encodeURIComponent(window.location.href);
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    async shareImageToApps() {
        if (!this.capturedImage) {
            alert('先に写真を撮影してください。');
            return;
        }

        // Check if Web Share API is available
        if (navigator.share && navigator.canShare) {
            try {
                // Convert data URL to blob
                const blob = await this.dataURLtoBlob(this.capturedImage);
                const file = new File([blob], 'christmas_photo.png', { type: 'image/png' });

                // Check if sharing files is supported
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Merry Christmas 2025!',
                        text: 'クリスマスの思い出をシェア！ 🎄✨',
                        files: [file]
                    });
                } else {
                    // Fallback to URL sharing
                    await navigator.share({
                        title: 'Merry Christmas 2025!',
                        text: 'クリスマスの思い出をシェア！ 🎄✨',
                        url: window.location.href
                    });
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

    async dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    showShareFallback() {
        alert('お使いのブラウザでは直接共有できません。\n画像を保存してから、各アプリで共有してください。');
    }

    flashEffect() {
        // Create flash overlay
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.background = 'white';
        flash.style.opacity = '0.8';
        flash.style.zIndex = '999';
        flash.style.pointerEvents = 'none';
        
        document.body.appendChild(flash);
        
        // Fade out animation
        setTimeout(() => {
            flash.style.transition = 'opacity 0.3s';
            flash.style.opacity = '0';
            setTimeout(() => {
                flash.remove();
            }, 300);
        }, 100);

        // Play sound if available (optional)
        this.playShutterSound();
    }

    playShutterSound() {
        // Create a simple beep sound using Web Audio API
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
        } catch (e) {
            // Ignore audio errors
        }
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
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check for HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert('このアプリはHTTPS接続が必要です。');
        return;
    }

    // Check for camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('お使いのブラウザはカメラAPIに対応していません。');
        return;
    }

    // Start the application
    new ChristmasAR();
});