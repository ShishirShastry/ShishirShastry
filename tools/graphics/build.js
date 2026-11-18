'use strict';
const path = require('path');
const Tk = require('./textkit.js');
const { THEMES, write } = require('./common.js');
const OUT = path.join(__dirname, '..', '..', 'assets');
const only = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  await Tk.init();
  const res = [];
  const want = (n) => !only || only.includes(n);
  try {
    if (want('banner')) { const { banner } = require('./banner.js'); for (const t of ['dark', 'light']) res.push(write(path.join(OUT, `banner-${t}.svg`), await banner(THEMES[t]))); }
    if (want('evora')) { const { evora } = require('./evora.js'); for (const t of ['dark', 'light']) res.push(write(path.join(OUT, `evora-${t}.svg`), await evora(THEMES[t]))); }
    if (want('small')) { const sm = require('./small.js'); for (const t of ['dark', 'light']) for (const [n, s] of await sm.all(THEMES[t])) res.push(write(path.join(OUT, `${n}-${t}.svg`), s)); }
  } finally { await Tk.close(); }
  for (const r of res) console.log((r.bytes / 1024).toFixed(1).padStart(7) + ' KB  ' + r.file);
})();
