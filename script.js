/* ============================================================
   Bryan Archie — Portfolio JS
   - City night driving canvas (parallax skyline + road)
   - Scroll reveal
   - Mobile nav toggle
   ============================================================ */

(() => {
  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }

  /* ---------- Scroll reveal ---------- */
  const revealTargets = document.querySelectorAll('.section-head, .about-text, .timeline, .project.featured, .project-card, .skill-group, .skills-legend, .goals, .contact-card, .footer');
  revealTargets.forEach(el => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }

  /* ============================================================
     CITY NIGHT DRIVING ANIMATION
     - Parallax layers: stars, far skyline, mid skyline, near buildings,
       road markings, foreground street lights
     ============================================================ */

  const canvas = document.getElementById('driving-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 0, H = 0, DPR = 1;
  let animId = null;
  let lastTime = 0;
  let running = true;

  // Respect prefers-reduced-motion
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initLayers();
  }

  /* ---------- Layer data ---------- */
  let stars = [];
  let farSkyline = [];   // distant, slow
  let midSkyline = [];   // mid buildings
  let nearBuildings = []; // foreground silhouettes
  let streetLights = [];
  let roadDashes = [];

  // Horizon y as a fraction of screen height
  const HORIZON = 0.62;

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function makeSkylineBuildings(count, baseY, minH, maxH, widthMin, widthMax, color, withWindows) {
    const arr = [];
    let x = -200;
    for (let i = 0; i < count; i++) {
      const w = rand(widthMin, widthMax);
      const h = rand(minH, maxH);
      const windows = [];
      if (withWindows) {
        const cols = Math.max(2, Math.floor(w / 8));
        const rows = Math.max(3, Math.floor(h / 10));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (Math.random() > 0.55) {
              windows.push({
                x: 3 + c * (w - 6) / cols,
                y: 4 + r * (h - 8) / rows,
                w: Math.max(2, (w - 6) / cols * 0.55),
                h: Math.max(2, (h - 8) / rows * 0.45),
                glow: Math.random() > 0.7,
              });
            }
          }
        }
      }
      arr.push({ x, y: baseY - h, w, h, color, windows });
      x += w + rand(2, 14);
    }
    return arr;
  }

  function initLayers() {
    const horizonY = H * HORIZON;

    // Stars
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * horizonY * 0.85,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.8 + 0.2,
        tw: Math.random() * 0.02 + 0.005,
      });
    }

    // Far skyline (smaller, more transparent)
    farSkyline = makeSkylineBuildings(
      Math.ceil(W / 30) + 4,
      horizonY,
      20, 70,
      18, 40,
      'rgba(40, 50, 90, 0.85)',
      false
    );

    // Mid skyline (with windows)
    midSkyline = makeSkylineBuildings(
      Math.ceil(W / 60) + 3,
      horizonY + 22,
      60, 140,
      40, 90,
      'rgba(18, 24, 48, 0.95)',
      true
    );

    // Near foreground (dark silhouettes, no windows)
    nearBuildings = makeSkylineBuildings(
      Math.ceil(W / 110) + 2,
      horizonY + 70,
      90, 190,
      80, 160,
      'rgba(5, 8, 16, 1)',
      false
    );

    // Street lights (along the road edges)
    streetLights = [];
    const roadTop = horizonY + 90;
    for (let i = 0; i < 12; i++) {
      streetLights.push({
        x: -200 + i * 220,
        y: roadTop + rand(-10, 10),
        side: i % 2 === 0 ? 'left' : 'right',
      });
    }

    // Road dashes
    roadDashes = [];
    for (let i = 0; i < 12; i++) {
      roadDashes.push({ x: -100 + i * 140, y: H - 50 });
    }
  }

  /* ---------- Speeds (px per second) ---------- */
  const SPEED_STARS = 4;
  const SPEED_FAR = 14;
  const SPEED_MID = 38;
  const SPEED_NEAR = 90;
  const SPEED_LIGHTS = 160;
  const SPEED_ROAD = 320;

  /* ---------- Draw helpers ---------- */
  function drawBackgroundSky() {
    const horizonY = H * HORIZON;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, '#070812');
    sky.addColorStop(0.5, '#0d0e26');
    sky.addColorStop(1, '#3a1c4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY);

    // Sun/glow on horizon (synthwave style)
    const glowGrad = ctx.createRadialGradient(W * 0.7, horizonY, 0, W * 0.7, horizonY, W * 0.4);
    glowGrad.addColorStop(0, 'rgba(255, 77, 210, 0.35)');
    glowGrad.addColorStop(0.4, 'rgba(255, 77, 210, 0.1)');
    glowGrad.addColorStop(1, 'rgba(255, 77, 210, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, horizonY + 40);

    // Ground / road area
    const ground = ctx.createLinearGradient(0, horizonY, 0, H);
    ground.addColorStop(0, '#0b0a18');
    ground.addColorStop(1, '#020308');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizonY, W, H - horizonY);
  }

  function drawStars(t) {
    ctx.save();
    for (const s of stars) {
      const flicker = Math.sin(t * s.tw * 1000) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(220, 230, 255, ${s.a * flicker})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBuildings(layer, baseY) {
    ctx.save();
    for (const b of layer) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      if (b.windows && b.windows.length) {
        for (const w of b.windows) {
          if (w.glow) {
            ctx.fillStyle = 'rgba(255, 200, 100, 0.85)';
            ctx.shadowColor = 'rgba(255, 200, 100, 0.6)';
            ctx.shadowBlur = 4;
          } else {
            ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
            ctx.shadowBlur = 0;
          }
          ctx.fillRect(b.x + w.x, b.y + w.y, w.w, w.h);
        }
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  function drawStreetLights() {
    const horizonY = H * HORIZON;
    ctx.save();
    for (const l of streetLights) {
      // Pole
      ctx.fillStyle = '#1a1d28';
      ctx.fillRect(l.x, l.y - 80, 2, 80);
      // Light
      ctx.fillStyle = '#ffd16b';
      ctx.shadowColor = 'rgba(255, 209, 107, 0.9)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(l.x + 1, l.y - 82, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glow on ground
      const groundGlow = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 60);
      groundGlow.addColorStop(0, 'rgba(255, 209, 107, 0.25)');
      groundGlow.addColorStop(1, 'rgba(255, 209, 107, 0)');
      ctx.fillStyle = groundGlow;
      ctx.fillRect(l.x - 60, l.y - 10, 120, 80);
    }
    ctx.restore();
  }

  function drawRoad() {
    const horizonY = H * HORIZON;
    const roadTop = horizonY + 90;

    // Center line markings
    ctx.save();
    ctx.fillStyle = 'rgba(0, 224, 255, 0.85)';
    ctx.shadowColor = 'rgba(0, 224, 255, 0.8)';
    ctx.shadowBlur = 8;
    for (const d of roadDashes) {
      ctx.fillRect(d.x, d.y, 60, 3);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Subtle horizon line
    ctx.save();
    const horizonGrad = ctx.createLinearGradient(0, 0, W, 0);
    horizonGrad.addColorStop(0, 'rgba(0, 224, 255, 0)');
    horizonGrad.addColorStop(0.5, 'rgba(0, 224, 255, 0.4)');
    horizonGrad.addColorStop(1, 'rgba(0, 224, 255, 0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, horizonY, W, 1);
    ctx.restore();
  }

  /* ---------- Update positions ---------- */
  function update(dt) {
    // Stars (very slow)
    for (const s of stars) {
      s.x -= SPEED_STARS * dt;
      if (s.x < -5) s.x = W + 5;
    }
    // Far skyline
    advanceLayer(farSkyline, SPEED_FAR * dt);
    // Mid skyline
    advanceLayer(midSkyline, SPEED_MID * dt);
    // Near buildings
    advanceLayer(nearBuildings, SPEED_NEAR * dt);
    // Street lights
    for (const l of streetLights) {
      l.x -= SPEED_LIGHTS * dt;
      if (l.x < -200) l.x += 12 * 220;
    }
    // Road dashes
    for (const d of roadDashes) {
      d.x -= SPEED_ROAD * dt;
      if (d.x < -80) d.x += 12 * 140;
    }
  }

  function advanceLayer(layer, dx) {
    for (const b of layer) b.x -= dx;
    // Recycle buildings that have moved off-screen left to the right side
    while (layer.length && layer[0].x + layer[0].w < -50) {
      const first = layer.shift();
      const last = layer[layer.length - 1];
      first.x = last.x + last.w + rand(2, 18);
      layer.push(first);
    }
  }

  /* ---------- Main loop ---------- */
  function frame(t) {
    if (!running) { animId = null; return; }
    const time = t / 1000;
    const dt = Math.min(0.05, lastTime ? time - lastTime : 0.016);
    lastTime = time;

    ctx.clearRect(0, 0, W, H);
    drawBackgroundSky();
    drawStars(time);
    drawBuildings(farSkyline);
    drawBuildings(midSkyline);
    drawBuildings(nearBuildings);
    drawStreetLights();
    drawRoad();

    if (!reduceMotion) update(dt);

    animId = requestAnimationFrame(frame);
  }

  /* ---------- Pause when tab is hidden ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    } else if (!running) {
      running = true;
      lastTime = 0;
      animId = requestAnimationFrame(frame);
    }
  });

  window.addEventListener('resize', resize, { passive: true });

  resize();
  animId = requestAnimationFrame(frame);
})();
