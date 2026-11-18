'use strict';
const Tk = require('./textkit.js');
const { Anim, r2, r3, gradStops, svgDoc, evoraLogo } = require('./common.js');

const CURSOR = 'M0 0V16.2L4.4 12.2 7.3 18.8 10 17.6 7.2 11.1H12.9Z';

async function wrap(str, w, size, maxW, ls = 0) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const cand = cur ? cur + ' ' + wd : wd;
    const m = await Tk.measure(cand, w, ls);
    if (m.width * size / Tk.UPM > maxW && cur) { lines.push(cur); cur = wd; } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function evora(th) {
  const W = 1000, H = 360;
  const dk = th.dark;
  const G = new Tk.Glyphs('Q');
  const A = new Anim('k');
  const D = [], B = [];
  const txt = async (s, o, attrs) => (await Tk.run(s, o)).svg(G, attrs);

  D.push(`<clipPath id="cl"><rect width="${W}" height="${H}" rx="20"/></clipPath>`);
  // background glows
  const glows = [
    [120, 20, 330, 210, '#7c5cff', dk ? .42 : .22, 24, 40, 20],
    [300, 380, 300, 150, '#2a62ff', dk ? .20 : .10, 30, 60, -10],
    [800, 395, 380, 190, '#ef67a8', dk ? .26 : .18, 26, -60, -10],
    [1010, 0, 260, 170, '#ff9d5c', dk ? .18 : .20, 22, -30, 20],
  ];
  let gl = '';
  glows.forEach(([cx, cy, rx, ry, c, o, T, dx, dy], i) => {
    D.push(`<radialGradient id="a${i}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".4" stop-color="${c}" stop-opacity="${r3(o * .55)}"/><stop offset=".75" stop-color="${c}" stop-opacity="${r3(o * .15)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    gl += `<ellipse class="b${i}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#a${i})"/>`;
    A.add(`.b${i}`, T, [[0, { x: 0, y: 0, s: 1 }, 'sio'], [T / 2, { x: dx, y: dy, s: 1.08 }, 'sio'], [T, { x: 0, y: 0, s: 1 }]], { offset: T * i * .29, extra: 'transform-box:fill-box;transform-origin:center' });
  });
  D.push(`<linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">${gradStops(th.accent)}</linearGradient>`);
  D.push(`<linearGradient id="acc3" x1="0" y1="0" x2="1" y2="1">${gradStops([th.accent[0], th.accent[1], th.accent[2]])}</linearGradient>`);
  D.push(`<linearGradient id="hi" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${dk ? .22 : 0}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);

  // ---------------- left column ----------------
  const X = 44;
  // eyebrow
  const sp = (cx, cy, r) => { const q = r * .17; return `M${cx} ${cy - r}Q${r2(cx + q)} ${r2(cy - q)} ${cx + r} ${cy}Q${r2(cx + q)} ${r2(cy + q)} ${cx} ${cy + r}Q${r2(cx - q)} ${r2(cy + q)} ${cx - r} ${cy}Q${r2(cx - q)} ${r2(cy - q)} ${cx} ${cy - r}Z`; };
  B.push(`<path d="${sp(X + 5, 51, 5.5)}" fill="url(#acc3)"/>`);
  B.push(await txt('FEATURED PROJECT', { w: 700, size: 11, ls: .16, x: X + 17, y: 55 }, `fill="${th.accentText}"`));
  // app tile + logo
  const ty = 74, ts = 66;
  D.push(`<radialGradient id="tglow" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="${th.accent[0]}" stop-opacity="${dk ? .35 : .12}"/><stop offset="1" stop-color="${th.accent[0]}" stop-opacity="0"/></radialGradient>`);
  B.push(`<rect x="${X}" y="${ty}" width="${ts}" height="${ts}" rx="18" fill="${dk ? '#15122a' : '#ffffff'}" stroke="${dk ? 'rgba(255,255,255,0.12)' : 'rgba(16,12,40,0.10)'}"/>`);
  B.push(`<rect x="${X}" y="${ty}" width="${ts}" height="${ts}" rx="18" fill="url(#tglow)"/>`);
  B.push(`<rect x="${X + 14}" y="${ty + .5}" width="${ts - 28}" height="1" fill="url(#hi)"/>`);
  B.push(evoraLogo(X + 12, ty + 12, ts - 24, 'L'));
  // title + repo path
  B.push(await txt('Evora', { w: 800, size: 40, ls: -0.03, x: X + ts + 18, y: ty + 37 }, `fill="${th.text}"`));
  B.push(await txt('github.com/ShishirShastry/evora', { w: 500, size: 12.5, x: X + ts + 19, y: ty + 59 }, `fill="${th.muted}"`));

  // description
  const desc = 'A free, open-source, local-first design and prototyping tool';
  const lines = await wrap(desc, 400, 17, 400);
  let dy = 186;
  for (const ln of lines) { B.push(await txt(ln, { w: 400, size: 17, x: X, y: dy }, `fill="${th.text}" fill-opacity="${dk ? .9 : .88}"`)); dy += 25; }

  // features 2x2
  const feats = [
    ['Real-time collaboration', '<circle cx="6" cy="5.2" r="2.3"/><path d="M1.8 13.2c.5-2.4 2.1-3.7 4.2-3.7s3.7 1.3 4.2 3.7"/><circle cx="11.6" cy="5.8" r="1.9"/><path d="M11.7 9.6c1.6.1 2.6 1.2 3 3.1"/>'],
    ['Prototyping', '<rect x="1.6" y="2.4" width="12.8" height="11.2" rx="3"/><path d="M6.6 5.9v4.2l3.4-2.1z" fill="url(#acc3)" stroke="none"/>'],
    ['Developer handoff', '<path d="M5.4 4.4 1.8 8l3.6 3.6M10.6 4.4 14.2 8l-3.6 3.6M9 3.2 7 12.8"/>'],
    ['Team libraries', '<path d="M8 1.8 14.2 5 8 8.2 1.8 5z"/><path d="M1.8 8.1 8 11.3l6.2-3.2M1.8 11.1 8 14.3l6.2-3.2"/>'],
  ];
  const fy0 = dy + 13;
  for (let i = 0; i < feats.length; i++) {
    const cx = X + (i % 2) * 196, cy = fy0 + Math.floor(i / 2) * 27;
    B.push(`<g transform="translate(${cx} ${cy - 12})" fill="none" stroke="url(#acc3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${feats[i][1]}</g>`);
    B.push(await txt(feats[i][0], { w: 500, size: 13.5, x: cx + 24, y: cy }, `fill="${th.muted}"`));
  }
  // badges
  const by = fy0 + 2 * 27 + 4, bh = 26;
  const badges = [
    ['v0.2.0', `<circle cx="6" cy="6" r="3.2" fill="${th.success}" stroke="none"/>`, true],
    ['MIT', '<path d="M6 1.8v8.6M3.2 10.4h5.6M2 3.6h8M2 3.6 .6 7h2.8zM10 3.6 8.6 7h2.8z"/>'],
    ['Windows', '<rect x="1" y="1.8" width="10" height="6.8" rx="1.4"/><path d="M4 10.6h4M6 8.6v2"/>'],
    ['Open source', '<path d="M4 3.2 1.2 6 4 8.8M8 3.2 10.8 6 8 8.8"/>'],
  ];
  let bx = X;
  for (const [label, icon, strong] of badges) {
    const r = await Tk.run(label, { w: 600, size: 12, x: 0, y: 0 });
    const bw = 10 + 12 + 6 + r.width + 11;
    B.push(`<rect x="${r2(bx)}" y="${by}" width="${r2(bw)}" height="${bh}" rx="${bh / 2}" fill="${dk ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.85)'}" stroke="${strong ? (dk ? 'rgba(61,220,151,0.35)' : 'rgba(18,163,106,0.35)') : th.border}"/>`);
    B.push(`<g transform="translate(${r2(bx + 10)} ${by + 7})" fill="none" stroke="${th.muted}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${icon}</g>`);
    const rr = await Tk.run(label, { w: 600, size: 12, x: bx + 28, y: by + bh / 2 + 4.36 });
    B.push(rr.svg(G, `fill="${th.text}" fill-opacity=".9"`));
    bx += bw + 8;
  }

  // ---------------- right: animated editor ----------------
  const wx = 482, wy = 24, ww = 494, wh = 312;
  const T = 10, P0 = 7.2;
  const E = [];
  const C = {
    win: dk ? '#100e1a' : '#ffffff',
    bar: dk ? '#161424' : '#f7f6fb',
    panel: dk ? '#121020' : '#fbfaff',
    canvas: dk ? '#0b0a13' : '#f1f0f6',
    line: dk ? 'rgba(255,255,255,0.08)' : 'rgba(16,12,40,0.08)',
    frame: dk ? '#1a1730' : '#ffffff',
    frameLine: dk ? 'rgba(255,255,255,0.10)' : 'rgba(16,12,40,0.10)',
    sk: dk ? 'rgba(255,255,255,0.80)' : 'rgba(22,19,31,0.82)',
    sk2: dk ? 'rgba(255,255,255,0.28)' : 'rgba(22,19,31,0.22)',
    sk3: dk ? 'rgba(255,255,255,0.08)' : 'rgba(22,19,31,0.06)',
    field: dk ? 'rgba(255,255,255,0.06)' : 'rgba(16,12,40,0.05)',
    proto: dk ? '#5b8cff' : '#2a62ff',
  };
  D.push(`<clipPath id="wc"><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="14"/></clipPath>`);
  D.push(`<pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".9" fill="${dk ? 'rgba(255,255,255,0.10)' : 'rgba(16,12,40,0.10)'}"/></pattern>`);
  // window shadow
  D.push(`<radialGradient id="wsh"><stop offset="0" stop-color="${dk ? '#000' : '#2a1f5c'}" stop-opacity="${dk ? .55 : .14}"/><stop offset="1" stop-color="${dk ? '#000' : '#2a1f5c'}" stop-opacity="0"/></radialGradient>`);
  E.push(`<ellipse cx="${wx + ww / 2}" cy="${wy + wh - 6}" rx="${ww / 2 + 10}" ry="26" fill="url(#wsh)"/>`);
  E.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="14" fill="${C.win}"/>`);
  const inner = [];
  // title bar
  const tbh = 32;
  inner.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${tbh}" fill="${C.bar}"/><path d="M${wx} ${wy + tbh}h${ww}" stroke="${C.line}"/>`);
  inner.push(evoraLogo(wx + 12, wy + 9, 14, 'M'));
  inner.push(await txt('Evora', { w: 700, size: 11, x: wx + 32, y: wy + 20 }, `fill="${th.text}"`));
  const tSlash = await Tk.run('/', { w: 400, size: 11, x: wx + 70, y: wy + 20 });
  inner.push(tSlash.svg(G, `fill="${th.faint}"`));
  inner.push(await txt('Landing page', { w: 500, size: 11, x: wx + 80, y: wy + 20 }, `fill="${th.muted}"`));
  // presence avatars + share + window controls
  const avx = wx + ww - 150;
  const av = async (cx, col, ch, ink) => `<circle cx="${cx}" cy="${wy + 16}" r="9" fill="${col}" stroke="${C.bar}" stroke-width="2"/>` + await txt(ch, { w: 700, size: 9.5, x: cx, y: wy + 19.4, anchor: 'middle' }, `fill="${ink}"`);
  inner.push(await av(avx + 13, th.alex, 'A', th.alexInk));
  inner.push(await av(avx, th.me, 'S', '#ffffff'));
  inner.push(`<rect x="${avx + 30}" y="${wy + 7}" width="44" height="18" rx="9" fill="${th.sel}"/>`);
  inner.push(await txt('Share', { w: 600, size: 9.5, x: avx + 52, y: wy + 19.4, anchor: 'middle' }, 'fill="#fff"'));
  const wcx = wx + ww - 62;
  inner.push(`<g stroke="${th.muted}" stroke-width="1.1" fill="none" stroke-linecap="round"><path d="M${wcx} ${wy + 16}h8"/><rect x="${wcx + 20}" y="${wy + 12}" width="8" height="8" rx="1"/><path d="M${wcx + 40} ${wy + 12}l8 8m0-8-8 8"/></g>`);

  // panels
  const by0 = wy + tbh, bodyH = wh - tbh;
  const lpW = 116, rpW = 124;
  const cx0 = wx + lpW, cw = ww - lpW - rpW;
  inner.push(`<rect x="${cx0}" y="${by0}" width="${cw}" height="${bodyH}" fill="${C.canvas}"/><rect x="${cx0}" y="${by0}" width="${cw}" height="${bodyH}" fill="url(#dots)"/>`);
  inner.push(`<rect x="${wx}" y="${by0}" width="${lpW}" height="${bodyH}" fill="${C.panel}"/><path d="M${cx0 - .5} ${by0}v${bodyH}" stroke="${C.line}"/>`);
  inner.push(`<rect x="${cx0 + cw}" y="${by0}" width="${rpW}" height="${bodyH}" fill="${C.panel}"/><path d="M${cx0 + cw + .5} ${by0}v${bodyH}" stroke="${C.line}"/>`);

  // ---- layers panel
  inner.push(await txt('Layers', { w: 700, size: 10, x: wx + 12, y: by0 + 20 }, `fill="${th.text}"`));
  inner.push(`<path d="M${wx + lpW - 22} ${by0 + 16.5}h8M${wx + lpW - 18} ${by0 + 12.5}v8" stroke="${th.muted}" stroke-width="1.1" stroke-linecap="round"/>`);
  const icons = {
    frame: '<path d="M2.8 0v9M6.2 0v9M0 2.8h9M0 6.2h9"/>',
    rect: '<rect x=".5" y=".5" width="8" height="8" rx="1.6"/>',
    text: '<path d="M1 1.2h7M4.5 1.2v7"/>',
    ellipse: '<circle cx="4.5" cy="4.5" r="4"/>',
  };
  const rows = [['frame', 'Home', 0], ['rect', 'Hero', 1], ['text', 'Title', 1], ['rect', 'Button', 1], ['frame', 'Profile', 0], ['ellipse', 'Avatar', 1], ['text', 'Name', 1], ['rect', 'Stats', 1]];
  const ry0 = by0 + 30, rh = 22;
  const HERO_ROW = 1;
  for (let i = 0; i < rows.length; i++) {
    const [ic, name, ind] = rows[i];
    const y = ry0 + i * rh;
    let g = '';
    if (i === HERO_ROW) {
      g += `<rect class="rhl" x="${wx + 6}" y="${y + 1}" width="${lpW - 12}" height="${rh - 2}" rx="6" fill="${th.sel}" fill-opacity="${dk ? .24 : .14}"/>`;
    }
    const ix = wx + 12 + ind * 12;
    if (!ind) g += `<path d="M${ix} ${y + 9.5}l2.5 2.5 2.5-2.5" fill="none" stroke="${th.faint}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
    const ix2 = ix + (ind ? 0 : 10);
    g += `<g transform="translate(${ix2} ${y + 6.5})" fill="none" stroke="${ind ? th.muted : th.accentText}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${icons[ic]}</g>`;
    g += await txt(name, { w: ind ? 500 : 600, size: 10, x: ix2 + 15, y: y + 14.6 }, `fill="${th.text}" fill-opacity="${ind ? .78 : .95}"`);
    inner.push(`<g class="r${i}">${g}</g>`);
    // row enter / exit
    const t0 = 0.25 + i * 0.075;
    A.add(`.r${i}`, T, [[0, { o: 0, x: -12 }], [t0, { o: 0, x: -12 }, 'o'], [t0 + .5, { o: 1, x: 0 }], [9.35, { o: 1, x: 0 }, 'io'], [9.75, { o: 0, x: -8 }], [T, { o: 0, x: -12 }]], { offset: P0 });
  }
  // ---- frames on canvas
  const fw = 94, fh = 178, gap = 22;
  const f1x = cx0 + (cw - (2 * fw + gap)) / 2, f2x = f1x + fw + gap, fy = by0 + 34;
  inner.push(await txt('Home', { w: 500, size: 9, x: f1x + 1, y: fy - 6 }, `fill="${th.muted}"`));
  inner.push(await txt('Profile', { w: 500, size: 9, x: f2x + 1, y: fy - 6 }, `fill="${th.muted}"`));
  D.push(`<linearGradient id="h1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#2a62ff"/></linearGradient>`);
  D.push(`<linearGradient id="h2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef67a8"/><stop offset="1" stop-color="#ff9d5c"/></linearGradient>`);
  D.push(`<linearGradient id="cov" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a62ff"/><stop offset="1" stop-color="#00e4ff"/></linearGradient>`);
  const frameBox = (x) => `<rect x="${x}" y="${fy}" width="${fw}" height="${fh}" rx="12" fill="${C.frame}" stroke="${C.frameLine}"/>`;
  // frame 1 (Home)
  const hx = f1x + 8, hy = fy + 24, hw = 78, hh = 54;
  let f1 = frameBox(f1x);
  f1 += `<circle cx="${f1x + 13}" cy="${fy + 13}" r="3.2" fill="url(#acc3)"/><rect x="${f1x + 56}" y="${fy + 11.5}" width="12" height="3" rx="1.5" fill="${C.sk2}"/><rect x="${f1x + 72}" y="${fy + 11.5}" width="13" height="3" rx="1.5" fill="${C.sk2}"/>`;
  f1 += `<rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="8" fill="url(#h1)"/>`;
  f1 += `<rect class="hf" x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="8" fill="url(#h2)"/>`;
  f1 += `<g fill="#fff" fill-opacity=".55"><circle cx="${hx + 58}" cy="${hy + 15}" r="5"/><path d="M${hx + 8} ${hy + hh - 8}l16-18 12 12 8-7 14 13z"/></g>`;
  f1 += `<rect x="${f1x + 8}" y="${fy + 90}" width="66" height="6" rx="3" fill="${C.sk}"/><rect x="${f1x + 8}" y="${fy + 101}" width="46" height="6" rx="3" fill="${C.sk}"/>`;
  f1 += `<rect x="${f1x + 8}" y="${fy + 115}" width="72" height="3.5" rx="1.75" fill="${C.sk2}"/><rect x="${f1x + 8}" y="${fy + 122}" width="54" height="3.5" rx="1.75" fill="${C.sk2}"/>`;
  const btnX = f1x + 8, btnY = fy + 135;
  f1 += `<rect x="${btnX}" y="${btnY}" width="44" height="16" rx="8" fill="${th.sel}"/><rect x="${btnX + 9}" y="${btnY + 6.5}" width="26" height="3" rx="1.5" fill="#fff" fill-opacity=".9"/>`;
  f1 += `<rect x="${btnX + 50}" y="${btnY}" width="28" height="16" rx="8" fill="none" stroke="${C.sk2}"/>`;
  f1 += `<g fill="${C.sk2}"><circle cx="${f1x + 26}" cy="${fy + 166}" r="2.2"/><circle cx="${f1x + 47}" cy="${fy + 166}" r="2.2"/><circle cx="${f1x + 68}" cy="${fy + 166}" r="2.2"/></g>`;
  inner.push(f1);
  // frame 2 (Profile)
  let f2 = frameBox(f2x);
  f2 += `<rect x="${f2x + 6}" y="${fy + 6}" width="${fw - 12}" height="30" rx="7" fill="url(#cov)" fill-opacity=".85"/>`;
  const avc = [f2x + fw / 2, fy + 40];
  f2 += `<circle cx="${avc[0]}" cy="${avc[1]}" r="14" fill="url(#acc)" stroke="${C.frame}" stroke-width="3"/>`;
  f2 += `<rect x="${f2x + 27}" y="${fy + 62}" width="40" height="6" rx="3" fill="${C.sk}"/><rect x="${f2x + 33}" y="${fy + 73}" width="28" height="3.5" rx="1.75" fill="${C.sk2}"/>`;
  for (let i = 0; i < 3; i++) f2 += `<rect x="${f2x + 9 + i * 26}" y="${fy + 86}" width="24" height="20" rx="5" fill="${C.sk3}"/><rect x="${f2x + 14 + i * 26}" y="${fy + 92}" width="14" height="3.5" rx="1.75" fill="${C.sk}"/><rect x="${f2x + 14 + i * 26}" y="${fy + 99}" width="9" height="2.5" rx="1.25" fill="${C.sk2}"/>`;
  for (let i = 0; i < 3; i++) f2 += `<circle cx="${f2x + 15}" cy="${fy + 120 + i * 15}" r="4" fill="${C.sk3}" stroke="${C.sk2}" stroke-width=".8"/><rect x="${f2x + 24}" y="${fy + 118.5 + i * 15}" width="${50 - i * 8}" height="3.5" rx="1.75" fill="${C.sk2}"/>`;
  f2 += `<rect x="${f2x + 25}" y="${fy + 160}" width="44" height="12" rx="6" fill="url(#cov)"/>`;
  inner.push(f2);
  // prototype connection (flowing dashes)
  const p0 = [btnX + 44, btnY + 8], p1 = [f2x - 1, fy + 64];
  const nd = `M${p0[0]} ${p0[1]}C${p0[0] + 26} ${p0[1]} ${p1[0] - 22} ${p1[1]} ${p1[0] - 5} ${p1[1]}`;
  inner.push(`<circle cx="${p0[0]}" cy="${p0[1]}" r="2.6" fill="${C.proto}" stroke="${C.frame}" stroke-width="1"/>`);
  inner.push(`<path d="${nd}" fill="none" stroke="${C.proto}" stroke-width="1.6" stroke-linecap="round" class="nd" stroke-dasharray="4 4"/>`);
  inner.push(`<path d="M${p1[0] - 6} ${p1[1] - 4}l5 4-5 4z" fill="${C.proto}"/>`);
  A.css.push(`@keyframes nd{to{stroke-dashoffset:-16}}.nd{animation:nd 1s linear infinite}`);

  // ---- toolbar
  const tbw = 136, tbx = cx0 + (cw - tbw) / 2, tby = by0 + bodyH - 40;
  inner.push(`<rect x="${tbx}" y="${tby}" width="${tbw}" height="28" rx="10" fill="${C.frame}" stroke="${C.frameLine}"/>`);
  const tools = [
    `<path d="M0 0v10.5l2.9-2.6 1.9 4.3 1.8-.8-1.9-4.2h3.8z" transform="translate(3.6 1.8)" fill="#fff" stroke="none"/>`,
    `<path d="M4.5 1.5v11M9.5 1.5v11M1.5 4.5h11M1.5 9.5h11"/>`,
    `<rect x="2" y="2" width="10" height="10" rx="2"/>`,
    `<path d="M7 12.6 3.6 7 5.3 2.6h3.4L10.4 7zM7 12.6V8.4"/><circle cx="7" cy="7.4" r="1"/>`,
    `<path d="M2.5 2.5h9M7 2.5v9.5"/>`,
  ];
  tools.forEach((ic, i) => {
    const x = tbx + 8 + i * 25.5;
    if (i === 0) inner.push(`<rect x="${x - 3}" y="${tby + 4}" width="20" height="20" rx="7" fill="${th.sel}"/>`);
    inner.push(`<g transform="translate(${x} ${tby + 7})" fill="none" stroke="${th.muted}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${ic}</g>`);
  });

  // ---- inspector
  const ix0 = cx0 + cw + 12;
  inner.push(await txt('Design', { w: 700, size: 10, x: ix0, y: by0 + 20 }, `fill="${th.text}"`));
  inner.push(await txt('Prototype', { w: 500, size: 10, x: ix0 + 44, y: by0 + 20 }, `fill="${th.muted}"`));
  inner.push(`<rect x="${ix0}" y="${by0 + 26}" width="35" height="2" rx="1" fill="${th.sel}"/>`);
  inner.push(`<path d="M${cx0 + cw} ${by0 + 31.5}h${rpW}" stroke="${C.line}"/>`);
  let insp = '';
  insp += await txt('Hero', { w: 600, size: 10, x: ix0, y: by0 + 50 }, `fill="${th.text}"`);
  insp += await txt('Rectangle', { w: 500, size: 9, x: ix0 + 100, y: by0 + 50, anchor: 'end' }, `fill="${th.faint}"`);
  const field = async (x, y, lab, val, w = 47) => `<rect x="${x}" y="${y}" width="${w}" height="20" rx="5" fill="${C.field}"/>` +
    await txt(lab, { w: 500, size: 9, x: x + 7, y: y + 13.3 }, `fill="${th.faint}"`) + await txt(val, { w: 500, size: 9.5, x: x + 19, y: y + 13.4 }, `fill="${th.text}" fill-opacity=".9"`);
  insp += await field(ix0, by0 + 60, 'X', '16') + await field(ix0 + 53, by0 + 60, 'Y', '72');
  insp += await field(ix0, by0 + 86, 'W', '78') + await field(ix0 + 53, by0 + 86, 'H', '54');
  insp += await txt('Fill', { w: 600, size: 10, x: ix0, y: by0 + 128 }, `fill="${th.text}"`);
  insp += `<rect x="${ix0}" y="${by0 + 136}" width="100" height="22" rx="6" fill="${C.field}"/>`;
  insp += `<rect x="${ix0 + 5}" y="${by0 + 141}" width="12" height="12" rx="3.5" fill="url(#h1)"/><rect class="hf" x="${ix0 + 5}" y="${by0 + 141}" width="12" height="12" rx="3.5" fill="url(#h2)"/>`;
  insp += await txt('Linear', { w: 500, size: 9.5, x: ix0 + 23, y: by0 + 150.4 }, `fill="${th.text}" fill-opacity=".9"`);
  insp += await txt('100%', { w: 500, size: 9, x: ix0 + 95, y: by0 + 150.4, anchor: 'end' }, `fill="${th.faint}"`);
  insp += await txt('Palette', { w: 600, size: 10, x: ix0, y: by0 + 182 }, `fill="${th.text}"`);
  const pal = [['#7c5cff', '#2a62ff'], ['#a63cff', '#7c5cff'], ['#ef67a8', '#ff9d5c'], ['#00e4ff', '#2a62ff'], ['#3ddc97', '#12a36a']];
  pal.forEach(([a, b], i) => {
    D.push(`<linearGradient id="p${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`);
    insp += `<rect x="${ix0 + i * 20.5}" y="${by0 + 190}" width="16" height="16" rx="5" fill="url(#p${i})"/>`;
  });
  const swi = 2, swx = ix0 + swi * 20.5 + 8, swy = by0 + 198;
  insp += `<rect class="swr" x="${swx - 10.5}" y="${swy - 10.5}" width="21" height="21" rx="7" fill="none" stroke="${th.text}" stroke-width="1.4"/>`;
  insp += await txt('Corner radius', { w: 600, size: 10, x: ix0, y: by0 + 230 }, `fill="${th.text}"`);
  insp += `<rect x="${ix0}" y="${by0 + 238}" width="100" height="20" rx="5" fill="${C.field}"/><path d="M${ix0 + 7} ${by0 + 253}v-5a3 3 0 0 1 3-3h5" fill="none" stroke="${th.faint}" stroke-width="1.1" stroke-linecap="round"/>`;
  insp += await txt('8', { w: 500, size: 9.5, x: ix0 + 22, y: by0 + 251.4 }, `fill="${th.text}" fill-opacity=".9"`);
  inner.push(`<g class="insp">${insp}</g>`);

  // ---- selection (hero)
  const hs = 6;
  let sel = `<rect x="${hx - .5}" y="${hy - .5}" width="${hw + 1}" height="${hh + 1}" fill="none" stroke="${th.sel}" stroke-width="1.5"/>`;
  for (const [x, y] of [[hx, hy], [hx + hw, hy], [hx, hy + hh], [hx + hw, hy + hh]]) sel += `<rect x="${x - hs / 2}" y="${y - hs / 2}" width="${hs}" height="${hs}" rx="1" fill="#fff" stroke="${th.sel}" stroke-width="1.3"/>`;
  const dimR = await Tk.run('78 × 54', { w: 600, size: 8.5, x: hx + hw / 2, y: hy + hh + 15.2, anchor: 'middle' });
  sel += `<rect x="${r2(hx + hw / 2 - dimR.width / 2 - 6)}" y="${hy + hh + 6}" width="${r2(dimR.width + 12)}" height="13" rx="4" fill="${th.sel}"/>` + dimR.svg(G, 'fill="#fff"');
  inner.push(`<g class="sel">${sel}</g>`);
  // ---- Alex hover outlines
  inner.push(`<circle class="ha" cx="${avc[0]}" cy="${avc[1]}" r="16.5" fill="none" stroke="${th.alex}" stroke-width="1.5"/>`);
  inner.push(`<rect class="hn" x="${f2x + 23.5}" y="${fy + 58.5}" width="47" height="21" rx="3" fill="none" stroke="${th.alex}" stroke-width="1.5"/>`);
  inner.push(`<rect class="hs" x="${f2x + 6.5}" y="${fy + 83.5}" width="${fw - 13}" height="25" rx="6" fill="none" stroke="${th.alex}" stroke-width="1.5"/>`);

  // ---- cursors
  const tagRun = async (name, ink) => {
    const r = await Tk.run(name, { w: 600, size: 10.5, x: 0, y: 0 });
    return { w: r.width + 14, svg: `<g transform="translate(18 ${r2(26.4 + 10.5 * .727 / 2)}) scale(${r3(r.k)})" fill="${ink}">${r.uses(G)}</g>` };
  };
  D.push(`<linearGradient id="tgS" x1="0" x2="1"><stop offset="0" stop-color="${th.me}"/><stop offset="1" stop-color="${th.accent[0]}"/></linearGradient>`);
  const tS = await tagRun('Shishir', '#fff');
  const tA = await tagRun('Alex', th.alexInk);
  const cursorSvg = (col, tag, fill) => `<path d="${CURSOR}" fill="${col}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><rect x="11" y="17" width="${r2(tag.w)}" height="19" rx="9.5" fill="${fill}"/>${tag.svg}`;
  // Shishir path
  const R0 = [cx0 + 40, wy + wh + 14], R1 = [hx + 46, hy + 32], R2 = [swx + 1, swy + 2], R3 = [hx + 16, hy + 13];
  const sF = [
    [0, { x: R0[0], y: R0[1], s: 1 }],
    [1.3, { x: R0[0], y: R0[1], s: 1 }, 'io'],
    [2.45, { x: R1[0], y: R1[1], s: 1 }, 'io'],
    [2.55, { x: R1[0], y: R1[1], s: .8 }, 'o'],
    [2.8, { x: R1[0], y: R1[1], s: 1 }],
    [3.4, { x: R1[0], y: R1[1], s: 1 }, 'io'],
    [4.6, { x: R2[0], y: R2[1], s: 1 }, 'io'],
    [4.7, { x: R2[0], y: R2[1], s: .8 }, 'o'],
    [4.95, { x: R2[0], y: R2[1], s: 1 }],
    [5.6, { x: R2[0], y: R2[1], s: 1 }, 'io'],
    [6.7, { x: R3[0], y: R3[1], s: 1 }],
    [7.9, { x: R3[0], y: R3[1], s: 1 }, 'io'],
    [9.0, { x: R0[0], y: R0[1], s: 1 }],
    [T, { x: R0[0], y: R0[1], s: 1 }],
  ];
  A.add('.cs', T, sF, { offset: P0 });
  // Alex path
  const Q0 = [avc[0] + 12, avc[1] + 10], Q1 = [f2x + 64, fy + 72], Q2 = [f2x + 74, fy + 102], Q3 = [f2x + 52, fy + 136];
  const aF = [
    [0, { x: Q0[0], y: Q0[1] }],
    [1.0, { x: Q0[0], y: Q0[1] }, 'io'],
    [2.2, { x: Q1[0], y: Q1[1] }],
    [4.4, { x: Q1[0], y: Q1[1] }, 'io'],
    [5.5, { x: Q2[0], y: Q2[1] }],
    [7.7, { x: Q2[0], y: Q2[1] }, 'io'],
    [8.6, { x: Q3[0], y: Q3[1] }],
    [9.0, { x: Q3[0], y: Q3[1] }, 'io'],
    [9.9, { x: Q0[0], y: Q0[1] }],
    [T, { x: Q0[0], y: Q0[1] }],
  ];
  A.add('.ca', T, aF, { offset: P0 });
  // state animations
  const fade = (sel, pts) => A.add(sel, T, pts.map(([t, o, e]) => [t, { o }, e]), { offset: P0 });
  A.add('.sel', T, [[0, { o: 0, s: .96 }], [2.55, { o: 0, s: .96 }, 'back'], [2.85, { o: 1, s: 1 }], [9.05, { o: 1, s: 1 }, 'io'], [9.35, { o: 0, s: 1 }], [T, { o: 0, s: .96 }]], { offset: P0, extra: 'transform-box:fill-box;transform-origin:center' });
  fade('.rhl', [[0, 0], [2.6, 0, 'o'], [2.9, 1], [9.05, 1, 'io'], [9.35, 0], [T, 0]]);
  fade('.insp', [[0, .35], [2.6, .35, 'o'], [2.9, 1], [9.05, 1, 'io'], [9.35, .35], [T, .35]]);
  fade('.hf', [[0, 0], [4.75, 0, 'io'], [5.3, 1], [9.3, 1, 'io'], [9.8, 0], [T, 0]]);
  fade('.swr', [[0, 0], [4.7, 0, 'o'], [4.95, 1], [9.05, 1, 'io'], [9.35, 0], [T, 0]]);
  fade('.ha', [[0, 1], [1.0, 1, 'io'], [1.2, 0], [9.8, 0, 'io'], [T, 1]]);
  fade('.hn', [[0, 0], [2.2, 0, 'io'], [2.4, 1], [4.4, 1, 'io'], [4.6, 0], [T, 0]]);
  fade('.hs', [[0, 0], [5.5, 0, 'io'], [5.7, 1], [7.7, 1, 'io'], [7.9, 0], [T, 0]]);
  inner.push(`<g class="ca">${cursorSvg(th.alex, tA, th.alex)}</g>`);
  inner.push(`<g class="cs">${cursorSvg(th.me, tS, 'url(#tgS)')}</g>`);

  E.push(`<g clip-path="url(#wc)">${inner.join('')}</g>`);
  E.push(`<rect x="${wx + .5}" y="${wy + .5}" width="${ww - 1}" height="${wh - 1}" rx="13.5" fill="none" stroke="${dk ? 'rgba(255,255,255,0.12)' : 'rgba(16,12,40,0.12)'}"/>`);

  // ---------------- assemble ----------------
  const topHi = dk ? `<rect x="40" y="0" width="${W - 80}" height="1" fill="url(#hi)"/>` : '';
  const body = `<g clip-path="url(#cl)"><rect width="${W}" height="${H}" fill="${th.bg}"/>${gl}${B.join('')}${E.join('')}${topHi}</g>` +
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="19.5" fill="none" stroke="${th.border}"/>`;
  return svgDoc({
    w: W, h: H,
    title: 'Evora: featured project',
    desc: 'Featured project card for Evora, a free, open-source, local-first design and prototyping tool with real-time collaboration, prototyping, developer handoff and team libraries. MIT licensed, latest release v0.2.0, desktop app for Windows. An animated editor shows two collaborators, Shishir and Alex, editing phone frames.',
    style: A.text(), defs: D.join('') + G.defs(), body,
  });
}

module.exports = { evora };
