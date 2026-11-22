/* NIO ET9 HMI study · shared interactions
   tap sound · selection groups · sliders · Walkman-style player · climate
   Serene / Map / Car views · drive modes with Custom per driver · blind-spot loop */
(function () {
  /* ---------- tap sound (on by default, mute switch on the page) ---------- */
  let muted = false;
  try { muted = localStorage.getItem('nio-sound') === 'off'; } catch (e) {}
  let ac = null, tapK = 1;               // tapK: Settings › Sound › Touch sounds (40 % = normal)
  function tick(kind) {
    if (muted || tapK <= 0) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      const base = kind === 'soft' ? 1500 : kind === 'low' ? 700 : 2100;
      o.type = 'triangle';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.04);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((kind === 'soft' ? 0.035 : 0.09) * tapK, t + 0.004);
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
      if (tog.hasAttribute('data-guard')) { const on = tog.classList.contains('on'), gc = tog.closest('.av-c, .app, .frame').querySelector('.gm-card');
        if (gc) { gc.classList.toggle('on', on); gc.querySelector('.gm-st').textContent = on ? 'Guard Mode is on' : 'Guard Mode is off'; gc.querySelector('.gm-sub').textContent = on ? 'Watching with 4 cameras while the ET9 is parked and locked' : 'Turn it on to record when someone comes close'; } }
      if (tog.hasAttribute('data-tapsound')) { muted = !tog.classList.contains('on'); try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {} paintSound(); }
      return;
    }
    if (pClick(t) || calClick(t) || sndClick(t)) return;
    const mv = t.closest('[data-mv]'); if (mv) { g2048Move(mv.closest('.gamewrap'), mv.dataset.mv); return; }
    if (t.closest('[data-g2048-new]')) { g2048New(t.closest('.gamewrap')); return; }
    const mk = t.closest('[data-mk]'); if (mk) { minesTap(mk); return; }
    if (t.closest('[data-mines-new]')) { minesNew(t.closest('.gamewrap')); return; }
    const segItem = t.closest('.seg div, .segx div, .opt span');
    if (segItem) {
      [...segItem.parentElement.children].forEach(c => c.classList.toggle('on', c === segItem));
      if (segItem.parentElement.classList.contains('g-mode')) { chessNew(segItem.closest('.gamewrap')); return; }
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
      if (song.dataset.station) {
        setStation(fr0, ti, song.dataset.station);
        const sc = song.closest('.tp'); sc.querySelector('.radio-f').textContent = song.dataset.station; sc.querySelector('.radio-n').textContent = ti; sc.querySelector('.dial i').style.left = (((+song.dataset.station) - 87.5) / 20.5 * 100).toFixed(1) + '%';
      } else {
        setSong(fr0, songIndex(ti, ar), true);
        if (song.dataset.pos) fr0.querySelectorAll('.player').forEach(p => { p._pos = Math.round(p._dur * song.dataset.pos / 100); paintTime(p); });
      }
      closePicker(fr0);
      return;
    }
    if (t.closest('[data-prev]')) { stepSong(fr0, -1); return; }
    if (t.closest('[data-next]')) { stepSong(fr0, 1); return; }
    if (t.closest('[data-pick]')) { openPicker(fr0); return; }
    if (t.closest('.picker-x') || t.classList.contains('pickerov')) { closePicker(fr0); return; }
    const ytc = t.closest('[data-yt]'); if (ytc) { ytc.parentElement.querySelectorAll('[data-yt]').forEach(x => x.classList.toggle('on', x === ytc)); const box = ytc.closest('.yt').querySelector('.ytbox'); if (box.classList.contains('playing')) loadYT(box, ytc.dataset.yt); return; }
    const ytp = t.closest('[data-ytplay]'); if (ytp) { const yt = ytp.closest('.yt'); const box = yt.querySelector('.ytbox'); box.classList.add('playing'); loadYT(box, yt.querySelector('[data-yt].on').dataset.yt); return; }
    const cln = t.closest('[data-clean]'); if (cln) { cleaning(fr0); return; }
    if (t.closest('[data-chess-new]')) { chessNew(t.closest('.gamewrap')); return; }
    const csq = t.closest('.chess i'); if (csq) { chessTap(csq); return; }
    const gm = t.closest('.g-mode div'); if (gm) { setTimeout(() => chessNew(gm.closest('.gamewrap')), 0); }
    const sc0 = t.closest('.sudoku i'); if (sc0) { suSelect(sc0); return; }
    const nm = t.closest('[data-num]'); if (nm) { suEnter(nm.closest('.gamewrap'), +nm.dataset.num); return; }
    if (t.closest('[data-su-new]')) { suNew(t.closest('.gamewrap')); return; }
    const tva = t.closest('.tv-a .btn'); if (tva) { tvAnswer(tva); return; }
    if (t.closest('.tv-next')) { tvNext(t.closest('.trivia')); return; }
    const call = t.closest('[data-call]');
    if (call) {
      const ov = fr0.querySelector('.callov'); let n = call.dataset.call;
      if (n === 'keypad') { n = fr0.querySelector('.kp-num').textContent.trim(); if (n.length < 6) return; }
      ov.querySelector('.call-n').textContent = n; ov.querySelector('.call-s').textContent = 'Calling…';
      const ca = ov.querySelector('.call-av'); if (ca) ca.innerHTML = avHTML(n, 120);
      ov.querySelectorAll('[data-ctog]').forEach(b => b.classList.remove('on'));
      ov.classList.add('on'); clearInterval(ov._t);
      if (!ov._held) { ov._held = [...fr0.querySelectorAll('.player.playing')]; ov._held.forEach(p => setPlaying(p, false)); }
      const start = Date.now() + 2000;
      ov._log = logCall(fr0, n); ov._t0 = start;
      ov._t = setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); if (s >= 0) ov.querySelector('.call-s').textContent = fmt(s); }, 250);
      return;
    }
    const cbt = t.closest('.cbtn');
    if (cbt) { if (cbt.classList.contains('end')) { const ov = cbt.closest('.callov'); clearInterval(ov._t); ov.classList.remove('on'); (ov._held || []).forEach(p => setPlaying(p, true)); ov._held = null;
        if (ov._log) { const m = Math.max(1, Math.round((Date.now() - ov._t0) / 60000)); ov._log.querySelector('.lc-s').textContent = Date.now() < ov._t0 ? 'Outgoing · cancelled' : `Outgoing · ${m} min`; ov._log = null; } } else cbt.classList.toggle('on'); return; }
    const key = t.closest('.key'); if (key) { const d = fr0.querySelector('.kp-num'); if (d.textContent.length < 18) d.textContent += key.dataset.key; return; }
    if (t.closest('[data-kpdel]')) { const d = fr0.querySelector('.kp-num'); d.textContent = d.textContent.trimEnd().slice(0, -1); return; }
    const rd = t.closest('[data-read]'); if (rd) { say(fr0, rd.dataset.read); return; }
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

  /* ---------- music library (shared by every player in a frame) ---------- */
  const SONGS = [
    ['Starman', 'David Bowie', 254], ['Heroes', 'David Bowie', 367], ['Life on Mars?', 'David Bowie', 228], ['Space Oddity', 'David Bowie', 315],
    ['Dancing Queen', 'ABBA', 231], ['Mamma Mia', 'ABBA', 212], ['Waterloo', 'ABBA', 166], ['The Winner Takes It All', 'ABBA', 294],
    ['Get Lucky', 'Daft Punk', 369], ['One More Time', 'Daft Punk', 320], ['Instant Crush', 'Daft Punk', 337], ['Digital Love', 'Daft Punk', 298],
    ['Memory Box', 'Peter Cat Recording Co.', 312], ['Floated By', 'Peter Cat Recording Co.', 305], ['Soulless Friends', 'Peter Cat Recording Co.', 268], ['People Never Change', 'Peter Cat Recording Co.', 241],
    ['Last Nite', 'The Strokes', 193], ['Reptilia', 'The Strokes', 221], ['Someday', 'The Strokes', 187], ['The Adults Are Talking', 'The Strokes', 309],
    ['60. Danny DeVito, Everybody', 'The Always Sunny Podcast', 4620, 'https://i.ytimg.com/vi/52c7vu7jfR8/hqdefault.jpg'],
    ["The AI Tsunami is Here & Society Isn't Ready", 'People by WTF · Nikhil Kamath', 5640, 'https://i.ytimg.com/vi/68ylaeBbdsg/hqdefault.jpg']];
  function songIndex(ti, ar) {
    let i = SONGS.findIndex(s => s[0] === ti);
    if (i < 0) { SONGS.push([ti, ar, 2400]); i = SONGS.length - 1; }   // audiobooks, podcasts
    return i;
  }
  function setSong(fr, i, play) {
    const [ti, ar, d, cov] = SONGS[(i + SONGS.length) % SONGS.length];
    fr._song = (i + SONGS.length) % SONGS.length;
    fr.querySelectorAll('.player').forEach(p => {
      p.classList.remove('radio');
      p.querySelectorAll('.h3').forEach(h => h.textContent = ti); p.querySelectorAll('.b2').forEach(b => b.textContent = ar);
      p._dur = d; p._pos = 0; if (play !== false) setPlaying(p, true); paintTime(p);
      setArt(p, cov ? { img: cov } : null);
      const e = p.querySelector('.p-full'); if (e) { e.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' }); }
    });
    const pk = fr.querySelector('.pickerov'); if (pk) pk.querySelectorAll('[data-song]').forEach(r => r.classList.toggle('on', r.dataset.song.split('|')[0] === ti));
  }
  // cover art: song placeholder, podcast cover, or the radio station's own tile
  function setArt(p, a) {
    p.querySelectorAll('.art').forEach(el => {
      if (el._ph == null) el._ph = el.innerHTML;
      el.classList.toggle('cov', !!(a && a.img)); el.classList.toggle('radioart', !!(a && a.radio));
      el.style.backgroundImage = a && a.img ? `url(${a.img})` : '';
      el.innerHTML = !a ? el._ph : a.img ? '' : `<span class="ra-l">DAB+ · Luxembourg</span><span class="ra-f">${a.f}</span><span class="ra-n">${a.radio}</span>`;
    });
    p.querySelectorAll('.cart').forEach(el => {
      if (el._ph == null) el._ph = el.innerHTML;
      el.classList.toggle('cov', !!(a && a.img)); el.classList.toggle('radioart', !!(a && a.radio));
      el.style.backgroundImage = a && a.img ? `url(${a.img})` : '';
      el.innerHTML = !a ? el._ph : a.img ? '' : `<span class="ra-f">${a.f}</span>`;
    });
  }
  function stepSong(fr, dir) {
    const p = fr.querySelector('.player');
    if (p && p.classList.contains('radio')) { const st = [['Radio 100,7', '100.7'], ['RTL Radio Lëtzebuerg', '92.5'], ['Eldoradio', '105.0']]; fr._st = ((fr._st || 0) + dir + 3) % 3; setStation(fr, ...st[fr._st]); return; }
    if (dir < 0 && p && p._pos > 3) { p._pos = 0; paintTime(p); return; }
    setSong(fr, (fr._song || 0) + dir, true);
  }
  function setStation(fr, name, f) {
    fr.querySelectorAll('.player').forEach(p => {
      p.classList.add('radio'); setArt(p, { radio: name, f }); p.querySelectorAll('.h3').forEach(h => h.textContent = name); p.querySelectorAll('.b2').forEach(b => b.textContent = 'Live radio · ' + f);
      p.querySelectorAll('.lb-s').forEach(x => x.textContent = 'DAB+ ' + f); setPlaying(p, true);
    });
  }
  function openPicker(fr) {
    let ov = fr.querySelector('.pickerov');
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'pickerov';
      const by = {}; SONGS.slice(0, 20).forEach(s => (by[s[1]] = by[s[1]] || []).push(s));
      ov.innerHTML = `<div class="picker"><div class="row" style="justify-content:space-between;align-items:center"><span class="h2">Choose a song</span><div class="icb picker-x" style="background:var(--s2)"><span class="ms" style="color:var(--t1)">close</span></div></div><div class="pk-list">` +
        Object.entries(by).map(([a, l]) => `<div class="pk-art"><span class="lbl">${a}</span>` + l.map(s => `<div class="pk-row" data-song="${s[0]}|${s[1]}" data-tap><span class="b2" style="color:var(--t1);flex:1">${s[0]}</span><span class="bs num">${fmt(s[2])}</span></div>`).join('') + '</div>').join('') + '</div></div>';
      fr.appendChild(ov);
    }
    const cur = fr.querySelector('.player .h3'); ov.querySelectorAll('[data-song]').forEach(r => r.classList.toggle('on', cur && r.dataset.song.split('|')[0] === cur.textContent));
    requestAnimationFrame(() => ov.classList.add('on'));
  }
  function closePicker(fr) { const ov = fr && fr.querySelector('.pickerov'); if (ov) ov.classList.remove('on'); }

  /* ---------- video (YouTube channels, uploads playlist on loop) ---------- */
  function loadYT(box, list) {
    const f = box.querySelector('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1&mute=1&loop=1&rel=0&modestbranding=1`;
  }
  function isParked(fr) { const g = fr.querySelector('.gear .on'); return g && g.textContent.trim() === 'P'; }

  /* ---------- screen cleaning: touch locked for 30 s ---------- */
  function cleaning(fr) {
    let ov = fr.querySelector('.cleanov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'cleanov'; fr.appendChild(ov); }
    let n = 30; ov.innerHTML = `<span class="ms" style="font-size:56px;color:#fff">cleaning_services</span><span class="h2" style="color:#fff">Cleaning mode</span><span class="bs cl-n" style="color:#d8d5e3">Touch unlocks in 30 s</span>`;
    ov.classList.add('on'); clearInterval(ov._t);
    ov._t = setInterval(() => { n--; ov.querySelector('.cl-n').textContent = `Touch unlocks in ${n} s`; if (n <= 0) { clearInterval(ov._t); ov.classList.remove('on'); } }, 1000);
  }

  /* ---------- Chess (chess.js rules; play the computer or a friend) ---------- */
  const PIECE = { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }, VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function chessNew(w) {
    if (!w || !w.querySelector('.chess')) return;
    if (!window.Chess) { w.querySelector('.chess-s').textContent = 'Chess engine is loading…'; return; }
    w._g = new Chess(); w._sel = null; chessDraw(w);
  }
  function chessDraw(w) {
    const g = w._g, b = w.querySelector('.chess'), files = 'abcdefgh';
    let html = '';
    const targets = w._sel ? g.moves({ square: w._sel, verbose: true }).map(m => m.to) : [];
    for (let r = 8; r >= 1; r--) for (let c = 0; c < 8; c++) {
      const sq = files[c] + r, pc = g.get(sq);
      const cls = ((r + c) % 2 ? 'lt1' : 'dk1') + (w._sel === sq ? ' sel' : '') + (targets.includes(sq) ? ' tgt' : '') + (pc ? (pc.color === 'w' ? ' pw' : ' pb') : '');
      html += `<i class="${cls}" data-sq="${sq}" data-tap>${pc ? PIECE[pc.type] : ''}</i>`;
    }
    b.innerHTML = html;
    const s = w.querySelector('.chess-s');
    s.textContent = g.in_checkmate() ? (g.turn() === 'w' ? 'Checkmate · Black wins' : 'Checkmate · White wins') : g.in_draw() ? 'Draw' : (g.turn() === 'w' ? 'White' : 'Black') + ' to move' + (g.in_check() ? ' · check' : '');
  }
  function chessTap(sqEl) {
    const w = sqEl.closest('.gamewrap'), g = w._g; if (!g || g.game_over()) return;
    const vsCpu = w.querySelector('.g-mode .on').textContent.includes('Computer');
    if (vsCpu && g.turn() === 'b') return;
    const sq = sqEl.dataset.sq, pc = g.get(sq);
    if (w._sel) {
      const mv = g.move({ from: w._sel, to: sq, promotion: 'q' });
      w._sel = null;
      if (mv) { chessDraw(w); if (vsCpu && !g.game_over()) setTimeout(() => chessCpu(w), 450); return; }
    }
    if (pc && pc.color === g.turn()) w._sel = sq;
    chessDraw(w);
  }
  function chessCpu(w) {   // one-move look-ahead: best capture, avoid hanging pieces, else random
    const g = w._g, moves = g.moves({ verbose: true }); if (!moves.length) return;
    let best = null, bs = -1e9;
    for (const m of moves) {
      let sc = (m.captured ? VAL[m.captured] * 10 : 0) + (m.flags.includes('p') ? 80 : 0) + Math.random();
      g.move(m); if (g.in_checkmate()) sc += 1000; else if (g.in_check()) sc += 2;
      const replies = g.moves({ verbose: true }); const worst = replies.reduce((x, r) => Math.max(x, r.captured ? VAL[r.captured] * 10 : 0), 0);
      g.undo(); sc -= worst * 0.9;
      if (sc > bs) { bs = sc; best = m; }
    }
    g.move(best); chessDraw(w);
  }

  /* ---------- Sudoku (numpad, conflicts, solved check) ---------- */
  const PUZ = [
    ['530070000600195000098000060800060003400803001700020006060000280000419005000080079', '534678912672195348198342567859761423426853791713924856961537284287419635345286179'],
    ['000260701680070090190004500820100040004602900050003028009300074040050036703018000', '435269781682571493197834562826195347374682915951743628519326874248957136763418259'],
    ['100489006730000040000001295007120600500703008006095700914600000020000037800512004', '152489376739256841468371295387124659591763428246895713914637582625948137873512964']];
  function suNew(w) {
    if (!w || !w.querySelector('.sudoku')) return;
    w._pi = ((w._pi ?? -1) + 1) % PUZ.length; const [p] = PUZ[w._pi];
    w.querySelector('.sudoku').innerHTML = [...p].map((ch, k) => `<i class="${ch !== '0' ? 'giv' : 'emp'}${(k % 9) === 2 || (k % 9) === 5 ? ' bx' : ''}${Math.floor(k / 9) === 2 || Math.floor(k / 9) === 5 ? ' by' : ''}" data-k="${k}" ${ch === '0' ? 'data-tap' : ''}>${ch !== '0' ? ch : ''}</i>`).join('');
    w._suSel = null; w.querySelector('.su-s').textContent = 'Pick a square, then a number.';
  }
  function suSelect(c) { const w = c.closest('.gamewrap'); if (c.classList.contains('giv')) return; w.querySelectorAll('.sudoku i').forEach(x => x.classList.toggle('sel', x === c)); w._suSel = c; }
  function suEnter(w, n) {
    const c = w._suSel; if (!c) { w.querySelector('.su-s').textContent = 'Pick an empty square first.'; return; }
    c.textContent = n ? n : '';
    const cells = [...w.querySelectorAll('.sudoku i')], v = cells.map(x => x.textContent);
    cells.forEach((x, k) => {
      const r = Math.floor(k / 9), cc = k % 9, br = r - r % 3, bc = cc - cc % 3;
      let bad = false;
      if (v[k]) for (let j = 0; j < 81; j++) { if (j === k || v[j] !== v[k]) continue; const r2 = Math.floor(j / 9), c2 = j % 9; if (r2 === r || c2 === cc || (r2 - r2 % 3 === br && c2 - c2 % 3 === bc)) { bad = true; break; } }
      x.classList.toggle('bad', bad && x.classList.contains('emp'));
    });
    const s = w.querySelector('.su-s');
    if (v.join('') === PUZ[w._pi][1]) s.textContent = 'Solved. Nicely done.';
    else s.textContent = cells.some(x => x.classList.contains('bad')) ? 'That number clashes with another.' : `${v.filter(x => !x).length} squares left`;
  }

  /* ---------- Trivia (endless, Open Trivia DB; offline fallback) ---------- */
  const TVBANK = [['Geography', 'What is the capital of Australia?', 'Canberra', ['Sydney', 'Melbourne', 'Perth']], ['Science', 'What gas do plants absorb from the air?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Helium']], ['History', 'In which year did the Berlin Wall fall?', '1989', ['1979', '1991', '1985']], ['Music', 'Which band recorded “Dancing Queen”?', 'ABBA', ['Queen', 'Blondie', 'Roxette']], ['Geography', 'Which river flows through the Grund in Luxembourg City?', 'Alzette', ['Moselle', 'Sûre', 'Rhine']], ['Science', 'How many planets are in our solar system?', '8', ['7', '9', '10']]];
  const dec = s => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; };
  async function tvFill(tr) {
    if (!tr._q || !tr._q.length) {
      try { const j = await fetch('https://opentdb.com/api.php?amount=10&type=multiple').then(r => r.json()); tr._q = j.results.map(q => [dec(q.category), dec(q.question), dec(q.correct_answer), q.incorrect_answers.map(dec)]); }
      catch (e) { tr._q = TVBANK.slice().sort(() => Math.random() - .5); }
      if (!tr._q.length) tr._q = TVBANK.slice().sort(() => Math.random() - .5);
    }
  }
  async function tvNext(tr) {
    if (!tr) return; await tvFill(tr);
    const [cat, q, ok, no] = tr._q.shift();
    tr.querySelector('.tv-cat').textContent = cat; tr.querySelector('.tv-q').textContent = q; tr.querySelector('.tv-r').textContent = '';
    tr.querySelector('.tv-next').style.visibility = 'hidden';
    tr.querySelector('.tv-a').innerHTML = [ok, ...no].sort(() => Math.random() - .5).map(a => `<div class="btn sec" data-ok="${a === ok ? 1 : 0}" style="justify-content:flex-start;height:56px">${a.replace(/</g, '&lt;')}</div>`).join('');
    tr._done = false;
  }
  function tvAnswer(b) {
    const tr = b.closest('.trivia'); if (tr._done) return; tr._done = true;
    const ok = b.dataset.ok === '1'; tr._score = (tr._score || 0) + (ok ? 1 : 0); tr._n = (tr._n || 0) + 1;
    b.classList.add(ok ? 'ok' : 'no'); if (!ok) tr.querySelector('.tv-a [data-ok="1"]').classList.add('ok');
    tr.querySelector('.tv-score').textContent = `Score ${tr._score} / ${tr._n}`;
    tr.querySelector('.tv-r').textContent = ok ? 'Correct.' : 'Not this time.';
    tr.querySelector('.tv-next').style.visibility = 'visible';
  }

  /* ---------- one dashboard, 15 s loop, following the real route:
     Route d'Esch (3 lanes) → red light → right onto Avenue Marie-Thérèse (2 lanes each way)
     → move to the left lane for Boulevard Joseph II, 170 m on. Speeds ramp like a real car. ---------- */
  document.querySelectorAll('[data-dash]').forEach(fr => {
    const w = fr.querySelector('.cv-world'); if (!w) return;
    w.dataset.dash = '1';
    const app = w.closest('.app'), cv = w.closest('.carview'), chipT = cv.querySelector('.cv-chip-t'), chipS = cv.querySelector('.cv-chip .bs'), tlT = cv.querySelector('.tl-t');
    const ex = +w.dataset.ex, y0 = +w.dataset.y0, R = +w.dataset.r, LC = +w.dataset.lc || 140, Y = 440, D = Y - y0, A = Math.PI / 2 * R;
    const cam = fr.querySelector('.ctx .bscam'), pl = fr.querySelector('.ctx .player'), upr = [...w.querySelectorAll('.upr')];
    // one scale for everything: 120 px/s = 45 km/h, so 1 px ≈ 0.104 m
    const T = 25, SV = +w.dataset.sv || 392, MPX = 0.104, KMH = 0.375;
    const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const V0 = 120, VT = 59, VE = 107;                             // 45 km/h approach, 22 km/h through the corner, 40 km/h after
    const GO = 9.6;                                                // light turns green at 9.4 s, car moves at 9.6 s
    let tArcEnd = 99;
    const vel = t => t < 4.5 ? V0 : t < 7 ? V0 * (1 - sm((t - 4.5) / 2.5)) : t < GO ? 0 : t < GO + 2.4 ? VT * sm((t - GO) / 2.4) : t < tArcEnd ? VT : VT + (VE - VT) * sm((t - tArcEnd) / 4);
    const DT = 0.005, N = Math.round(T / DT), ST = new Float64Array(N + 1);
    const build = () => { for (let k = 1; k <= N; k++) ST[k] = ST[k - 1] + vel((k - .5) * DT) * DT; };
    build();
    const SOFF = SV - ST[Math.round(7 / DT)];                      // stop exactly at SV
    // find when the corner ends, then rebuild so the car only speeds up once it is straight again
    for (let k = 0; k <= N; k++) if (SOFF + ST[k] >= D + A) { tArcEnd = k * DT; break; }
    build();
    const sAt = t => SOFF + ST[Math.min(N, Math.round(t / DT))];
    const vAt = t => vel(t);
    const U0 = 60, UL = 480;                                        // gentle lane change: starts 6 m after the corner, takes ~50 m
    const pose = s => {
      if (s < D) return [ex, Y - s, 0];
      if (s < D + A) { const f = (s - D) / R; return [ex + R - R * Math.cos(f), y0 - R * Math.sin(f), f * 180 / Math.PI]; }
      const u = s - D - A, k = (u - U0) / UL, yy = y0 - R - LC * sm(k);
      const slope = k > 0 && k < 1 ? LC * 6 * k * (1 - k) / UL : 0;
      return [ex + R + u, yy, 90 - Math.atan(slope) * 180 / Math.PI];
    };
    const $ = s => app.querySelector(`[data-nav="${s}"]`);
    const ui = { dist: $('dist'), street: $('street'), icon: $('icon'), lanes: $('lanes'), then: $('then') };
    const lanesHTML = l => l.map(x => x.endsWith('*') ? `<span class="ms go f">${x.slice(0, -1)}</span>` : `<span class="ms">${x}</span>`).join('');
    let phase = '';
    function card(ph, dist) {
      if (ui.dist) ui.dist.textContent = dist;
      if (ph === phase) return; phase = ph;
      const c = ph === 'right' ? ['turn_right', 'Avenue Marie-Thérèse', ['straight', 'straight', 'turn_right*'], 'then left onto Bd Joseph II']
                               : ['turn_left', 'Boulevard Joseph II', ['turn_left*', 'straight'], 'then keep left onto Bd de la Foire'];
      if (ui.icon) ui.icon.textContent = c[0]; if (ui.street) ui.street.textContent = c[1];
      if (ui.lanes) { ui.lanes.style.visibility = 'visible'; ui.lanes.innerHTML = lanesHTML(c[2]); } if (ui.then) ui.then.textContent = c[3];
    }
    const navOn = () => !fr.querySelector('[data-screen]') || fr.querySelector('[data-screen="nav"].on');
    let t0 = null, bsWas = false, wasCar = false;
    function setBS(on) {
      if (on === bsWas) return; bsWas = on;
      fr.classList.toggle('bs-on', on); if (pl) pl.classList.toggle('compact', on);
      if (cam) {
        const ctx = cam.parentElement, other = [...ctx.children].filter(c => c !== cam && c !== pl && c.offsetParent !== null).reduce((h, c) => h + c.offsetHeight + 16, 0);
        cam.style.height = on ? Math.max(200, ctx.clientHeight - other - 112 - 16) + 'px' : '0px';
      }
    }
    const m = px => Math.max(5, Math.round(px * MPX / 5) * 5) + ' m';
    const spd = fr.querySelector('[data-nav="speed"]') || fr.querySelector('.status .speed b'), ind = fr.querySelector('.bs-ind .ms');
    function frame(ts) {
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) % T;
      const active = navOn();
      if (!app.classList.contains('v-car')) { fr.classList.toggle('bs-sig', active && t > 1.8 && t < 10.8); if (ind) ind.textContent = 'turn_right'; }
      setBS(active && t > 2.6 && t < 6.6);
      const green = t > 9.4; cv.classList.toggle('tl-green', green); cv.classList.toggle('tl-red', !green);
      const isCar = app.classList.contains('v-car') && active; app.classList.toggle('dash-car', isCar);
      if (isCar) {
        const s = sAt(t), [x, y, h] = pose(s);
        w.setAttribute('transform', `translate(${ex} ${Y}) rotate(${-h}) translate(${-x} ${-y})`);
        upr.forEach(g => g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) rotate(${h})`));   // signs stay readable
        w.classList.toggle('fade', t > T - 0.6 || t < 0.2);
        const u = s - D - A, toLeft = 170 - Math.max(0, u) * MPX;      // Joseph II is ~170 m after the turn
        if (spd) spd.textContent = Math.round(vAt(t) * KMH);
        const lc = u > U0 - 40 && u < U0 + UL, rightInd = t > 1.8 && s < D + A;
        if (ind) { ind.textContent = lc ? 'turn_left' : 'turn_right'; }
        fr.classList.toggle('bs-sig', rightInd || lc);
        let chip, sub = 'Stay in this lane';
        if (s < SV - 1) { chip = `Lane 3 of 3 · turn right in ${m(D - s)}`; card('right', m(D - s)); }
        else if (t < GO) { chip = 'Waiting at the junction'; sub = 'Right-turn lane'; card('right', m(D - s)); }
        else if (s < D + A) { chip = 'Turning right'; sub = 'Onto Avenue Marie-Thérèse'; card('right', 'Now'); }
        else if (u < U0 + UL) { chip = 'Move to lane 1 of 2'; sub = `Left turn in ${Math.round(toLeft / 10) * 10} m`; card('left', Math.round(toLeft / 10) * 10 + ' m'); }
        else { chip = `Lane 1 of 2 · turn left in ${Math.round(toLeft / 10) * 10} m`; card('left', Math.round(toLeft / 10) * 10 + ' m'); }
        if (chipT) chipT.textContent = chip; if (chipS) chipS.textContent = sub;
        if (tlT) tlT.textContent = green ? 'Green · go' : t > 6.4 ? 'Red light · stopping' : 'Traffic light ahead · red';
      } else if (wasCar) { phase = ''; if (window.nioNavRefresh) window.nioNavRefresh(app); }
      wasCar = isCar;
      requestAnimationFrame(frame);
    }
    const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!rm) requestAnimationFrame(frame); else { cv.classList.add('tl-red'); }
  });

  const PEOPLE = ['bora', 'charles', 'emma', 'mamma', 'mar', 'pierre', 'ashish'];
  function avHTML(name, s) {
    const k = String(name).toLowerCase();
    return PEOPLE.includes(k) ? `<img class="av" src="img/people/${k}.jpg" alt="${name}" style="width:${s}px;height:${s}px">`
      : `<span class="av av-i" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .4)}px">${k === 'keypad' || /^\+?\d/.test(name) ? '<span class="ms" style="font-size:inherit">dialpad</span>' : String(name).slice(0, 1)}</span>`;
  }
  function logCall(fr, name) {
    const list = fr.querySelector('.recents'); if (!list) return null;
    const clock = (fr.querySelector('.status .time') || {}).textContent || '13:48';
    const row = document.createElement('div'); row.className = 'lrow'; row.dataset.call = name; row.setAttribute('data-tap', '');
    row.innerHTML = `${avHTML(name, 44)}<div class="col" style="gap:0;flex:1"><span class="b2" style="color:var(--t1)">${name}</span><span class="bs row" style="gap:4px"><span class="ms" style="font-size:16px;color:var(--t3)">call_made</span><span class="lc-s">Outgoing · calling</span></span></div><span class="bs num">Today ${clock.trim()}</span><span class="callbtn sm"><span class="ms f" style="font-size:20px;color:#fff">call</span></span>`;
    list.prepend(row); row.animate([{ background: 'var(--sel)' }, { background: 'transparent' }], { duration: 1600, easing: 'ease-out' });
    return row;
  }
  /* ---------- Settings › Sound ---------- */
  const EQP = { Balanced: [0, 0, 0], Vocal: [-2, 3, 1], Bass: [5, 0, -1], Concert: [2, -1, 3] };
  function eqPaint(card) {
    const v = [...card.querySelectorAll('[data-eq]')].map(s => Math.round((parseFloat(s.style.getPropertyValue('--v')) / 100) * 12 - 6));
    const y = x => 45 - x * 6.5;
    card.querySelector('.eq-p').setAttribute('d', `M0 ${y(v[0])}C60 ${y(v[0])} 110 ${y(v[0])} 150 ${(y(v[0]) + y(v[1])) / 2}S200 ${y(v[1])} 230 ${y(v[1])}S320 ${y(v[2])} 400 ${y(v[2])}`);
  }
  function eqChanged(s) { if (!s) return; const card = s.closest('.scard'); card.querySelectorAll('.eq-pre div').forEach(d => d.classList.toggle('on', d.textContent === 'Custom')); card.querySelector('.eq-name').textContent = 'Custom'; eqPaint(card); }
  function eqPreset(d) {
    const card = d.closest('.scard'), p = EQP[d.textContent]; card.querySelectorAll('.eq-pre div').forEach(x => x.classList.toggle('on', x === d));
    card.querySelector('.eq-name').textContent = d.textContent; if (!p) return;
    card.querySelectorAll('[data-eq]').forEach((s, i) => { s.style.setProperty('--v', ((p[i] + 6) / 12 * 100) + '%'); s.parentElement.querySelector('.val').textContent = (p[i] > 0 ? '+' : '') + p[i] + ' dB'; });
    eqPaint(card);
  }
  const SF = { 'All seats': [50, 50], Driver: [30, 36], Front: [50, 34], Rear: [50, 68] };
  function sfSet(pad, x, y, label) {
    const dot = pad.querySelector('.sf-dot'); dot.style.left = x + '%'; dot.style.top = y + '%';
    const bal = Math.round((x - 50) / 5), fade = Math.round((50 - y) / 5);
    const rd = pad.closest('.scard').querySelector('.sf-read');
    rd.textContent = `${label || (bal === 0 && fade === 0 ? 'Centred' : 'Custom')} · balance ${bal > 0 ? 'R' + bal : bal < 0 ? 'L' + (-bal) : 0} · fade ${fade > 0 ? 'F' + fade : fade < 0 ? 'R' + (-fade) : 0}`;
    if (!label) pad.closest('.scard').querySelectorAll('.sf-focus div').forEach(d => d.classList.remove('on'));
  }
  let sfDrag = null;
  document.addEventListener('pointerdown', e => { const pad = e.target.closest('.sf-pad'); if (!pad) return; sfDrag = pad; sfMove(e); });
  document.addEventListener('pointermove', e => { if (sfDrag) sfMove(e); });
  document.addEventListener('pointerup', () => { sfDrag = null; });
  function sfMove(e) { const r = sfDrag.getBoundingClientRect(); sfSet(sfDrag, Math.max(12, Math.min(88, (e.clientX - r.left) / r.width * 100)), Math.max(14, Math.min(86, (e.clientY - r.top) / r.height * 100))); }
  // previews: short tones at the row's own level
  function tone(seq, vol) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      let t0 = ac.currentTime + 0.02;
      seq.forEach(([f, d, type]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.16 * vol), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02); t0 += d * 0.85; });
    } catch (e) {}
  }
  const TONES = { nav: [[880, .18], [1175, .3]], call: [[440, .25], [480, .25], [440, .25]], nomi: [[660, .12], [990, .12], [1320, .28]], ring: [[1046, .14], [1318, .14], [1568, .3]],
    chime: [[1200, .3, 'triangle']], tap: [[2100, .06, 'triangle']], lock: [[1320, .08], [990, .16]], lockClassic: [[880, .12, 'square'], [880, .12, 'square']],
    welcome: [[523, .25], [659, .25], [784, .25], [1046, .6]], welcomeB: [[784, .3], [659, .3], [880, .7]] };
  const sndBar = snd => snd.parentElement.querySelector('.snd-tabs');
  function sndTabs(snd, k) { sndBar(snd).querySelectorAll('div').forEach(d => d.classList.toggle('on', d.dataset.sndGo === k)); }
  // scrolling the page lights up the section you are in; content dissolves under the bar
  document.addEventListener('scroll', e => {
    const snd = e.target; if (!snd.classList || !snd.classList.contains('snd')) return;
    snd.parentElement.classList.toggle('scrolled', snd.scrollTop > 4);
    if (snd._jump) return;
    const top = snd.getBoundingClientRect().top + 40;
    let cur = 'vol'; snd.querySelectorAll('.snd-sec').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.sec; });
    if (snd.scrollTop + snd.clientHeight >= snd.scrollHeight - 4) cur = 'car';
    sndTabs(snd, cur);
  }, true);
  function sndClick(t) {
    const go = t.closest('[data-snd-go]');
    if (go) { const snd = go.closest('.snd-wrap').querySelector('.snd'), sec = snd.querySelector(`[data-sec="${go.dataset.sndGo}"]`);
      sndTabs(snd, go.dataset.sndGo); snd._jump = true; clearTimeout(snd._jt); snd._jt = setTimeout(() => snd._jump = false, 700);
      snd.scrollTo({ top: sec.offsetTop - 14, behavior: 'smooth' }); return true; }
    const pv = t.closest('[data-snd-test]');
    if (pv) { const v = parseFloat(pv.parentElement.querySelector('.sl').style.getPropertyValue('--v')) / 100; tone(TONES[pv.dataset.sndTest], v); return true; }
    const pl = t.closest('[data-snd-play]');
    if (pl) { const card = pl.closest('.row'); const ch = card.querySelector('.segx .on').textContent;
      if (ch === 'Off') { toast(frameOf(pl), 'This sound is off'); return true; }
      tone(pl.dataset.sndPlay === 'lock' ? (ch === 'Classic' ? TONES.lockClassic : TONES.lock) : (ch === 'Breeze' ? TONES.welcomeB : TONES.welcome), 0.7); return true; }
    const eq = t.closest('.eq-pre div'); if (eq) { eqPreset(eq); return true; }
    const sf = t.closest('.sf-focus div'); if (sf) { sf.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === sf)); sfSet(sf.closest('.scard').querySelector('.sf-pad'), ...SF[sf.textContent], sf.textContent); return true; }
    if (t.closest('[data-sf-reset]')) { const c = t.closest('.scard'); c.querySelectorAll('.sf-focus div').forEach((d, i) => d.classList.toggle('on', i === 0)); sfSet(c.querySelector('.sf-pad'), 50, 50, 'Centred'); return true; }
    return false;
  }
  // long-press the dock volume to open Settings › Sound
  let lpT = null, lpX = 0, lpFired = false;
  document.addEventListener('click', e => { if (lpFired) { lpFired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // a long-press is not a mute tap
  document.addEventListener('pointerdown', e => { const v = e.target.closest('.dock .dvol, .dock .vol'); if (!v) return; lpX = e.clientX;
    lpT = setTimeout(() => { lpT = null; if (drag) { drag.s.classList.remove('drag'); drag = null; } const fr = frameOf(v); route(fr, 'settings:Sound'); lpFired = true; toast(fr, 'Sound settings'); }, 650); });
  document.addEventListener('pointermove', e => { if (lpT && Math.abs(e.clientX - lpX) > 8) { clearTimeout(lpT); lpT = null; } });
  document.addEventListener('pointerup', () => { if (lpT) { clearTimeout(lpT); lpT = null; } });

  function toast(fr, msg) {
    let el = fr.querySelector('.htoast'); if (!el) { el = document.createElement('div'); el.className = 'htoast'; fr.appendChild(el); }
    el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
  /* ---------- Calendar: week / month / year, Emma's plans, add a random event ---------- */
  const CY = new Date().getFullYear();
  const CAT = { work: '#cddcf7', art: '#f3dde4', hike: '#d5ead8', ski: '#d5ead8', life: '#e9dcf3' };
  const EVENTS = [
    [11, 22, '14:00', 'Mudam visit', 'Kirchberg', 'art'], [11, 22, '16:00', 'Ville Haute walk', 'Old town', 'life'], [11, 22, '18:00', 'Grand Ducal Palace', 'Tour', 'art'], [11, 22, '20:30', 'Dinner at Aké', 'Booked by Ashish', 'life'],
    [11, 24, '10:00', 'Client walkthrough', 'Limpertsberg apartment', 'work'], [11, 26, '19:00', 'Gallery opening', 'Casino Luxembourg', 'art'],
    [11, 28, '08:30', 'Hike · Mullerthal Trail', 'Route 1, Echternach', 'hike'], [12, 2, '11:00', 'Fabric and tile samples', 'Studio', 'work'],
    [12, 11, 'All day', 'Ski weekend', 'Saas-Fee, until Sunday', 'ski'], [12, 12, 'All day', 'Ski weekend', 'Saas-Fee', 'ski'], [12, 13, 'All day', 'Ski weekend', 'Saas-Fee', 'ski'],
    [12, 17, '18:30', 'Christmas market sketch walk', "Place d'Armes", 'art']].map(e => ({ d: new Date(CY, e[0] - 1, e[1]), t: e[2], n: e[3], w: e[4], c: e[5] }));
  const IDEAS = [['Showroom visit', 'Kitchen supplier, Bertrange', 'work'], ['Museum late', 'MNHA', 'art'], ['Hike · Schiessentümpel loop', 'Mullerthal', 'hike'], ['Lunch with Ashish', 'Grund', 'life'],
    ['Design review', 'Clausen loft', 'work'], ['Life drawing class', 'Studio Bonnevoie', 'art'], ['Ski pass renewal', 'Online', 'life'], ['Moodboard session', 'Studio', 'work'], ['Hike · Müllerthal sunrise', 'Berdorf', 'hike']];
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const evOn = d => EVENTS.filter(e => sameDay(e.d, d)).sort((a, b) => a.t.localeCompare(b.t));
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function calInit(cw) { if (!cw) return; const t = new Date(); cw._sel = new Date(t.getFullYear(), t.getMonth(), t.getDate()); cw._view = 'Today'; calDraw(cw); }
  function calDraw(cw) {
    const sel = cw._sel, today = new Date(), body = cw.querySelector('.cal-body'), title = cw.querySelector('.cal-title');
    cw.querySelectorAll('.cal-view div').forEach(d => d.classList.toggle('on', d.textContent === cw._view));
    let h = '';
    if (cw._view === 'Today') {
      title.textContent = sameDay(sel, today) ? 'Today' : sel.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const ev = evOn(sel), allDay = ev.filter(e => !/^\d/.test(e.t)), H0 = 8, H1 = 22, PX = 44;
      h = `<div class="cal-dv">${allDay.map(e => `<div class="cal-ad" style="background:${CAT[e.c]}">All day · ${e.n}</div>`).join('')}<div class="cal-tl" style="height:${(H1 - H0) * PX}px">`;
      for (let hh = H0; hh <= H1; hh++) h += `<div class="cal-hr" style="top:${(hh - H0) * PX}px"><span class="num">${String(hh).padStart(2, '0')}:00</span></div>`;
      ev.filter(e => /^\d/.test(e.t)).forEach(e => { const [a, b] = e.t.split(':').map(Number), y = (a + b / 60 - H0) * PX;
        h += `<div class="cal-blk" style="top:${y + 2}px;height:${(e.len || 1) * PX - 4}px;background:${CAT[e.c]}"><b>${e.n}</b><span>${e.t} · ${e.w}</span></div>`; });
      if (sameDay(sel, today)) { const nowH = today.getHours() + today.getMinutes() / 60; if (nowH >= H0 && nowH <= H1) h += `<div class="cal-now" style="top:${(nowH - H0) * PX}px"></div>`; }
      h += '</div></div>';
    } else if (cw._view === 'Month') {
      title.textContent = `${MON[sel.getMonth()]} ${sel.getFullYear()}`;
      const first = new Date(sel.getFullYear(), sel.getMonth(), 1), off = (first.getDay() + 6) % 7;
      h = '<div class="cal-m">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="cal-h">${d}</span>`).join('');
      for (let k = 0; k < 42; k++) {
        const d = new Date(sel.getFullYear(), sel.getMonth(), 1 - off + k), ev = evOn(d), out = d.getMonth() !== sel.getMonth();
        h += `<div class="cal-d${out ? ' out' : ''}${sameDay(d, today) ? ' today' : ''}${sameDay(d, sel) ? ' sel' : ''}" data-cal-day="${d.getTime()}" data-tap><b>${d.getDate()}</b>${ev.slice(0, 2).map(e => `<i style="background:${CAT[e.c]}">${e.n}</i>`).join('')}${ev.length > 2 ? `<small>+${ev.length - 2} more</small>` : ''}</div>`;
      }
      h += '</div>';
    } else if (cw._view === 'Week') {
      const mon = new Date(sel); mon.setDate(sel.getDate() - (sel.getDay() + 6) % 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      title.textContent = `${mon.getDate()} ${MON[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MON[sun.getMonth()].slice(0, 3)}`;
      h = '<div class="cal-w">' + Array.from({ length: 7 }, (_, k) => {
        const d = new Date(mon); d.setDate(mon.getDate() + k);
        return `<div class="cal-wc${sameDay(d, sel) ? ' sel' : ''}${sameDay(d, today) ? ' today' : ''}" data-cal-day="${d.getTime()}" data-tap><span class="cal-h">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k]}</span><b>${d.getDate()}</b>` +
          evOn(d).map(e => `<div class="cal-ev" style="background:${CAT[e.c]}"><span class="num">${e.t}</span>${e.n}</div>`).join('') + '</div>';
      }).join('') + '</div>';
    } else {
      title.textContent = String(sel.getFullYear());
      h = '<div class="cal-y">' + MON.map((mn, m) => {
        const first = new Date(sel.getFullYear(), m, 1), off = (first.getDay() + 6) % 7, days = new Date(sel.getFullYear(), m + 1, 0).getDate();
        let g = '<i></i>'.repeat(off);
        for (let d = 1; d <= days; d++) { const dt = new Date(sel.getFullYear(), m, d); g += `<i class="${evOn(dt).length ? 'ev' : ''}${sameDay(dt, today) ? ' today' : ''}">${d}</i>`; }
        return `<div class="cal-ym" data-cal-month="${m}" data-tap><span class="b2" style="color:var(--t1)">${mn}</span><div class="cal-yg">${g}</div></div>`;
      }).join('') + '</div>';
    }
    body.innerHTML = h;
    const ev = evOn(sel);
    cw.querySelector('.cal-day').textContent = sameDay(sel, today) ? 'Today' : sel.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    cw.querySelector('.cal-list').innerHTML = ev.length ? ev.map(e => `<div class="cal-li"><i style="background:${CAT[e.c]}"></i><div class="col" style="gap:0"><span class="b2" style="color:var(--t1)">${e.n}</span><span class="bs">${e.t} · ${e.w}</span></div></div>`).join('') : '<span class="bs">Nothing planned.</span>';
  }
  function calClick(t) {
    const cw = t.closest('.calw'); if (!cw) return false;
    if (t.closest('.cal-sheetov')) { ceClick(cw, t); return true; }
    const vd = t.closest('.cal-view div'); if (vd) { cw._view = vd.textContent; calDraw(cw); return true; }
    const st = t.closest('[data-cal-step]');
    if (st) { const k = +st.dataset.calStep, s = cw._sel;
      cw._sel = cw._view === 'Today' ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + k) : cw._view === 'Month' ? new Date(s.getFullYear(), s.getMonth() + k, 1) : cw._view === 'Week' ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * k) : new Date(s.getFullYear() + k, s.getMonth(), 1);
      calDraw(cw); return true; }
    const dd = t.closest('[data-cal-day]'); if (dd) { cw._sel = new Date(+dd.dataset.calDay); calDraw(cw); return true; }
    const mm = t.closest('[data-cal-month]'); if (mm) { cw._sel = new Date(cw._sel.getFullYear(), +mm.dataset.calMonth, 1); cw._view = 'Month'; calDraw(cw); return true; }
    if (t.closest('[data-cal-add]')) { ceOpen(cw); return true; }
    return false;
  }

  /* ---------- New event sheet ---------- */
  function ceOpen(cw) {
    const ov = cw.querySelector('.cal-sheetov'); cw._ce = { d: new Date(cw._sel), m: 10 * 60, cat: 'work' };
    ov.querySelector('.ce-title').value = ''; ov.querySelector('.ce-where').value = '';
    ov.querySelectorAll('.ce-cat .chip2').forEach(c => c.classList.toggle('on', c.dataset.ceCat === 'work'));
    cePaint(cw); ov.classList.add('on'); setTimeout(() => ov.querySelector('.ce-title').focus({ preventScroll: true }), 350);
  }
  function cePaint(cw) {
    const ov = cw.querySelector('.cal-sheetov'), e = cw._ce, today = new Date();
    ov.querySelector('.ce-date').textContent = sameDay(e.d, today) ? 'Today' : e.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    ov.querySelector('.ce-time').textContent = `${String(Math.floor(e.m / 60)).padStart(2, '0')}:${String(e.m % 60).padStart(2, '0')}`;
    ov.querySelector('[data-ce-save]').classList.toggle('off', !ov.querySelector('.ce-title').value.trim());
  }
  function ceClick(cw, t) {
    const ov = cw.querySelector('.cal-sheetov'), e = cw._ce;
    if (t === ov || t.closest('[data-ce-cancel]')) { ov.classList.remove('on'); return; }
    const st = t.closest('[data-ce]'); if (st) { const [k, v] = st.dataset.ce.split('|'); if (k === 'd') e.d = new Date(e.d.getFullYear(), e.d.getMonth(), e.d.getDate() + +v); else e.m = Math.max(6 * 60, Math.min(22 * 60, e.m + +v)); cePaint(cw); return; }
    const sg = t.closest('[data-ce-sugg]'); if (sg) { const [n, c] = sg.dataset.ceSugg.split('|'); ov.querySelector('.ce-title').value = n; e.cat = c; ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x.dataset.ceCat === c)); cePaint(cw); return; }
    const ct = t.closest('[data-ce-cat]'); if (ct) { e.cat = ct.dataset.ceCat; ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x === ct)); return; }
    const sx = t.closest('.ce-len div, .ce-alert div'); if (sx) { [...sx.parentElement.children].forEach(x => x.classList.toggle('on', x === sx)); return; }
    if (t.closest('[data-cal-nomi]')) {
      const [n, w, c] = IDEAS[Math.floor(Math.random() * IDEAS.length)];
      ov.querySelector('.ce-title').value = n; ov.querySelector('.ce-where').value = w; e.cat = c; e.m = (9 + Math.floor(Math.random() * 9)) * 60 + (Math.random() < .5 ? 0 : 30);
      ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x.dataset.ceCat === c)); cePaint(cw); toast(frameOf(cw), 'NOMI filled in a suggestion'); return;
    }
    const sv = t.closest('[data-ce-save]');
    if (sv && !sv.classList.contains('off')) {
      const len = ov.querySelector('.ce-len .on').textContent, n = ov.querySelector('.ce-title').value.trim();
      const tm = len === 'All day' ? 'All day' : ov.querySelector('.ce-time').textContent;
      EVENTS.push({ d: e.d, t: tm, n, w: ov.querySelector('.ce-where').value.trim() || 'No place', c: e.cat, len: len === '2 h' ? 2 : len === '30 min' ? .5 : 1 });
      ov.classList.remove('on'); cw._sel = e.d; calDraw(cw);
      toast(frameOf(cw), `Saved · ${n}, ${ov.querySelector('.ce-date').textContent} ${tm === 'All day' ? '(all day)' : tm}`);
    }
  }
  document.addEventListener('input', ev => { const cw = ev.target.closest && ev.target.closest('.calw'); if (cw && cw._ce) cePaint(cw); });

  /* ---------- Weather: Paris and New Delhi below Luxembourg (Open-Meteo, live) ---------- */
  function weatherCities(root) {
    root.querySelectorAll('.wcity').forEach(c => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.dataset.lat}&longitude=${c.dataset.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=${encodeURIComponent(c.dataset.tz)}`)
        .then(r => r.json()).then(j => {
          const codes = window.nioCodes || [], m = codes.filter(x => x[0] <= j.current.weather_code).pop() || [0, 'clear', 'clear_day'];
          const lt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.dataset.tz });
          c.querySelector('.wc-c').textContent = Math.round(j.current.temperature_2m) + ' °C';
          c.querySelector('.wc-t').textContent = `${m[1]} · ${lt} local`; const hr = +lt.slice(0, 2), night = hr < 7 || hr >= 18; c.querySelector('.wc-i').textContent = night ? m[2].replace('clear_day', 'clear_night').replace('partly_cloudy_day', 'partly_cloudy_night') : m[2];
          c.querySelector('.wc-h').textContent = `H ${Math.round(j.daily.temperature_2m_max[0])}° · L ${Math.round(j.daily.temperature_2m_min[0])}°`;
        }).catch(() => { c.querySelector('.wc-t').textContent = 'weather unavailable'; });
    });
  }

  /* ---------- Parking app: suggest → compare → time → confirm → booked ---------- */
  const GAR = [['Parking Trois Glands', 2.40], ['Kirchberg Shopping', 1.80], ['Parking Coque', 1.20]];
  function pPaint(pf) {
    const [name, rate] = GAR[+pf.dataset.g], at = pf.dataset.at, h = parseInt(pf.dataset.dur) + (+pf.dataset.ext || 0);
    const [hh, mm] = at.split(':').map(Number), end = `${String((hh + h) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const set = (k, v) => pf.querySelectorAll(`[data-pv="${k}"]`).forEach(x => x.textContent = v);
    set('name', name); set('until', end); set('span', `${at} – ${end}`); set('total', '€' + (rate * h).toFixed(2));
  }
  function pClick(t) {
    const pf = t.closest('.pflow'); if (!pf) return false;
    const ps = t.closest('[data-pset]'), pg = t.closest('[data-pgo]');
    if (!ps && !pg && !t.closest('[data-pext]')) return false;
    if (ps) {
      const [k, v] = ps.dataset.pset.split('|'); pf.dataset[k] = v;
      if (ps.parentElement.classList.contains('pchips')) [...ps.parentElement.children].forEach(c => c.classList.toggle('on', c === ps));
    }
    if (t.closest('[data-pext]')) { pf.dataset.ext = (+pf.dataset.ext || 0) + 1; toast(frameOf(pf), 'Booking extended by 1 hour'); }
    if (pg) {
      if (pg.hasAttribute('data-pcancel')) { pf.dataset.ext = 0; toast(frameOf(pf), 'Booking cancelled · refunded to saved payment method'); }
      pf.querySelectorAll('.pst').forEach(s => s.classList.toggle('on', s.dataset.st === pg.dataset.pgo));
    }
    pPaint(pf); return true;
  }

  /* ---------- 2048 ---------- */
  function g2048New(w) {
    if (!w) return; w._b = Array(16).fill(0); w._sc = 0; g2048Add(w); g2048Add(w); g2048Draw(w);
    w.querySelector('.g-s').textContent = 'Swipe on the board or use the arrows.';
    const b = w.querySelector('.b2048');
    if (!b._sw) { b._sw = 1; let sx, sy;
      b.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
      b.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; g2048Move(w, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }); }
  }
  function g2048Add(w) { const e = w._b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) w._b[e[Math.floor(Math.random() * e.length)]] = Math.random() < .9 ? 2 : 4; }
  function g2048Draw(w, fresh) {
    w.querySelector('.b2048').innerHTML = w._b.map(v => `<i class="t${Math.min(v, 4096)}">${v || ''}</i>`).join('');
    w.querySelector('.g-score').textContent = 'Score ' + w._sc;
  }
  function g2048Move(w, dir) {
    if (!w._b) return;
    const idx = (r, c) => dir === 'left' ? r * 4 + c : dir === 'right' ? r * 4 + 3 - c : dir === 'up' ? c * 4 + r : (3 - c) * 4 + r;
    let moved = false;
    for (let r = 0; r < 4; r++) {
      const line = [0, 1, 2, 3].map(c => w._b[idx(r, c)]).filter(Boolean), out = [];
      for (let i = 0; i < line.length; i++) { if (line[i] === line[i + 1]) { out.push(line[i] * 2); w._sc += line[i] * 2; i++; } else out.push(line[i]); }
      while (out.length < 4) out.push(0);
      out.forEach((v, c) => { if (w._b[idx(r, c)] !== v) moved = true; w._b[idx(r, c)] = v; });
    }
    if (moved) g2048Add(w); g2048Draw(w);
    const s = w.querySelector('.g-s');
    if (w._b.includes(2048)) s.textContent = 'You made 2048. Keep going?';
    else if (!w._b.includes(0) && ![0, 1, 2, 3].some(r => [0, 1, 2].some(c => w._b[r * 4 + c] === w._b[r * 4 + c + 1] || w._b[c * 4 + r] === w._b[(c + 1) * 4 + r]))) s.textContent = 'No moves left. Start a new game.';
  }

  /* ---------- Minesweeper (9 × 9, 10 mines, first tap is always safe) ---------- */
  function minesNew(w) {
    if (!w) return; w._m = null; w._open = 0; w._over = false; w._fl = 0;
    w.querySelector('.bmines').innerHTML = Array.from({ length: 81 }, (_, k) => `<i data-mk="${k}" data-tap></i>`).join('');
    w.querySelector('.m-left').textContent = '10 mines'; w.querySelector('.m-s').textContent = 'Tap to reveal. Hold, or switch to Flag, to mark a mine.';
    const b = w.querySelector('.bmines');
    if (!b._lp) { b._lp = 1; let tm;
      b.addEventListener('pointerdown', e => { const c = e.target.closest('[data-mk]'); if (!c) return; tm = setTimeout(() => { tm = null; c._held = true; minesFlag(w, c); }, 450); });
      ['pointerup', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { if (tm) clearTimeout(tm); tm = null; })); }
  }
  const nb = k => { const r = Math.floor(k / 9), c = k % 9, o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const R = r + dr, C = c + dc; if ((dr || dc) && R >= 0 && R < 9 && C >= 0 && C < 9) o.push(R * 9 + C); } return o; };
  function minesFlag(w, c) {
    if (w._over || c.classList.contains('op')) return;
    c.classList.toggle('fl'); c.innerHTML = c.classList.contains('fl') ? '<span class="ms f">flag</span>' : '';
    w._fl += c.classList.contains('fl') ? 1 : -1; w.querySelector('.m-left').textContent = `${10 - w._fl} mines`;
  }
  function minesTap(c) {
    const w = c.closest('.gamewrap'); if (c._held) { c._held = false; return; }
    if (w._over) return;
    if (w.querySelector('.m-mode .on').textContent.includes('Flag')) { minesFlag(w, c); return; }
    if (c.classList.contains('fl')) return;
    const k = +c.dataset.mk;
    if (!w._m) { const safe = new Set([k, ...nb(k)]); w._m = new Set(); while (w._m.size < 10) { const r = Math.floor(Math.random() * 81); if (!safe.has(r)) w._m.add(r); } }
    const cells = w.querySelectorAll('.bmines i');
    if (w._m.has(k)) {
      w._over = true; w._m.forEach(m => { cells[m].classList.add('mine'); cells[m].innerHTML = '<span class="ms f">brightness_7</span>'; }); c.classList.add('boom');
      w.querySelector('.m-s').textContent = 'Mine. Start a new game to try again.'; return;
    }
    const stack = [k];
    while (stack.length) {
      const q = stack.pop(), el = cells[q]; if (el.classList.contains('op') || el.classList.contains('fl')) continue;
      const n = nb(q).filter(x => w._m.has(x)).length; el.classList.add('op', 'n' + n); el.textContent = n || ''; w._open++;
      if (!n) nb(q).forEach(x => stack.push(x));
    }
    if (w._open === 71) { w._over = true; w.querySelector('.m-s').textContent = 'Cleared. Well played.'; }
  }

  /* ---------- router (prototype): bottom bar + gear switch screens ---------- */
  const NAMES = { media: 'Media', phone: 'Phone', apps: 'Apps' };
  function route(fr, to) {
    if (!fr) return;
    let arg = null;
    if (to.includes(':')) { [to, arg] = to.split(':'); }
    let scr = fr.querySelector(`[data-screen="${to}"]`);
    if (!scr) return;
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
    const gw = c.querySelector('.gamewrap');
    if (name === 'Chess') chessNew(gw);
    if (name === 'Sudoku') suNew(gw);
    if (name === 'Trivia') tvNext(c.querySelector('.trivia'));
    if (name === '2048') g2048New(gw);
    if (name === 'Calendar') calInit(c.querySelector('.calw'));
    if (name === 'Weather') weatherCities(c);
    if (name === 'Minesweeper') minesNew(gw);
    if (name === 'YouTube') { const box = c.querySelector('.ytbox'); if (isParked(fr)) { box.classList.add('playing'); loadYT(box, c.querySelector('[data-yt].on').dataset.yt); } }
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
    else if (drag.s.hasAttribute('data-bright')) {
      drag.s.style.setProperty('--v', pct + '%');
      const fr = frameOf(drag.s); if (fr.style) fr.style.filter = `brightness(${(0.45 + pct / 100 * 0.86).toFixed(3)})`;
    }
    else if (drag.s.dataset.min !== undefined) {
      let pct2 = pct; const fl = +drag.s.dataset.floor || 0;
      if (pct2 < fl) { pct2 = fl; if (!drag.s._fl) { drag.s._fl = 1; toast(frameOf(drag.s), `Safety chimes stay at ${fl} % or louder`); setTimeout(() => drag.s && (drag.s._fl = 0), 2500); } }
      if (pct2 !== pct) { drag.s.style.setProperty('--v', pct2 + '%'); const o = drag.s.parentElement.querySelector('.val'); if (o) o.textContent = pct2 + ' %'; return; }
      if (drag.s.hasAttribute('data-touchvol')) { tapK = pct / 40; muted = pct === 0; paintSound(); }
      if (drag.s.dataset.eq) setTimeout(() => eqChanged(drag && drag.s), 0);
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
  const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function paintTime(p) {
    const c = p.querySelector('.p-cur'); if (c) c.textContent = fmt(p._pos);
    const d = p.querySelector('.p-dur'); if (d) d.textContent = fmt(p._dur);
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
      svg.innerHTML = `<rect x="1" y="1" width="${w - 2}" height="62" rx="12" fill="#e4e1ee"/><path class="tline" fill="none" stroke="#4b3f52" stroke-width="2" stroke-linejoin="round"/><circle class="pk-l" cx="40" cy="30" fill="#4b3f52"/><circle class="pk-r" cx="${w - 40}" cy="30" fill="#4b3f52"/><g transform="translate(40 30)"><g class="reel">${HUB}</g></g><g transform="translate(${w - 40} 30)"><g class="reel">${HUB}</g></g><circle cx="84" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><circle cx="${w - 84}" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><rect x="${w / 2 - 10}" y="54" width="20" height="8" rx="2" fill="#9b95b5"/>`;
    }
    const f = p._pos / p._dur, rl = 22 - 10 * f, rr = 12 + 10 * f;
    svg.querySelector('.pk-l').setAttribute('r', rl.toFixed(1));
    svg.querySelector('.pk-r').setAttribute('r', rr.toFixed(1));
    svg.querySelector(".tline").setAttribute('d', `M${(40 + rl * 0.45).toFixed(1)} ${(30 + rl * 0.89).toFixed(1)}L84 59.5L${w - 84} 59.5L${(w - 40 - rr * 0.45).toFixed(1)} ${(30 + rr * 0.89).toFixed(1)}`);
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
    if (w.closest('[data-dash]')) return;   // driven by the dashboard timeline
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
