/* Winning.
 *
 * This is the one moment the portal is allowed to take over the screen. The
 * free games hijack this feeling to sell an advert; here it is just his,
 * earned and given back straight away.
 *
 * Confetti is drawn by hand rather than pulled from a library, because the
 * portal has no dependencies and must keep working offline forever. The
 * chime is synthesised for the same reason — no audio file to fetch, and
 * nothing to break if it fails.
 */
(function (Portal) {
  'use strict';

  var COLOURS = ['#e69f00', '#56b4e9', '#009e73', '#f0e442',
                 '#0072b2', '#d55e00', '#cc79a7'];

  /* A short rising chord. Sound is a nice-to-have: if the phone is muted, the
   * browser blocks audio, or WebAudio is unavailable, the celebration still
   * works exactly the same on screen. */
  function chime() {
    var settings = Portal.state.settings();
    if (settings.sound === false) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      // C, E, G, C — a plain major arpeggio, warm and unambiguous.
      [523.25, 659.25, 784.0, 1046.5].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var at = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.22, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.6);
      });
      setTimeout(function () {
        try { ctx.close(); } catch (err) { /* already gone */ }
      }, 1600);
    } catch (err) {
      // Never let a failed noise spoil a win.
    }
  }

  function confetti(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    var bits = [];
    for (var i = 0; i < 90; i++) {
      bits.push({
        x: w * Math.random(),
        y: -20 - Math.random() * h * 0.6,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.6 + Math.random() * 2.4,
        size: 7 + Math.random() * 9,
        spin: (Math.random() - 0.5) * 0.24,
        angle: Math.random() * Math.PI,
        colour: COLOURS[i % COLOURS.length]
      });
    }

    var frame = null;
    var started = Date.now();

    function tick() {
      ctx.clearRect(0, 0, w, h);
      var alive = 0;
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.045;             // gravity
        b.angle += b.spin;
        if (b.y < h + 30) alive++;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = b.colour;
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      }
      // Stop when the last piece has fallen off the bottom, or after a few
      // seconds regardless. An animation loop left running is a phone
      // quietly burning battery in his pocket.
      if (alive > 0 && Date.now() - started < 6000) {
        frame = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(frame);
        ctx.clearRect(0, 0, w, h);
      }
    }
    tick();

    return function stop() {
      if (frame) cancelAnimationFrame(frame);
    };
  }

  /* show({ message, again, againLabel })
   *
   * `again` is called when he asks for another puzzle. The only other way off
   * this screen is Home. Tapping the background does nothing, deliberately —
   * a celebration that vanishes because of a stray touch reads as having done
   * something wrong. */
  function show(options) {
    options = options || {};

    /* One at a time. Two of these stacked would leave him tapping a button
     * and finding another screen underneath it. */
    var already = document.querySelectorAll('.celebrate');
    for (var i = 0; i < already.length; i++) already[i].remove();

    var wrap = document.createElement('div');
    wrap.className = 'celebrate';

    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas);

    var text = document.createElement('div');
    text.className = 'celebrate-text';
    text.textContent = options.message || 'You did it!';
    wrap.appendChild(text);

    /* In the word game he is congratulated before the board is exhausted, so
     * there is a third way on: back to the puzzle he was enjoying. When it is
     * offered it is the big button, because carrying on is the likelier wish. */
    if (options.keepGoing) {
      var carryOn = document.createElement('button');
      carryOn.className = 'btn btn-primary';
      carryOn.textContent = 'Keep Going';
      carryOn.addEventListener('click', function () {
        stop();
        wrap.remove();
        options.keepGoing();
      });
      wrap.appendChild(carryOn);
    }

    var again = document.createElement('button');
    again.className = options.keepGoing ? 'btn' : 'btn btn-primary';
    again.textContent = options.againLabel || 'Play Again';
    again.addEventListener('click', function () {
      stop();
      wrap.remove();
      if (options.again) options.again();
    });
    wrap.appendChild(again);

    var home = document.createElement('button');
    home.className = 'btn btn-quiet';
    home.textContent = 'Home';
    home.addEventListener('click', function () {
      stop();
      window.location.href = '../';
    });
    wrap.appendChild(home);

    document.body.appendChild(wrap);

    var stop = confetti(canvas);
    chime();

    return function close() {
      stop();
      wrap.remove();
    };
  }

  /* A single soft note, for a small good thing — one word found out of many.
   * Deliberately nothing like the win chime: this is a nod, not a fanfare. */
  function blip() {
    var settings = Portal.state.settings();
    if (settings.sound === false) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      var at = ctx.currentTime;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.16, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.25);
      setTimeout(function () {
        try { ctx.close(); } catch (err) { /* already gone */ }
      }, 600);
    } catch (err) { /* silence is fine */ }
  }

  Portal.celebrate = { show: show, blip: blip, _chime: chime };
})(window.Portal = window.Portal || {});
