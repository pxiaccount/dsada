/* ============================================================
   AUREUM — prologue
   A close study of legs in motion. Runs while the vault is
   prepared, then the camera pushes through the coin and the
   collection is revealed.
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('loader');
  var runner = document.getElementById('runner');
  var skipBtn = document.getElementById('skipIntro');

  function noopIntro() {
    return Promise.resolve();
  }

  if (!root || !runner) {
    window.AUREUM_INTRO = { reveal: noopIntro, skip: function () {} };
    return;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var nodes = {
    frontThigh: document.getElementById('thighFront'),
    frontShin: document.getElementById('shinFront'),
    frontFoot: document.getElementById('footFront'),
    backThigh: document.getElementById('thighBack'),
    backShin: document.getElementById('shinBack'),
    backFoot: document.getElementById('footBack'),
    shadow: document.getElementById('runnerShadow')
  };

  var HIP_Y = -60;
  var DEG = 180 / Math.PI;
  var figure = document.querySelector('.prologue__figure');

  function fitViewBox() {
    if (!figure) return;
    figure.setAttribute('viewBox', window.innerWidth <= 760 ? '100 80 800 1020' : '0 0 1000 1100');
  }

  fitViewBox();
  window.addEventListener('resize', fitViewBox);
  var start = performance.now();
  var skipRequested = false;
  var revealPromise = null;
  var minHold = reduce ? 300 : 2600;
  var zoomTime = reduce ? 320 : 1350;

  function setLeg(kind, phase) {
    var tight = window.innerWidth <= 760;
    var thigh = -(tight ? 0.36 : 0.46) * Math.cos(phase);
    var knee = 0.26 + (tight ? 0.86 : 0.95) * Math.pow(Math.max(0, Math.sin(phase - Math.PI)), 1.15);
    var tilt = 0.1 * Math.sin(phase) + 0.06;
    var foot = -(thigh + knee) + tilt;

    var hipX = kind === 'front' ? 570 : 505;

    nodes[kind + 'Thigh'].setAttribute(
      'transform',
      'translate(' + hipX + ',' + HIP_Y + ') rotate(' + (thigh * DEG).toFixed(2) + ')'
    );
    nodes[kind + 'Shin'].setAttribute(
      'transform',
      'translate(0,560) rotate(' + (knee * DEG).toFixed(2) + ')'
    );
    nodes[kind + 'Foot'].setAttribute(
      'transform',
      'translate(0,390) rotate(' + (foot * DEG).toFixed(2) + ')'
    );
  }

  function pose(now) {
    var elapsed = (now - start) / 1000;
    var phase = elapsed * Math.PI * 2 * 1.35;

    setLeg('front', phase);
    setLeg('back', phase + Math.PI);

    var bob = -16 * Math.abs(Math.sin(phase));
    runner.setAttribute('transform', 'translate(0,' + bob.toFixed(2) + ')');

    var swing = Math.abs(Math.sin(phase));
    nodes.shadow.setAttribute('rx', (238 + 44 * swing).toFixed(1));
    nodes.shadow.setAttribute('opacity', (0.15 + 0.07 * Math.abs(Math.cos(phase))).toFixed(3));
  }

  var rafId = 0;

  function frame(now) {
    if (root.classList.contains('is-done')) {
      rafId = 0;
      return;
    }
    pose(now);
    rafId = requestAnimationFrame(frame);
  }

  if (reduce) {
    pose(start + 900);
  } else {
    rafId = requestAnimationFrame(frame);
  }

  function waitHold() {
    return new Promise(function (resolve) {
      function check() {
        if (skipRequested || performance.now() - start >= minHold) resolve();
        else setTimeout(check, 90);
      }
      check();
    });
  }

  function reveal() {
    if (revealPromise) return revealPromise;

    revealPromise = waitHold().then(function () {
      root.classList.add('is-zooming');
      if (skipBtn) skipBtn.disabled = true;
      return new Promise(function (resolve) {
        setTimeout(resolve, zoomTime);
      });
    });

    return revealPromise;
  }

  function skip() {
    skipRequested = true;
  }

  if (skipBtn) skipBtn.addEventListener('click', skip);

  window.AUREUM_INTRO = { reveal: reveal, skip: skip };

  // expose a tiny hook for automated visual checks
  window.AUREUM_INTRO.pose = function (phase) {
    pose(start + (phase / (Math.PI * 2 * 1.35)) * 1000);
  };
})();
