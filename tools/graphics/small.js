'use strict';
const Tk = require('./textkit.js');
const { Anim, r2, r3, gradStops, svgDoc, evoraLogo } = require('./common.js');

const BTN_H = 44;
const BTN_SIZE = 14.5;

const BUTTONS = [
  { id: 'btn-portfolio', label: 'Portfolio', ext: true, title: 'Portfolio', desc: 'Button: open Shishir’s portfolio website.' },
  { id: 'btn-linkedin', label: 'LinkedIn', ext: true, title: 'LinkedIn', desc: 'Button: connect with Shishir on LinkedIn.' },
  { id: 'btn-hashnode', label: 'Hashnode', ext: true, title: 'Hashnode', desc: 'Button: read Shishir’s articles on Hashnode.' },
  { id: 'btn-evora-site', label: 'Evora website', ext: true, title: 'Evora website', desc: 'Button: visit the Evora website.' },
  { id: 'btn-download', label: 'Download Evora', primary: true, title: 'Download Evora', desc: 'Button: download Evora, the open-source design tool, for Windows.' },
];

function icon(id, th, bg) {
  switch (id) {
    case 'btn-portfolio':
      return `<g fill="none" stroke="url(#ig)" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="7.6"/><ellipse cx="9" cy="9" rx="3.3" ry="7.6"/><path d="M1.6 9h14.8M2.8 5h12.4M2.8 13h12.4"/></g>`;
    case 'btn-linkedin':
      return `<rect width="18" height="18" rx="4" fill="#0a66c2"/><g fill="#fff"><circle cx="5.1" cy="5.2" r="1.35"/><rect x="3.9" y="7.2" width="2.4" height="6.9" rx=".3"/><path d="M7.9 7.2h2.3v1c.4-.7 1.3-1.2 2.4-1.2 2.2 0 2.7 1.4 2.7 3.3v3.8h-2.4v-3.4c0-.8-.1-1.8-1.2-1.8s-1.4.9-1.4 1.8v3.4H7.9z"/></g>`;
    case 'btn-hashnode':
      return `<path d="M1.6 6.6a3.6 3.6 0 0 0 0 5L6.4 16.4a3.6 3.6 0 0 0 5 0L16.4 11.6a3.6 3.6 0 0 0 0-5L11.4 1.6a3.6 3.6 0 0 0-5 0zM9 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="#2962ff" fill-rule="evenodd"/>`;
    case 'btn-evora-site':
      return evoraLogo(-1, -1, 20, 'L');
    case 'btn-download':
      return `<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.2v9.2M5.2 7.8 9 11.6l3.8-3.8"/><path d="M2.6 12.2v1.6a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2v-1.6"/></g>`;
  }
  return '';
}

async function buttons(th) {
  // uniform width: widest content + padding
  const runs = {};
  let maxC = 0;
  for (const b of BUTTONS) {
    const r = await Tk.run(b.label, { w: 600, size: BTN_SIZE, ls: -0.005, x: 0, y: 0 });
    runs[b.id] = r;
    const cw = 18 + 9 + r.width + (b.ext ? 8 + 9 : 0);
    maxC = Math.max(maxC, cw);
  }
  const W = Math.ceil(maxC + 44);
  const out = [];
  BUTTONS.forEach((b, idx) => {
    const dk = th.dark;
    const G = new Tk.Glyphs('Q');
    const A = new Anim('k');
    const r0 = runs[b.id];
    const cw = 18 + 9 + r0.width + (b.ext ? 8 + 9 : 0);
    const x0 = (W - cw) / 2;
    const H = BTN_H, R = H / 2;
    const D = [];
    D.push(`<clipPath id="c"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${R - 1}"/></clipPath>`);
    D.push(`<linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">${gradStops([th.accent[0], th.accent[1], th.accent[2]])}</linearGradient>`);
    D.push(`<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${b.primary ? .38 : (dk ? .10 : .7)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    D.push(`<linearGradient id="tp" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${b.primary ? .55 : (dk ? .22 : .9)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    D.push(`<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${b.primary ? .16 : (dk ? .05 : 0)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    let s = '';
    if (b.primary) {
      D.push(`<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.accent[0]}"/><stop offset=".55" stop-color="${th.accent[1]}"/><stop offset="1" stop-color="${th.accent[2]}"/></linearGradient>`);
      s += `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R - .5}" fill="url(#pg)"/>`;
    } else {
      s += `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R - .5}" fill="${dk ? th.surface : '#ffffff'}"/>`;
    }
    s += `<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="url(#vg)"/>` +
      `<path class="sh" d="M-60 0h34L-50 ${H}h-34z" fill="url(#sh)"/>` +
      `<rect x="${R}" y="1" width="${W - 2 * R}" height="1" fill="url(#tp)"/></g>`;
    s += `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R - .5}" fill="none" stroke="${b.primary ? 'rgba(255,255,255,0.22)' : (dk ? 'rgba(255,255,255,0.13)' : 'rgba(16,12,40,0.13)')}"/>`;
    s += `<g transform="translate(${r2(x0)} ${(H - 18) / 2})">${icon(b.id, th)}</g>`;
    const tx = x0 + 18 + 9;
    const r = { ...r0 };
    const ty = H / 2 + BTN_SIZE * 0.727 / 2;
    s += `<g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r3(r0.k)})" fill="${b.primary ? '#ffffff' : th.text}">${r0.uses(G)}</g>`;
    if (b.ext) {
      const ax = tx + r0.width + 8, ay = H / 2 - 4.5;
      s += `<path d="M${r2(ax + .5)} ${r2(ay + 8.5)}l8-8M${r2(ax + 2.5)} ${r2(ay + .5)}h6v6" fill="none" stroke="${th.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    // sheen: sweep once every 6s, staggered per button so a row of buttons shimmers in sequence
    const sw = W + 120;
    A.add('.sh', 6, [[0, { x: 0 }], [1.2 + idx * .22, { x: 0 }, 'io'], [2.2 + idx * .22, { x: sw }], [6, { x: sw }]], { offset: 0 });
    out.push([b.id, svgDoc({ w: W, h: H, title: b.title, desc: b.desc, style: A.text(), defs: D.join('') + G.defs(), body: s })]);
  });
  return out;
}

async function divider(th) {
  const W = 1000, H = 24, y = 12;
  const dk = th.dark;
  const A = new Anim('k');
  const D = [];
  D.push(`<linearGradient id="base" x1="0" x2="1"><stop offset="0" stop-color="${th.accent[0]}" stop-opacity="0"/><stop offset=".3" stop-color="${th.accent[0]}" stop-opacity="${dk ? .35 : .28}"/><stop offset=".5" stop-color="${th.accent[1]}" stop-opacity="${dk ? .5 : .4}"/><stop offset=".7" stop-color="${th.accent[2]}" stop-opacity="${dk ? .35 : .28}"/><stop offset="1" stop-color="${th.accent[3]}" stop-opacity="0"/></linearGradient>`);
  D.push(`<linearGradient id="beam" x1="0" x2="1"><stop offset="0" stop-color="${th.accent[0]}" stop-opacity="0"/><stop offset=".45" stop-color="${th.accent[1]}"/><stop offset=".7" stop-color="${th.accent[2]}"/><stop offset="1" stop-color="${th.accent[3]}" stop-opacity="0"/></linearGradient>`);
  D.push(`<radialGradient id="glow"><stop offset="0" stop-color="${th.accent[1]}" stop-opacity="${dk ? .55 : .3}"/><stop offset="1" stop-color="${th.accent[1]}" stop-opacity="0"/></radialGradient>`);
  D.push(`<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff"/><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  D.push(`<mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`);
  D.push(`<linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">${gradStops([th.accent[0], th.accent[1], th.accent[2]])}</linearGradient>`);
  let s = `<rect x="0" y="${y - .5}" width="${W}" height="1" fill="url(#base)"/>`;
  s += `<g mask="url(#m)"><g class="bm"><ellipse cx="0" cy="${y}" rx="110" ry="9" fill="url(#glow)"/><rect x="-110" y="${y - 1}" width="220" height="2" rx="1" fill="url(#beam)"/></g></g>`;
  // center gem
  s += `<rect x="${W / 2 - 4}" y="${y - 4}" width="8" height="8" rx="1.5" transform="rotate(45 ${W / 2} ${y})" fill="${th.bg}" stroke="url(#dg)" stroke-width="1.5"/>`;
  s += `<rect class="gm" x="${W / 2 - 1.75}" y="${y - 1.75}" width="3.5" height="3.5" rx=".6" fill="url(#dg)"/>`;
  A.add('.bm', 7, [[0, { x: -120 }, 'sio'], [7, { x: W + 120 }]], { offset: 2.6 });
  A.add('.gm', 3.5, [[0, { o: .55, s: .8, r: 45 }, 'sio'], [1.75, { o: 1, s: 1.15, r: 45 }, 'sio'], [3.5, { o: .55, s: .8, r: 45 }]], { offset: 0, extra: 'transform-box:fill-box;transform-origin:center' });
  return svgDoc({ w: W, h: H, title: 'Section divider', desc: 'A thin gradient line with a travelling glow.', style: A.text(), defs: D.join(''), body: s });
}

async function heading(label, th) {
  const W = 640, H = 64;
  const dk = th.dark;
  const G = new Tk.Glyphs('Q');
  const A = new Anim('k');
  const D = [];
  const base = 37;
  const r = await Tk.run(label, { w: 800, size: 29, ls: -0.02, x: W / 2, y: base, anchor: 'middle' });
  let s = r.svg(G, `fill="${th.text}"`);
  const midY = base - 29 * 0.727 / 2;
  const gapX = 24, len = Math.min(170, r.x0 - gapX - 8);
  const lx = r.x0 - gapX, rx = r.x0 + r.width + gapX;
  D.push(`<linearGradient id="hl" gradientUnits="userSpaceOnUse" x1="${r2(lx - len)}" x2="${r2(lx)}"><stop offset="0" stop-color="${th.accent[0]}" stop-opacity="0"/><stop offset="1" stop-color="${th.accent[0]}" stop-opacity="${dk ? .55 : .45}"/></linearGradient>`);
  D.push(`<linearGradient id="hr" gradientUnits="userSpaceOnUse" x1="${r2(rx)}" x2="${r2(rx + len)}"><stop offset="0" stop-color="${th.accent[2]}" stop-opacity="${dk ? .55 : .45}"/><stop offset="1" stop-color="${th.accent[2]}" stop-opacity="0"/></linearGradient>`);
  s += `<rect x="${r2(lx - len)}" y="${r2(midY - .5)}" width="${len}" height="1" fill="url(#hl)"/><rect x="${r2(rx)}" y="${r2(midY - .5)}" width="${len}" height="1" fill="url(#hr)"/>`;
  s += `<rect x="${r2(lx - 3)}" y="${r2(midY - 3)}" width="6" height="6" rx="1" transform="rotate(45 ${r2(lx)} ${r2(midY)})" fill="${th.accent[0]}"/>`;
  s += `<rect x="${r2(rx - 3)}" y="${r2(midY - 3)}" width="6" height="6" rx="1" transform="rotate(45 ${r2(rx)} ${r2(midY)})" fill="${th.accent[2]}"/>`;
  // gradient underline with a travelling highlight
  const uw = 56, ux = W / 2 - uw / 2, uy = base + 12;
  D.push(`<linearGradient id="ug" x1="0" x2="1">${gradStops(th.accent)}</linearGradient>`);
  D.push(`<linearGradient id="us" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  D.push(`<clipPath id="uc"><rect x="${ux}" y="${uy}" width="${uw}" height="4" rx="2"/></clipPath>`);
  s += `<rect x="${ux}" y="${uy}" width="${uw}" height="4" rx="2" fill="url(#ug)"/>`;
  s += `<g clip-path="url(#uc)"><rect class="us" x="${ux - 30}" y="${uy}" width="24" height="4" fill="url(#us)"/></g>`;
  A.add('.us', 5, [[0, { x: 0 }], [1.4, { x: 0 }, 'io'], [2.6, { x: uw + 40 }], [5, { x: uw + 40 }]], { offset: 0 });
  return svgDoc({ w: W, h: H, title: label, desc: `Section heading: ${label}`, style: A.text(), defs: D.join('') + G.defs(), body: s });
}

const HEADINGS = [['heading-about', 'About'], ['heading-featured', 'Featured'], ['heading-tech-stack', 'Tech stack'], ['heading-github-stats', 'GitHub stats'], ['heading-connect', 'Connect']];

async function all(th) {
  const out = [];
  out.push(...await buttons(th));
  out.push(['divider', await divider(th)]);
  for (const [id, label] of HEADINGS) out.push([id, await heading(label, th)]);
  return out;
}

module.exports = { all, BUTTONS, HEADINGS };
