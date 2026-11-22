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
    document.querySelectorAll('[data-tapsound]').forEach(x => x.classList.toggle('on', !muted));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.sound'); if (!b) return;
    muted = !muted; try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {}
    paintSound(); tick();
  });
  paintSound();

  const TAP = '.icb,.dk,.seg div,.segx div,.play,.btn,.qbtn,.snav div,.tog,.mode,.opt span,.chip,.chip2,.key,.cbtn,.atile,[data-tap]'; // mute icons stay silent
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
    const tog = t.closest('.tog'); if (tog) {
      tog.classList.toggle('on');
      if (tog.hasAttribute('data-tapsound')) { muted = !tog.classList.contains('on'); try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {} paintSound(); }
      return;
    }
    const segItem = t.closest('.seg div, .segx div, .opt span');
    if (segItem) {
      [...segItem.parentElement.children].forEach(c => c.classList.toggle('on', c === segItem));
      if (segItem.parentElement.hasAttribute('data-tabs')) {
        const i = [...segItem.parentElement.children].indexOf(segItem);
        const tp = segItem.parentElement.parentElement.querySelector('.tabpanes');
        if (tp) [...tp.children].forEach((c, k) => c.classList.toggle('on', k === i));
        return;
      }
      const views = segItem.parentElement.closest('[data-views]');
      if (views) {
        const app = frameOf(segItem).querySelector('.app');
        const v = segItem.textContent.trim().toLowerCase();
        app.classList.remove('v-serene', 'v-map', 'v-car'); app.classList.add('v-' + v);
      }
      return;
    }
    const dk = t.closest('.dk');
    if (dk && dk.classList.contains('short')) {   // seat-heat shortcut: 0 → 1 → 2 → 3 → 0
      const bars = dk.querySelectorAll('.lv b'); const lvl = ([...bars].filter(b => !b.classList.contains('off')).length + 1) % 4;
      bars.forEach((b, i) => b.classList.toggle('off', i >= lvl)); return;
    }
    if (dk && dk.hasAttribute('data-go')) { route(dk.closest('.frame'), dk.dataset.go); return; }
    if (dk && dk.hasAttribute('data-nomi')) { openNomi(dk.closest('.frame')); return; }
    if (dk && !dk.classList.contains('short') && !dk.closest('.dim')) {
      dk.parentElement.querySelectorAll('.dk').forEach(d => d.classList.toggle('on', d === dk)); return;
    }
    const sn = t.closest('.snav div');
    if (sn) {
      sn.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === sn));
      if (sn.parentElement.hasAttribute('data-pages')) {
        const name = sn.textContent.replace(sn.querySelector('.ms').textContent, '').trim();
        sn.closest('.pane').querySelectorAll('.pg').forEach(pg => pg.classList.toggle('on', pg.dataset.page === name));
      }
      return;
    }
    const fr0 = t.closest('.frame');
    const app = t.closest('[data-app]'); if (app) { openApp(fr0, app.dataset.app); return; }
    const song = t.closest('[data-song]');
    if (song) {
      const [ti, ar] = song.dataset.song.split('|');
      fr0.querySelectorAll('.player').forEach(p => { p.querySelectorAll('.h3').forEach(h => h.textContent = ti); p.querySelectorAll('.b2').forEach(b => b.textContent = ar); p._pos = 0; setPlaying(p, true); paintTime(p); });
      if (song.dataset.station) { const sc = song.closest('.tp'); sc.querySelector('.radio-f').textContent = song.dataset.station; sc.querySelector('.radio-n').textContent = ti; sc.querySelector('.dial i').style.left = (((+song.dataset.station) - 87.5) / 20.5 * 100).toFixed(1) + '%'; }
      return;
    }
    const call = t.closest('[data-call]');
    if (call) {
      const ov = fr0.querySelector('.callov'); let n = call.dataset.call;
      if (n === 'keypad') { n = fr0.querySelector('.kp-num').textContent.trim(); if (n.length < 6) return; }
      ov.querySelector('.call-n').textContent = n; ov.querySelector('.call-s').textContent = 'Calling…';
      ov.querySelectorAll('[data-ctog]').forEach(b => b.classList.remove('on'));
      ov.classList.add('on'); clearInterval(ov._t);
      const start = Date.now() + 2000;
      ov._t = setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); if (s >= 0) ov.querySelector('.call-s').textContent = fmt(s); }, 250);
      return;
    }
    const cbt = t.closest('.cbtn');
    if (cbt) { if (cbt.classList.contains('end')) { const ov = cbt.closest('.callov'); clearInterval(ov._t); ov.classList.remove('on'); } else cbt.classList.toggle('on'); return; }
    const key = t.closest('.key'); if (key) { const d = fr0.querySelector('.kp-num'); if (d.textContent.length < 18) d.textContent += key.dataset.key; return; }
    if (t.closest('.kp-num') || (t.textContent === 'backspace' && t.closest('.tp'))) { const d = fr0.querySelector('.kp-num'); if (d.textContent.length > 5) d.textContent = d.textContent.slice(0, -1); return; }
    const rd = t.closest('[data-read]'); if (rd) { say(fr0, rd.dataset.read); return; }
    const sq = t.closest('.chess i');
    if (sq) { const b = sq.parentElement, sel = b.querySelector('.sel');
      if (sel && sel !== sq) { sq.textContent = sel.textContent; sel.textContent = ''; sel.classList.remove('sel'); const st = b.closest('.row').querySelector('.chess-s'); st.textContent = st.textContent === 'White to move' ? 'Black to move' : 'White to move'; }
      else if (sq.textContent.trim()) sq.classList.toggle('sel'); return; }
    const su = t.closest('.sudoku .emp'); if (su) { su.textContent = ((+su.textContent || 0) % 9) + 1; return; }
    const an = t.closest('.trivia .ans');
    if (an) { const ok = an.dataset.ok === '1'; an.classList.add(ok ? 'ok' : 'no'); an.closest('.trivia').querySelector('.tv-r').textContent = ok ? 'Correct. The Alzette runs through the Grund.' : 'Not quite. Try another answer.'; return; }
    if (t.closest('[data-nomi]')) { openNomi(fr0); return; }
    if (t.closest('.nomi-x') || t.classList.contains('nomiov')) { fr0.querySelector('.nomiov').classList.remove('on'); return; }
    const ask = t.closest('[data-ask]'); if (ask) { nomiAsk(fr0, ask.dataset.ask, ask.textContent); return; }
    const go = t.closest('[data-go]');
    if (go) { route(go.closest('.frame'), go.dataset.go); return; }
    const sw = t.closest('.sw'); if (sw) { sw.parentElement.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === sw)); return; }
    const mem = t.closest('.mem .btn:not(.tint)'); if (mem) { mem.parentElement.querySelectorAll('.btn:not(.tint)').forEach(x => x.classList.toggle('on', x === mem)); return; }
    const pr = t.closest('.prof'); if (pr) { pr.parentElement.querySelectorAll('.prof').forEach(x => { x.classList.toggle('on', x === pr); x.querySelector('.bs').textContent = x === pr ? 'Driving now' : 'Seat, mirrors, Custom mode, music'; }); return; }
    const fl = t.closest('[data-flip]'); if (fl) { const s = fl.querySelector('span:last-child'); const a = s.textContent; s.textContent = fl.dataset.flip; fl.dataset.flip = a; return; }
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

  /* ---------- NOMI (scripted demo; actions really change the car) ---------- */
  function say(fr, text) {
    try { if (!muted && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {}
    const ov = fr && fr.querySelector('.nomiov'); if (!ov) return;
  }
  function openNomi(fr) {
    const ov = fr.querySelector('.nomiov'); ov.querySelector('.nomi-log').innerHTML = ''; ov.querySelector('.nomi-state').textContent = 'Listening…'; ov.classList.add('on');
  }
  function bubble(log, cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; log.appendChild(d); return d; }
  function nomiAsk(fr, k, text) {
    const ov = fr.querySelector('.nomiov'), log = ov.querySelector('.nomi-log'), st = ov.querySelector('.nomi-state');
    if (k === 'reserve') { log.innerHTML = ''; bubble(log, 'me', 'Reserve it'); }
    else { log.innerHTML = ''; bubble(log, 'me', text); }
    st.textContent = 'Thinking…';
    setTimeout(() => {
      st.textContent = 'NOMI';
      let a = '';
      if (k === 'park') a = 'Parking Trois Glands is a 5 minute walk from Mudam and fits the ET9. Reserve a space from 13:55?<div class="acts" style="margin-top:10px"><div class="btn pri sm" data-ask="reserve">Reserve</div><div class="btn sec sm nomi-x">Not now</div></div>';
      if (k === 'reserve') a = 'Done. Level −2, bay 14, from 13:55 until 15:55. I’ve added it to your trip.';
      if (k === 'seat') { a = 'Driver seat heat set to 2.'; fr.querySelectorAll('.dk.short .lv b').forEach((b, i) => b.classList.toggle('off', i >= 2)); }
      if (k === 'calm') { a = 'Playing Space Oddity by David Bowie.'; fr.querySelectorAll('.player').forEach(p => { p.querySelectorAll('.h3').forEach(h => h.textContent = 'Space Oddity'); p.querySelectorAll('.b2').forEach(b => b.textContent = 'David Bowie'); p._pos = 0; setPlaying(p, true); paintTime(p); }); }
      if (k === 'air') { const q = document.querySelector('[data-live="aqi"]'), x = document.querySelector('[data-live="aqitext"]'); a = q && q.textContent.trim() && q.textContent !== 'AQI –' ? `Outside air is ${q.textContent}${x ? ', ' + x.textContent : ''}. Cabin filtering is on.` : 'Outside air quality is good today. Cabin filtering is on.'; }
      bubble(log, 'ai', a); say(null, a.replace(/<[^>]+>/g, ''));
    }, 700);
  }

  /* ---------- router (prototype): bottom bar + gear switch screens ---------- */
  const NAMES = { media: 'Media', phone: 'Phone', apps: 'Apps' };
  function route(fr, to) {
    if (!fr) return;
    let arg = null;
    if (to.includes(':')) { [to, arg] = to.split(':'); }
    let scr = fr.querySelector(`[data-screen="${to}"]`);
    if (!scr) { scr = fr.querySelector('[data-screen="soon"]'); if (scr) scr.querySelector('.soon-t').textContent = NAMES[to] || to; }
    fr.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s === scr));
    fr.querySelectorAll('.dock .dk[data-go]').forEach(d => d.classList.toggle('on', d.dataset.go === to));
    const nav = to === 'nav';
    fr.querySelectorAll('[data-ctx="nav"]').forEach(c => c.style.display = nav ? '' : 'none');
    fr.querySelectorAll('[data-ctx="other"]').forEach(c => c.style.display = nav ? 'none' : '');
    if (arg !== null && scr) {
      if (/^\d+$/.test(arg)) { const seg = scr.querySelector('[data-tabs]'); if (seg) seg.children[+arg].click(); }
      else { const it = [...scr.querySelectorAll('.snav div')].find(d => d.textContent.includes(arg)); if (it) it.click(); }
    }
  }
  const TABDOCK = { appview: 'apps' };
  function openApp(fr, name) {
    const scr = fr.querySelector('[data-screen="appview"]'), tpl = fr.querySelector(`template[data-appc="${name}"]`);
    scr.querySelector('.av-t').textContent = name;
    const c = scr.querySelector('.av-c'); c.innerHTML = ''; if (tpl) c.appendChild(tpl.content.cloneNode(true));
    route(fr, 'appview');
    fr.querySelectorAll('.dock .dk[data-go]').forEach(d => d.classList.toggle('on', d.dataset.go === 'apps'));
    if (window.nioLive) window.nioLive();
  }

  /* ---------- sliders (progress + volume, volume synced per frame) ---------- */
  function setVol(fr, pct) {
    fr.querySelectorAll('[data-sync="vol"]').forEach(s => { s.style.setProperty('--v', pct + '%'); const o = s.parentElement.querySelector('.val'); if (o) o.textContent = pct + ' %'; });
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
    else if (drag.s.dataset.min !== undefined) {
      drag.s.style.setProperty('--v', pct + '%');
      const lo = +drag.s.dataset.min, hi = +drag.s.dataset.max, st = +(drag.s.dataset.step || 1);
      const v = Math.round((lo + (hi - lo) * pct / 100) / st) * st;
      const out = drag.s.parentElement.querySelector('.val');
      if (out) out.textContent = (lo < 0 && v > 0 ? '+' : '') + v + (drag.s.dataset.unit || '');
    }
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
    const chip = root.querySelector('.status .chip') || (root.closest('.frame') || document).querySelector('.status .chip');
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
  /* ---------- car view: 5 s loop, drive to the junction and turn right (heading-up) ---------- */
  document.querySelectorAll('.cv-world').forEach(w => {
    const app = w.closest('.app'), chipT = app && app.querySelector('.cv-chip-t');
    const ex = +w.dataset.ex, y0 = +w.dataset.y0, R = +w.dataset.r, Y = 440, D = Y - y0, A = Math.PI / 2 * R, V = 200, PX_M = 40;
    const pose = s => {
      if (s < D) return [ex, Y - s, 0];
      if (s < D + A) { const f = (s - D) / R; return [ex + R - R * Math.cos(f), y0 - R * Math.sin(f), f * 180 / Math.PI]; }
      return [ex + R + (s - D - A), y0 - R, 90];
    };
    const draw = s => { const [x, y, h] = pose(s); w.setAttribute('transform', `translate(${ex} ${Y}) rotate(${-h}) translate(${-x} ${-y})`);
      if (chipT) chipT.textContent = s < D ? `Lane 3 of 3 · turn right in ${Math.max(1, Math.round((D - s) / PX_M))} m` : 'Turning right';
    };
    let t0 = null;
    draw(0);
    if (reduce) return;
    function frame(ts) {
      if (!app.classList.contains('v-car')) { t0 = null; requestAnimationFrame(frame); return; }
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) % 5;
      draw(V * t);
      w.classList.toggle('fade', t > 4.55 || t < 0.05);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();
