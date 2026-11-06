/* ============================================================
   Procedural coin faces — engraving, relief and metal colour
   ============================================================ */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const SERIF = '"Bodoni Moda", "Didot", Georgia, serif';

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }

  function hash(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967295;
  }

  /* ---------- relief helpers ---------- */

  function fillRelief(ctx, path, opts) {
    opts = opts || {};
    ctx.save();
    ctx.shadowColor = opts.shadow || 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = opts.blur || 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = opts.fill || '#f0f0f0';
    ctx.fill(path);
    ctx.restore();
    if (opts.stroke !== false) {
      ctx.lineWidth = opts.lw || 2.2;
      ctx.strokeStyle = opts.stroke || '#ffffff';
      ctx.stroke(path);
    }
  }

  function circlePath(cx, cy, r) {
    const p = new Path2D();
    p.arc(cx, cy, r, 0, TAU);
    return p;
  }

  function starPath(cx, cy, r, innerRatio, points) {
    const p = new Path2D();
    const n = (points || 4) * 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      const rr = i % 2 === 0 ? r : r * (innerRatio || 0.24);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  }

  /* ---------- curved lettering ---------- */

  function arcText(ctx, text, cx, cy, radius, fontSize, opts) {
    opts = opts || {};
    const dir = opts.dir || 1;
    const tracking = opts.tracking == null ? 0.16 : opts.tracking;
    const weight = opts.weight || 500;

    ctx.save();
    ctx.font = weight + ' ' + fontSize + 'px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const chars = Array.from(text);
    const widths = chars.map(function (ch) {
      return ctx.measureText(ch).width + fontSize * tracking;
    });
    const total = widths.reduce(function (a, b) { return a + b; }, 0);
    const span = total / radius;
    let angle = (opts.start == null ? -Math.PI / 2 : opts.start) - dir * span / 2;

    for (let i = 0; i < chars.length; i++) {
      const half = (widths[i] / radius) / 2;
      angle += dir * half;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + dir * Math.PI / 2);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = fontSize * 0.18;
      ctx.shadowOffsetY = fontSize * 0.05;
      ctx.fillStyle = opts.fill || '#f1f1f1';
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();

      angle += dir * half;
    }
    ctx.restore();
  }

  /* ---------- emblems ---------- */

  function emblemSun(ctx, cx, cy, r) {
    const rays = 24;
    const p = new Path2D();
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU;
      const long = i % 2 === 0;
      const inner = r * 0.54;
      const outer = long ? r * 0.99 : r * 0.78;
      const half = (TAU / rays) * 0.28;
      p.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      p.lineTo(cx + Math.cos(a - half) * outer, cy + Math.sin(a - half) * outer);
      p.lineTo(cx + Math.cos(a + half) * outer, cy + Math.sin(a + half) * outer);
      p.closePath();
    }
    fillRelief(ctx, p, { blur: 12 });

    fillRelief(ctx, circlePath(cx, cy, r * 0.44), { blur: 14 });

    ctx.save();
    ctx.strokeStyle = '#5c5c5c';
    ctx.lineWidth = r * 0.028;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.33, 0, TAU);
    ctx.stroke();
    ctx.restore();

    fillRelief(ctx, circlePath(cx, cy, r * 0.09), { blur: 8, lw: 1.5 });

    const tiny = new Path2D();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.26;
      const rr = r * 0.39;
      tiny.moveTo(cx + Math.cos(a) * rr + r * 0.018, cy + Math.sin(a) * rr);
      tiny.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.018, 0, TAU);
    }
    fillRelief(ctx, tiny, { blur: 6, stroke: false, fill: '#f6f6f6' });
  }

  function emblemMoon(ctx, cx, cy, r) {
    fillRelief(ctx, circlePath(cx, cy, r * 0.9), { blur: 16 });

    ctx.save();
    ctx.fillStyle = '#6c6c6c';
    ctx.beginPath();
    ctx.arc(cx + r * 0.4, cy - r * 0.16, r * 0.82, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    ctx.restore();

    const stars = [
      [0.62, -0.6, 0.1], [0.86, 0.02, 0.07], [0.55, 0.5, 0.085],
      [-0.82, -0.3, 0.06], [-0.6, 0.58, 0.075], [-0.1, 0.86, 0.055],
      [0.12, -0.86, 0.06]
    ];
    stars.forEach(function (s) {
      const p = starPath(cx + s[0] * r, cy + s[1] * r, s[2] * r * 2.4, 0.2, 4);
      fillRelief(ctx, p, { blur: 6, lw: 1.2 });
    });
  }

  function emblemLeaf(ctx, cx, cy, r) {
    const leaf = new Path2D();
    leaf.moveTo(cx, cy - r * 1.02);
    leaf.bezierCurveTo(cx + r * 0.86, cy - r * 0.5, cx + r * 0.68, cy + r * 0.52, cx, cy + r * 0.98);
    leaf.bezierCurveTo(cx - r * 0.68, cy + r * 0.52, cx - r * 0.86, cy - r * 0.5, cx, cy - r * 1.02);
    leaf.closePath();
    fillRelief(ctx, leaf, { blur: 18 });

    ctx.save();
    ctx.strokeStyle = '#575757';
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.045;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.86);
    ctx.quadraticCurveTo(cx + r * 0.05, cy, cx, cy + r * 0.84);
    ctx.stroke();

    ctx.lineWidth = r * 0.026;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const y = cy - r * 0.58 + t * r * 1.15;
      const spread = r * (0.38 - Math.abs(t - 0.45) * 0.3);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(cx + spread * 0.6, y - r * 0.1, cx + spread, y - r * 0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(cx - spread * 0.6, y - r * 0.1, cx - spread, y - r * 0.16);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = r * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.9);
    ctx.lineTo(cx, cy + r * 1.14);
    ctx.stroke();
    ctx.restore();
  }

  function emblemStar(ctx, cx, cy, r) {
    const p = starPath(cx, cy, r, 0.2, 4);
    fillRelief(ctx, p, { blur: 16, lw: 2.6 });

    const rays = new Path2D();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const inner = r * 0.42;
      const outer = r * (i % 2 === 0 ? 1.16 : 0.92);
      const w = 0.035;
      rays.moveTo(cx + Math.cos(a - w) * inner, cy + Math.sin(a - w) * inner);
      rays.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      rays.lineTo(cx + Math.cos(a + w) * inner, cy + Math.sin(a + w) * inner);
      rays.closePath();
    }
    fillRelief(ctx, rays, { blur: 8, lw: 1 });

    fillRelief(ctx, circlePath(cx, cy, r * 0.07), { blur: 6, lw: 1 });
  }

  function emblemEclipse(ctx, cx, cy, r) {
    const corona = new Path2D();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const long = i % 2 === 0;
      const inner = r * 0.86;
      const outer = r * (long ? 1.16 : 1.03);
      const half = 0.026;
      corona.moveTo(cx + Math.cos(a - half) * inner, cy + Math.sin(a - half) * inner);
      corona.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      corona.lineTo(cx + Math.cos(a + half) * inner, cy + Math.sin(a + half) * inner);
      corona.closePath();
    }
    fillRelief(ctx, corona, { blur: 10, lw: 1 });

    const ring = new Path2D();
    ring.arc(cx, cy, r * 0.82, 0, TAU);
    ring.arc(cx, cy, r * 0.6, 0, TAU, true);
    fillRelief(ctx, ring, { blur: 14 });

    ctx.save();
    ctx.fillStyle = '#585858';
    ctx.beginPath();
    ctx.arc(cx + r * 0.09, cy - r * 0.08, r * 0.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3f3f3f';
    ctx.lineWidth = r * 0.025;
    ctx.stroke();
    ctx.restore();

    const dots = new Path2D();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const rr = r * 1.3;
      dots.moveTo(cx + Math.cos(a) * rr + r * 0.025, cy + Math.sin(a) * rr);
      dots.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.025, 0, TAU);
    }
    fillRelief(ctx, dots, { blur: 6, stroke: false, fill: '#efefef' });
  }

  const EMBLEMS = {
    sun: emblemSun,
    moon: emblemMoon,
    leaf: emblemLeaf,
    star: emblemStar,
    eclipse: emblemEclipse
  };

  /* ---------- face composition ---------- */

  function drawFace(ctx, S, coin, isBack) {
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.478;

    ctx.clearRect(0, 0, S, S);

    const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.24, R * 0.04, cx, cy, R);
    g.addColorStop(0, '#909090');
    g.addColorStop(0.68, '#7c7c7c');
    g.addColorStop(1, '#6a6a6a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);

    for (let a = 0; a < TAU; a += TAU / 260) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
      ctx.lineTo(Math.cos(a) * R * 0.872, Math.sin(a) * R * 0.872);
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.055)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    for (let r = R * 0.24; r < R * 0.87; r += R * 0.021) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.972, 0, TAU);
    ctx.strokeStyle = '#dedede';
    ctx.lineWidth = S * 0.03;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.947, 0, TAU);
    ctx.strokeStyle = '#5c5c5c';
    ctx.lineWidth = S * 0.004;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.997, 0, TAU);
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = S * 0.005;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.888, 0, TAU);
    ctx.strokeStyle = '#4b4b4b';
    ctx.lineWidth = S * 0.005;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.878, 0, TAU);
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = S * 0.003;
    ctx.stroke();

    if (isBack) drawBack(ctx, S, cx, cy, R, coin);
    else drawFront(ctx, S, cx, cy, R, coin);
  }

  function drawFront(ctx, S, cx, cy, R, coin) {
    const draw = EMBLEMS[coin.emblem] || EMBLEMS.sun;
    draw(ctx, cx, cy - R * 0.02, R * 0.345);

    arcText(ctx, coin.legendTop, cx, cy, R * 0.928, R * 0.078, {
      start: -Math.PI / 2,
      dir: 1,
      tracking: 0.2
    });
    arcText(ctx, coin.legendBottom, cx, cy, R * 0.928, R * 0.064, {
      start: Math.PI / 2,
      dir: -1,
      tracking: 0.16
    });

    ctx.save();
    ctx.font = '500 ' + R * 0.055 + 'px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ededed';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = R * 0.02;
    ctx.fillText(coin.purity, cx, cy + R * 0.4);
    ctx.restore();

    const dots = new Path2D();
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? Math.PI : 0;
      const x = cx + Math.cos(a) * R * 0.79;
      const y = cy + Math.sin(a) * R * 0.79;
      dots.moveTo(x + R * 0.014, y);
      dots.arc(x, y, R * 0.014, 0, TAU);
    }
    fillRelief(ctx, dots, { blur: 6, stroke: false, fill: '#e9e9e9' });
  }

  function drawBack(ctx, S, cx, cy, R, coin) {
    ctx.save();
    ctx.strokeStyle = '#c4c4c4';
    ctx.lineWidth = S * 0.0035;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.44, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = '500 ' + R * 0.62 + 'px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1f1f1';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = R * 0.035;
    ctx.fillText('A', cx, cy + R * 0.015);
    ctx.restore();

    arcText(ctx, 'AUREUM', cx, cy, R * 0.928, R * 0.078, {
      start: -Math.PI / 2,
      dir: 1,
      tracking: 0.32
    });
    arcText(ctx, 'FINE METAL EDITION', cx, cy, R * 0.925, R * 0.048, {
      start: Math.PI / 2,
      dir: -1,
      tracking: 0.16
    });

    ctx.save();
    ctx.font = '500 ' + R * 0.044 + 'px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ededed';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = R * 0.015;
    ctx.fillText(coin.serial, cx, cy + R * 0.57);
    ctx.restore();
  }

  /* ---------- height canvas -> colour + normal maps ---------- */

  function deriveMaps(heightCanvas, coin, strength) {
    const S = heightCanvas.width;
    const hctx = heightCanvas.getContext('2d', { willReadFrequently: true });
    const src = hctx.getImageData(0, 0, S, S).data;
    const heights = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) heights[i] = src[i * 4] / 255;

    const colorCanvas = makeCanvas(S);
    const cctx = colorCanvas.getContext('2d');
    const cimg = cctx.createImageData(S, S);
    const cd = cimg.data;

    const normalCanvas = makeCanvas(S);
    const nctx = normalCanvas.getContext('2d');
    const nimg = nctx.createImageData(S, S);
    const nd = nimg.data;

    const base = coin.base;
    const patina = coin.patina;
    const half = S / 2;

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const idx = y * S + x;
        const p = idx * 4;
        const h = heights[idx];

        const xl = heights[y * S + (x > 0 ? x - 1 : x)];
        const xr = heights[y * S + (x < S - 1 ? x + 1 : x)];
        const yu = heights[(y > 0 ? y - 1 : y) * S + x];
        const yd = heights[(y < S - 1 ? y + 1 : y) * S + x];

        const dx = x - half;
        const dy = y - half;
        const radial = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (S * 0.52));
        const ao = 1 - 0.15 * radial * radial;
        const grain = (hash(x, y) - 0.5) * 0.055;
        // bake a raking light from the upper-left into the colour map
        const emboss = clamp(1 + ((xl - xr) - (yu - yd)) * 2.6, 0.7, 1.32);
        const k = (0.46 + 0.76 * h) * ao * emboss + grain;

        let r = base[0] * k;
        let g = base[1] * k;
        let b = base[2] * k;

        if (patina) {
          const pn = Math.sin(x * 0.0075 + y * 0.004) * Math.sin(y * 0.009 - x * 0.0031);
          const t = clamp(0.5 + pn * 1.05, 0, 1);
          r = r * (1 - t * 0.4) + 120 * t * 0.4;
          g = g * (1 - t * 0.18) + 184 * t * 0.18;
          b = b * (1 - t * 0.28) + 156 * t * 0.28;
        }

        cd[p] = clamp(r, 0, 255);
        cd[p + 1] = clamp(g, 0, 255);
        cd[p + 2] = clamp(b, 0, 255);
        cd[p + 3] = 255;

        let nx = (xl - xr) * strength;
        let ny = (yd - yu) * strength;
        const len = Math.hypot(nx, ny, 1);

        nd[p] = (nx / len * 0.5 + 0.5) * 255;
        nd[p + 1] = (ny / len * 0.5 + 0.5) * 255;
        nd[p + 2] = (1 / len * 0.5 + 0.5) * 255;
        nd[p + 3] = 255;
      }
    }

    cctx.putImageData(cimg, 0, 0);
    nctx.putImageData(nimg, 0, 0);
    return { color: colorCanvas, normal: normalCanvas };
  }

  /* ---------- custom coin photographs ---------- */

  function normalFromLuminance(colorCanvas, strength) {
    const S = colorCanvas.width;
    const ctx = colorCanvas.getContext('2d', { willReadFrequently: true });
    const src = ctx.getImageData(0, 0, S, S).data;
    const heights = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      heights[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    }

    const normalCanvas = makeCanvas(S);
    const nctx = normalCanvas.getContext('2d');
    const nimg = nctx.createImageData(S, S);
    const nd = nimg.data;

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const p = (y * S + x) * 4;
        const xl = heights[y * S + (x > 0 ? x - 1 : x)];
        const xr = heights[y * S + (x < S - 1 ? x + 1 : x)];
        const yu = heights[(y > 0 ? y - 1 : y) * S + x];
        const yd = heights[(y < S - 1 ? y + 1 : y) * S + x];

        const nx = (xl - xr) * strength;
        const ny = (yd - yu) * strength;
        const len = Math.sqrt(nx * nx + ny * ny + 1);

        nd[p] = (nx / len * 0.5 + 0.5) * 255;
        nd[p + 1] = (ny / len * 0.5 + 0.5) * 255;
        nd[p + 2] = (1 / len * 0.5 + 0.5) * 255;
        nd[p + 3] = 255;
      }
    }

    nctx.putImageData(nimg, 0, 0);
    return normalCanvas;
  }

  function mapsFromImage(img, S, strength) {
    const colorCanvas = makeCanvas(S);
    const ctx = colorCanvas.getContext('2d');
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, S, S);

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(S / iw, S / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);

    return {
      color: colorCanvas,
      normal: normalFromLuminance(colorCanvas, strength || 0.7),
      photo: true
    };
  }

  /* ---------- reeded edge ---------- */

  function makeEdgeCanvas(coin, W, H) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a9a9a9';
    ctx.fillRect(0, 0, W, H);

    const n = 84;
    const step = W / n;
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const grad = ctx.createLinearGradient(x, 0, x + step, 0);
      grad.addColorStop(0, '#565656');
      grad.addColorStop(0.36, '#f4f4f4');
      grad.addColorStop(0.58, '#9a9a9a');
      grad.addColorStop(1, '#4d4d4d');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, step + 0.8, H);
    }

    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0.35)');
    vg.addColorStop(0.2, 'rgba(255,255,255,0.12)');
    vg.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    vg.addColorStop(0.85, 'rgba(0,0,0,0.18)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    return c;
  }

  /* ---------- public API ---------- */

  function makeTexture(canvas, srgb, anisotropy) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = anisotropy || 4;
    tex.needsUpdate = true;
    return tex;
  }

  function buildCoinAssets(coin, anisotropy, images) {
    let front, back;

    if (images && images.front) {
      front = mapsFromImage(images.front, 640, coin.imageRelief || 0.8);
    } else {
      const frontH = makeCanvas(640);
      drawFace(frontH.getContext('2d'), 640, coin, false);
      front = deriveMaps(frontH, coin, 2.05);
    }

    if (images && images.back) {
      back = mapsFromImage(images.back, 512, coin.imageRelief || 0.7);
    } else {
      const backH = makeCanvas(512);
      drawFace(backH.getContext('2d'), 512, coin, true);
      back = deriveMaps(backH, coin, 1.85);
    }

    return {
      front: {
        map: makeTexture(front.color, true, anisotropy),
        normalMap: makeTexture(front.normal, false, anisotropy),
        photo: !!front.photo
      },
      back: {
        map: makeTexture(back.color, true, anisotropy),
        normalMap: makeTexture(back.normal, false, anisotropy),
        photo: !!back.photo
      },
      edge: makeTexture(makeEdgeCanvas(coin, 1024, 128), true, anisotropy)
    };
  }

  global.AUREUM_TEXTURES = {
    buildCoinAssets: buildCoinAssets,
    makeCanvas: makeCanvas
  };
})(window);
