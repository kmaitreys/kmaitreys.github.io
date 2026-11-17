/* Isovelocity contours of a flared Keplerian disk, drawn in the page's text
 * colour. On wide screens the disk sits in the right margin and runs off the
 * page edge; on narrower screens the text overlays the same large disk.
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
  if (!bleed) return;
  const wide = matchMedia('(min-width: 1200px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
  /* ---------- vector drawing helpers ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function element(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }
  function toPath(lines, cx, cy, a) {
    return lines.map(points => points.map((p, i) =>
      `${i ? 'L' : 'M'}${(cx + a * p[0]).toFixed(3)},${(cy + a * p[1]).toFixed(3)}`
    ).join(' ')).join(' ');
  }

  /* ---------- one drawing in one mount ---------- */
  function create(mount) {
    const g = geometry(LOOK.inclination, LOOK.positionAngle, LOOK.flaring);
    const svg = element('svg', { 'aria-hidden': 'true', focusable: 'false' });
    mount.appendChild(svg);
    let items = [];
    let lastDraw = -Infinity, request = null, visible = true;
    const start = performance.now();

    function build() {
      const { width: W, height: H } = mount.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let a, cx, cy, stops;
      if (wide.matches) {
        // Preserve the desktop disk's placement in the right margin.
        const edge = document.querySelector('.site-wrapper').getBoundingClientRect().right;
        const margin = W - edge;
        a = Math.max(W * 0.36, margin * LOOK.size);
        cx = edge + Math.max(W * 0.1, margin * LOOK.centreX);
        cy = H * LOOK.centreY;
        stops = [[-480, 0], [-220, 0.06], [-40, 0.18], [80, 0.6], [220, 1]]
          .map(([dx, opacity]) => [clamp((edge + dx) / W, 0, 1), opacity]);
      } else {
        // A large disk cropped at the right edge, with text over its quieter left side.
        a = Math.max(W * 1.1, H * 0.7);
        cx = W * 0.92;
        cy = H * 0.4;
        stops = [[0, 0.025], [0.35, 0.12], [0.7, 0.32], [1, 0.55]];
      }

      const defs = element('defs');
      function mask(name, gradientAttributes, values) {
        const id = `${mount.id}-${name}`;
        const gradient = element('linearGradient', {
          id: `${id}-gradient`, gradientUnits: 'userSpaceOnUse', ...gradientAttributes,
        });
        for (const [offset, opacity] of values) gradient.appendChild(element('stop', {
          offset, 'stop-color': 'white', 'stop-opacity': opacity,
        }));
        const mask = element('mask', {
          id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H,
        });
        mask.appendChild(element('rect', {
          width: W, height: H, fill: `url(#${id}-gradient)`,
        }));
        defs.append(gradient, mask);
        return `url(#${id})`;
      }
      const across = element('g', {
        mask: mask('across', { x1: 0, y1: 0, x2: W, y2: 0 }, stops),
        fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      const down = element('g', {
        mask: mask('down', { x1: 0, y1: 0, x2: 0, y2: H }, [[0, 1], [0.7, 1], [1, 0]]),
      });
      down.appendChild(across);
      items = [];
      for (let k = -CHANNELS; k <= CHANNELS; k++) {
        const path = side => element('path', {
          d: toPath(contour(g, k * DU, side), cx, cy, a),
          'vector-effect': 'non-scaling-stroke',
        });
        const back = path(-1), front = path(1);
        across.append(back, front);
        items.push({ k, front, back });
      }
      svg.replaceChildren(defs, down);
      lastDraw = -Infinity;
      wake();
    }

    function draw(now) {
      const t = (now - start) / 1000;
      const centre = reducedMotion.matches
        ? STILL_CHANNEL
        : (CHANNELS + 3) * Math.sin(TAU * t / LOOK.sweepSeconds - 0.5);
      for (const item of items) {
        const glow = gauss((item.k - centre) / 1.5);
        item.back.setAttribute('stroke-width', '0.8');
        item.back.setAttribute('stroke-opacity', 0.3 * LOOK.lineAlpha + 0.3 * LOOK.glow * glow);
        item.front.setAttribute('stroke-width', 0.9 + 0.6 * LOOK.glow * glow);
        item.front.setAttribute('stroke-opacity', LOOK.lineAlpha + LOOK.glow * glow);
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
    const mount = bleed;
    if (active && mount === mounted) { active.build(); return; }
    if (active) active.destroy();
    active = null;
    mounted = mount;
    if (mount && mount.getBoundingClientRect().width > 0) active = create(mount);
  }
  let resizeTimer = null, lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return; // ignore mobile toolbar height changes
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 80);
  });
  window.addEventListener('pageshow', e => { if (e.persisted) apply(); });
  if (document.fonts) document.fonts.ready.then(apply);
  apply();
})();
