/* NIO ET9 HMI study · shared interactions
   tap sound · selection groups · sliders · Walkman-style player · climate
   Serene / Map / Car views · drive modes with Custom per driver · blind-spot loop */
(function () {
  /* ---------- tap sound (on by default, mute switch on the page) ---------- */
  let muted = false;
  try { muted = localStorage.getItem('nio-sound') === 'off'; } catch (e) {}
  let ac = null;
  function tick(kind) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      const base = kind === 'soft' ? 1500 : kind === 'low' ? 700 : 2100;
      o.type = 'triangle';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.04);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === 'soft' ? 0.035 : 0.09, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      f.type = 'lowpass'; f.frequency.value = 3400;
      o.connect(f); f.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.08);
    } catch (e) {}
  }
  function paintSound() {
    document.querySelectorAll('.sound').forEach(b => {
      b.innerHTML = `<span class="ms">${muted ? 'volume_off' : 'volume_up'}</span>Tap sounds ${muted ? 'off' : 'on'}`;
      b.setAttribute('aria-pressed', String(!muted));
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.sound'); if (!b) return;
    muted = !muted; try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {}
    paintSound(); tick();
  });
  paintSound();

  const TAP = '.icb,.dk,.seg div,.segx div,.play,.btn,.qbtn,.snav div,.tog,.mode,.opt span,.chip,[data-tap]'; // mute icons stay silent
  // no tap sounds while the frame's volume is muted
  const frameVol = fr => { const s = fr && fr.querySelector && fr.querySelector('[data-sync="vol"]'); return s ? (parseFloat(getComputedStyle(s).getPropertyValue('--v')) || 0) : 50; };
  document.addEventListener('pointerdown', e => {
    const fr = e.target.closest('.frame');
    if (fr && e.target.closest(TAP) && frameVol(fr) > 0) tick();
  });

  /* ---------- selection groups, toggles, climate, views ---------- */
  const frameOf = el => el.closest('.frame') || document;
  document.addEventListener('click', e => {
    const t = e.target;
    const tog = t.closest('.tog'); if (tog) { tog.classList.toggle('on'); return; }
    const segItem = t.closest('.seg div, .segx div, .opt span');
    if (segItem) {
      [...segItem.parentElement.children].forEach(c => c.classList.toggle('on', c === segItem));
      const views = segItem.parentElement.closest('[data-views]');
      if (views) {
        const app = frameOf(segItem).querySelector('.app');
        const v = segItem.textContent.trim().toLowerCase();
        app.classList.remove('v-serene', 'v-map', 'v-car'); app.classList.add('v-' + v);
      }
      return;
    }
    const dk = t.closest('.dk');
    if (dk && !dk.classList.contains('short') && !dk.closest('.dim')) {
      dk.parentElement.querySelectorAll('.dk').forEach(d => d.classList.toggle('on', d === dk)); return;
    }
    const sn = t.closest('.snav div');
    if (sn) { sn.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === sn)); return; }
    const cb = t.closest('.clim .icb');
    if (cb) {
      const v = cb.parentElement.querySelector('.t');
      let n = parseFloat(v.textContent) + (cb.textContent.includes('add') ? 0.5 : -0.5);
      n = Math.max(16, Math.min(28, n)); v.textContent = n.toFixed(1) + '°'; return;
    }
    const pl = t.closest('.player .play');
    if (pl) { setPlaying(pl.closest('.player'), !pl.closest('.player').classList.contains('playing')); return; }
    const vi = t.closest('.vol .ms, .dvol .ms');
    if (vi) {
      const fr = frameOf(vi); const s = fr.querySelector('[data-sync="vol"]');
      const cur = parseFloat(getComputedStyle(s).getPropertyValue('--v')) || 0;
      if (cur > 0) { fr.dataset.lastVol = cur; setVol(fr, 0); } else setVol(fr, parseFloat(fr.dataset.lastVol || 55));
    }
  });

  /* ---------- sliders (progress + volume, volume synced per frame) ---------- */
  function setVol(fr, pct) {
    fr.querySelectorAll('[data-sync="vol"]').forEach(s => s.style.setProperty('--v', pct + '%'));
    fr.querySelectorAll('.vol .ms, .dvol .ms').forEach(i => i.textContent = pct === 0 ? 'volume_off' : pct < 40 ? 'volume_down' : 'volume_up');
  }
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const s = e.target.closest('.sl'); if (!s) return;
    drag = { s, last: -1 }; s.classList.add('drag'); s.setPointerCapture && s.setPointerCapture(e.pointerId); move(e);
  });
  document.addEventListener('pointermove', e => { if (drag) move(e); });
  document.addEventListener('pointerup', () => { if (drag) { drag.s.classList.remove('drag'); drag = null; } });
  function move(e) {
    const r = drag.s.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
    const step = Math.floor(pct / 10); if (step !== drag.last) { if (drag.last !== -1 && frameVol(frameOf(drag.s)) > 0) tick('soft'); drag.last = step; }
    if (drag.s.dataset.sync === 'vol') setVol(frameOf(drag.s), pct);
    else {
      drag.s.style.setProperty('--v', pct + '%');
      const p = drag.s.closest('.player'); if (p) { p._pos = Math.round(p._dur * pct / 100); paintTime(p); }
    }
  }

  /* ---------- player ---------- */
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function paintTime(p) {
    const c = p.querySelector('.p-cur'); if (c) c.textContent = fmt(p._pos);
    p.querySelectorAll('.p-prog').forEach(s => s.style.setProperty('--v', (100 * p._pos / p._dur).toFixed(2) + '%'));
    drawTape(p);
  }
  // vintage tape: two reels joined by tape over guide rollers and a head; deck spans the cover width
  const HUB = '<circle r="9" fill="#fff" stroke="#c9c4dc" stroke-width="1.2"/><circle r="3" fill="#cfcae0"/><g stroke="#9b95b5" stroke-width="2" stroke-linecap="round"><path d="M0 -4V-8"/><path d="M3.5 2L7 4"/><path d="M-3.5 2L-7 4"/></g>';
  function drawTape(p) {
    const svg = p.querySelector('svg.tape'); if (!svg) return;
    const w = Math.round(svg.parentElement.offsetWidth || 300);
    if (p._tw !== w) {
      p._tw = w; svg.setAttribute('viewBox', `0 0 ${w} 64`);
      svg.innerHTML = `<rect x="1" y="1" width="${w - 2}" height="62" rx="12" fill="#e4e1ee"/><path class="tp" fill="none" stroke="#4b3f52" stroke-width="2"/><circle class="pk-l" cx="40" cy="30" fill="#4b3f52"/><circle class="pk-r" cx="${w - 40}" cy="30" fill="#4b3f52"/><g transform="translate(40 30)"><g class="reel">${HUB}</g></g><g transform="translate(${w - 40} 30)"><g class="reel">${HUB}</g></g><circle cx="84" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><circle cx="${w - 84}" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><rect x="${w / 2 - 10}" y="54" width="20" height="8" rx="2" fill="#9b95b5"/>`;
    }
    const f = p._pos / p._dur, rl = 22 - 10 * f, rr = 12 + 10 * f;
    svg.querySelector('.pk-l').setAttribute('r', rl.toFixed(1));
    svg.querySelector('.pk-r').setAttribute('r', rr.toFixed(1));
    svg.querySelector('.tp').setAttribute('d', `M${(40 + rl * 0.45).toFixed(1)} ${(30 + rl * 0.89).toFixed(1)}L84 59.5L${w - 84} 59.5L${(w - 40 - rr * 0.45).toFixed(1)} ${(30 + rr * 0.89).toFixed(1)}`);
  }
  function setPlaying(p, on) {
    p.classList.toggle('playing', on);
    p.querySelectorAll('.play .ms').forEach(i => i.textContent = on ? 'pause' : 'play_arrow');
  }
  const players = [...document.querySelectorAll('.player')];
  players.forEach(p => { p._dur = 254; p._pos = 110; paintTime(p); });
  window.addEventListener('load', () => players.forEach(p => { p._tw = 0; paintTime(p); }));
  setInterval(() => players.forEach(p => {
    if (!p.classList.contains('playing') || (drag && p.contains(drag.s))) return;
    p._pos = (p._pos + 1) % p._dur; paintTime(p);
  }), 1000);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------- drive modes (values change per mode; Custom is editable and saved per driver) ---------- */
  const MODES = {
    Comfort: { Steering: 'Light', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'Standard', Traction: 'Normal', d: 'Quiet and balanced. The default for city driving.' },
    Sport:   { Steering: 'Firm', Suspension: 'Firm', Power: 'Sharp', Regeneration: 'High', Traction: 'Sport', d: 'Quicker response and a tighter body. More energy use.' },
    Eco:     { Steering: 'Light', Suspension: 'Standard', Power: 'Gentle', Regeneration: 'High', Traction: 'Normal', d: 'Gentle power and strong regeneration for the most range.' },
    Snow:    { Steering: 'Light', Suspension: 'Soft', Power: 'Gentle', Regeneration: 'Low', Traction: 'Snow', d: 'Soft power delivery and low regeneration for grip on snow and ice.' },
  };
  const OPTS = { Steering: ['Light', 'Standard', 'Firm'], Suspension: ['Soft', 'Standard', 'Firm'], Power: ['Gentle', 'Smooth', 'Sharp'], Regeneration: ['Low', 'Standard', 'High'], Traction: ['Normal', 'Sport', 'Snow'] };
  const custom = { Emma: { Steering: 'Standard', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'High', Traction: 'Normal' } };
  document.querySelectorAll('[data-modes]').forEach(root => {
    const driver = root.dataset.driver || 'Emma';
    const kv = root.querySelector('.kv'), cu = root.querySelector('.custom'), title = root.querySelector('.m-title'), desc = root.querySelector('.m-desc'), save = root.querySelector('.m-save'), toast = root.querySelector('.toast');
    const chip = root.querySelector('.status .chip');
    function show(m) {
      root.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x.dataset.m === m));
      if (chip) chip.lastChild.textContent = m;
      title.textContent = m + (m === 'Custom' ? ' · ' + driver : ' changes');
      const isC = m === 'Custom';
      kv.style.display = isC ? 'none' : ''; cu.style.display = isC ? '' : 'none'; save.style.display = isC ? '' : 'none';
      if (isC) {
        const c = custom[driver];
        cu.innerHTML = Object.keys(OPTS).map(k => `<div><span>${k}</span><span class="opt" data-k="${k}">${OPTS[k].map(o => `<span class="${c[k] === o ? 'on' : ''}">${o}</span>`).join('')}</span></div>`).join('');
        desc.textContent = 'Your own mix, saved to ' + driver + '’s profile.';
      } else {
        const v = MODES[m];
        kv.querySelectorAll('b').forEach(b => {
          const nv = v[b.dataset.k];
          if (b.textContent !== nv) { b.textContent = nv; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 700); }
        });
        desc.textContent = v.d;
      }
    }
    root.addEventListener('click', e => {
      const m = e.target.closest('.mode'); if (m) { show(m.dataset.m); return; }
      if (e.target.closest('.m-save')) {
        cu.querySelectorAll('.opt').forEach(o => { custom[driver][o.dataset.k] = o.querySelector('.on').textContent; });
        toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800);
      }
    });
    show('Comfort');
  });

  /* ---------- blind-spot loop: indicator → cyclist → camera opens → 4 s → camera closes, music returns ---------- */
  document.querySelectorAll('[data-blindspot]').forEach(fr => {
    const p = fr.querySelector('.player');
    function cycle() {
      fr.classList.remove('bs-sig', 'bs-on'); p && p.classList.remove('compact');
      setTimeout(() => fr.classList.add('bs-sig'), 1800);
      setTimeout(() => { fr.classList.add('bs-on'); p && p.classList.add('compact'); }, 2600);
      setTimeout(() => { fr.classList.remove('bs-on'); p && p.classList.remove('compact'); }, 6600);
      setTimeout(() => fr.classList.remove('bs-sig'), 8200);
    }
    cycle(); if (!reduce) setInterval(cycle, 10500); else { fr.classList.add('bs-sig', 'bs-on'); p && p.classList.add('compact'); }
  });
})();
