/*
 * Placeholder landscapes: a calm, flat illustration for each trip until real photography is
 * added (set "image" in trips.json). Pick one with "scene" in trips.json: peaks, towers, arctic,
 * islands, coast, fjord, volcano, baobab, palms, desert, loch, tea, aerial, steppe. Unknown or empty -> peaks.
 */

let uid = 0;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const r1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

/** Points along a ridgeline. Sharp ridges alternate peaks and valleys. */
function ridge(w, rand, { base, amp, count = 8, sharp = false, pin = false }) {
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const jitter = i && i < count ? (rand() - 0.5) * (w / count) * 0.5 : 0;
    let lift = sharp ? (i % 2 ? 0.55 + rand() * 0.45 : rand() * 0.3) : rand();
    if (pin && (i === 0 || i === count)) lift = 0;
    pts.push([(w / count) * i + jitter, base - amp * lift]);
  }
  return pts;
}

function curve(pts) {
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

function hill(w, h, pts, fill, extra = '') {
  return `<path d="M0 ${h} L${curve(pts).slice(1)} L${w} ${h} Z" fill="${fill}"${extra}/>`;
}

function island(pts, base, fill) {
  return `<path d="M${pt(pts[0])} ${curve(pts).slice(1)} L${r1(pts[pts.length - 1][0])} ${r1(base)} Z" fill="${fill}"/>`;
}

/** A closed, slightly irregular shape (islands, reefs, ripples). */
function blob(cx, cy, rx, ry, rand, n = 9, wobble = 0.3) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - wobble / 2 + rand() * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${d} Z`;
}

function range(w, h, pts, fill, snow) {
  let out = `<path d="M0 ${h} L${pts.map(pt).join(' L')} L${w} ${h} Z" fill="${fill}"/>`;
  if (snow) {
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [p, a, b] = [pts[i], pts[i - 1], pts[i + 1]];
      const at = (q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const mid = [p[0] + ((a[0] + b[0]) / 2 - p[0]) * 0.18, p[1] + (Math.max(a[1], b[1]) - p[1]) * 0.22];
      out += `<path d="M${pt(p)} L${pt(at(b, 0.32))} L${pt(mid)} L${pt(at(a, 0.3))} Z" fill="${snow}"/>`;
    }
  }
  return out;
}

function sky(id, w, h, stops) {
  const s = stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('');
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${s}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}

const circle = (x, y, r, fill, extra = '') => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fill}"${extra}/>`;

function pine(x, y, s, fill) {
  const t = (top, hw, bottom) => `M${r1(x)} ${r1(y - top * s)} L${r1(x + hw * s)} ${r1(y - bottom * s)} L${r1(x - hw * s)} ${r1(y - bottom * s)} Z`;
  return `<path d="${t(64, 14, 30)} ${t(46, 19, 8)} ${t(28, 23, -6)}" fill="${fill}"/>`;
}

function palm(x, y, s, lean, color) {
  const top = [x + lean * s, y - 150 * s];
  let out = `<path d="M${r1(x)} ${r1(y)} Q${r1(x + lean * 0.15 * s)} ${r1(y - 80 * s)} ${pt(top)}" stroke="${color}" stroke-width="${r1(7 * s)}" fill="none" stroke-linecap="round"/>`;
  for (const deg of [-172, -140, -112, -70, -40, -8]) {
    const a = (deg * Math.PI) / 180;
    const end = [top[0] + Math.cos(a) * 62 * s, top[1] + Math.sin(a) * 30 * s + 30 * s];
    const ctrl = [top[0] + Math.cos(a) * 36 * s, top[1] + Math.sin(a) * 34 * s - 6 * s];
    out += `<path d="M${pt(top)} Q${pt(ctrl)} ${pt(end)}" stroke="${color}" stroke-width="${r1(6 * s)}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

function baobab(x, y, s, color, rand) {
  const tw = 15 * s;
  const th = 120 * s;
  let out = `<path d="M${r1(x - tw)} ${r1(y)} C${r1(x - tw * 0.95)} ${r1(y - th * 0.5)} ${r1(x - tw * 0.6)} ${r1(y - th * 0.85)} ${r1(x - tw * 0.45)} ${r1(y - th)} L${r1(x + tw * 0.45)} ${r1(y - th)} C${r1(x + tw * 0.6)} ${r1(y - th * 0.85)} ${r1(x + tw * 0.95)} ${r1(y - th * 0.5)} ${r1(x + tw)} ${r1(y)} Z" fill="${color}"/>`;
  for (let k = -2; k <= 2; k++) {
    const end = [x + k * 13 * s, y - th - (12 + rand() * 18) * s];
    out += `<path d="M${r1(x + k * 2 * s)} ${r1(y - th + 2)} L${pt(end)}" stroke="${color}" stroke-width="${r1(5 * s)}" stroke-linecap="round"/>`;
    out += `<ellipse cx="${r1(end[0])}" cy="${r1(end[1])}" rx="${r1(11 * s)}" ry="${r1(6 * s)}" fill="${color}"/>`;
  }
  return out;
}

function stars(w, h, rand, n, color) {
  let out = '';
  for (let i = 0; i < n; i++) out += circle(rand() * w, rand() * h, 0.8 + rand() * 1.6, color, ` opacity="${r1(0.4 + rand() * 0.6)}"`);
  return out;
}

function ripples(w, y0, y1, rand, color, n = 14) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const y = y0 + rand() * (y1 - y0);
    const x = rand() * w;
    const len = 20 + rand() * 70;
    out += `<path d="M${r1(x)} ${r1(y)} h${r1(len)}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`;
  }
  return out;
}

const SCENES = {
  peaks(w, h, rand, id) {
    const s = h / 600;
    return sky(id, w, h, ['#d9e3de', '#efebe0', '#f5efe3']) +
      circle(w * 0.74, h * 0.2, 34 * s, '#f6e3c4') +
      range(w, h, ridge(w, rand, { base: h * 0.56, amp: h * 0.36, count: 10, sharp: true }), '#aebdb5', '#f7f4ec') +
      range(w, h, ridge(w, rand, { base: h * 0.7, amp: h * 0.22, count: 8, sharp: true }), '#7d9587', '#e9eee8') +
      hill(w, h, ridge(w, rand, { base: h * 0.84, amp: h * 0.12, count: 6 }), '#46644f') +
      hill(w, h, ridge(w, rand, { base: h * 0.95, amp: h * 0.08, count: 5 }), '#26432f');
  },
  towers(w, h, rand, id) {
    const s = h / 600;
    let towers = '';
    const base = h * 0.66;
    [[0.36, 0.26, 22], [0.5, 0.12, 26], [0.64, 0.22, 20]].forEach(([fx, fy, hw]) => {
      const x = w * fx;
      const top = h * fy;
      towers += `<path d="M${r1(x - hw * s * 1.3)} ${r1(base)} L${r1(x - hw * s)} ${r1(top + 30 * s)} Q${r1(x)} ${r1(top - 18 * s)} ${r1(x + hw * s)} ${r1(top + 30 * s)} L${r1(x + hw * s * 1.3)} ${r1(base)} Z" fill="#8b9a99"/>`;
      towers += `<path d="M${r1(x - hw * s)} ${r1(top + 30 * s)} Q${r1(x)} ${r1(top - 18 * s)} ${r1(x + hw * s)} ${r1(top + 30 * s)} L${r1(x + hw * s * 0.4)} ${r1(top + 44 * s)} L${r1(x - hw * s * 0.5)} ${r1(top + 36 * s)} Z" fill="#c9d3d0"/>`;
    });
    return sky(id, w, h, ['#cfdcdc', '#eef0e8', '#f5efe3']) +
      range(w, h, ridge(w, rand, { base: h * 0.62, amp: h * 0.18, count: 10, sharp: true }), '#b7c4c2', '#f3f4ef') +
      towers +
      `<rect x="0" y="${r1(h * 0.66)}" width="${w}" height="${r1(h * 0.24)}" fill="#7fb0a9"/>` +
      ripples(w, h * 0.67, h * 0.8, rand, '#b9d6d0', 10) +
      hill(w, h, ridge(w, rand, { base: h * 0.86, amp: h * 0.1, count: 6 }), '#5c7a5f') +
      hill(w, h, ridge(w, rand, { base: h * 0.96, amp: h * 0.08, count: 5 }), '#2b4834');
  },
  arctic(w, h, rand, id) {
    const s = h / 600;
    const ground = ridge(w, rand, { base: h * 0.86, amp: h * 0.08, count: 6 });
    let trees = '';
    for (let i = 0; i < 9; i++) {
      const x = (w / 9) * i + rand() * (w / 12);
      trees += pine(x, h * (0.83 + rand() * 0.05), s * (0.8 + rand() * 0.6), '#1d3a2f');
    }
    return sky(id, w, h, ['#16302e', '#2c4c4a', '#5a7a74']) +
      stars(w, h * 0.5, rand, Math.round(40 * (w / 800)), '#f5efe3') +
      `<path d="M${-w * 0.05} ${r1(h * 0.34)} C${r1(w * 0.25)} ${r1(h * 0.12)} ${r1(w * 0.55)} ${r1(h * 0.42)} ${r1(w * 1.05)} ${r1(h * 0.18)}" stroke="#8fd1ae" stroke-width="${r1(56 * s)}" fill="none" opacity="0.22" stroke-linecap="round"/>` +
      `<path d="M${-w * 0.05} ${r1(h * 0.34)} C${r1(w * 0.25)} ${r1(h * 0.12)} ${r1(w * 0.55)} ${r1(h * 0.42)} ${r1(w * 1.05)} ${r1(h * 0.18)}" stroke="#b6ecc9" stroke-width="${r1(10 * s)}" fill="none" opacity="0.55" stroke-linecap="round"/>` +
      hill(w, h, ridge(w, rand, { base: h * 0.7, amp: h * 0.14, count: 7 }), '#c9d8d4') +
      hill(w, h, ridge(w, rand, { base: h * 0.78, amp: h * 0.1, count: 6 }), '#e1eae6') +
      trees +
      hill(w, h, ground, '#f3f4ef');
  },
  islands(w, h, rand, id) {
    const s = h / 600;
    const sea = h * 0.6;
    let houses = '';
    for (let i = 0; i < 9; i++) {
      const x = w * 0.2 + i * 17 * s + rand() * 6 * s;
      const y = sea - (16 + (i % 3) * 13 + rand() * 6) * s;
      houses += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(15 * s)}" height="${r1(13 * s)}" fill="#fbf8f2"/>`;
    }
    houses += circle(w * 0.2 + 60 * s, sea - 46 * s, 9 * s, '#4f7f95');
    return sky(id, w, h, ['#f1dcbc', '#f6e9d4', '#f8f2e7']) +
      circle(w * 0.7, h * 0.3, 58 * s, '#f2c98f') +
      island([[w * 0.02, sea + 2], [w * 0.14, sea - h * 0.1], [w * 0.28, sea - h * 0.17], [w * 0.42, sea - h * 0.12], [w * 0.56, sea + 2]], sea + 2, '#e6d7bf') +
      island(ridge(w * 0.36, rand, { base: sea + 2, amp: h * 0.1, count: 3, pin: true }).map(([x, y]) => [x + w * 0.62, y]), sea + 2, '#d8c6a8') +
      houses +
      `<rect x="0" y="${r1(sea)}" width="${w}" height="${r1(h - sea)}" fill="#6f9da0"/>` +
      `<rect x="0" y="${r1(sea + (h - sea) * 0.45)}" width="${w}" height="${r1((h - sea) * 0.55)}" fill="#5b8b8f"/>` +
      ripples(w, sea + 8, h - 8, rand, '#cfe3dc', 18);
  },
  coast(w, h, rand, id) {
    const s = h / 600;
    const sea = h * 0.55;
    let waves = '';
    for (let i = 0; i < 5; i++) {
      const y = sea + (h - sea) * (0.2 + i * 0.17);
      const x = rand() * w * 0.4;
      waves += `<path d="M${r1(x)} ${r1(y)} q${r1(30 * s)} ${r1(-12 * s)} ${r1(60 * s)} 0 t${r1(60 * s)} 0 t${r1(60 * s)} 0" stroke="#eef5f0" stroke-width="${r1(3 * s)}" fill="none" stroke-linecap="round" opacity="0.8"/>`;
    }
    return sky(id, w, h, ['#e3e9e3', '#f3eadb', '#f7efe2']) +
      circle(w * 0.24, h * 0.24, 40 * s, '#f4d3a3') +
      `<rect x="0" y="${r1(sea)}" width="${w}" height="${r1(h - sea)}" fill="#76a2a3"/>` +
      waves +
      `<path d="M${w} ${h} L${r1(w * 0.52)} ${h} L${r1(w * 0.56)} ${r1(h * 0.78)} L${r1(w * 0.6)} ${r1(h * 0.62)} L${r1(w * 0.64)} ${r1(h * 0.42)} L${r1(w * 0.78)} ${r1(h * 0.36)} L${w} ${r1(h * 0.33)} Z" fill="#d6a46c"/>` +
      `<path d="M${w} ${h} L${r1(w * 0.68)} ${h} L${r1(w * 0.71)} ${r1(h * 0.7)} L${r1(w * 0.76)} ${r1(h * 0.5)} L${r1(w * 0.86)} ${r1(h * 0.46)} L${w} ${r1(h * 0.45)} Z" fill="#bf8551"/>` +
      `<path d="M${r1(w * 0.64)} ${r1(h * 0.42)} L${r1(w * 0.78)} ${r1(h * 0.36)} L${w} ${r1(h * 0.33)} L${w} ${r1(h * 0.36)} L${r1(w * 0.78)} ${r1(h * 0.39)} Z" fill="#7d9a6b"/>`;
  },
  fjord(w, h, rand, id) {
    const s = h / 600;
    const water = h * 0.66;
    const left = [[0, h * 0.18], [w * 0.12, h * 0.26], [w * 0.24, h * 0.42], [w * 0.36, h * 0.58], [w * 0.44, water]];
    const right = [[w, h * 0.12], [w * 0.86, h * 0.22], [w * 0.74, h * 0.36], [w * 0.64, h * 0.54], [w * 0.56, water]];
    const wall = (pts, fill) => `<path d="M${pt(pts[0])} L${pts.slice(1).map(pt).join(' L')} L${r1(pts[0][0])} ${r1(water)} Z" fill="${fill}"/>`;
    const sauna = `<rect x="${r1(w * 0.47)}" y="${r1(water - 20 * s)}" width="${r1(36 * s)}" height="${r1(18 * s)}" fill="#3a2d24"/>` +
      `<path d="M${r1(w * 0.47 - 4 * s)} ${r1(water - 20 * s)} L${r1(w * 0.47 + 18 * s)} ${r1(water - 34 * s)} L${r1(w * 0.47 + 40 * s)} ${r1(water - 20 * s)} Z" fill="#2a211b"/>` +
      `<rect x="${r1(w * 0.47 + 6 * s)}" y="${r1(water - 15 * s)}" width="${r1(8 * s)}" height="${r1(7 * s)}" fill="#f4c97a"/>` +
      `<path d="M${r1(w * 0.47 + 10 * s)} ${r1(water + 6 * s)} v${r1(26 * s)}" stroke="#f4c97a" stroke-width="${r1(3 * s)}" opacity="0.5"/>`;
    return sky(id, w, h, ['#c8d2d6', '#e6d6cb', '#f0e3d6']) +
      range(w, h, ridge(w, rand, { base: h * 0.5, amp: h * 0.2, count: 8, sharp: true }), '#b6c0c0', '#f4f2ec') +
      wall(left, '#3e5a51') + wall(right, '#2d483f') +
      `<rect x="0" y="${r1(water)}" width="${w}" height="${r1(h - water)}" fill="#8ea6ab"/>` +
      ripples(w, water + 10, h - 6, rand, '#d5e1e1', 16) +
      sauna;
  },
  volcano(w, h, rand, id) {
    const s = h / 600;
    const x = w * 0.55;
    const base = h * 0.7;
    const top = h * 0.24;
    const cone = `<path d="M${r1(x - 300 * s)} ${r1(base)} C${r1(x - 170 * s)} ${r1(base - 50 * s)} ${r1(x - 80 * s)} ${r1(top + 20 * s)} ${r1(x - 40 * s)} ${r1(top)} L${r1(x + 40 * s)} ${r1(top)} C${r1(x + 80 * s)} ${r1(top + 20 * s)} ${r1(x + 170 * s)} ${r1(base - 50 * s)} ${r1(x + 300 * s)} ${r1(base)} Z" fill="#7f8e88"/>`;
    const cap = `<path d="M${r1(x - 40 * s)} ${r1(top)} L${r1(x + 40 * s)} ${r1(top)} C${r1(x + 55 * s)} ${r1(top + 10 * s)} ${r1(x + 64 * s)} ${r1(top + 28 * s)} ${r1(x + 70 * s)} ${r1(top + 40 * s)} L${r1(x + 30 * s)} ${r1(top + 30 * s)} L${r1(x)} ${r1(top + 44 * s)} L${r1(x - 34 * s)} ${r1(top + 28 * s)} L${r1(x - 66 * s)} ${r1(top + 42 * s)} C${r1(x - 60 * s)} ${r1(top + 26 * s)} ${r1(x - 52 * s)} ${r1(top + 10 * s)} ${r1(x - 40 * s)} ${r1(top)} Z" fill="#c5cdc8"/>`;
    let steam = '';
    for (let i = 0; i < 6; i++) steam += circle(x - 10 * s + i * 12 * s + rand() * 10 * s, top - 20 * s - i * 16 * s, (16 + i * 4) * s, '#f7f4ec', ' opacity="0.75"');
    return sky(id, w, h, ['#d6e2de', '#ecece2', '#f5efe3']) +
      range(w, h, ridge(w, rand, { base: h * 0.66, amp: h * 0.12, count: 8, sharp: true }), '#b3c2bb') +
      cone + cap + steam +
      hill(w, h, ridge(w, rand, { base: h * 0.8, amp: h * 0.1, count: 6 }), '#8eab84') +
      hill(w, h, ridge(w, rand, { base: h * 0.9, amp: h * 0.07, count: 5 }), '#5d8059') +
      hill(w, h, ridge(w, rand, { base: h * 0.98, amp: h * 0.05, count: 5 }), '#2f4d39');
  },
  baobab(w, h, rand, id) {
    const s = h / 600;
    const ground = h * 0.78;
    let trees = '';
    [0.18, 0.4, 0.66, 0.86].forEach((fx, i) => {
      trees += baobab(w * fx + (rand() - 0.5) * 30 * s, ground + 4 * s, s * (i % 2 ? 0.85 : 1.15) * (w > h * 2 ? 1.1 : 1), '#3a2c22', rand);
    });
    return sky(id, w, h, ['#e9a77b', '#f1c597', '#f6e0bf']) +
      circle(w * 0.52, ground - 30 * s, 70 * s, '#f8dca8') +
      hill(w, h, ridge(w, rand, { base: ground, amp: h * 0.03, count: 6 }), '#7a5a40') +
      trees +
      `<rect x="0" y="${r1(ground + 8 * s)}" width="${w}" height="${r1(h)}" fill="#5c4331"/>`;
  },
  palms(w, h, rand, id) {
    const s = h / 600;
    const water = h * 0.7;
    let trees = '';
    [[0.12, 22], [0.2, -18], [0.78, 26], [0.88, -14], [0.94, 8]].forEach(([fx, lean]) => {
      trees += palm(w * fx, water + 6 * s, s * (0.9 + rand() * 0.4), lean, '#24402f');
    });
    return sky(id, w, h, ['#efcfa7', '#f4e2c7', '#f7efe1']) +
      circle(w * 0.5, h * 0.42, 54 * s, '#f6d39b') +
      hill(w, water, ridge(w, rand, { base: water, amp: h * 0.06, count: 7 }), '#6f8f6c') +
      `<rect x="0" y="${r1(water)}" width="${w}" height="${r1(h - water)}" fill="#a9bfb2"/>` +
      ripples(w, water + 8, h - 6, rand, '#f3e2c4', 14) +
      trees;
  },
  desert(w, h, rand, id) {
    const s = h / 600;
    return sky(id, w, h, ['#efd2b0', '#f5e5cf', '#f8f0e3']) +
      circle(w * 0.3, h * 0.3, 46 * s, '#f6d9a8') +
      hill(w, h, ridge(w, rand, { base: h * 0.62, amp: h * 0.12, count: 5 }), '#e3b98c') +
      hill(w, h, ridge(w, rand, { base: h * 0.74, amp: h * 0.12, count: 4 }), '#d39e6c') +
      hill(w, h, ridge(w, rand, { base: h * 0.88, amp: h * 0.1, count: 4 }), '#bb7f51') +
      hill(w, h, ridge(w, rand, { base: h * 0.98, amp: h * 0.06, count: 4 }), '#9e6643');
  },
  loch(w, h, rand, id) {
    const water = h * 0.68;
    return sky(id, w, h, ['#c9d1cf', '#e2e2da', '#eeebe2']) +
      hill(w, water, ridge(w, rand, { base: h * 0.5, amp: h * 0.18, count: 6 }), '#a59aa4') +
      hill(w, water, ridge(w, rand, { base: h * 0.6, amp: h * 0.14, count: 6 }), '#7d8b74') +
      hill(w, water, ridge(w, rand, { base: water, amp: h * 0.08, count: 5 }), '#566e57') +
      `<rect x="0" y="${r1(water)}" width="${w}" height="${r1(h - water)}" fill="#99adae"/>` +
      ripples(w, water + 8, h * 0.88, rand, '#dfe7e4', 12) +
      hill(w, h, ridge(w, rand, { base: h * 0.98, amp: h * 0.08, count: 5 }), '#3a5343');
  },
  aerial(w, h, rand, id) {
    const s = h / 600;
    const cx = w * 0.56;
    const cy = h * 0.48;
    let rings = '';
    for (let k = 4; k >= 1; k--) {
      rings += `<path d="${blob(cx, cy, (150 + k * 55) * s, (105 + k * 42) * s, rand, 10, 0.16)}" fill="none" stroke="#a3e0da" stroke-width="${r1(2.5 * s)}" opacity="${r1(0.5 - k * 0.09)}"/>`;
    }
    let trees = '';
    for (let i = 0; i < 14; i++) {
      const y = (h / 13) * i + rand() * 20 * s;
      const x = w * 0.085 - (y / h) * w * 0.03 + rand() * 12 * s;
      trees += circle(x, y, (16 + rand() * 12) * s, i % 2 ? '#2f5238' : '#24402c');
    }
    const bx = w * 0.36;
    const by = h * 0.8;
    const wake = `M${r1(bx)} ${r1(by)} C${r1(bx - 50 * s)} ${r1(by + 50 * s)} ${r1(bx - 30 * s)} ${r1(by + 130 * s)} ${r1(bx + 50 * s)} ${r1(by + 220 * s)}`;
    return sky(id, w, h, ['#2a8b98', '#1f7587', '#185f72']) +
      `<path d="M0 0 H${r1(w * 0.3)} C${r1(w * 0.24)} ${r1(h * 0.3)} ${r1(w * 0.31)} ${r1(h * 0.62)} ${r1(w * 0.23)} ${h} H0 Z" fill="#5db7b4" opacity="0.85"/>` +
      rings +
      `<path d="${blob(cx, cy, 178 * s, 128 * s, rand, 10, 0.22)}" fill="#4fb0ad" opacity="0.6"/>` +
      `<path d="${blob(cx, cy, 122 * s, 86 * s, rand, 11, 0.38)}" fill="#6d6759"/>` +
      `<path d="${blob(cx - 10 * s, cy - 8 * s, 94 * s, 62 * s, rand, 10, 0.42)}" fill="#3e6a44"/>` +
      `<path d="${blob(cx - 26 * s, cy - 16 * s, 50 * s, 34 * s, rand, 9, 0.45)}" fill="#567f50"/>` +
      `<path d="M0 0 H${r1(w * 0.17)} C${r1(w * 0.13)} ${r1(h * 0.25)} ${r1(w * 0.19)} ${r1(h * 0.55)} ${r1(w * 0.13)} ${h} H0 Z" fill="#eddcbb"/>` +
      `<path d="M0 0 H${r1(w * 0.1)} C${r1(w * 0.075)} ${r1(h * 0.3)} ${r1(w * 0.11)} ${r1(h * 0.6)} ${r1(w * 0.065)} ${h} H0 Z" fill="#2c4a33"/>` +
      trees +
      `<path d="${wake}" stroke="#ffffff" stroke-width="${r1(20 * s)}" fill="none" opacity="0.18" stroke-linecap="round"/>` +
      `<path d="${wake}" stroke="#ffffff" stroke-width="${r1(5 * s)}" fill="none" opacity="0.65" stroke-linecap="round"/>` +
      `<rect x="${r1(bx - 6 * s)}" y="${r1(by - 26 * s)}" width="${r1(12 * s)}" height="${r1(30 * s)}" rx="${r1(6 * s)}" fill="#f7f5f0" transform="rotate(-28 ${r1(bx)} ${r1(by)})"/>`;
  },
  steppe(w, h, rand, id) {
    const s = h / 600;
    const ground = h * 0.7;
    let yurts = '';
    [[0.3, 1], [0.37, 0.8], [0.72, 0.9]].forEach(([fx, k]) => {
      const x = w * fx;
      const r = 26 * s * k;
      yurts += `<path d="M${r1(x - r)} ${r1(ground + 6 * s)} v${r1(-r * 0.7)} q${r1(r)} ${r1(-r * 0.75)} ${r1(r * 2)} 0 v${r1(r * 0.7)} Z" fill="#f7f3ea"/>`;
      yurts += `<rect x="${r1(x - r * 0.18)}" y="${r1(ground + 6 * s - r * 0.45)}" width="${r1(r * 0.36)}" height="${r1(r * 0.45)}" fill="#b5523a"/>`;
    });
    return sky(id, w, h, ['#cfe0e6', '#e9eee6', '#f4efe2']) +
      range(w, h, ridge(w, rand, { base: h * 0.5, amp: h * 0.16, count: 10, sharp: true }), '#b8c4c6', '#f3f4ef') +
      hill(w, h, ridge(w, rand, { base: h * 0.62, amp: h * 0.08, count: 6 }), '#a7b07a') +
      hill(w, h, ridge(w, rand, { base: ground + 8 * s, amp: h * 0.04, count: 5 }), '#c2b56b') +
      yurts +
      hill(w, h, ridge(w, rand, { base: h * 0.92, amp: h * 0.05, count: 5 }), '#8f9a55');
  },
  tea(w, h, rand, id) {
    const s = h / 600;
    const front = ridge(w, rand, { base: h * 0.74, amp: h * 0.12, count: 5 });
    let rows = '';
    for (let k = 1; k <= 8; k++) {
      rows += `<path d="${curve(front.map(([x, y]) => [x, y + k * 22 * s]))}" stroke="#86ad6e" stroke-width="${r1(7 * s)}" stroke-dasharray="${r1(3 * s)} ${r1(10 * s)}" stroke-linecap="round" fill="none"/>`;
    }
    return sky(id, w, h, ['#dfe7d6', '#eef0e2', '#f6f1e4']) +
      circle(w * 0.78, h * 0.22, 36 * s, '#f5e1b8') +
      hill(w, h, ridge(w, rand, { base: h * 0.5, amp: h * 0.16, count: 6 }), '#b4c9a5') +
      hill(w, h, ridge(w, rand, { base: h * 0.62, amp: h * 0.14, count: 6 }), '#86a873') +
      hill(w, h, front, '#5b8a50') +
      rows;
  },
};

export const SCENE_NAMES = Object.keys(SCENES);

/**
 * Returns an inline SVG string. `label` becomes the accessible name; pass '' for a decorative image.
 */
export function sceneSVG(name, { seed = name, label = '', width = 800, height = 600, className = 'scene' } = {}) {
  const draw = SCENES[name] || SCENES.peaks;
  const id = `sc${++uid}`;
  const body = draw(width, height, rng(hash(seed)), id);
  const a11y = label ? `role="img" aria-label="${label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${className}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" ${a11y}>${body}</svg>`;
}
