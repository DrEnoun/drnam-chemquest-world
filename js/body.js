// Webcam body tracking for the runner, using MediaPipe Pose (bundled in vendor/, so it works offline).
// The video never leaves the device: frames go straight from the camera to the pose model in this browser tab.
let loading = null;
function loadPose() {
  return (loading ??= new Promise((resolve, reject) => {
    if (window.Pose) return resolve(window.Pose);
    const s = document.createElement('script'); s.src = 'vendor/mediapipe-pose/pose.js';
    s.onload = () => (window.Pose ? resolve(window.Pose) : reject(new Error('Pose did not load')));
    s.onerror = () => { loading = null; reject(new Error('Could not load the body tracker')); };
    document.head.append(s);
  }));
}

// onFrame(landmarks | null) is called for every processed frame; landmarks are mirrored so your right is screen right.
export function createBodyCam({ video, preview, onFrame, onStatus }) {
  let stream = null, pose = null, running = false, busy = false, raf = 0;
  const pctx = preview ? preview.getContext('2d') : null;
  function draw(results) {
    if (!pctx) return;
    const w = preview.width, h = preview.height;
    pctx.save(); pctx.clearRect(0, 0, w, h); pctx.translate(w, 0); pctx.scale(-1, 1);
    pctx.drawImage(results.image, 0, 0, w, h);
    const lm = results.poseLandmarks;
    if (lm) {
      pctx.strokeStyle = '#d4ff3a'; pctx.lineWidth = 3; pctx.lineCap = 'round';
      [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [24, 26]].forEach(([a, b]) => {
        if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) return;
        pctx.beginPath(); pctx.moveTo(lm[a].x * w, lm[a].y * h); pctx.lineTo(lm[b].x * w, lm[b].y * h); pctx.stroke();
      });
    }
    pctx.restore();
  }
  async function loop() {
    if (!running) return;
    if (!busy && video.readyState >= 2) {
      busy = true;
      try { await pose.send({ image: video }); } catch (e) { /* skip this frame */ }
      busy = false;
    }
    raf = requestAnimationFrame(loop);
  }
  return {
    get on() { return running; },
    async start() {
      if (running) return true;
      if (!navigator.mediaDevices?.getUserMedia) { onStatus('nocam', 'This browser cannot use a camera here. Open the game over https or localhost, or play with the keys or swipes.'); return false; }
      onStatus('loading', 'Starting the camera…');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      } catch (e) { onStatus('nocam', 'No camera, or permission was refused. You can still play with the keys or swipes.'); return false; }
      video.srcObject = stream; await video.play().catch(() => {});
      onStatus('loading', 'Loading the body tracker (first time only)…');
      try {
        const Pose = await loadPose();
        pose ??= new Pose({ locateFile: f => `vendor/mediapipe-pose/${f}` });
        pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(r => {
          draw(r);
          const lm = r.poseLandmarks ? r.poseLandmarks.map(p => ({ x: 1 - p.x, y: p.y, visibility: p.visibility })) : null;   // mirror
          onFrame(lm);
        });
        await pose.initialize();
      } catch (e) { this.stop(); onStatus('nocam', 'The body tracker could not start on this device. Play with the keys or swipes instead.'); return false; }
      running = true; onStatus('on', 'Camera on'); loop();
      return true;
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null; video.srcObject = null;
      if (pctx) pctx.clearRect(0, 0, preview.width, preview.height);
      onStatus('off', 'Camera off');
    },
  };
}
