/* ============================================================
   SDS Labs — specimen catalog
   Animated chemiluminescent field + interactive sample dispenser
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ambient field (cyan value-noise, dither-lifted) ---------- */
  var canvas = document.getElementById('bg');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    if (ctx) {
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
      var sw = 0, sh = 0;
      var small = document.createElement('canvas');
      var smallCtx = small.getContext('2d', { willReadFrequently: true });
      var bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(function (row) {
        return row.map(function (v) { return (v + .5) / 16; });
      });
      var ramp = [
        [4, 20, 25], [8, 30, 38], [14, 46, 58], [22, 66, 82],
        [42, 110, 132], [92, 176, 190], [198, 242, 226]
      ];
      var rampMax = ramp.length - 1;
      var ramp32 = new Uint32Array(ramp.length);
      for (var i = 0; i < ramp.length; i++) {
        var c = ramp[i];
        ramp32[i] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
      }
      var nodes = [
        { x: .15, y: .25, vx: .00022, vy: .00016, speed: .9, phase: 0 },
        { x: .85, y: .30, vx: -.00018, vy: .00020, speed: .8, phase: 1.8 },
        { x: .30, y: .75, vx: .00016, vy: -.00022, speed: 1.0, phase: 3.2 },
        { x: .70, y: .70, vx: -.00020, vy: -.00017, speed: .85, phase: 4.5 },
        { x: .10, y: .55, vx: .00018, vy: -.00014, speed: .75, phase: 2.1 },
        { x: .90, y: .50, vx: -.00016, vy: .00018, speed: .95, phase: 5.4 }
      ];
      var PIXEL_SCALE = window.matchMedia('(min-width:768px)').matches ? 3 : 4;
      var target = { x: .5, y: .5, tx: .5, ty: .5, sty: 0, sy: 0 };
      var t0 = 0, raf = null, started = false;

      function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        sw = Math.ceil(W / PIXEL_SCALE);
        sh = Math.ceil(H / PIXEL_SCALE);
        small.width = sw;
        small.height = sh;
      }
      window.addEventListener('resize', resize);
      resize();

      function draw(now) {
        if (!started) return;
        var t = (now - t0) * 0.001;
        var mouse = target;
        mouse.x += (mouse.tx - mouse.x) * .06;
        mouse.y += (mouse.ty - mouse.y) * .06;
        mouse.sy += (mouse.sty - mouse.sy) * .08;
        var offX = (mouse.x - .5) * sw * .7;
        var offY = (mouse.y - .5) * sh * .7 + mouse.sy * .14;
        var mpx = mouse.x * sw;
        var mpy = mouse.y * sh;
        var mrad = sw * .22;
        var mrad2 = mrad * mrad;
        for (var n = 0; n < nodes.length; n++) {
          var nd = nodes[n];
          nd.x += nd.vx;
          nd.y += nd.vy;
          if (nd.x < .02 || nd.x > .98) nd.vx *= -1;
          if (nd.y < .02 || nd.y > .98) nd.vy *= -1;
        }
        var img = smallCtx.createImageData(sw, sh);
        var buf = new Uint32Array(img.data.buffer);
        for (var y = 0; y < sh; y++) {
          var rowB = bayer[y & 3];
          var yf = (y + offY) * .020;
          for (var x = 0; x < sw; x++) {
            var xf = (x + offX) * .020;
            var w1 = Math.sin(xf * .85 + yf * .65 + t * .45);
            var w2 = Math.cos(xf * .70 - yf * .90 - t * .35);
            var w3 = Math.sin((xf + yf) * .60 + t * .55);
            var nw = 0;
            for (var k = 0; k < nodes.length; k++) {
              var nn = nodes[k];
              var dx = x - nn.x * sw;
              var dy = y - nn.y * sh;
              var d = Math.sqrt(dx * dx + dy * dy);
              nw += Math.cos(d * .035 - t * nn.speed + nn.phase) * Math.exp(-d * .007);
            }
            var field = (w1 * .25 + w2 * .22 + w3 * .18 + nw * .35 + 1.6) * .24;
            var glow = 0;
            var mdx = x - mpx, mdy = y - mpy;
            var md2 = mdx * mdx + mdy * mdy;
            if (md2 < mrad2) {
              var g = 1 - md2 / mrad2;
              glow = g * g * .20;
            }
            var total = field + glow;
            var q = Math.pow(Math.max(0, total), 1.25) * 1.1;
            if (q > 1) q = 1;
            var pos = q * rampMax;
            var idx = Math.floor(pos);
            var frac = pos - idx;
            var thresh = rowB[x & 3];
            if (frac > thresh) idx++;
            if (idx > rampMax) idx = rampMax;
            if (idx < 0) idx = 0;
            buf[y * sw + x] = ramp32[idx];
          }
        }
        smallCtx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H);
        raf = requestAnimationFrame(draw);
      }

      function start() {
        if (started || prefersReduced.matches) return;
        started = true;
        t0 = performance.now();
        raf = requestAnimationFrame(draw);
      }
      function stop() {
        started = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      }
      window.addEventListener('mousemove', function (e) {
        target.tx = e.clientX / W;
        target.ty = e.clientY / H;
      }, { passive: true });
      window.addEventListener('scroll', function () {
        target.sty = window.scrollY;
      }, { passive: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });
      window.addEventListener('blur', stop);
      window.addEventListener('focus', start);
      start();
    }
  }

  /* ---------- sample dispenser ---------- */
  var report = document.getElementById('report');
  var dispense = document.getElementById('dispense');
  if (report && dispense) {
    var samples = [
      'Specimen stable. No signs of business purpose.',
      'Sample emits a faint hum. Origin: unknown. Cause: unknown.',
      'Project shows zero activity. Temperature matches room. Normal.',
      'Mutation detected: community interest exceeding expected baseline.',
      'Specimen vault sealed. Reason for sealing: none on file.',
      'No update in 211 days. This is not a bug. This is the design.',
      'Awareness rising above lab threshold — promotion review recommended.',
      'Contents rearranged themselves overnight. Recommend not investigating.'
    ];
    var accs = ['cyan', 'warn', 'plain'];
    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function analyze() {
      var acc = accs[Math.floor(Math.random() * accs.length)];
      var cls = acc === 'cyan' ? 's-accent' : acc === 'warn' ? 's-warn' : 's-line';
      report.classList.add('analyzing');
      report.innerHTML = '';
      var tick = 0;
      var interval = setInterval(function () {
        tick++;
        report.innerHTML = '<span>' + '▍'.repeat(Math.min(tick, 14)) + '&nbsp;analyzing…'.slice(0, tick + 9) + '&nbsp;</span>';
        if (tick >= 9) {
          clearInterval(interval);
          report.classList.remove('analyzing');
          var msg = samples[Math.floor(Math.random() * samples.length)];
          report.innerHTML =
            '<span class="s-line">[SDS-LABS] analysis complete — scan ' +
            Math.floor(100 + Math.random() * 900) + '</span>' +
            '<span class="' + cls + '">▸ ' + esc(msg) + '</span>';
        }
      }, 120);
    }
    dispense.addEventListener('click', analyze);
  }
})();