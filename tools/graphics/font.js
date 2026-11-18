// Minimal WOFF1 + TrueType (glyf) reader: cmap lookup, advances, glyph outlines -> SVG path (y-down, font units).
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function loadWoff(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'wOFF') throw new Error('not a WOFF1 file: ' + file);
  const numTables = b.readUInt16BE(12);
  const t = {};
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = b.toString('ascii', o, o + 4);
    const off = b.readUInt32BE(o + 4), comp = b.readUInt32BE(o + 8), orig = b.readUInt32BE(o + 12);
    let data = b.subarray(off, off + comp);
    if (comp < orig) data = zlib.inflateSync(data);
    t[tag] = data;
  }
  return new Font(t, file);
}

class Font {
  constructor(t, file) {
    this.file = file;
    this.t = t;
    this.upm = t.head.readUInt16BE(18);
    this.locFmt = t.head.readInt16BE(50);
    this.numGlyphs = t.maxp.readUInt16BE(4);
    this.ascender = t.hhea.readInt16BE(4);
    this.descender = t.hhea.readInt16BE(6);
    this.numHM = t.hhea.readUInt16BE(34);
    // OS/2 cap height / x height (version >= 2)
    const os2 = t['OS/2'];
    this.capHeight = os2.readUInt16BE(0) >= 2 ? os2.readInt16BE(88) : Math.round(this.upm * 0.727);
    this.xHeight = os2.readUInt16BE(0) >= 2 ? os2.readInt16BE(86) : Math.round(this.upm * 0.545);
    this.loca = [];
    for (let i = 0; i <= this.numGlyphs; i++) {
      this.loca.push(this.locFmt === 0 ? t.loca.readUInt16BE(i * 2) * 2 : t.loca.readUInt32BE(i * 4));
    }
    this._cmap = this._parseCmap();
    this._cache = new Map();
  }
  _parseCmap() {
    const c = this.t.cmap;
    const n = c.readUInt16BE(2);
    let best = null, bestScore = -1;
    for (let i = 0; i < n; i++) {
      const p = c.readUInt16BE(4 + i * 8), e = c.readUInt16BE(6 + i * 8), off = c.readUInt32BE(8 + i * 8);
      const fmt = c.readUInt16BE(off);
      let score = -1;
      if (fmt === 12 && (p === 3 && e === 10 || p === 0)) score = 3;
      else if (fmt === 4 && (p === 3 && e === 1 || p === 0)) score = 2;
      if (score > bestScore) { bestScore = score; best = { fmt, off }; }
    }
    if (!best) throw new Error('no usable cmap');
    const map = new Map();
    const { fmt, off } = best;
    if (fmt === 4) {
      const segX2 = c.readUInt16BE(off + 6), seg = segX2 / 2;
      const endO = off + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (let s = 0; s < seg; s++) {
        const end = c.readUInt16BE(endO + s * 2), start = c.readUInt16BE(startO + s * 2);
        const delta = c.readInt16BE(deltaO + s * 2), ro = c.readUInt16BE(rangeO + s * 2);
        for (let ch = start; ch <= end && ch !== 0xffff; ch++) {
          let g;
          if (ro === 0) g = (ch + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + ro + (ch - start) * 2;
            g = c.readUInt16BE(gi);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g) map.set(ch, g);
        }
      }
    } else {
      const ng = c.readUInt32BE(off + 12);
      for (let i = 0; i < ng; i++) {
        const o = off + 16 + i * 12;
        const s = c.readUInt32BE(o), e = c.readUInt32BE(o + 4), g = c.readUInt32BE(o + 8);
        for (let ch = s; ch <= e; ch++) map.set(ch, g + ch - s);
      }
    }
    return map;
  }
  gid(ch) {
    const g = this._cmap.get(ch.codePointAt(0));
    if (g === undefined) throw new Error(`glyph missing for "${ch}" (U+${ch.codePointAt(0).toString(16)}) in ${this.file}`);
    return g;
  }
  advance(gid) {
    const i = Math.min(gid, this.numHM - 1);
    return this.t.hmtx.readUInt16BE(i * 4);
  }
  // returns array of contours; each contour = [{x,y,on}] in font units (y up)
  contours(gid, depth = 0) {
    if (depth > 8) return [];
    const g = this.t.glyf;
    const s = this.loca[gid], e = this.loca[gid + 1];
    if (e <= s) return [];
    const nc = g.readInt16BE(s);
    if (nc >= 0) {
      const ends = [];
      for (let i = 0; i < nc; i++) ends.push(g.readUInt16BE(s + 10 + i * 2));
      const np = nc ? ends[nc - 1] + 1 : 0;
      let p = s + 10 + nc * 2;
      const il = g.readUInt16BE(p); p += 2 + il;
      const flags = [];
      while (flags.length < np) {
        const f = g[p++];
        flags.push(f);
        if (f & 8) { let r = g[p++]; while (r--) flags.push(f); }
      }
      const xs = [], ys = [];
      let v = 0;
      for (const f of flags) {
        if (f & 2) { const d = g[p++]; v += (f & 16) ? d : -d; }
        else if (!(f & 16)) { v += g.readInt16BE(p); p += 2; }
        xs.push(v);
      }
      v = 0;
      for (const f of flags) {
        if (f & 4) { const d = g[p++]; v += (f & 32) ? d : -d; }
        else if (!(f & 32)) { v += g.readInt16BE(p); p += 2; }
        ys.push(v);
      }
      const out = [];
      let st = 0;
      for (const en of ends) {
        const c = [];
        for (let i = st; i <= en; i++) c.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
        out.push(c);
        st = en + 1;
      }
      return out;
    }
    // composite
    let p = s + 10;
    const out = [];
    for (;;) {
      const fl = g.readUInt16BE(p), ci = g.readUInt16BE(p + 2); p += 4;
      let a1, a2;
      if (fl & 1) { a1 = g.readInt16BE(p); a2 = g.readInt16BE(p + 2); p += 4; }
      else { a1 = g.readInt8(p); a2 = g.readInt8(p + 1); p += 2; }
      let a = 1, b = 0, c = 0, d = 1;
      const f2 = (o) => g.readInt16BE(o) / 16384;
      if (fl & 8) { a = d = f2(p); p += 2; }
      else if (fl & 0x40) { a = f2(p); d = f2(p + 2); p += 4; }
      else if (fl & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8; }
      const dx = (fl & 2) ? a1 : 0, dy = (fl & 2) ? a2 : 0;
      for (const ct of this.contours(ci, depth + 1)) {
        out.push(ct.map(q => ({ x: a * q.x + c * q.y + dx, y: b * q.x + d * q.y + dy, on: q.on })));
      }
      if (!(fl & 0x20)) break;
    }
    return out;
  }
  // SVG path data, y-down, offset by (ox, 0), relative commands, integer-rounded. absStart: first M absolute.
  path(gid, ox = 0) {
    const key = gid + ':' + ox;
    if (this._cache.has(key)) return this._cache.get(key);
    const parts = [];
    let cx = 0, cy = 0, first = true;
    const R = (v) => Math.round(v);
    const pt = (q) => ({ x: R(q.x + ox), y: R(-q.y) });
    const num = (n) => String(n);
    const join = (arr) => {
      let s = '';
      for (let i = 0; i < arr.length; i++) {
        const t = num(arr[i]);
        if (i > 0 && t[0] !== '-') s += ' ';
        s += t;
      }
      return s;
    };
    for (const ct0 of this.contours(gid)) {
      if (ct0.length < 2) continue;
      let ct = ct0.slice();
      let si = ct.findIndex(q => q.on);
      let start;
      if (si < 0) { // all off-curve
        start = { x: (ct[0].x + ct[1].x) / 2, y: (ct[0].y + ct[1].y) / 2, on: true };
        ct = [start, ...ct.slice(1), ct[0]];
      } else {
        ct = ct.slice(si).concat(ct.slice(0, si));
        start = ct[0];
      }
      const P = pt(start);
      if (first) { parts.push('M' + join([P.x, P.y])); first = false; }
      else parts.push('m' + join([P.x - cx, P.y - cy]));
      cx = P.x; cy = P.y;
      let off = null;
      const seq = ct.slice(1).concat([start]);
      for (const q of seq) {
        if (q.on) {
          const Q = pt(q);
          if (off) {
            const O = pt(off);
            parts.push('q' + join([O.x - cx, O.y - cy, Q.x - cx, Q.y - cy]));
          } else {
            if (Q.x === cx) parts.push('v' + num(Q.y - cy));
            else if (Q.y === cy) parts.push('h' + num(Q.x - cx));
            else parts.push('l' + join([Q.x - cx, Q.y - cy]));
          }
          cx = Q.x; cy = Q.y; off = null;
        } else {
          if (off) {
            const mid = { x: (off.x + q.x) / 2, y: (off.y + q.y) / 2 };
            const O = pt(off), M = pt(mid);
            parts.push('q' + join([O.x - cx, O.y - cy, M.x - cx, M.y - cy]));
            cx = M.x; cy = M.y;
          }
          off = q;
        }
      }
      parts.push('z');
    }
    // compact: drop redundant command letters is not worth the risk; just join
    const d = parts.join('').replace(/([a-zA-Z]) /g, '$1');
    this._cache.set(key, d);
    return d;
  }
}

module.exports = { loadWoff };
