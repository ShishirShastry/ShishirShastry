'use strict';
const fs = require('fs');

const ACCENT = ['#7c5cff', '#a63cff', '#ef67a8', '#ff9d5c'];
const COOL = ['#2a62ff', '#00e4ff'];

const THEMES = {
  dark: {
    name: 'dark', dark: true,
    bg: '#0a0912', surface: '#12101c', surface2: '#181626',
    border: 'rgba(255,255,255,0.10)', borderStrong: 'rgba(255,255,255,0.16)',
    text: '#f5f4fb', muted: '#a9a5bd', faint: '#6f6a86', success: '#3ddc97',
    accent: ACCENT, cool: COOL,
    // gradient for big display text
    nameGrad: ['#8f73ff', '#b45cff', '#f06aab', '#ffa066'],
    // gradient for small emphasised text (lighter so it stays readable on dark)
    kwGrad: ['#a48dff', '#c58bff', '#f584bb', '#ffb07e'],
    accentText: '#b7a6ff',
    me: '#ef67a8', alex: '#22d3ee', alexInk: '#04232a',
    sel: '#8b6dff',
    hi: '#ffffff', ink: '#0a0912',
  },
  light: {
    name: 'light', dark: false,
    bg: '#ffffff', surface: '#f6f5fb', surface2: '#efedf7',
    border: 'rgba(16,12,40,0.10)', borderStrong: 'rgba(16,12,40,0.16)',
    text: '#16131f', muted: '#5d5873', faint: '#9893ab', success: '#12a36a',
    accent: ACCENT, cool: COOL,
    nameGrad: ['#5b34ff', '#9a2cf0', '#e0408f', '#f0782a'],
    kwGrad: ['#5634f0', '#8f27e0', '#cf2f7c', '#d9601a'],
    accentText: '#5b34ff',
    me: '#e0408f', alex: '#0891b2', alexInk: '#ffffff',
    sel: '#6a45ff',
    hi: '#ffffff', ink: '#16131f',
  },
};

const E = {
  io: 'cubic-bezier(.65,0,.35,1)',
  sio: 'cubic-bezier(.37,0,.63,1)',
  o: 'cubic-bezier(.22,1,.36,1)',
  i: 'cubic-bezier(.55,0,1,.45)',
  lin: 'linear',
  back: 'cubic-bezier(.34,1.56,.64,1)',
};

const r2 = (n) => String(Math.round(n * 100) / 100);
const r3 = (n) => String(Math.round(n * 1000) / 1000);

function lerp(a, b, t) { return a + (b - a) * t; }
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r) { return '#' + r.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
// sample a multi-stop gradient (evenly spaced stops) at t in [0,1]
function sampleGrad(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  const a = hex2rgb(stops[i]), b = hex2rgb(stops[i + 1]);
  return rgb2hex(a.map((v, k) => lerp(v, b[k], f)));
}

function gradStops(stops, opacity) {
  return stops.map((c, i) => `<stop offset="${r3(i / (stops.length - 1))}" stop-color="${c}"${opacity !== undefined ? ` stop-opacity="${opacity}"` : ''}/>`).join('');
}

// CSS keyframe animation registry. frames: [[t, {o,x,y,s,r}, ease], ...] with t in seconds; first/last must match.
class Anim {
  constructor(prefix = 'k') { this.prefix = prefix; this.n = 0; this.css = []; }
  static props(p, hasT) {
    const out = [];
    if (p.o !== undefined) out.push(`opacity:${r3(p.o)}`);
    if (hasT) {
      const t = [];
      t.push(`translate(${r2(p.x || 0)}px,${r2(p.y || 0)}px)`);
      if (p.s !== undefined || hasT.s) t.push(`scale(${r3(p.s === undefined ? 1 : p.s)})`);
      if (p.r !== undefined || hasT.r) t.push(`rotate(${r2(p.r || 0)}deg)`);
      out.push(`transform:${t.join(' ')}`);
    }
    return out.join(';');
  }
  static stateAt(frames, t) {
    for (let i = 0; i < frames.length - 1; i++) {
      const [t0, a] = frames[i], [t1, b] = frames[i + 1];
      if (t >= t0 && t <= t1) {
        const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        const o = {};
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const def = (k === 's' || k === 'o') ? 1 : 0;
          o[k] = lerp(a[k] ?? def, b[k] ?? def, f);
        }
        return o;
      }
    }
    return frames[0][1];
  }
  // returns keyframes name; registers @keyframes
  keyframes(T, frames) {
    const name = this.prefix + (this.n++).toString(36);
    const hasT = frames.some(([, p]) => ['x', 'y', 's', 'r'].some(k => p[k] !== undefined));
    const flags = hasT ? { s: frames.some(([, p]) => p.s !== undefined), r: frames.some(([, p]) => p.r !== undefined) } : null;
    let k = `@keyframes ${name}{`;
    for (const [t, p, ease] of frames) {
      const pct = r3(t / T * 100);
      k += `${pct}%{${Anim.props(p, flags)}${ease && ease !== 'lin' ? `;animation-timing-function:${E[ease] || ease}` : ''}}`;
    }
    k += '}';
    this.css.push(k);
    return { name, flags };
  }
  // full rule: selector gets animation + base (reduced-motion) state = state at `offset`
  add(sel, T, frames, { offset = 0, extra = '' } = {}) {
    const { name, flags } = this.keyframes(T, frames);
    const ph = ((offset % T) + T) % T;
    const base = Anim.props(Anim.stateAt(frames, ph), flags);
    this.css.push(`${sel}{${base};animation:${name} ${T}s linear infinite;animation-delay:${r3(-offset)}s${extra ? ';' + extra : ''}}`);
    return name;
  }
  text() { return this.css.join('\n'); }
}

function svgDoc({ w, h, title, desc, style = '', defs = '', body = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="title desc">` +
    `<title id="title">${title}</title><desc id="desc">${desc}</desc>` +
    `<style>.rs{display:none}\n${style}\n@media (prefers-reduced-motion:reduce){*{animation:none!important}.ra{display:none}.rs{display:inline!important}}</style>` +
    `<defs>${defs}</defs>${body}</svg>`;
}

// Evora logo (verbatim shapes/gradients from F:/Open Design/public/favicon.svg; only ids namespaced)
function evoraLogo(x, y, size, p = 'ev') {
  return `<svg x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}" viewBox="-21.5 -7 328 328">` +
    `<defs><linearGradient id="${p}t" gradientUnits="userSpaceOnUse" x1="2" y1="115" x2="283" y2="38"><stop offset="0" stop-color="#5b34ff"/><stop offset="0.42" stop-color="#a63cff"/><stop offset="0.74" stop-color="#ef67a8"/><stop offset="1" stop-color="#ff9d5c"/></linearGradient>` +
    `<linearGradient id="${p}b" gradientUnits="userSpaceOnUse" x1="2" y1="191" x2="283" y2="276"><stop offset="0" stop-color="#3a1cf0"/><stop offset="0.5" stop-color="#2a62ff"/><stop offset="1" stop-color="#00e4ff"/></linearGradient>` +
    `<linearGradient id="${p}f" gradientUnits="userSpaceOnUse" x1="0" y1="115" x2="0" y2="191"><stop offset="0" stop-color="#7a3dff"/><stop offset="1" stop-color="#3a1cf0"/></linearGradient></defs>` +
    `<rect x="2" y="115" width="38" height="76" fill="url(#${p}f)"/>` +
    `<line x1="40" y1="115" x2="245" y2="38" stroke="url(#${p}t)" stroke-width="76" stroke-linecap="round"/>` +
    `<line x1="40" y1="191" x2="245" y2="276" stroke="url(#${p}b)" stroke-width="76" stroke-linecap="round"/></svg>`;
}

function write(file, s) {
  fs.writeFileSync(file, s);
  return { file, bytes: Buffer.byteLength(s) };
}

module.exports = { THEMES, E, Anim, r2, r3, lerp, sampleGrad, gradStops, svgDoc, evoraLogo, write, ACCENT, COOL };
