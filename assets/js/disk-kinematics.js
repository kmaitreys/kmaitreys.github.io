/* Isovelocity contours of a flared Keplerian disk, drawn in the page's text
 * colour. On wide screens the disk sits in the right margin and runs off the
 * page edge; on narrower screens it sits behind the header navigation.
 * A bright channel sweeps from the blue-shifted wing to the red-shifted wing
 * and back, like scrubbing through a line cube.
 *
 * Geometry: on an emission surface z(r) = z0 r^psi the line-of-sight velocity
 * is v ∝ r^-1/2 sin(i) cos(phi), so the contour of channel u is
 * phi(r) = ±acos(u sqrt(r)).
 */
(() => {
  'use strict';
  const bleed = document.getElementById('disk-bleed');
  const band = document.getElementById('disk-band');
  if (!bleed && !band) return;
  const html = document.documentElement;
  const wide = matchMedia('(min-width: 1200px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const gauss = x => Math.exp(-x * x / 2);

  /* ---------- disk model (lengths in units of the outer radius) ---------- */
  const R_IN = 0.13, PSI = 1.25;
  const CHANNELS = 24, DU = 0.115;
  const STILL_CHANNEL = 7; // the channel shown bright when motion is reduced

  /* ---------- look: tune these ---------- */
  const LOOK = {
    inclination: 72,      // degrees; higher is more edge-on
    positionAngle: -0.16, // radians; tilt of the major axis
    flaring: 0.2,         // emission-surface height z0 (z = z0 r^1.25)
    // Wide screens. "Margin" is the empty space right of the text column.
    size: 1.1,            // disk radius as a fraction of the margin width
    centreX: 0.7,         // centre, as a fraction across the margin
    centreY: 0.24,        // centre, as a fraction of the drawing's height
    // Contours and the scanning channel.
    lineAlpha: 0.24,      // resting opacity of the near-surface contours
    glow: 0.3,            // extra opacity of the scanning channel
    sweepSeconds: 24,     // one blue -> red -> blue scan
  };

  function geometry(incDeg, pa, z0) {
    const inc = incDeg * Math.PI / 180;
    return { cos: Math.cos(inc), sin: Math.sin(inc), cp: Math.cos(pa), sp: Math.sin(pa), z0 };
  }
  // side: +1 for the near (front) emission surface, -1 for the far (back) one.
  function project(g, r, phi, side) {
    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi) * g.cos - side * g.z0 * Math.pow(r, PSI) * g.sin;
    return [x * g.cp - y * g.sp, x * g.sp + y * g.cp];
  }
  // Polylines for the contour of channel u: a closed lobe, or two open arms.
  function contour(g, u, side, n = 144) {
    const rEnd = u === 0 ? 1 : Math.min(1, 1 / (u * u));
    if (rEnd <= R_IN) return [];
    const branch = sign => {
      const pts = [];
      for (let j = 0; j <= n; j++) {
        const s = j / n;
        const r = R_IN + (rEnd - R_IN) * (1 - (1 - s) * (1 - s)); // denser towards the tip
        const phi = sign * Math.acos(clamp(u * Math.sqrt(r), -1, 1));
        pts.push(project(g, r, phi, side));
      }
      return pts;
    };
    const a = branch(1), b = branch(-1);
    return rEnd < 1 ? [a.concat(b.reverse())] : [a, b];
  }
  function ring(g, r, side, n = 120) {
    const pts = [];
    for (let j = 0; j <= n; j++) pts.push(project(g, r, TAU * j / n, side));
    return pts;
  }
  // Scale and centre that fit the whole disk inside a W x H box.
  function fitDisk(g, W, H, pad) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const side of [1, -1]) for (const p of ring(g, 1, side)) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }
    const a = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    return { a, cx: W / 2 - a * (x0 + x1) / 2, cy: H / 2 - a * (y0 + y1) / 2 };
  }

  /* ---------- drawing helpers ---------- */
  function palette() {
    const css = getComputedStyle(html);
    const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return { ink: get('--text', '#111') };
  }
  function toPath(lines, cx, cy, a) {
    const path = new Path2D();
    for (const pts of lines) {
      pts.forEach((p, i) => (i ? path.lineTo(cx + a * p[0], cy + a * p[1]) : path.moveTo(cx + a * p[0], cy + a * p[1])));
    }
    return path;
  }
  /* ---------- one drawing in one mount ---------- */
  function create(mount, big) {
    const g = big
      ? geometry(LOOK.inclination, LOOK.positionAngle, LOOK.flaring)
      : geometry(Math.max(76, LOOK.inclination), -0.05, 0.13);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, a = 1, cx = 0, cy = 0, edge = 0, colors, items = [];
    let lastDraw = -Infinity, request = null, visible = true;
    const start = performance.now();

    function build() {
      const rect = mount.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      colors = palette();
      if (big) {
        // Centre the disk in the empty margin right of the text column; it runs off the page edge.
        edge = document.querySelector('.site-wrapper').getBoundingClientRect().right;
        const margin = W - edge;
        a = Math.max(W * 0.36, margin * LOOK.size);
        cx = edge + Math.max(W * 0.1, margin * LOOK.centreX);
        cy = H * LOOK.centreY;
      } else {
        ({ a, cx, cy } = fitDisk(g, W, H, 2));
      }
      items = [];
      for (let k = -CHANNELS; k <= CHANNELS; k++) {
        items.push({
          k,
          front: toPath(contour(g, k * DU, 1), cx, cy, a),
          back: toPath(contour(g, k * DU, -1), cx, cy, a),
        });
      }
      lastDraw = -Infinity;
      wake();
    }

    function draw(now) {
      const t = (now - start) / 1000;
      const centre = reducedMotion.matches
        ? STILL_CHANNEL
        : (CHANNELS + 3) * Math.sin(TAU * t / LOOK.sweepSeconds - 0.5);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = colors.ink;
      for (const item of items) {
        const glow = gauss((item.k - centre) / 1.5);
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.3 * LOOK.lineAlpha + 0.3 * LOOK.glow * glow;
        ctx.stroke(item.back);
        ctx.lineWidth = 0.9 + 0.6 * LOOK.glow * glow;
        ctx.globalAlpha = LOOK.lineAlpha + LOOK.glow * glow;
        ctx.stroke(item.front);
      }
      ctx.globalAlpha = 1;
      if (big) {
        // A faint watermark behind the text column, dissolving towards the bottom.
        ctx.globalCompositeOperation = 'destination-in';
        const across = ctx.createLinearGradient(0, 0, W, 0);
        const stop = x => clamp(x / W, 0, 1);
        [[-480, 0], [-220, 0.06], [-40, 0.18], [80, 0.6], [220, 1]].forEach(([dx, alpha]) => {
          across.addColorStop(stop(edge + dx), `rgba(0,0,0,${alpha})`);
        });
        ctx.fillStyle = across; ctx.fillRect(0, 0, W, H);
        const down = ctx.createLinearGradient(0, 0, 0, H);
        down.addColorStop(0.7, 'rgba(0,0,0,1)'); down.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = down; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Animate at up to ~30 fps while on screen; draw once and stop when motion is reduced.
    const running = () => visible && !document.hidden && !reducedMotion.matches;
    function frame(now) {
      request = null;
      if (now - lastDraw >= 33) { draw(now); lastDraw = now; }
      if (running()) request = requestAnimationFrame(frame);
    }
    function wake() { if (request === null) request = requestAnimationFrame(frame); }
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; wake(); })
      : null;
    if (observer) observer.observe(mount);
    document.addEventListener('visibilitychange', wake);
    reducedMotion.addEventListener('change', wake);
    build();

    return {
      build,
      destroy() {
        if (request !== null) cancelAnimationFrame(request);
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', wake);
        reducedMotion.removeEventListener('change', wake);
        mount.replaceChildren();
      },
    };
  }

  /* ---------- mounting ---------- */
  let active = null, mounted = null;
  function apply() {
    const mount = wide.matches && bleed ? bleed : band;
    if (active && mount === mounted) { active.build(); return; }
    if (active) active.destroy();
    active = null;
    mounted = mount;
    if (mount && mount.getBoundingClientRect().width > 0) active = create(mount, mount === bleed);
  }
  let resizeTimer = null, lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return; // ignore mobile toolbar height changes
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 80);
  });
  const recolor = () => { if (active) active.build(); };
  new MutationObserver(recolor).observe(html, { attributes: true, attributeFilter: ['class'] });
  systemDark.addEventListener('change', recolor);
  window.addEventListener('pageshow', e => { if (e.persisted) apply(); });
  if (document.fonts) document.fonts.ready.then(apply);
  apply();
})();
