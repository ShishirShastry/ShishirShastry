// Text -> SVG glyph paths. Layout (kerning, letter-spacing) is measured in a real browser with Inter,
// outlines come from the Inter WOFF files, so the output needs no font at view time.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadWoff } = require('./font.js');
const { chromium } = require('F:/Open Design/node_modules/@playwright/test');

const FONT_DIR = 'F:/Open Design/node_modules/@fontsource/inter/files';
const WEIGHTS = [400, 500, 600, 700, 800];

const fonts = {};
for (const w of WEIGHTS) fonts[w] = loadWoff(path.join(FONT_DIR, `inter-latin-${w}-normal.woff`));
const UPM = fonts[400].upm;

let browser, page;
const cache = new Map();

async function init() {
  browser = await chromium.launch({ channel: 'msedge' });
  page = await browser.newPage({ viewport: { width: 1400, height: 600 } });
  const faces = WEIGHTS.map(w => {
    const b64 = fs.readFileSync(path.join(FONT_DIR, `inter-latin-${w}-normal.woff`)).toString('base64');
    return `@font-face{font-family:IM;font-weight:${w};src:url(data:font/woff;base64,${b64}) format('woff');}`;
  }).join('\n');
  await page.setContent(`<!doctype html><html><head><style>${faces}
    body{margin:0} #m{font-family:IM;font-size:${UPM}px;white-space:pre;position:absolute;left:0;top:0;
      font-feature-settings:"calt" 0,"liga" 0,"kern" 1;font-kerning:normal;line-height:1}
  </style></head><body><span id="m"></span></body></html>`);
  await page.evaluate(async (ws) => {
    await Promise.all(ws.map(w => document.fonts.load(`${w} 20px IM`)));
  }, WEIGHTS);
}

async function close() { if (browser) await browser.close(); }

// returns { chars:[{ch,gid,x}], width } in font units (pen positions)
async function measure(str, weight, lsEm = 0) {
  const key = `${weight}|${lsEm}|${str}`;
  if (cache.has(key)) return cache.get(key);
  const res = await page.evaluate(({ str, weight, ls }) => {
    const el = document.getElementById('m');
    el.style.fontWeight = weight;
    el.style.letterSpacing = ls + 'em';
    el.textContent = str;
    const node = el.firstChild;
    const base = el.getBoundingClientRect().left;
    const xs = [];
    const r = document.createRange();
    for (let i = 0; i < str.length; i++) {
      r.setStart(node, i); r.setEnd(node, i + 1);
      xs.push(r.getBoundingClientRect().left - base);
    }
    r.setStart(node, 0); r.setEnd(node, str.length);
    const rr = r.getBoundingClientRect();
    return { xs, width: rr.width };
  }, { str, weight, ls: lsEm });
  const f = fonts[weight];
  const chars = [...str].map((ch, i) => ({ ch, gid: f.gid(ch), x: Math.round(res.xs[i]) }));
  // width without trailing letter-spacing
  const width = res.width - lsEm * UPM;
  const out = { chars, width, weight, str };
  cache.set(key, out);
  return out;
}

// Per-SVG glyph registry: emits <path id> defs once per (weight,gid)
class Glyphs {
  constructor(prefix = 'Q') { this.prefix = prefix; this.map = new Map(); this.n = 0; }
  ref(weight, gid) {
    const k = weight + ':' + gid;
    if (!this.map.has(k)) this.map.set(k, { id: this.prefix + (this.n++).toString(36), weight, gid });
    return this.map.get(k).id;
  }
  defs() {
    let s = '';
    for (const { id, weight, gid } of this.map.values()) {
      const d = fonts[weight].path(gid);
      if (d) s += `<path id="${id}" d="${d}"/>`;
    }
    return s;
  }
}

const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  return String(r);
};

/**
 * Lay out a text run. opts: {w, size, ls (em), x, y (baseline), anchor: 'start'|'middle'|'end'}
 * Returns helper with:
 *   .k scale, .width px, .x0 (left px), .y baseline px
 *   .uses(G, perGlyph?) -> inner <use> markup (in font units)
 *   .open(attrs) / '</g>' -> group wrapper with transform
 *   .svg(G, attrs) -> full group with uses
 *   .d() -> combined path d in run-local font units
 *   .glyphX(i) px position of glyph i (absolute)
 */
async function run(str, opts) {
  const { w = 400, size = 16, ls = 0, x = 0, y = 0, anchor = 'start' } = opts;
  const m = await measure(str, w, ls);
  const k = size / UPM;
  const width = m.width * k;
  let x0 = x;
  if (anchor === 'middle') x0 = x - width / 2;
  else if (anchor === 'end') x0 = x - width;
  const chars = m.chars;
  const f = fonts[w];
  const R = {
    str, k, width, x0, y, size, w, chars,
    transform: `translate(${fmt(x0)} ${fmt(y)}) scale(${+k.toFixed(6)})`,
    glyphX(i) { return x0 + chars[i].x * k; },
    glyphCenter(i) { return x0 + (chars[i].x + f.advance(chars[i].gid) / 2) * k; },
    // inner uses; attrFn(i, ch) may return extra attribute string per glyph
    uses(G, attrFn) {
      let s = '';
      chars.forEach((c, i) => {
        if (c.ch === ' ') return;
        const id = G.ref(w, c.gid);
        const ex = attrFn ? attrFn(i, c) : '';
        if (ex === null) return;
        const extra = ex || '';
        s += `<use href="#${id}"${c.x ? ` x="${c.x}"` : ''}${extra ? ' ' + extra : ''}/>`;
      });
      return s;
    },
    svg(G, attrs = '', attrFn) {
      return `<g transform="${R.transform}"${attrs ? ' ' + attrs : ''}>${R.uses(G, attrFn)}</g>`;
    },
    d() {
      let s = '';
      for (const c of chars) {
        if (c.ch === ' ') continue;
        const p = f.path(c.gid, c.x);
        if (p) s += p;
      }
      return s;
    },
    capTop() { return y - f.capHeight * k; },
    xTop() { return y - f.xHeight * k; },
  };
  return R;
}

module.exports = { init, close, run, measure, Glyphs, fonts, UPM, fmt };
