/* Synthetic projected Keplerian field plus a small illustrative LOS perturbation.
 * The sharp velocity field remains stationary; a separate, clearly visible
 * advected texture supplies artistic motion at the displayed header scale. */
(() => {
  'use strict';
  const root = document.getElementById('disk-kinematics');
  if (!root) return;
  const canvas = root.querySelector('.disk-texture');
  const fieldCanvas = root.querySelector('.disk-field');
  const ctx = canvas.getContext('2d');
  const fieldCtx = fieldCanvas.getContext('2d');
  if (!ctx || !fieldCtx) return;
  const W = canvas.width, H = canvas.height;
  const frame = ctx.createImageData(W, H);
  const fieldFrame = fieldCtx.createImageData(fieldCanvas.width, fieldCanvas.height);
  const pixels = [];
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const gauss = x => Math.exp(-x * x / 2);
  let seed = 6217;
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const N = 128, noise = new Float32Array(N * N);
  for (let i = 0; i < noise.length; i++) noise[i] = random();
  function sample(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    const x0 = ix & 127, x1 = (ix + 1) & 127;
    const y0 = (iy & 127) * N, y1 = ((iy + 1) & 127) * N;
    return (noise[y0 + x0] * (1 - fx) + noise[y0 + x1] * fx) * (1 - fy)
      + (noise[y1 + x0] * (1 - fx) + noise[y1 + x1] * fx) * fy;
  }
  const angle = -0.43, ca = Math.cos(angle), sa = Math.sin(angle);
  const cosInclination = 0.68;
  const sinInclination = Math.sqrt(1 - cosInclination ** 2);
  const keplerianSpeedAtOuterRadius = 2.4;
  const velocityLimit = 4.0, residualLimit = 0.20;
  const flipR = 0.44, flipPhi = -1.7;

  function geometry(x, y) {
    const sx = (x - W * 0.51) / 248, sy = (y - H * 0.50) / 248;
    const dx = sx * ca + sy * sa, dy = (-sx * sa + sy * ca) / cosInclination;
    const r = Math.hypot(dx, dy), phi = Math.atan2(dy, dx);
    if (r > 1.025 || r < 0.195) return null;
    const grain = sample(dx * 57 + 21, dy * 57 + 37) - 0.5;
    // A defined, slightly irregular aperture with a narrow antialiased rim.
    const edge = 1 + 0.003 * Math.sin(phi * 13) + grain * 0.008;
    const mask = smooth(0.196, 0.203, r) * (1 - smooth(edge - 0.003, edge + 0.003, r));
    return mask > 0.001 ? { r, phi, dx, dy, grain, mask } : null;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = geometry(x + 0.5, y + 0.5);
      if (!p) continue;
      pixels.push({ i: (y * W + x) * 4, mask: p.mask,
        u: p.phi * 96 / (Math.PI * 2), v: p.r * 36,
        band: Math.min(127, Math.floor(p.r * 120)) });
    }
  }

  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  function darkTheme() {
    const classes = document.documentElement.classList;
    return classes.contains('theme-dark') || (!classes.contains('theme-light') && systemDark.matches);
  }
  function makePalette() {
    // Keep blue negative and red positive in both themes. The dark neutral
    // is quieter, while the colored lobes retain strong chroma and contrast.
    const colors = darkTheme()
      ? [[29, 76, 155], [22, 111, 199], [57, 159, 226], [118, 187, 216],
        [190, 199, 202], [229, 165, 142], [242, 98, 68], [220, 43, 44], [157, 18, 49]]
      : [[6, 42, 94], [7, 98, 177], [31, 154, 220], [143, 203, 226],
        [250, 247, 236], [252, 183, 152], [242, 88, 55], [207, 27, 41], [114, 0, 35]];
    return Array.from({ length: 2049 }, (_, i) => {
      const t = i / 256, j = Math.min(7, Math.floor(t)), f = t - j;
      return colors[j].map((c, k) => Math.round(c * (1 - f) + colors[j + 1][k] * f));
    });
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const shifts = new Float32Array(128);
  const sessionKey = 'disk-kinematics-v1';
  let epoch = Date.now(), found = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey));
    if (saved && Number.isFinite(saved.epoch) && saved.epoch <= epoch) {
      epoch = saved.epoch;
      found = saved.found === true;
    }
  } catch { /* The graphic also works when browser storage is unavailable. */ }
  function saveState() {
    try { sessionStorage.setItem(sessionKey, JSON.stringify({ epoch, found })); } catch { /* Optional persistence. */ }
  }
  saveState();
  let visible = true, faded = false;
  let lastDraw = -Infinity, request = null;
  const discovery = root.querySelector('.disk-discovery');
  const status = root.querySelector('.disk-discovery-status');
  const header = root.closest('header');

  function updateDiscovery() {
    discovery.setAttribute('aria-pressed', String(found));
    discovery.setAttribute('aria-label', found
      ? 'Planet found. Return to the velocity field'
      : 'Explore the disk: find the hidden planet');
  }

  function updateScroll() {
    const fade = smooth(12, 160, window.scrollY);
    root.style.opacity = String(1 - fade);
    root.inert = fade >= 0.99;
    const nextFaded = fade >= 0.99;
    if (nextFaded !== faded) {
      faded = nextFaded;
      if (!faded) draw();
      synchronize();
    }
  }

  // Position the art between the actual link bounds and the action controls.
  // On cramped headers it disappears rather than moving or covering controls.
  function layout() {
    const bounds = header.getBoundingClientRect();
    const title = header.querySelector('.site-title').getBoundingClientRect();
    const links = header.querySelectorAll('.main-nav a');
    const navEnd = links[links.length - 1].getBoundingClientRect().right;
    const actions = header.querySelector('.nav-actions').getBoundingClientRect();
    const left = Math.max(title.right, navEnd) - bounds.left + 14;
    const right = actions.left - bounds.left - 14;
    root.hidden = right - left < 72;
    root.style.left = `${left}px`;
    root.style.width = `${Math.max(0, right - left)}px`;
    // Keep the crop independent of the extra sticky article-title row.
    root.style.height = `${header.querySelector('.main-nav').getBoundingClientRect().bottom - bounds.top + 10}px`;
    synchronize();
  }

  // Project the perturbation's location with the same geometry as the map.
  const planetX = flipR * Math.cos(flipPhi);
  const planetY = flipR * Math.sin(flipPhi) * cosInclination;
  const targetX = W * 0.51 + 248 * (planetX * ca - planetY * sa);
  const targetY = H * 0.50 + 248 * (planetX * sa + planetY * ca);
  discovery.addEventListener('click', event => {
    if (found) {
      found = false;
      status.textContent = '';
    } else {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * W / rect.width;
      const y = (event.clientY - rect.top) * H / rect.height;
      // Keyboard activation supplies the equivalent discovery without requiring
      // pointer coordinates; touch receives a usable target around the feature.
      const tolerance = Math.max(34, 14 * W / rect.width);
      if (event.detail !== 0 && Math.hypot(x - targetX, y - targetY) > tolerance) return;
      found = true;
      status.textContent = 'You found the hidden planet! Doppler residuals revealed.';
    }
    updateDiscovery();
    saveState();
    drawField();
    draw();
  });
  let fieldState = '';
  function drawField() {
    const state = `${found}:${darkTheme()}`;
    if (state === fieldState) return;
    fieldState = state;
    const data = fieldFrame.data, palette = makePalette();
    const scale = fieldCanvas.width / W;
    data.fill(0);
    for (let y = 0; y < fieldCanvas.height; y++) {
      for (let x = 0; x < fieldCanvas.width; x++) {
        const p = geometry((x + 0.5) / scale, (y + 0.5) / scale);
        if (!p) continue;
        const dp = Math.atan2(Math.sin(p.phi - flipPhi), Math.cos(p.phi - flipPhi));
        const tangential = dp * flipR;
        const bend = 0.028 * Math.tanh(tangential / 0.06);
        const flip = 0.16 * (tangential / 0.052) * gauss(tangential / 0.066)
          * gauss((p.r - flipR - bend) / 0.052);
        const rotation = keplerianSpeedAtOuterRadius * sinInclination * Math.cos(p.phi) / Math.sqrt(p.r);
        const perturbation = flip + p.grain * 0.014
          + 0.012 * Math.cos(p.phi) * Math.sin(p.r * 34) * gauss((p.r - 0.65) / 0.28);
        const velocity = rotation + perturbation;
        const residual = velocity - rotation;
        const value = found ? residual / residualLimit : velocity / velocityLimit;
        const color = palette[Math.round((clamp(value, -1, 1) + 1) * 1024)];
        const i = (y * fieldCanvas.width + x) * 4;
        data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
        data[i + 3] = Math.round(p.mask * 255);
      }
    }
    fieldCtx.putImageData(fieldFrame, 0, 0);
  }
  function draw() {
    const data = frame.data;
    const elapsed = reducedMotion.matches ? 0 : (Date.now() - epoch) / 1000;
    for (let b = 0; b < shifts.length; b++) {
      const radius = Math.max((b + 0.5) / 120, 0.27);
      shifts[b] = elapsed * 0.075 / Math.pow(radius, 1.5) * 96 / (Math.PI * 2);
    }
    for (const p of pixels) {
      const u = p.u - shifts[p.band];
      const advected = 0.7 * sample(u, p.v) + 0.3 * sample(u * 2, p.v * 2) - 0.5;
      // Visible structure at the actual header size, rather than subpixel
      // grain that disappears on downsampling. A neutral texture preserves
      // the stationary red/blue velocity pattern beneath it.
      const intensity = Math.round(128 + advected * 190);
      const i = p.i;
      data[i] = intensity; data[i + 1] = intensity; data[i + 2] = intensity;
      data[i + 3] = Math.round(p.mask * 255);
    }
    ctx.putImageData(frame, 0, 0);
  }
  function tick(now) {
    request = null;
    if (reducedMotion.matches || !visible || faded || root.hidden || document.hidden) return;
    if (now - lastDraw > 33) { draw(); lastDraw = now; }
    request = requestAnimationFrame(tick);
  }
  function synchronize() {
    if (request !== null) cancelAnimationFrame(request);
    request = null;
    if (!reducedMotion.matches && visible && !faded && !root.hidden && !document.hidden) request = requestAnimationFrame(tick);
  }
  reducedMotion.addEventListener('change', () => { draw(); synchronize(); });
  document.addEventListener('visibilitychange', synchronize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      synchronize();
    }).observe(root);
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(layout);
    observer.observe(header);
    observer.observe(header.querySelector('.main-nav'));
    observer.observe(header.querySelector('.site-title'));
    observer.observe(header.querySelector('.nav-actions'));
  }
  window.addEventListener('resize', layout);
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('pageshow', () => {
    // A bfcache restore skips script initialization; refresh both phase and
    // state in case another page changed the Easter egg in the meantime.
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey));
      if (saved && saved.epoch === epoch) found = saved.found === true;
    } catch { /* Optional persistence. */ }
    updateDiscovery();
    drawField();
    draw();
    layout();
    updateScroll();
  });
  header.querySelector('.main-nav').addEventListener('scroll', layout, { passive: true });
  if (document.fonts) document.fonts.ready.then(layout);
  if ('MutationObserver' in window) {
    new MutationObserver(drawField).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  systemDark.addEventListener('change', drawField);
  updateDiscovery();
  drawField();
  draw();
  layout();
  updateScroll();
})();
