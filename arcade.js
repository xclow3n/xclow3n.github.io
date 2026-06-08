/* ============================================================================
   ARCADE BLOG — arcade.js
   One self-contained script powering every page:
   · random palette per reload  · parallax starfield
   · pixel invaders  · reveal-on-scroll  · XP/read bar  · Konami code
   · 8-bit sound blips (opt-in)  · manual theme switcher
   ========================================================================== */
(function () {
  'use strict';
  // theme list comes from assets/js/theme-pick.js (single source of truth); fallback if absent
  var THEMES = (window.__THEMES && window.__THEMES.length) ? window.__THEMES : ['synthwave', 'acid', 'amber', 'vapor'];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
  var cssVar = function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); };
  // display label is read from each palette's own --theme-name var, so new themes need no JS change
  function themeName() { return (cssVar('--theme-name') || '').replace(/^["']|["']$/g, '').trim() || (theme || '').toUpperCase(); }

  /* theme is already chosen by the inline <head> script (no flash); fall back here */
  if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', pick(THEMES));
  var theme = root.getAttribute('data-theme');

  /* ---------------------------------------------------------------- chrome */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function injectChrome() {
    var frag = document.createDocumentFragment();
    frag.appendChild(el('div', 'bg-grid'));
    if (!reduce) frag.appendChild(el('div', 'bg-floor'));
    var c = el('canvas'); c.id = 'stars'; frag.appendChild(c);
    frag.appendChild(el('div', 'crt'));
    if (!reduce) frag.appendChild(el('div', 'flicker'));
    document.body.appendChild(frag);
  }

  /* ----------------------------------------------------------- pixel sprite */
  // classic 11x8 "crab" invader
  var CRAB = ['00100000100','00010001000','00111111100','01101110110','11111111111','10111111101','10100000101','00011011000'];
  function invaderSVG(cls) {
    var w = CRAB[0].length, h = CRAB.length, r = '';
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (CRAB[y][x] === '1') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    return '<svg class="invader ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">' + r + '</svg>';
  }
  // canonical arcade "legends" — path ghosts (Blinky/Pinky/Inky/Clyde) + fruit/heart
  var GHOSTS = ['#ff4d4d', '#ff9ed2', '#46e8ff', '#ffb24d'];
  function ghostSVG(color, cls) {
    return '<svg class="ghost ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true">'
      + '<path fill="' + color + '" d="M8 1.2C4.8 1.2 2.2 3.8 2.2 7v7.7l1.95-1.95L6.1 14.7 8 12.8l1.9 1.9 1.95-1.95L13.8 14.7V7c0-3.2-2.6-5.8-5.8-5.8z"/>'
      + '<circle cx="6" cy="7" r="2.1" fill="#fff"/><circle cx="10.6" cy="7" r="2.1" fill="#fff"/>'
      + '<circle cx="5.3" cy="7.3" r="1.05" fill="#16121f"/><circle cx="9.9" cy="7.3" r="1.05" fill="#16121f"/></svg>';
  }
  function cherrySVG() {
    return '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">'
      + '<path d="M8.5 3C10.5 3.6 12.7 5 13.5 7.5" stroke="#5ec84b" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
      + '<circle cx="5" cy="11.4" r="3.2" fill="#ff3b3b"/><circle cx="11" cy="12.2" r="3" fill="#e01f1f"/>'
      + '<circle cx="4" cy="10.4" r=".9" fill="#ffb3b3"/></svg>';
  }
  function heartSVG() {
    return '<svg class="ico" viewBox="0 0 16 14" aria-hidden="true">'
      + '<path fill="#ff5e7a" d="M8 13.4 1.7 7.1A3.6 3.6 0 0 1 6.8 2L8 3.2 9.2 2a3.6 3.6 0 0 1 5.1 5.1z"/></svg>';
  }

  function buildInvaders() {
    // hero parade: the (theme-coloured) invaders we kept, now joined by the legends
    document.querySelectorAll('.invrow').forEach(function (row) {
      row.innerHTML = '';
      var parade = [invaderSVG('hop'), '<span class="pac"></span>', ghostSVG(GHOSTS[0], 'bob'),
        invaderSVG('c hop'), ghostSVG(GHOSTS[2], 'bob'), cherrySVG(), heartSVG()];
      parade.forEach(function (html, i) {
        var s = el('span', 'sprite', html); var g = s.firstChild;
        if (g && g.classList && g.classList.contains('invader')) { g.style.width = '40px'; g.style.height = '31px'; }
        if (g && g.style) g.style.animationDelay = (i * 0.11) + 's';
        row.appendChild(s);
      });
    });
    // footer: Pac-Man flees a ghost squad across the screen
    document.querySelectorAll('.marquee-row').forEach(function (row) {
      row.innerHTML = '';
      var chase = el('div', 'chase'), run = el('div', 'chase-run');
      run.innerHTML = '<i class="pdot"></i><i class="pdot"></i><span class="pac"></span>'
        + '<i class="pdot"></i><i class="pdot"></i><i class="pdot"></i>'
        + ghostSVG(GHOSTS[0]) + ghostSVG(GHOSTS[1]) + ghostSVG(GHOSTS[2]) + ghostSVG(GHOSTS[3]);
      chase.appendChild(run); row.appendChild(chase);
    });
  }

  /* ------------------------------------------ Pac-Man perimeter eater */
  // A Pac-Man laps the border of each .pac-frame box, devouring an endless trail
  // of dots that refill on the far side — the box's "border" IS the dot trail.
  // one shared rAF drives every frame on the page (scales to many boxes; offscreen ones idle)
  var pacRunners = [], pacRAF = 0, pacLast = 0;
  function pacTick(now) {
    var dt = Math.min(0.05, (now - pacLast) / 1000) || 0; pacLast = now;
    for (var i = 0; i < pacRunners.length; i++) pacRunners[i](dt);
    pacRAF = requestAnimationFrame(pacTick);
  }
  function pacFrames() {
    var list = document.querySelectorAll('.pac-frame'); if (!list.length) return;
    list.forEach(pacFrame);
    if (!pacRAF) { pacLast = (window.performance && performance.now()) ? performance.now() : 0; pacRAF = requestAnimationFrame(pacTick); }
  }
  function pacFrame(box) {
    box.classList.add('pac-on');
    var layer = el('div', 'pac-layer'); box.appendChild(layer);
    var pac = el('div', 'pac-runner'); layer.appendChild(pac);
    var dots = [], W = 0, H = 0, P = 0, GAP = 24, SPEED = 120, d = 0, visible = true;
    function ptAt(dist) {
      dist = ((dist % P) + P) % P;
      if (dist < W) return { x: dist, y: 0, a: 0 };
      dist -= W; if (dist < H) return { x: W, y: dist, a: 90 };
      dist -= H; if (dist < W) return { x: W - dist, y: H, a: 180 };
      dist -= W; return { x: 0, y: H - dist, a: 270 };
    }
    function layout() {
      var r = box.getBoundingClientRect(); W = r.width; H = r.height; P = 2 * (W + H);
      if (P < 1) return;
      dots.forEach(function (x) { x.el.remove(); }); dots = [];
      var n = Math.max(8, Math.round(P / GAP)), gap = P / n;
      for (var i = 0; i < n; i++) {
        var p = ptAt(i * gap), e = el('i', 'pac-dot');
        e.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
        layer.appendChild(e); dots.push({ el: e, d: i * gap });
      }
    }
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(box); else addEventListener('resize', layout);
    if (reduce) { pac.style.transform = 'translate(-11px,-11px)'; return; }   // park pac, leave dots lit
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(box);
    pacRunners.push(function (dt) {
      if (!visible || P < 1) return;
      d = (d + SPEED * dt) % P; var p = ptAt(d);
      pac.style.transform = 'translate(' + (p.x - 11) + 'px,' + (p.y - 11) + 'px) rotate(' + p.a + 'deg)';
      for (var i = 0; i < dots.length; i++) {
        var behind = ((d - dots[i].d) % P + P) % P;          // how far pac has passed this dot
        dots[i].el.style.opacity = behind < P * 0.5 ? 0 : 1;  // eaten just behind pac; refilled on the far side
      }
    });
  }

  /* --------------------------------------------------------------- starfield */
  function Starfield() {
    var cv = document.getElementById('stars'); if (!cv) return;
    var ctx = cv.getContext('2d'), W, H, stars = [], DPR = Math.min(devicePixelRatio || 1, 2), pal = [];
    function colors() {
      pal = [cssVar('--p1'), cssVar('--p2'), cssVar('--p3'), cssVar('--p4'), '#ffffff'];
    }
    function resize() {
      W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
      var n = Math.min(150, Math.round(innerWidth * innerHeight / 11000));
      stars = [];
      for (var i = 0; i < n; i++) stars.push({
        x: Math.random() * W, y: Math.random() * H,
        z: Math.random() * 1.4 + 0.3, r: (Math.random() * 1.6 + 0.4) * DPR,
        c: pal[(Math.random() * pal.length) | 0],
        t: Math.random() * Math.PI * 2, ts: Math.random() * 0.05 + 0.01
      });
    }
    colors(); resize(); addEventListener('resize', resize);
    if (reduce) { draw(true); return; }
    function draw(stat) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!stat) { s.y += s.z * 0.35 * DPR; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } s.t += s.ts; }
        ctx.globalAlpha = stat ? 0.7 : (0.45 + Math.sin(s.t) * 0.4);
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, s.y, s.r, s.r); // square stars = pixel feel
      }
      ctx.globalAlpha = 1;
      if (!stat) requestAnimationFrame(function () { draw(false); });
    }
    draw(false);
    return { recolor: function () { colors(); for (var i = 0; i < stars.length; i++) stars[i].c = pal[(Math.random() * pal.length) | 0]; } };
  }

  /* ---------------------------------------------------------------- audio */
  var soundOn = false, actx = null;
  function AC() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { } }
    return actx;
  }
  function blip(freq, dur, type, vol) {
    if (!soundOn) return; var ac = AC(); if (!ac) return;
    try {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.value = freq || 440;
      g.gain.value = vol || 0.04; o.connect(g); g.connect(ac.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.05));
      o.stop(ac.currentTime + (dur || 0.05));
    } catch (e) { }
  }
  function arpUp() { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.07, 'square', 0.05); }, i * 60); }); }

  /* ----------------------------------------------------- chiptune music */
  // a procedurally-synthesised 4-bar loop in A-minor (Am–F–C–G): bass · arp · lead · drums.
  // fully generated in WebAudio — no audio files, stays offline, no copyright.
  var chiptune = null;
  function music() { if (!chiptune) chiptune = makeChiptune(); return chiptune; }
  function makeChiptune() {
    var BPM = 138, SPS = 60 / BPM / 4;  // seconds per 16th note
    var SEMI = { C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 };
    function hz(n) { var m = /^([A-G][b#]?)(\d)$/.exec(n); return m ? 440 * Math.pow(2, (SEMI[m[1]] + (+m[2] - 4) * 12) / 12) : 0; }
    function up(n) { var m = /^([A-G][b#]?)(\d)$/.exec(n); return m[1] + (+m[2] + 1); }
    // 8-bar loop over the classic vi-IV-I-V (Am-F-C-G) with an A-minor-pentatonic
    // lead (call in bars 1-4, response in 5-8) + a snare backbeat.
    var prog = [
      { r: 'A2', t: ['A3', 'C4', 'E4'] }, { r: 'F2', t: ['F3', 'A3', 'C4'] },
      { r: 'C3', t: ['C4', 'E4', 'G4'] }, { r: 'G2', t: ['G3', 'B3', 'D4'] },
      { r: 'A2', t: ['A3', 'C4', 'E4'] }, { r: 'F2', t: ['F3', 'A3', 'C4'] },
      { r: 'C3', t: ['C4', 'E4', 'G4'] }, { r: 'G2', t: ['G3', 'B3', 'D4'] }
    ];
    var lead = [
      ['A4', 'C5', 'E5', 'D5', 'E5', 0, 'C5', 0],
      ['D5', 'E5', 'G5', 'E5', 'D5', 0, 'C5', 0],
      ['E5', 'G5', 'A5', 'G5', 'E5', 0, 'D5', 0],
      ['C5', 'D5', 'E5', 0, 'D5', 'C5', 'A4', 0],
      ['A4', 'C5', 'E5', 'A5', 'G5', 'E5', 'D5', 0],
      ['E5', 'D5', 'C5', 'D5', 'E5', 0, 'G5', 0],
      ['A5', 'G5', 'E5', 'D5', 'C5', 0, 'A4', 0],
      ['E5', 'D5', 'C5', 'A4', 0, 0, 0, 0]
    ];
    var BASS = [], ARP = [], LEAD = [], HAT = [], KICK = [], SNARE = [], STEPS = 128;
    for (var bar = 0; bar < 8; bar++) {
      var ch = prog[bar];
      for (var s = 0; s < 16; s++) {
        var i = bar * 16 + s;
        BASS[i] = (s === 0 || s === 8) ? ch.r : (s === 4 || s === 12) ? up(ch.r) : (s === 14) ? ch.r : 0;
        ARP[i] = ch.t[s % 3];
        HAT[i] = (s % 2 === 1);
        KICK[i] = (s === 0 || s === 8 || (s === 14 && bar % 2 === 1));
        SNARE[i] = (s === 4 || s === 12);
        LEAD[i] = (s % 2 === 0) ? lead[bar][s / 2] : 0;
      }
    }
    var ac, master, lp, timer = null, next = 0, step = 0, playing = false;
    function voice(type, f, t, dur, vol) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    }
    function hat(t) {
      var len = (ac.sampleRate * 0.05) | 0, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var s = ac.createBufferSource(); s.buffer = b;
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7600;
      var g = ac.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
    }
    function kick(t) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
    }
    function snare(t) {
      var len = (ac.sampleRate * 0.12) | 0, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var s = ac.createBufferSource(); s.buffer = b;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.8;
      var g = ac.createGain(); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.12);
      var o = ac.createOscillator(), og = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(320, t);
      og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.06);
    }
    function sched() {
      if (next < ac.currentTime) next = ac.currentTime + 0.05;  // resync after a suspend/throttle gap (avoids a flood on resume)
      while (next < ac.currentTime + 0.12) {
        var s = step % STEPS;
        if (BASS[s]) voice('triangle', hz(BASS[s]), next, SPS * 1.8, 0.32);
        if (ARP[s]) voice('square', hz(ARP[s]), next, SPS * 0.8, 0.05);
        if (LEAD[s]) voice('square', hz(LEAD[s]), next, SPS * 1.8, 0.16);
        if (HAT[s]) hat(next);
        if (KICK[s]) kick(next);
        if (SNARE[s]) snare(next);
        next += SPS; step++;
      }
      timer = setTimeout(sched, 26);
    }
    return {
      start: function () {
        if (playing) return; ac = AC(); if (!ac) return;
        master = ac.createGain(); lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9500;
        master.connect(lp); lp.connect(ac.destination);
        master.gain.setValueAtTime(0.0001, ac.currentTime); master.gain.linearRampToValueAtTime(0.17, ac.currentTime + 0.7);
        playing = true; step = 0; next = ac.currentTime + 0.08; sched();
      },
      stop: function () {
        if (!playing) return; playing = false; clearTimeout(timer);
        try { var t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0.0001, t + 0.35); } catch (e) { }
      },
      toggle: function () { this.playing ? this.stop() : this.start(); return this.playing; },
      get playing() { return playing; }
    };
  }

  /* ------------------------------------------------------------ coins / HUD */
  var coins = parseInt(sessionStorage.getItem('coins') || '0', 10) || 0;
  function setCoins(v) { coins = v; sessionStorage.setItem('coins', coins); var n = document.getElementById('coinval'); if (n) n.textContent = String(coins).padStart(2, '0'); }
  function addCoins(n) { setCoins(coins + n); }

  /* --------------------------------------------------------------- themes */
  var stars = null;
  function applyTheme(t, withFx) {
    theme = t; root.setAttribute('data-theme', t);
    try { localStorage.setItem('arc-theme', t); } catch (e) {}   // persist the user's palette choice
    var btn = document.getElementById('themeBtn'); if (btn) btn.innerHTML = '◐ <span class="lbl">' + themeName() + '</span>';
    if (stars) stars.recolor();
    if (withFx) {
      var f = document.querySelector('.flicker'); if (f) { f.style.transition = 'none'; f.style.opacity = '.12'; setTimeout(function () { f.style.transition = ''; f.style.opacity = ''; }, 90); }
      blip(660, 0.06); setTimeout(function () { blip(880, 0.06); }, 70);
    }
  }
  function cycleTheme() {
    var i = THEMES.indexOf(theme); applyTheme(THEMES[(i + 1) % THEMES.length], true); addCoins(1);
  }
  // exposed for the HUD ↻ button (and any legacy reroll hooks): jump to a random palette
  window.__reroll = function () { applyTheme(pick(THEMES), true); addCoins(1); };

  /* ------------------------------------------------------------- reveal/scroll */
  function reveals() {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (e) { io.observe(e); });
  }
  function progress() {
    var xp = document.getElementById('xp'); if (!xp) return;
    function on() { var h = document.documentElement; var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); xp.style.width = Math.min(100, p * 100) + '%'; }
    addEventListener('scroll', on, { passive: true }); on();
  }

  /* ----------------------------------------------------------------- glitch */
  function glitchPulse() {
    var gs = document.querySelectorAll('.glitch'); if (!gs.length || reduce) return;
    setInterval(function () {
      var g = gs[(Math.random() * gs.length) | 0];
      g.classList.add('go'); setTimeout(function () { g.classList.remove('go'); }, 450);
    }, 5200);
  }

  /* ------------------------------------------------------------------ konami */
  function konami() {
    var seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], i = 0;
    addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = (k === seq[i]) ? i + 1 : (k === seq[0] ? 1 : 0);
      if (i === seq.length) { i = 0; cheat(); }
    });
  }
  function cheat() {
    addCoins(30); arpUp();
    var glyphs = ['★', '✦', '♥', '◆', '▰', '✚'];
    var pals = [cssVar('--p1'), cssVar('--p2'), cssVar('--p3'), cssVar('--p4')];
    for (var i = 0; i < 60; i++) (function (i) {
      var f = el('div', 'fx', glyphs[(Math.random() * glyphs.length) | 0]);
      f.style.left = Math.random() * 100 + 'vw'; f.style.top = '-40px';
      f.style.color = pals[(Math.random() * pals.length) | 0];
      f.style.fontSize = (12 + Math.random() * 22) + 'px';
      document.body.appendChild(f);
      var dur = 1400 + Math.random() * 1800, rot = (Math.random() * 720 - 360);
      f.animate([{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(' + (innerHeight + 80) + 'px) rotate(' + rot + 'deg)', opacity: 1 }],
        { duration: dur, easing: 'cubic-bezier(.4,0,.7,1)', delay: Math.random() * 500 }).onfinish = function () { f.remove(); };
    })(i);
    flash('CHEAT ACTIVATED · 30 LIVES');
  }
  function flash(msg) {
    var b = el('div', '', msg);
    b.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:9600;' +
      "font-family:'Press Start 2P',monospace;font-size:clamp(14px,3vw,26px);color:var(--p1);text-align:center;" +
      'text-shadow:3px 3px 0 var(--p2),6px 6px 0 var(--shadow);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(b);
    b.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }],
      { duration: 1700, easing: 'ease-out' }).onfinish = function () { b.remove(); };
  }

  /* -------------------------------------------------------------- HUD wiring */
  function wireHUD() {
    setCoins(coins);
    var tb = document.getElementById('themeBtn');
    if (tb) { tb.innerHTML = '◐ <span class="lbl">' + themeName() + '</span>'; tb.addEventListener('click', cycleTheme); }
    var sb = document.getElementById('soundBtn');
    if (sb) {
      try { soundOn = localStorage.getItem('arc-sound') === '1'; } catch (e) {}   // restore SFX setting
      sb.innerHTML = '<span class="dot">♪</span> <span class="lbl">SOUND: ' + (soundOn ? 'ON' : 'OFF') + '</span>';
      sb.classList.toggle('on', soundOn);
      sb.addEventListener('click', function () {
        soundOn = !soundOn;
        sb.querySelector('.lbl').textContent = 'SOUND: ' + (soundOn ? 'ON' : 'OFF');
        sb.classList.toggle('on', soundOn);
        try { localStorage.setItem('arc-sound', soundOn ? '1' : '0'); } catch (e) {}
        if (soundOn) { arpUp(); }
      });
    }
    // inject a MUSIC toggle next to SOUND (so the HTML files stay untouched)
    var mb = document.getElementById('musicBtn');
    if (!mb) {
      mb = el('button', 'ah-btn'); mb.id = 'musicBtn';
      if (sb && sb.parentNode) sb.parentNode.insertBefore(mb, sb.nextSibling);
      else { var hi = document.querySelector('.arcade-hud-in'); if (hi) hi.appendChild(mb); }
    }
    var musicWanted = false;
    try { musicWanted = localStorage.getItem('arc-music') === '1'; } catch (e) {}   // restore MUSIC setting
    mb.innerHTML = '<span class="dot">♫</span> <span class="lbl">MUSIC: ' + (musicWanted ? 'ON' : 'OFF') + '</span>';
    mb.classList.toggle('on', musicWanted);
    mb.addEventListener('click', function () {
      var on = music().toggle();
      mb.querySelector('.lbl').textContent = 'MUSIC: ' + (on ? 'ON' : 'OFF');
      mb.classList.toggle('on', on);
      try { localStorage.setItem('arc-music', on ? '1' : '0'); } catch (e) {}
    });
    // if music was on, ATTEMPT to auto-resume on page load — works once the origin has
    // audio engagement (i.e. right after you turned music on). If the browser still
    // blocks it, the first click/keypress resumes the suspended context.
    if (musicWanted) {
      music().start();                       // schedules + asks the context to resume
      var resumeMusic = function () {
        if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
        if (!music().playing) music().start();
        if (!actx || actx.state === 'running') {
          removeEventListener('pointerdown', resumeMusic);
          removeEventListener('keydown', resumeMusic);
        }
      };
      addEventListener('pointerdown', resumeMusic);
      addEventListener('keydown', resumeMusic);
      // some browsers flip the context to running shortly after load (engagement) —
      // catch that transition and (re)start cleanly.
      var ac0 = AC();
      if (ac0) ac0.onstatechange = function () { if (ac0.state === 'running' && !music().playing) music().start(); };
    }
    // blips on nav + buttons
    document.querySelectorAll('.ah-nav a, .btn, .level, .ah-btn').forEach(function (a) {
      a.addEventListener('mouseenter', function () { blip(720, 0.03, 'square', 0.025); });
    });
    document.querySelectorAll('.btn, .level').forEach(function (a) {
      a.addEventListener('click', function () { blip(440, 0.08, 'square', 0.05); setTimeout(function () { blip(880, 0.06); }, 50); });
    });
    // keyboard shortcuts: T theme, S sound
    addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t && t.isContentEditable) return;
      if (e.key === 't' || e.key === 'T') cycleTheme();
      if (e.key === 's' || e.key === 'S') { var s = document.getElementById('soundBtn'); if (s) s.click(); }
      if (e.key === 'm' || e.key === 'M') { var m = document.getElementById('musicBtn'); if (m) m.click(); }
    });
  }

  /* --------------------------------------------------------------- init */
  function start() {
    injectChrome();
    stars = Starfield();
    buildInvaders();
    pacFrames();
    wireHUD();
    reveals();
    glitchPulse();
    konami();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
