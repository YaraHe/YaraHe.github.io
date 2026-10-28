(() => {
  'use strict';

  // 44, 52 and 60 are comparison presets, not CSS radii. 52 is the default.
  const requested = new URLSearchParams(location.search).get('brush');
  const preset = requested === '44' ? 44 : requested === '60' ? 60 : 52;
  const REVEAL = Object.freeze({
    preset,
    referencePreset: 82,
    referenceHeightShare: 0.54,
    holdMs: 2700,
    fullMs: 500,
    fieldScale: 0.34,
    edgeSoftness: 0.036,
    paper: '#f5f1e8'
  });

  const canvas = document.getElementById('reveal');
  const home = document.getElementById('home');
  if (!canvas || !home) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d', { alpha: true });
  if (!ctx || !maskCtx) return;

  let width = 0, height = 0, fieldWidth = 0, fieldHeight = 0, radius = 0;
  let field = new Float32Array(0);
  let warpX = new Float32Array(0), warpY = new Float32Array(0);
  let contour = new Float32Array(0), erosion = new Float32Array(0);
  let image = null, segments = [], lastPoint = null, travel = 0, frame = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function smoothstep(v) {
    const t = clamp(v, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hash(x, y, seed) {
    let n = Math.imul(x + seed, 374761393) + Math.imul(y - seed, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function noise(x, y, scale, seed) {
    const u = x / scale, v = y / scale;
    const xi = Math.floor(u), yi = Math.floor(v);
    const tx = smoothstep(u - xi), ty = smoothstep(v - yi);
    const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }

  function makeStableTexture() {
    const size = fieldWidth * fieldHeight;
    warpX = new Float32Array(size);
    warpY = new Float32Array(size);
    contour = new Float32Array(size);
    erosion = new Float32Array(size);
    const px = REVEAL.fieldScale;
    for (let y = 0; y < fieldHeight; y++) {
      for (let x = 0; x < fieldWidth; x++) {
        const i = y * fieldWidth + x;
        const broad = noise(x, y, 105 * px, 13) * 2 - 1;
        const middle = noise(x, y, 39 * px, 47) * 2 - 1;
        const small = noise(x, y, 15 * px, 101) * 2 - 1;
        const other = noise(x, y, 46 * px, 157) * 2 - 1;
        warpX[i] = radius * (broad * 0.065 + middle * 0.035);
        warpY[i] = radius * (other * 0.060 + small * 0.022);
        contour[i] = broad * 0.045 + middle * 0.085 + small * 0.055;
        erosion[i] = (noise(x, y, 27 * px, 211) * 2 - 1) * 0.045;
      }
    }
  }

  function radiusAt(distance) {
    return radius * (1 + 0.075 * Math.sin(distance / 101 + 0.4)
      + 0.035 * Math.sin(distance / 39 - 1.1));
  }

  function resize() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const bounds = home.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calibrated against the source tool's 44, 60 and 82 at 770 × 432.
    // sqrt maps the preset to observed *proportional* stroke width.
    const heightShare = REVEAL.referenceHeightShare *
      Math.sqrt(REVEAL.preset / REVEAL.referencePreset);
    radius = clamp(height * heightShare / 2 * REVEAL.fieldScale, 26, 93);
    fieldWidth = Math.max(1, Math.round(width * REVEAL.fieldScale));
    fieldHeight = Math.max(1, Math.round(height * REVEAL.fieldScale));
    maskCanvas.width = fieldWidth;
    maskCanvas.height = fieldHeight;
    field = new Float32Array(fieldWidth * fieldHeight);
    image = maskCtx.createImageData(fieldWidth, fieldHeight);
    makeStableTexture();
    render(performance.now());
  }

  function pointerMove(event) {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    if (event.target instanceof Element && event.target.closest('#music-player')) {
      lastPoint = null;
      return;
    }
    const bounds = home.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left) * REVEAL.fieldScale,
      y: (event.clientY - bounds.top) * REVEAL.fieldScale,
      at: performance.now()
    };
    if (!lastPoint) {
      segments.push({
        ax: point.x, ay: point.y, bx: point.x, by: point.y,
        t0: point.at, t1: point.at, r0: radiusAt(travel), r1: radiusAt(travel)
      });
    } else {
      const length = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      const nextTravel = travel + length / REVEAL.fieldScale;
      segments.push({
        ax: lastPoint.x, ay: lastPoint.y, bx: point.x, by: point.y,
        t0: lastPoint.at, t1: point.at,
        r0: radiusAt(travel), r1: radiusAt(nextTravel)
      });
      travel = nextTravel;
    }
    lastPoint = point;
    if (!frame) frame = requestAnimationFrame(render);
  }

  function rasterize(segment, now) {
    const vx = segment.bx - segment.ax, vy = segment.by - segment.ay;
    const lengthSq = vx * vx + vy * vy;
    const extent = Math.max(segment.r0, segment.r1) * 1.28;
    const minX = Math.max(0, Math.floor(Math.min(segment.ax, segment.bx) - extent));
    const maxX = Math.min(fieldWidth - 1, Math.ceil(Math.max(segment.ax, segment.bx) + extent));
    const minY = Math.max(0, Math.floor(Math.min(segment.ay, segment.by) - extent));
    const maxY = Math.min(fieldHeight - 1, Math.ceil(Math.max(segment.ay, segment.by) + extent));

    for (let y = minY; y <= maxY; y++) {
      let i = y * fieldWidth + minX;
      for (let x = minX; x <= maxX; x++, i++) {
        const px = x + warpX[i], py = y + warpY[i];
        const t = lengthSq > 0.01 ?
          clamp(((px - segment.ax) * vx + (py - segment.ay) * vy) / lengthSq, 0, 1) : 0;
        const nearX = segment.ax + vx * t, nearY = segment.ay + vy * t;
        const dx = px - nearX, dy = py - nearY;
        const r = segment.r0 + (segment.r1 - segment.r0) * t;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > r * r * 1.38) continue;
        const time = segment.t0 + (segment.t1 - segment.t0) * t;
        const age = now - time;
        if (age >= REVEAL.holdMs) continue;
        const progress = age <= REVEAL.fullMs ? 0 :
          smoothstep((age - REVEAL.fullMs) /
            (REVEAL.holdMs - REVEAL.fullMs));
        const metric = Math.sqrt(distanceSq) / r;
        const boundary = 1 - progress + contour[i] + erosion[i] * progress;
        const alpha = smoothstep((boundary - metric) / REVEAL.edgeSoftness);
        if (alpha > field[i]) field[i] = alpha;
      }
    }
  }

  function render(now) {
    frame = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = REVEAL.paper;
    ctx.fillRect(0, 0, width, height);
    segments = segments.filter(s => now - s.t1 < REVEAL.holdMs);
    if (!segments.length || !image) return;

    field.fill(0);
    for (const segment of segments) rasterize(segment, now);

    const pixels = image.data;
    for (let i = 0, j = 0; i < field.length; i++, j += 4) {
      pixels[j] = 255;
      pixels[j + 1] = 255;
      pixels[j + 2] = 255;
      pixels[j + 3] = Math.round(field[i] * 255);
    }
    maskCtx.putImageData(image, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(maskCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    frame = requestAnimationFrame(render);
  }

  home.addEventListener('pointermove', pointerMove, { passive: true });
  home.addEventListener('pointerleave', () => { lastPoint = null; });
  window.addEventListener('blur', () => { lastPoint = null; });
  window.addEventListener('resize', resize);
  reducedMotion.addEventListener('change', () => {
    segments = []; lastPoint = null; resize();
  });
  resize();
})();
