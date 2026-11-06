/* ============================================================
   AUREUM — scene, coins and interface
   ============================================================ */
(function () {
  'use strict';

  const T = window.THREE;
  const COINS = window.AUREUM_COINS;
  const TEX = window.AUREUM_TEXTURES;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // debug hook: ?timer renders on a setTimeout loop (headless screenshots have no rAF)
  const timerMode = /[?&]timer\b/.test(window.location.search);

  if (!T) {
    const meta = document.getElementById('loaderMeta');
    if (meta) meta.textContent = 'Three.js failed to load';
    return;
  }

  /* ---------------- DOM ---------------- */

  const el = {
    canvas: document.getElementById('scene'),
    loader: document.getElementById('loader'),
    loaderBar: document.getElementById('loaderBar'),
    loaderMeta: document.getElementById('loaderMeta'),
    counterCurrent: document.getElementById('counterCurrent'),
    counterTotal: document.getElementById('counterTotal'),
    coinHead: document.getElementById('coinHead'),
    coinName: document.getElementById('coinName'),
    coinMetal: document.getElementById('coinMetal'),
    coinDesc: document.getElementById('coinDesc'),
    coinPrice: document.getElementById('coinPrice'),
    specWeight: document.getElementById('specWeight'),
    specMintage: document.getElementById('specMintage'),
    specDiameter: document.getElementById('specDiameter'),
    dots: document.getElementById('dots'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    root: document.documentElement
  };

  /* ---------------- State ---------------- */

  const state = {
    index: 0,
    ready: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDX: 0,
    dragTarget: 0,
    dragCur: 0,
    moved: false,
    pointerDown: false,
    pointer: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    camPulse: 0,
    wheelLock: 0,
    textTimer: 0
  };

  let renderer, scene, camera, carousel, coins = [], particles, clock;
  let layout = {};
  let raycaster, pointerNDC;
  let pickables = [];

  const MAX_ANISO = 4;

  /* ---------------- Helpers ---------------- */

  function nextPaint() {
    if (timerMode) return new Promise(function (resolve) { setTimeout(resolve, 0); });
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { setTimeout(resolve, 0); });
    });
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, 1800); })
    ]);
  }

  function setProgress(p, label) {
    if (!el.loaderBar) return;
    el.loaderBar.style.width = Math.round(p * 100) + '%';
    if (el.loaderMeta) el.loaderMeta.textContent = label + ' — ' + Math.round(p * 100) + '%';
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---------------- Layout ---------------- */

  function computeLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mobile = w < 760;
    const mid = w < 1180;
    const fov = mobile ? 40 : 36;
    const camZ = mobile ? 13.6 : (mid ? 12.0 : 12.6);
    const visH = 2 * camZ * Math.tan((fov * Math.PI) / 360);
    const visW = visH * (w / h);

    layout = {
      mobile: mobile,
      mid: mid,
      fov: fov,
      camZ: camZ,
      visH: visH,
      visW: visW,
      stageX: mobile ? 0 : (mid ? 0.55 : 1.35),
      stageY: mobile ? -0.15 : 0.22,
      sideX: mobile ? 2.15 : (mid ? 2.15 : 3.35),
      sideScale: mobile ? 0.55 : (mid ? 0.58 : 0.66),
      sideZ: mobile ? -1.6 : (mid ? -1.7 : -1.3),
      pxToWorld: visW / w,
      haloScale: mobile ? 5 : 6.2
    };

    const sx = 50 + (layout.stageX / layout.visW) * 100;
    const sy = 50 - (layout.stageY / layout.visH) * 100;
    el.root.style.setProperty('--stage-x', sx.toFixed(2) + '%');
    el.root.style.setProperty('--stage-y', sy.toFixed(2) + '%');
  }

  function slotFor(d) {
    const L = layout;
    if (d === 0) {
      return { x: 0, y: 0, z: 0.85, s: 1, ry: 0, h: 1 };
    }
    const sgn = Math.sign(d);
    if (Math.abs(d) === 1) {
      return {
        x: sgn * L.sideX,
        y: -0.05,
        z: L.sideZ,
        s: L.sideScale,
        ry: -sgn * (L.mobile ? 0.46 : 0.6),
        h: 0.2
      };
    }
    return {
      x: sgn * 16,
      y: -0.8,
      z: -10,
      s: 0.4,
      ry: -sgn * 0.95,
      h: 0
    };
  }

  /* ---------------- Environment ---------------- */

  function softBlob(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color.replace(/[\d.]+\)$/, '0.28)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function buildEnvironment() {
    const c = TEX.makeCanvas(1024, 512);
    const ctx = c.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#3b4258');
    bg.addColorStop(0.34, '#1b1e29');
    bg.addColorStop(0.52, '#0a0a0e');
    bg.addColorStop(1, '#040405');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 512);

    const topGlow = ctx.createLinearGradient(0, 0, 0, 240);
    topGlow.addColorStop(0, 'rgba(255, 250, 238, 0.5)');
    topGlow.addColorStop(1, 'rgba(255, 250, 238, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, 1024, 240);

    // broad glow in the direction the coins reflect (behind the camera)
    softBlob(ctx, 768, 250, 300, 210, 'rgba(255, 251, 242, 0.38)');
    // a stack of soft strips right where the flat face reflects
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)';
      ctx.fillRect(560, 186 + i * 42, 420, 26);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(836, 110, 12, 300);
    ctx.fillRect(700, 330, 200, 60);
    softBlob(ctx, 260, 250, 300, 200, 'rgba(255, 236, 210, 0.55)');

    // crisp studio strips for engraved relief
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(690, 90, 24, 300);
    ctx.fillRect(796, 120, 30, 260);
    ctx.fillRect(870, 60, 14, 360);
    ctx.fillRect(620, 320, 260, 14);

    softBlob(ctx, 300, 66, 320, 150, 'rgba(255, 248, 232, 1)');
    softBlob(ctx, 790, 96, 240, 120, 'rgba(214, 228, 255, 0.95)');
    softBlob(ctx, 80, 280, 210, 130, 'rgba(255, 186, 122, 0.8)');
    softBlob(ctx, 950, 290, 230, 140, 'rgba(140, 172, 240, 0.65)');
    softBlob(ctx, 520, 470, 360, 100, 'rgba(255, 214, 166, 0.2)');

    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.colorSpace = T.SRGBColorSpace;

    const pmrem = new T.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();

    scene.environment = env;
  }

  function glowTexture(size, inner, mid) {
    const c = TEX.makeCanvas(size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ---------------- Coin construction ---------------- */

  let haloTexture;
  let dustTexture;

  function faceMaterial(maps, coin) {
    const photo = !!maps.photo;
    return new T.MeshPhysicalMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new T.Vector2(photo ? 0.7 : 1.35, photo ? 0.7 : 1.35),
      color: 0xffffff,
      metalness: photo ? 0.74 : 0.78,
      roughness: photo ? 0.45 : 0.18,
      envMapIntensity: photo ? 1.1 : 1.25,
      clearcoat: photo ? 0.1 : 0.06,
      clearcoatRoughness: 0.28,
      iridescence: coin.iridescence ? 1 : 0,
      iridescenceIOR: 1.9,
      iridescenceThicknessRange: [120, 520]
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      const img = new Image();
      let done = false;
      const finish = function (value) {
        if (done) return;
        done = true;
        resolve(value);
      };
      img.onload = function () { finish(img); };
      img.onerror = function () {
        console.warn('AUREUM: could not load coin image — ' + src);
        finish(null);
      };
      img.src = src;
      setTimeout(function () { finish(null); }, 4000);
    });
  }

  async function loadCoinImages(coin) {
    if (!coin.frontImage && !coin.backImage) return null;
    const pair = await Promise.all([
      loadImage(coin.frontImage),
      loadImage(coin.backImage)
    ]);
    return { front: pair[0], back: pair[1] };
  }

  function createCoin(coin, index, images) {
    const assets = TEX.buildCoinAssets(coin, renderer.capabilities.getMaxAnisotropy(), images);

    const R = 1.55;
    const TH = 0.17;

    const wrapper = new T.Group();
    const tilt = new T.Group();
    const spinner = new T.Group();
    wrapper.add(tilt);
    tilt.add(spinner);

    const edgeMat = new T.MeshPhysicalMaterial({
      color: new T.Color(coin.rim),
      map: assets.edge,
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.7
    });
    const body = new T.Mesh(new T.CylinderGeometry(R, R, TH, 160, 1, true), edgeMat);
    body.rotation.x = Math.PI / 2;
    body.userData.coinIndex = index;
    spinner.add(body);

    const faceGeo = new T.CircleGeometry(R * 0.996, 180);

    const front = new T.Mesh(faceGeo, faceMaterial(assets.front, coin));
    front.position.z = TH / 2 + 0.002;
    front.userData.coinIndex = index;
    spinner.add(front);

    const back = new T.Mesh(faceGeo, faceMaterial(assets.back, coin));
    back.position.z = -TH / 2 - 0.002;
    back.rotation.y = Math.PI;
    back.userData.coinIndex = index;
    spinner.add(back);
    pickables.push(front, back);

    const rimGeo = new T.TorusGeometry(R * 0.985, 0.026, 12, 160);
    const rimMat = new T.MeshStandardMaterial({
      color: new T.Color(coin.rim),
      metalness: 1,
      roughness: 0.16,
      envMapIntensity: 1.9
    });
    const rimFront = new T.Mesh(rimGeo, rimMat);
    rimFront.position.z = TH / 2 - 0.004;
    spinner.add(rimFront);
    const rimBack = new T.Mesh(rimGeo, rimMat);
    rimBack.position.z = -TH / 2 + 0.004;
    spinner.add(rimBack);

    const halo = new T.Sprite(new T.SpriteMaterial({
      map: haloTexture,
      color: new T.Color('#241d12'),
      transparent: true,
      opacity: 0.2,
      blending: T.NormalBlending,
      depthWrite: false,
      depthTest: true
    }));
    halo.position.set(0, -1.15, -1.05);
    halo.scale.set(layout.haloScale * 1.15, layout.haloScale * 0.58, 1);
    wrapper.add(halo);

    tilt.rotation.x = 0.055;
    wrapper.add(tilt);

    carousel.add(wrapper);

    return {
      index: index,
      data: coin,
      wrapper: wrapper,
      tilt: tilt,
      spinner: spinner,
      halo: halo,
      phase: index * 1.63,
      flipT: -1,
      pop: 0,
      cur: { x: 0, y: 0, z: 0, s: 1, ry: 0, h: 0 },
      vel: { x: 0, y: 0, z: 0, s: 0, ry: 0, h: 0 }
    };
  }

  /* ---------------- UI ---------------- */

  function buildDots() {
    COINS.forEach(function (coin, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.dataset.index = String(i + 1).padStart(2, '0');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Show ' + coin.name);
      b.setAttribute('aria-selected', i === state.index ? 'true' : 'false');
      b.addEventListener('click', function () { goTo(i); });
      el.dots.appendChild(b);
    });
  }

  function updateDots() {
    const dots = el.dots.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i === state.index);
      dots[i].setAttribute('aria-selected', i === state.index ? 'true' : 'false');
    }
  }

  function writeCopy(coin) {
    el.counterCurrent.textContent = String(state.index + 1).padStart(2, '0');
    el.coinName.textContent = coin.name;
    el.coinMetal.textContent = coin.metal + ' · ' + coin.purity;
    el.coinDesc.textContent = coin.desc;
    el.coinPrice.textContent = coin.price;
    el.specWeight.textContent = coin.weight;
    el.specMintage.textContent = coin.mintage;
    el.specDiameter.textContent = coin.diameter;
  }

  function updateUI(coin, immediate) {
    el.root.style.setProperty('--accent', coin.accent);
    el.root.style.setProperty('--accent-soft', coin.accentSoft);
    document.body.dataset.coin = coin.id;
    updateDots();

    if (immediate) {
      writeCopy(coin);
      el.coinHead.classList.remove('is-out');
      el.coinDesc.classList.remove('is-out');
      return;
    }

    clearTimeout(state.textTimer);
    el.coinHead.classList.add('is-out');
    el.coinDesc.classList.add('is-out');
    state.textTimer = setTimeout(function () {
      writeCopy(coin);
      el.coinHead.classList.remove('is-out');
      el.coinDesc.classList.remove('is-out');
    }, 190);
  }

  /* ---------------- Navigation ---------------- */

  function indexDelta(a, b) {
    const n = COINS.length;
    let d = a - b;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  function goTo(i) {
    const n = COINS.length;
    i = ((i % n) + n) % n;
    if (i === state.index) {
      flipActive();
      return;
    }
    const previous = state.index;
    state.index = i;

    const active = coins[i];
    active.flipT = 0;
    active.pop = 1;
    if (coins[previous]) coins[previous].pop = 0.4;

    state.camPulse = reduceMotion ? 0 : 1;
    updateUI(COINS[i], false);
  }

  function flipActive() {
    const coin = coins[state.index];
    if (!coin) return;
    coin.flipT = 0;
    coin.pop = 1;
    state.camPulse = reduceMotion ? 0 : 0.6;
  }

  /* ---------------- Interaction ---------------- */

  function isInteractive(target) {
    return !!(target && target.closest && target.closest('a, button, input, textarea, select'));
  }

  function pointerPosition(e) {
    state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  function onPointerDown(e) {
    if (e.button !== 0 || isInteractive(e.target)) return;
    state.pointerDown = true;
    state.dragging = true;
    state.moved = false;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragDX = 0;
    state.dragTarget = 0;
    document.body.classList.add('is-grabbing');
  }

  function onPointerMove(e) {
    pointerPosition(e);
    if (!state.dragging) return;

    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;
    state.dragDX = dx;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) state.moved = true;

    const world = dx * layout.pxToWorld * 0.72;
    state.dragTarget = clamp(world, -2.6, 2.6);
  }

  function onPointerUp(e) {
    if (!state.dragging) return;
    const dx = state.dragDX;
    state.dragging = false;
    state.pointerDown = false;
    document.body.classList.remove('is-grabbing');

    if (Math.abs(dx) > 68) {
      goTo(state.index + (dx < 0 ? 1 : -1));
      state.dragTarget = 0;
      state.dragDX = 0;
      return;
    }

    state.dragTarget = 0;

    if (!state.moved && e.target && !isInteractive(e.target)) {
      pick(e.clientX, e.clientY);
    }
    state.dragDX = 0;
  }

  function pick(clientX, clientY) {
    if (!raycaster || !camera) return;
    const rect = el.canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    if (!hits.length) return;
    const idx = hits[0].object.userData.coinIndex;
    if (idx === state.index) flipActive();
    else goTo(idx);
  }

  function onWheel(e) {
    if (e.ctrlKey) return;
    e.preventDefault();
    const now = performance.now();
    if (now < state.wheelLock) return;
    if (Math.abs(e.deltaY) < 6) return;
    state.wheelLock = now + 720;
    goTo(state.index + (e.deltaY > 0 ? 1 : -1));
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goTo(state.index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goTo(state.index - 1);
    } else if (/^[1-9]$/.test(e.key)) {
      const n = parseInt(e.key, 10) - 1;
      if (n < COINS.length) goTo(n);
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (!isInteractive(e.target)) {
        e.preventDefault();
        flipActive();
      }
    }
  }

  /* ---------------- Animation ---------------- */

  function springTo(c, key, target, k, damp, dt) {
    const a = (target - c.cur[key]) * k - c.vel[key] * damp;
    c.vel[key] += a * dt;
    c.cur[key] += c.vel[key] * dt;
  }

  function updateCoins(dt, time) {
    const steps = dt > 0.02 ? 2 : 1;
    const sdt = dt / steps;

    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      const d = indexDelta(c.index, state.index);
      const slot = slotFor(d);
      const isActive = d === 0;

      for (let s = 0; s < steps; s++) {
        springTo(c, 'x', slot.x, 120, 18, sdt);
        springTo(c, 'y', slot.y, 110, 17, sdt);
        springTo(c, 'z', slot.z, 120, 18, sdt);
        springTo(c, 's', slot.s, 130, 18, sdt);
        springTo(c, 'ry', slot.ry, 120, 18, sdt);
        springTo(c, 'h', slot.h, 100, 16, sdt);
      }

      c.pop *= Math.exp(-3.6 * dt);

      let flip = 0;
      let lift = 0;
      if (c.flipT >= 0) {
        c.flipT += dt;
        const p = Math.min(1, c.flipT / (reduceMotion ? 0.5 : 1.02));
        flip = easeOutCubic(p) * TAU;
        lift = Math.sin(p * Math.PI) * 0.4;
        if (p >= 1) c.flipT = -1;
      }

      const bobAmp = isActive ? 0.055 : 0.03;
      const bob = Math.sin(time * 0.72 + c.phase) * bobAmp;
      const sway = Math.sin(time * 0.5 + c.phase * 1.4) * 0.03;

      c.wrapper.position.set(
        c.cur.x,
        c.cur.y + bob,
        c.cur.z + lift
      );
      c.wrapper.scale.setScalar(c.cur.s * (1 + c.pop * 0.075));
      c.wrapper.rotation.y = c.cur.ry;

      c.tilt.rotation.x = 0.085 + state.look.y * 0.05 * (isActive ? 1 : 0.4);
      c.tilt.rotation.z = sway + state.look.x * 0.02;

      const spinBase = Math.sin(time * 0.46 + c.phase) * (isActive ? 0.3 : 0.1);
      const pointerSpin = isActive ? state.look.x * 0.16 : 0;
      c.spinner.rotation.y = spinBase + pointerSpin + flip;

      c.halo.material.opacity = c.cur.h * c.data.halo * 0.42 * (0.85 + Math.sin(time * 0.9 + c.phase) * 0.08);
      const hs = layout.haloScale * (0.62 + c.cur.s * 0.42) * (1 + c.pop * 0.08);
      c.halo.scale.set(hs * 1.15, hs * 0.58, 1);
    }
  }

  function updateCamera(dt) {
    const smooth = 1 - Math.exp(-4.2 * dt);
    state.look.x = lerp(state.look.x, state.pointer.x, smooth);
    state.look.y = lerp(state.look.y, state.pointer.y, smooth);

    state.camPulse *= Math.exp(-3.2 * dt);

    camera.position.x = state.look.x * (layout.mobile ? 0.18 : 0.42);
    camera.position.y = state.look.y * (layout.mobile ? 0.12 : 0.28);
    camera.position.z = layout.camZ - state.camPulse * 0.5;
    camera.lookAt(carousel.position.x * 0.32, 0.05, 0);

    const dragSmooth = 1 - Math.exp(-9 * dt);
    state.dragCur = lerp(state.dragCur, state.dragTarget, dragSmooth);
    carousel.position.x = layout.stageX + state.dragCur;
    carousel.position.y = layout.stageY;
  }

  function updateParticles(dt, time) {
    if (!particles) return;
    particles.rotation.y += dt * 0.014;
    particles.rotation.x = Math.sin(time * 0.07) * 0.02;
    particles.position.y = Math.sin(time * 0.16) * 0.25;
  }

  function animate() {
    if (timerMode) setTimeout(animate, 16);
    else requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const time = clock.elapsedTime;

    updateCamera(dt);
    updateCoins(dt, time);
    updateParticles(dt, time);

    renderer.render(scene, camera);
  }

  /* ---------------- Scene setup ---------------- */

  function buildParticles() {
    const count = 190;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 2;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));

    const mat = new T.PointsMaterial({
      size: 0.05,
      map: dustTexture,
      color: new T.Color('#6b6252'),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: T.NormalBlending,
      sizeAttenuation: true
    });

    particles = new T.Points(geo, mat);
    scene.add(particles);
  }

  function initRenderer() {
    renderer = new T.WebGLRenderer({
      canvas: el.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: timerMode,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 200);
    carousel = new T.Group();
    scene.add(carousel);

    clock = new T.Clock();
    raycaster = new T.Raycaster();
    pointerNDC = new T.Vector2();

    haloTexture = glowTexture(256, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.28)');
    dustTexture = glowTexture(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0.35)');

    computeLayout();
    buildEnvironment();
    buildParticles();

    scene.add(new T.AmbientLight(0xffffff, 0.25));

    const key = new T.DirectionalLight(0xfff2dd, 2.9);
    key.position.set(4, 6, 7);
    scene.add(key);

    const rim = new T.DirectionalLight(0x9fb8ff, 1.9);
    rim.position.set(-6, -1, 4);
    scene.add(rim);

    const low = new T.DirectionalLight(0xffb877, 1.25);
    low.position.set(2, -5, 5);
    scene.add(low);

    const spark = new T.PointLight(0xfff6e8, 15, 30, 2);
    spark.position.set(2.5, 2.5, 7);
    scene.add(spark);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer) return;
    computeLayout();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = layout.fov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------------- Boot ---------------- */

  function primeCoins(intro) {
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      const slot = slotFor(i - state.index);
      c.cur.x = slot.x;
      c.cur.y = slot.y;
      c.cur.z = intro ? slot.z - 6.2 : slot.z;
      c.cur.s = intro ? slot.s * 0.82 : slot.s;
      c.cur.ry = slot.ry;
      c.cur.h = slot.h;
      c.vel.x = c.vel.y = c.vel.z = c.vel.s = c.vel.ry = c.vel.h = 0;
      c.flipT = -1;
      c.pop = 0;
      c.wrapper.position.set(c.cur.x, c.cur.y, c.cur.z);
      c.wrapper.scale.setScalar(c.cur.s);
    }
    const active = coins[state.index];
    if (active) active.flipT = 0;
  }

  function bindEvents() {
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    el.prevBtn.addEventListener('click', function () { goTo(state.index - 1); });
    el.nextBtn.addEventListener('click', function () { goTo(state.index + 1); });
  }

  async function boot() {
    setProgress(0.04, 'Calibrating light');

    try {
      initRenderer();
    } catch (err) {
      if (el.loaderMeta) el.loaderMeta.textContent = 'WebGL is not available in this browser';
      console.error(err);
      return;
    }

    if (el.counterTotal) el.counterTotal.textContent = String(COINS.length).padStart(2, '0');
    buildDots();
    updateUI(COINS[0], true);
    updateDots();

    await fontsReady();
    await nextPaint();

    for (let i = 0; i < COINS.length; i++) {
      setProgress(0.1 + (i / COINS.length) * 0.8, 'Striking ' + COINS[i].name);
      await nextPaint();
      const images = await loadCoinImages(COINS[i]);
      coins.push(createCoin(COINS[i], i, images));
    }

    setProgress(0.94, 'Polishing metal');
    await nextPaint();

    primeCoins(true);
    bindEvents();
    updateDots();

    if (coins[0]) {
      coins[0].flipT = reduceMotion ? -1 : 0;
    }

    // compile shaders before revealing
    renderer.compile(scene, camera);
    renderer.render(scene, camera);

    setProgress(1, 'Ready');
    state.ready = true;
    if (timerMode) setTimeout(animate, 16);
    else requestAnimationFrame(animate);

    await nextPaint();

    // hold the prologue for its minimum beat, then push into the vault
    if (window.AUREUM_INTRO && window.AUREUM_INTRO.reveal) {
      await window.AUREUM_INTRO.reveal();
    } else {
      await new Promise(function (r) { setTimeout(r, 300); });
    }

    document.body.classList.add('is-ready');
    setTimeout(function () {
      if (el.loader) el.loader.classList.add('is-done');
    }, 120);

    setTimeout(function () {
      if (el.loader && el.loader.parentNode) el.loader.parentNode.removeChild(el.loader);
    }, 1700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
