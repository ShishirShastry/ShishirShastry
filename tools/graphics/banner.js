'use strict';
const Tk = require('./textkit.js');
const { Anim, r2, r3, sampleGrad, gradStops, svgDoc } = require('./common.js');

const TAGLINES = [
  { s: 'Web developer & system engineer', kw: 'Web developer' },
  { s: 'Building Evora, an open-source design tool', kw: 'Evora' },
  { s: 'Exploring AI agents & Gen AI', kw: 'AI agents' },
  { s: 'Crafting mind-blowing websites', kw: 'mind-blowing' },
];

function star4(cx, cy, r, k = 0.17) {
  const q = r * k;
  return `M${r2(cx)} ${r2(cy - r)}Q${r2(cx + q)} ${r2(cy - q)} ${r2(cx + r)} ${r2(cy)}Q${r2(cx + q)} ${r2(cy + q)} ${r2(cx)} ${r2(cy + r)}Q${r2(cx - q)} ${r2(cy + q)} ${r2(cx - r)} ${r2(cy)}Q${r2(cx - q)} ${r2(cy - q)} ${r2(cx)} ${r2(cy - r)}Z`;
}

const CURSOR = 'M0 0V16.2L4.4 12.2 7.3 18.8 10 17.6 7.2 11.1H12.9Z';

async function banner(th) {
  const W = 1000, H = 300;
  const dk = th.dark;
  const G = new Tk.Glyphs('Q');
  const A = new Anim('k');
  const D = [];
  const B = [];

  D.push(`<clipPath id="cl"><rect width="${W}" height="${H}" rx="20"/></clipPath>`);

  // ---------------- aurora ----------------
  // cx, cy, rx, ry, color, opacity, period, dx1, dy1, dx2, dy2
  const blobs = [
    [835, 30, 340, 210, '#7c5cff', dk ? .58 : .34, 22, -70, 34, 30, 22],
    [985, 255, 270, 190, '#ef67a8', dk ? .38 : .30, 26, -46, -30, -90, 12],
    [600, 335, 330, 150, '#2a62ff', dk ? .30 : .16, 24, 80, -22, -46, -12],
    [70, -50, 330, 170, '#a63cff', dk ? .30 : .16, 28, 70, 24, 130, 4],
    [1005, 18, 200, 140, '#ff9d5c', dk ? .24 : .30, 20, -36, 30, -70, -10],
    [700, 150, 180, 110, '#00e4ff', dk ? .10 : .10, 18, 46, 22, -34, -22],
  ];
  let au = '';
  blobs.forEach(([cx, cy, rx, ry, c, o, T, dx1, dy1, dx2, dy2], i) => {
    D.push(`<radialGradient id="a${i}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".38" stop-color="${c}" stop-opacity="${r3(o * .6)}"/><stop offset=".72" stop-color="${c}" stop-opacity="${r3(o * .17)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    au += `<ellipse class="b${i}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#a${i})"/>`;
    A.add(`.b${i}`, T, [
      [0, { x: 0, y: 0, s: 1 }, 'sio'],
      [T / 3, { x: dx1, y: dy1, s: 1.1 }, 'sio'],
      [2 * T / 3, { x: dx2, y: dy2, s: .94 }, 'sio'],
      [T, { x: 0, y: 0, s: 1 }],
    ], { offset: T * ((i * 0.37) % 1), extra: 'transform-box:fill-box;transform-origin:center' });
  });

  // ---------------- perspective grid ----------------
  const yh = 172, vx = 772;
  let grid = '';
  for (let i = -18; i <= 18; i++) {
    const xb = vx + i * 58;
    const yE = H + 12;
    const xE = vx + (xb - vx) * (yE - yh) / (H - yh);
    grid += `<path d="M${vx} ${yh}L${r2(xE)} ${yE}"/>`;
  }
  // moving horizontal lines (equal spacing in depth -> correct perspective spacing)
  const NL = 9, PL = 3.2, TT = NL * PL, AA = 118, zf = 15, zn = 0.84;
  const fr = [];
  const NS = 28;
  for (let s = 0; s <= NS; s++) {
    const f = s / NS;
    const z = zf - (zf - zn) * f;
    fr.push([TT * f, { y: AA / z }]);
  }
  const gl = A.keyframes(TT, fr);
  A.css.push(`.hl{transform:translate(0,${r2(AA / 3)}px);animation:${gl.name} ${TT}s linear infinite}`);
  for (let i = 0; i < NL; i++) {
    const ph = ((i * PL + 0.5) % TT) / TT, zz = zf - (zf - zn) * ph;
    grid += `<path class="hl" style="animation-delay:${r3(-i * PL - 0.5)}s;transform:translate(0,${r2(AA / zz)}px)" d="M-10 ${yh}H1010"/>`;
  }
  D.push(`<radialGradient id="gr" cx=".77" cy="1" r=".72"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
  D.push(`<linearGradient id="gh" gradientUnits="userSpaceOnUse" x1="0" y1="${yh}" x2="0" y2="${yh + 95}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>`);
  D.push(`<mask id="m1"><rect width="${W}" height="${H}" fill="url(#gr)"/></mask><mask id="m2"><rect width="${W}" height="${H}" fill="url(#gh)"/></mask>`);
  const gridCol = dk ? '#b3a3ff' : '#5b34ff';
  const gridOp = dk ? .30 : .16;
  B.push(`<g mask="url(#m1)"><g mask="url(#m2)" fill="none" stroke="${gridCol}" stroke-opacity="${gridOp}" stroke-width="1">${grid}</g></g>`);
  // horizon glow
  D.push(`<linearGradient id="hz" x1="0" x2="1"><stop offset="0" stop-color="${th.accent[0]}" stop-opacity="0"/><stop offset=".45" stop-color="${th.accent[1]}" stop-opacity="${dk ? .55 : .35}"/><stop offset=".75" stop-color="${th.accent[2]}" stop-opacity="${dk ? .45 : .3}"/><stop offset="1" stop-color="${th.accent[3]}" stop-opacity="0"/></linearGradient>`);
  D.push(`<radialGradient id="hg"><stop offset="0" stop-color="${th.accent[1]}" stop-opacity="${dk ? .32 : .14}"/><stop offset="1" stop-color="${th.accent[1]}" stop-opacity="0"/></radialGradient>`);
  B.push(`<ellipse cx="${vx}" cy="${yh}" rx="300" ry="26" fill="url(#hg)"/><rect x="430" y="${yh - .5}" width="570" height="1" fill="url(#hz)"/>`);

  // ---------------- left: text ----------------
  const X = 64;
  // status pill
  const pillY = 68, pillH = 30;
  const pt = await Tk.run('Currently working on AI agents', { w: 600, size: 13, ls: .005, x: X + 30, y: pillY + pillH / 2 + 4.73 });
  const pillW = 30 + pt.width + 14;
  B.push(`<rect x="${X}" y="${pillY}" width="${r2(pillW)}" height="${pillH}" rx="${pillH / 2}" fill="${dk ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)'}" stroke="${th.border}"/>`);
  const dotX = X + 16, dotY = pillY + pillH / 2;
  B.push(`<circle class="pr" cx="${dotX}" cy="${dotY}" r="3.5" fill="none" stroke="${th.success}" stroke-width="1.5"/><circle cx="${dotX}" cy="${dotY}" r="3.5" fill="${th.success}"/>`);
  A.add('.pr', 2.4, [[0, { o: .7, s: 1 }, 'o'], [1.8, { o: 0, s: 2.7 }], [2.4, { o: 0, s: 2.7 }]], { offset: 0.3, extra: 'transform-box:fill-box;transform-origin:center' });
  // make reduced-motion state of ring invisible-ish
  B.push(pt.svg(G, `fill="${th.text}" fill-opacity="${dk ? .86 : .82}"`));

  // headline
  const hl = await Tk.run('Hi, I’m Shishir', { w: 800, size: 62, ls: -0.028, x: X - 3, y: 168 });
  const split = 'Hi, I’m '.length;
  B.push(`<g transform="${hl.transform}" fill="${th.text}">${hl.uses(G, (i) => i >= split ? null : '')}</g>`);
  // gradient name with shimmer (mask = glyph outlines)
  const nameChars = hl.chars.slice(split);
  const fnt = Tk.fonts[800];
  let nameD = '';
  for (const c of nameChars) nameD += fnt.path(c.gid, c.x);
  const nx0 = hl.glyphX(split);
  const nx1 = hl.x0 + hl.width;
  const capTop = hl.capTop();
  D.push(`<mask id="nm"><g transform="${hl.transform}"><path d="${nameD}" fill="#fff"/></g></mask>`);
  D.push(`<linearGradient id="ng" gradientUnits="userSpaceOnUse" x1="${r2(nx0)}" y1="0" x2="${r2(nx1)}" y2="0">${gradStops(th.nameGrad)}</linearGradient>`);
  D.push(`<linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${dk ? .75 : .65}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  const sTop = capTop - 8, sBot = 168 + 18;
  const L = nx1 - nx0 + 170;
  B.push(`<g mask="url(#nm)"><rect x="${r2(nx0 - 6)}" y="${r2(sTop)}" width="${r2(nx1 - nx0 + 12)}" height="${r2(sBot - sTop)}" fill="url(#ng)"/>` +
    `<path class="sh" d="M${r2(nx0 - 60)} ${r2(sTop)}h46l-34 ${r2(sBot - sTop)}h-46z" fill="url(#sg)"/></g>`);
  A.add('.sh', 8, [[0, { x: 0 }], [2.2, { x: 0 }, 'io'], [3.9, { x: L }], [8, { x: L }]], { offset: 0 });

  // cycling tagline
  const tagX = X + 30, tagY = 222;
  const sp = star4(X + 9, tagY - 7, 8.5);
  D.push(`<linearGradient id="sp" x1="0" y1="0" x2="1" y2="1">${gradStops(th.nameGrad)}</linearGradient>`);
  B.push(`<path class="sp" d="${sp}" fill="url(#sp)"/>`);
  A.add('.sp', 9, [[0, { r: 0, s: 1 }, 'sio'], [4.5, { r: 45, s: .78 }, 'sio'], [9, { r: 90, s: 1 }]], { offset: 0, extra: 'transform-box:fill-box;transform-origin:center' });

  const P = 5, NT = TAGLINES.length, TP = P * NT, OFF = 2.4, ST = 0.022;
  for (let li = 0; li < NT; li++) {
    const { s, kw } = TAGLINES[li];
    const r = await Tk.run(s, { w: 500, size: 23, ls: -0.008, x: tagX, y: tagY });
    const k0 = s.indexOf(kw), k1 = k0 + kw.length;
    const kx0 = r.glyphX(k0), kx1 = r.glyphX(k1 - 1) + 10;
    const dy = 10 / r.k;
    const ws = li * P;
    // glyph entrance
    const gf = [];
    if (ws > 0) gf.push([0, { o: 0, y: dy }]);
    gf.push([ws, { o: 0, y: dy }, 'o']);
    gf.push([ws + .6, { o: 1, y: 0 }]);
    gf.push([ws + P - .02, { o: 1, y: 0 }]);
    if (ws + P < TP) { gf.push([ws + P, { o: 0, y: dy }]); gf.push([TP, { o: 0, y: dy }]); }
    else gf.push([TP, { o: 1, y: 0 }]);
    const gk = A.keyframes(TP, gf);
    A.css.push(`.q${li}{animation:${gk.name} ${TP}s linear infinite}`);
    // line group (fade out, drift up)
    const lf = [];
    if (ws > 0) { lf.push([0, { o: 0, y: 0 }]); lf.push([ws - .01, { o: 0, y: 0 }]); }
    lf.push([ws, { o: 1, y: 0 }]);
    lf.push([ws + P - .55, { o: 1, y: 0 }, 'i']);
    lf.push([ws + P - .05, { o: 0, y: -7 }]);
    if (ws + P < TP) lf.push([TP, { o: 0, y: 0 }]);
    else lf.push([TP, { o: 0, y: -7 }]);
    const lk = A.keyframes(TP, lf);
    A.css.push(`.L${li}{opacity:${li === 0 ? 1 : 0};animation:${lk.name} ${TP}s linear infinite;animation-delay:${-OFF}s}`);
    const inner = r.uses(G, (i) => {
      let a = `class="q${li}" style="animation-delay:${r3(i * ST - OFF)}s"`;
      if (i >= k0 && i < k1) {
        const t = (r.glyphCenter(i) - kx0) / Math.max(1, kx1 - kx0);
        a += ` fill="${sampleGrad(th.kwGrad, t)}"`;
      }
      return a;
    });
    B.push(`<g class="L${li}"><g transform="${r.transform}" fill="${th.muted}">${inner}</g></g>`);
  }

  // ---------------- right: design-tool glyphs ----------------
  const art = [];
  // bezier with handles, dragged by a cursor (SMIL so path + handle + cursor stay in lockstep)
  const Ap = [634, 236], Bp = [946, 88], C1 = [790, 236];
  const K = [[798, 88], [842, 50], [770, 118]];
  const dOf = (c2) => `M${Ap[0]} ${Ap[1]}C${C1[0]} ${C1[1]} ${c2[0]} ${c2[1]} ${Bp[0]} ${Bp[1]}`;
  const seq = [K[0], K[0], K[1], K[1], K[2], K[2], K[0]];
  const kt = '0;.08;.34;.44;.7;.8;1';
  const ks = '0 0 1 1;.5 0 .25 1;0 0 1 1;.5 0 .25 1;0 0 1 1;.5 0 .25 1';
  const DUR = 11;
  const smil = (attr, vals) => `<animate attributeName="${attr}" dur="${DUR}s" repeatCount="indefinite" calcMode="spline" keyTimes="${kt}" keySplines="${ks}" values="${vals}"/>`;
  D.push(`<linearGradient id="cv" gradientUnits="userSpaceOnUse" x1="${Ap[0]}" y1="${Ap[1]}" x2="${Bp[0]}" y2="${Bp[1]}">${gradStops(th.accent)}</linearGradient>`);
  D.push(`<linearGradient id="tg" x1="0" x2="1">${gradStops([th.accent[0], th.me])}</linearGradient>`);

  const handleCol = dk ? 'rgba(255,255,255,0.45)' : 'rgba(16,12,40,0.38)';
  const anchorFill = dk ? th.bg : '#ffffff';
  const tagRun = await Tk.run('Shishir', { w: 600, size: 11, x: 0, y: 0 });
  const bez = (animated) => {
    const c2 = K[0];
    const an = (attr, vals) => animated ? smil(attr, vals) : '';
    let s = '';
    s += `<path d="${dOf(c2)}" fill="none" stroke="url(#cv)" stroke-width="13" stroke-opacity="${dk ? .14 : .10}" stroke-linecap="round">${an('d', seq.map(dOf).join(';'))}</path>`;
    s += `<path d="${dOf(c2)}" fill="none" stroke="url(#cv)" stroke-width="3" stroke-linecap="round">${an('d', seq.map(dOf).join(';'))}</path>`;
    s += `<path d="M${Ap[0]} ${Ap[1]}H${C1[0]}" stroke="${handleCol}" stroke-width="1"/>`;
    s += `<line x1="${Bp[0]}" y1="${Bp[1]}" x2="${c2[0]}" y2="${c2[1]}" stroke="${handleCol}" stroke-width="1">${an('x2', seq.map(p => p[0]).join(';'))}${an('y2', seq.map(p => p[1]).join(';'))}</line>`;
    s += `<rect x="${Ap[0] - 5}" y="${Ap[1] - 5}" width="10" height="10" rx="2" fill="${anchorFill}" stroke="${th.accent[0]}" stroke-width="1.5"/>`;
    s += `<rect x="${Bp[0] - 5}" y="${Bp[1] - 5}" width="10" height="10" rx="2" fill="${th.accent[2]}" stroke="${dk ? '#fff' : '#fff'}" stroke-width="1.5"/>`;
    s += `<circle cx="${C1[0]}" cy="${C1[1]}" r="4.5" fill="${anchorFill}" stroke="${th.accent[0]}" stroke-width="1.5"/>`;
    s += `<circle cx="${c2[0]}" cy="${c2[1]}" r="5" fill="${th.accent[1]}" stroke="#fff" stroke-width="1.5">${an('cx', seq.map(p => p[0]).join(';'))}${an('cy', seq.map(p => p[1]).join(';'))}</circle>`;
    // cursor + name tag
    const tagW = tagRun.width + 16;
    let cur = `<path d="${CURSOR}" fill="${th.me}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>`;
    cur += `<rect x="11" y="17" width="${r2(tagW)}" height="20" rx="10" fill="url(#tg)"/>`;
    cur += `<g transform="translate(19 ${r2(27 + 11 * 0.727 / 2)}) scale(${r3(tagRun.k)})" fill="#fff">${tagRun.uses(G)}</g>`;
    const tr = (p) => `${p[0] + 3} ${p[1] + 3}`;
    s += `<g transform="translate(${tr(c2)})">${animated ? `<animateTransform attributeName="transform" type="translate" dur="${DUR}s" repeatCount="indefinite" calcMode="spline" keyTimes="${kt}" keySplines="${ks}" values="${seq.map(tr).join(';')}"/>` : ''}${cur}</g>`;
    return s;
  };
  art.push(`<g class="ra">${bez(true)}</g><g class="rs">${bez(false)}</g>`);

  // floating tool tiles
  D.push(`<linearGradient id="ic" x1="0" y1="0" x2="1" y2="1">${gradStops([th.accent[0], th.accent[1], th.accent[2]])}</linearGradient>`);
  D.push(`<linearGradient id="th" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${dk ? .35 : 0}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  D.push(`<radialGradient id="shd"><stop offset="0" stop-color="#2a1f5c" stop-opacity="${dk ? .5 : .16}"/><stop offset="1" stop-color="#2a1f5c" stop-opacity="0"/></radialGradient>`);
  const tile = (cx, cy, icon, cls) => {
    const s = 54, x = cx - s / 2, y = cy - s / 2;
    return `<g class="${cls}"><ellipse cx="${cx}" cy="${cy + 30}" rx="30" ry="8" fill="url(#shd)"/>` +
      `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="15" fill="${dk ? 'rgba(22,19,36,0.82)' : 'rgba(255,255,255,0.92)'}" stroke="${dk ? 'rgba(255,255,255,0.13)' : 'rgba(16,12,40,0.10)'}"/>` +
      `<rect x="${x + 12}" y="${y + .5}" width="${s - 24}" height="1" fill="url(#th)"/>` +
      `<g transform="translate(${cx - 12} ${cy - 12})" fill="none" stroke="url(#ic)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</g></g>`;
  };
  const penIcon = `<path d="M12 21.4 6.6 12.3 9.3 5.4h5.4l2.7 6.9z"/><path d="M12 21.4v-7.2"/><circle cx="12" cy="12.6" r="1.7"/><path d="M9.3 5.4V2.8h5.4v2.6"/>`;
  const frameIcon = `<path d="M8 3.5v17M16 3.5v17M3.5 8h17M3.5 16h17"/>`;
  art.push(tile(684, 96, penIcon, 'ta'));
  art.push(tile(904, 222, frameIcon, 'tb'));
  A.add('.ta', 7, [[0, { y: 0, r: 0 }, 'sio'], [3.5, { y: -8, r: -4 }, 'sio'], [7, { y: 0, r: 0 }]], { offset: 1, extra: 'transform-box:fill-box;transform-origin:center' });
  A.add('.tb', 8.5, [[0, { y: 0, r: 0 }, 'sio'], [4.25, { y: 7, r: 3 }, 'sio'], [8.5, { y: 0, r: 0 }]], { offset: 3, extra: 'transform-box:fill-box;transform-origin:center' });

  // twinkles
  const tw = [[606, 158, 5, 3.6, 0], [726, 36, 4, 4.4, 1.2], [972, 160, 4.5, 5.2, 2.5], [842, 270, 3.5, 4, .7], [560, 52, 3, 4.8, 3.1]];
  tw.forEach(([x, y, r, T, o], i) => {
    art.push(`<path class="w${i}" d="${star4(x, y, r)}" fill="${i % 2 ? th.accent[2] : (dk ? '#ffffff' : th.accent[0])}"/>`);
    A.add(`.w${i}`, T, [[0, { o: .25, s: .7 }, 'sio'], [T / 2, { o: dk ? .95 : .8, s: 1 }, 'sio'], [T, { o: .25, s: .7 }]], { offset: o, extra: 'transform-box:fill-box;transform-origin:center' });
  });

  // ---------------- assemble ----------------
  const topHi = dk ? `<rect x="40" y="0" width="${W - 80}" height="1" fill="url(#th2)"/>` : '';
  D.push(`<linearGradient id="th2" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  const body = `<g clip-path="url(#cl)"><rect width="${W}" height="${H}" fill="${th.bg}"/>${au}${B.slice(0, 2).join('')}${art.join('')}${B.slice(2).join('')}${topHi}</g>` +
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="19.5" fill="none" stroke="${th.border}"/>`;
  const defs = D.join('') + G.defs();
  return svgDoc({
    w: W, h: H,
    title: 'Hi, I’m Shishir',
    desc: 'Animated banner: Hi, I’m Shishir. Web developer and system engineer, building Evora (an open-source design tool), exploring AI agents and Gen AI, crafting mind-blowing websites.',
    style: A.text(), defs, body,
  });
}

module.exports = { banner };
