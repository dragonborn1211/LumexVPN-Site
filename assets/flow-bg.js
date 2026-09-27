/* Animated flowing-light background.
   A procedural WebGL redraw of assets/bg-flow.webp: stays sharp at any size and
   pixel density, and moves — fibre bundles sway, pulses of light run along the
   streams, sparks twinkle. Without WebGL the page keeps the static image. */
(function () {
  'use strict';

  var root = document.documentElement;
  var canvas = document.getElementById('flow-bg');

  function fallback() {
    root.classList.remove('bg-live');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  if (!canvas) { fallback(); return; }

  var glOpts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  var gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
  if (!gl) { fallback(); return; }

  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PARALLAX = 0.85;
  var IMG_W = 866, IMG_H = 1816; // pixel space of the artwork the streams were traced from
  var BG = [10 / 255, 14 / 255, 26 / 255];

  var COL = {
    blue:    [0.20, 0.42, 1.00],
    cyan:    [0.16, 0.76, 1.00],
    purple:  [0.56, 0.22, 1.00],
    magenta: [0.88, 0.12, 0.75],
    pink:    [1.00, 0.18, 0.50],
    red:     [1.00, 0.12, 0.15],
    orange:  [1.00, 0.38, 0.06],
    amber:   [1.00, 0.70, 0.32],
    white:   [1.00, 0.95, 0.90]
  };

  // Control points: [x, y, bundle half-width, colour, hotness 0..1 (1 = white-hot crossing)]
  var STREAMS = [
    { edge: 'blue', fadeIn: true, pts: [
      [90, -20, 42, 'blue', 0], [260, 95, 50, 'blue', 0], [440, 165, 36, 'purple', 0],
      [565, 228, 16, 'pink', 0.25], [628, 287, 5, 'amber', 1], [735, 290, 18, 'purple', 0.35],
      [860, 305, 46, 'blue', 0.05], [990, 350, 70, 'cyan', 0]] },
    { edge: 'magenta', pts: [
      [770, -40, 62, 'magenta', 0], [705, 110, 42, 'pink', 0.05], [652, 228, 14, 'orange', 0.35],
      [625, 288, 5, 'amber', 1], [520, 322, 13, 'orange', 0.5], [392, 370, 22, 'red', 0.1],
      [306, 432, 28, 'red', 0], [352, 490, 22, 'red', 0], [520, 524, 16, 'red', 0.1],
      [680, 566, 18, 'pink', 0.2], [742, 632, 16, 'pink', 0.35], [706, 690, 12, 'pink', 0.3],
      [585, 712, 7, 'orange', 0.75], [482, 738, 11, 'orange', 0.5], [452, 792, 13, 'orange', 0.6],
      [512, 860, 18, 'orange', 0.3], [645, 915, 24, 'red', 0.1], [795, 975, 34, 'red', 0],
      [950, 1035, 50, 'purple', 0]] },
    { edge: 'purple', fadeOut: true, pts: [
      [-60, 585, 30, 'purple', 0], [140, 598, 28, 'magenta', 0], [330, 648, 20, 'pink', 0.1],
      [500, 700, 10, 'pink', 0.45], [612, 713, 6, 'pink', 0.6], [720, 698, 14, 'pink', 0.15]] },
    { edge: 'purple', fadeIn: true, pts: [
      [505, 905, 22, 'red', 0], [610, 990, 18, 'red', 0.1], [682, 1072, 14, 'orange', 0.25],
      [695, 1142, 11, 'orange', 0.45], [662, 1192, 8, 'orange', 0.65], [616, 1213, 5, 'amber', 1],
      [702, 1246, 16, 'cyan', 0.3], [792, 1292, 30, 'blue', 0.05], [905, 1348, 50, 'blue', 0]] },
    { edge: 'purple', fadeOut: true, pts: [
      [-60, 1110, 28, 'purple', 0], [160, 1135, 26, 'magenta', 0], [390, 1168, 18, 'pink', 0.1],
      [560, 1204, 8, 'pink', 0.5], [618, 1215, 5, 'amber', 1], [682, 1266, 16, 'purple', 0.2],
      [722, 1352, 26, 'purple', 0], [752, 1455, 32, 'blue', 0]] },
    { edge: 'blue', fadeOut: true, pts: [
      [-60, 1395, 30, 'blue', 0], [180, 1405, 30, 'purple', 0], [362, 1456, 24, 'purple', 0],
      [450, 1540, 20, 'magenta', 0], [440, 1612, 18, 'pink', 0.1]] },
    { edge: 'purple', pts: [
      [-60, 1625, 26, 'magenta', 0], [180, 1592, 22, 'pink', 0.1], [402, 1606, 14, 'orange', 0.6],
      [522, 1648, 14, 'red', 0.2], [682, 1698, 22, 'magenta', 0], [862, 1745, 36, 'blue', 0],
      [985, 1780, 50, 'blue', 0]] }
  ];
  // Bright crossings: [x, y, strength]
  var NODES = [[626, 288, 1], [617, 1214, 1], [585, 712, 0.5], [455, 790, 0.4], [402, 1606, 0.45]];

  var VS = [
    'precision highp float;',
    'attribute vec2 a_c; attribute vec2 a_n; attribute vec4 a_p; attribute vec4 a_col; attribute vec4 a_f; attribute vec4 a_g;',
    'uniform vec2 u_view; uniform float u_scroll; uniform float u_time; uniform float u_dpr; uniform float u_flow;',
    'varying vec4 v_col; varying vec2 v_uv; varying float v_kind;',
    'void main() {',
    '  float kind = a_g.y;',
    '  float t = u_time;',
    '  vec2 n = a_n;',
    '  vec2 tg = vec2(-n.y, n.x);',
    '  vec2 pos = a_c;',
    '  float alpha = a_col.a;',
    '  vec3 col = a_col.rgb;',
    '  float hw = a_f.w;',
    '  float minHw = 0.8 / u_dpr;',
    '  if (hw < minHw) { alpha *= hw / minHw; hw = minHw; }',
    '  if (kind < 1.5) {',
    // a_p = (spread, arc length, side, curvature); a_f = (bundle offset, sway, sway frequency, half-width)
    '    float breathe = 1.0 + 0.08 * sin(t * 0.33 + a_g.w * 6.2832);',
    '    float sway = a_f.y * sin(a_p.y * a_f.z + t * a_g.z + a_g.x);',
    '    float off = a_p.x * (a_f.x + sway) * breathe + a_p.z * hw;',
    // a_p.w = signed curvature of the centre-line. Pushing a vertex past the centre of a tight
    // turn folds the strip over itself and draws "spokes"; compress the offset so it approaches
    // but never reaches the centre, and fade out fibres that would have crossed it.
    '    float inward = off * a_p.w;',
    '    if (inward > 0.0) {',
    '      float lim = 0.92 / abs(a_p.w);',
    '      if (kind < 0.5) alpha *= 1.0 - smoothstep(0.65, 1.0, inward);',
    '      off = sign(off) * lim * (1.0 - exp(-abs(off) / lim));',
    '    }',
    '    pos += n * off;',
    // Light running along the streams: comets with a white-hot head and a fading tail. Glow lines
    // of one stream share a seed, so they surge together; every fibre carries its own faster comets.
    // u_flow scales speed, spacing and tail with the size of the composition.
    '    float spd = (kind > 0.5 ? 200.0 + 105.0 * fract(a_g.w * 13.7) : 220.0 + 145.0 * fract(a_g.w * 13.7)) * u_flow;',
    '    float per = (kind > 0.5 ? 1500.0 : 650.0 + 650.0 * fract(a_g.w * 5.3)) * u_flow;',
    '    float behind = fract((t * spd - a_p.y) / per + a_g.w) * per;',
    '    float comet = exp(-behind / ((kind > 0.5 ? 260.0 : 150.0) * u_flow)) * smoothstep(0.0, 14.0 * u_flow, behind);',
    // only fibres and the narrow glow lines carry comets: on the wide haze a travelling flash reads as a pale slab
    '    comet *= kind > 0.5 ? clamp(1.0 - (hw - 8.0) / 24.0, 0.0, 1.0) : 1.0;',
    '    if (kind < 0.5) {',
    '      float seg = sin(a_p.y * (0.0028 + 0.0024 * fract(a_g.w * 7.13)) + a_g.x * 3.1 + t * 0.15);',
    '      alpha *= max(smoothstep(-0.45, 0.5, seg), comet * 0.7);',
    '    }',
    '    alpha *= 1.0 + comet * (kind > 0.5 ? 2.2 : 3.0);',
    '    col = mix(col, vec3(1.0, 0.97, 0.94), comet * 0.5);',
    '  } else {',
    '    float tw = kind > 2.5 ? 0.25 + 0.75 * (0.5 + 0.5 * sin(t * a_g.z + a_g.x)) : 0.86 + 0.14 * sin(t * 0.6 + a_g.x);',
    '    alpha *= tw;',
    '    pos += tg * (sin(t * 0.22 + a_g.x) * a_f.y);',
    '    pos += (n * a_p.z + tg * a_p.w) * hw;',
    '  }',
    '  vec2 clip = (pos - vec2(0.0, u_scroll)) / u_view * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    '  v_col = vec4(col, alpha);',
    '  v_uv = kind < 1.5 ? vec2(a_p.z, 0.0) : a_p.zw;',
    '  v_kind = kind;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec4 v_col; varying vec2 v_uv; varying float v_kind;',
    'void main() {',
    '  float a;',
    '  if (v_kind < 0.5) { a = 1.0 - v_uv.x * v_uv.x; }',
    '  else if (v_kind < 1.5) { float d = 1.0 - v_uv.x * v_uv.x; a = d * d; }',
    '  else { float r = 1.0 - dot(v_uv, v_uv); if (r <= 0.0) discard; a = v_kind < 2.5 ? r * r : r * r * r; }',
    '  a *= v_col.a;',
    '  gl_FragColor = vec4(v_col.rgb * a, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  var prog = vs && fs && gl.createProgram();
  if (prog) {
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
  }
  if (!prog) { fallback(); return; }
  gl.useProgram(prog);

  var FLOATS = 20;
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  [['a_c', 2, 0], ['a_n', 2, 2], ['a_p', 4, 4], ['a_col', 4, 8], ['a_f', 4, 12], ['a_g', 4, 16]].forEach(function (a) {
    var loc = gl.getAttribLocation(prog, a[0]);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, a[1], gl.FLOAT, false, FLOATS * 4, a[2] * 4);
  });
  var uView = gl.getUniformLocation(prog, 'u_view');
  var uScroll = gl.getUniformLocation(prog, 'u_scroll');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uDpr = gl.getUniformLocation(prog, 'u_dpr');
  var uFlow = gl.getUniformLocation(prog, 'u_flow');
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR); // screen: overlapping light saturates softly instead of clipping

  // ---------- geometry ----------
  var buf = new Float32Array(1 << 18), len = 0, verts = 0, dupFirst = false;
  var V = new Float32Array(FLOATS);
  function grow(n) {
    if (len + n <= buf.length) return;
    var nb = new Float32Array(Math.max(buf.length * 2, len + n));
    nb.set(buf.subarray(0, len));
    buf = nb;
  }
  function put() { grow(FLOATS); buf.set(V, len); len += FLOATS; verts++; }
  function vtx() { if (dupFirst) { put(); dupFirst = false; } put(); }
  // One TRIANGLE_STRIP for everything; degenerate triangles stitch the pieces together.
  function beginStrip() { dupFirst = verts > 0; }
  function endStrip() { grow(FLOATS); buf.copyWithin(len, len - FLOATS, len); len += FLOATS; verts++; }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function smooth(e0, e1, x) { var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  function mix3(a, b, k, out) { out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k; out[2] = a[2] + (b[2] - a[2]) * k; return out; }

  // Centripetal Catmull-Rom (no overshoot at the tight turns)
  function crPoint(ex, ey, i, u) {
    var x0 = ex[i], y0 = ey[i], x1 = ex[i + 1], y1 = ey[i + 1], x2 = ex[i + 2], y2 = ey[i + 2], x3 = ex[i + 3], y3 = ey[i + 3];
    var t0 = 0;
    var t1 = t0 + Math.sqrt(Math.hypot(x1 - x0, y1 - y0)) + 1e-4;
    var t2 = t1 + Math.sqrt(Math.hypot(x2 - x1, y2 - y1)) + 1e-4;
    var t3 = t2 + Math.sqrt(Math.hypot(x3 - x2, y3 - y2)) + 1e-4;
    var t = t1 + (t2 - t1) * u;
    function l(a, b, ta, tb) { return a * (tb - t) / (tb - ta) + b * (t - ta) / (tb - ta); }
    var a1x = l(x0, x1, t0, t1), a1y = l(y0, y1, t0, t1);
    var a2x = l(x1, x2, t1, t2), a2y = l(y1, y2, t1, t2);
    var a3x = l(x2, x3, t2, t3), a3y = l(y2, y3, t2, t3);
    var b1x = l(a1x, a2x, t0, t2), b1y = l(a1y, a2y, t0, t2);
    var b2x = l(a2x, a3x, t1, t3), b2y = l(a2y, a3y, t1, t3);
    return [l(b1x, b2x, t1, t2), l(b1y, b2y, t1, t2)];
  }

  var STEP = 7, SUB = 24;
  function sample(def, map) {
    var P = def.pts, n = P.length, i, j;
    var cx = [], cy = [];
    for (i = 0; i < n; i++) { cx.push(map.x(P[i][0])); cy.push(map.y(P[i][1])); }
    var ex = [2 * cx[0] - cx[1]].concat(cx, [2 * cx[n - 1] - cx[n - 2]]);
    var ey = [2 * cy[0] - cy[1]].concat(cy, [2 * cy[n - 1] - cy[n - 2]]);
    var dx = [], dy = [], dseg = [], du = [];
    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < SUB; j++) {
        var p = crPoint(ex, ey, i, j / SUB);
        dx.push(p[0]); dy.push(p[1]); dseg.push(i); du.push(j / SUB);
      }
    }
    dx.push(cx[n - 1]); dy.push(cy[n - 1]); dseg.push(n - 2); du.push(1);
    var cl = [0];
    for (i = 1; i < dx.length; i++) cl.push(cl[i - 1] + Math.hypot(dx[i] - dx[i - 1], dy[i] - dy[i - 1]));
    var L = cl[cl.length - 1];
    var m = Math.max(2, Math.floor(L / STEP) + 1);
    var S = {
      n: m, L: L,
      x: new Float32Array(m), y: new Float32Array(m), nx: new Float32Array(m), ny: new Float32Array(m),
      sp: new Float32Array(m), c: new Float32Array(m * 3), hot: new Float32Array(m), s: new Float32Array(m), fade: new Float32Array(m),
      k: new Float32Array(m)
    };
    var k = 0;
    for (var q = 0; q < m; q++) {
      var s = Math.min(L, q * STEP);
      while (k < cl.length - 2 && cl[k + 1] < s) k++;
      var f = (s - cl[k]) / ((cl[k + 1] - cl[k]) || 1);
      S.x[q] = dx[k] + (dx[k + 1] - dx[k]) * f;
      S.y[q] = dy[k] + (dy[k + 1] - dy[k]) * f;
      var seg = dseg[k];
      var u = du[k] + ((dseg[k + 1] === seg ? du[k + 1] : 1) - du[k]) * f;
      var A = P[seg], B = P[seg + 1], e = u * u * (3 - 2 * u);
      S.sp[q] = (A[2] + (B[2] - A[2]) * e) * map.sx;
      var ca = COL[A[3]], cb = COL[B[3]];
      S.c[q * 3] = ca[0] + (cb[0] - ca[0]) * e;
      S.c[q * 3 + 1] = ca[1] + (cb[1] - ca[1]) * e;
      S.c[q * 3 + 2] = ca[2] + (cb[2] - ca[2]) * e;
      S.hot[q] = Math.pow(A[4] + (B[4] - A[4]) * e, 1.5);
      S.s[q] = s;
    }
    var ang = new Float32Array(m);
    for (q = 0; q < m; q++) {
      var a = Math.max(q - 1, 0), b = Math.min(q + 1, m - 1);
      var tx = S.x[b] - S.x[a], ty = S.y[b] - S.y[a], tl = Math.hypot(tx, ty) || 1;
      S.nx[q] = -ty / tl;
      S.ny[q] = tx / tl;
      ang[q] = Math.atan2(ty, tx);
    }
    // Signed curvature (1/radius) along the normal above: the turn's centre sits at P + n / k.
    // Take the sharpest value within a few samples so the shader's clamp errs on the safe side.
    var kr = new Float32Array(m);
    for (q = 0; q < m; q++) {
      var qa = Math.max(q - 2, 0), qb = Math.min(q + 2, m - 1);
      var da = ang[qb] - ang[qa];
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      kr[q] = qb > qa ? da / ((qb - qa) * STEP) : 0;
    }
    for (q = 0; q < m; q++) {
      var best = kr[q];
      for (var w = Math.max(q - 4, 0); w <= Math.min(q + 4, m - 1); w++) if (Math.abs(kr[w]) > Math.abs(best)) best = kr[w];
      S.k[q] = best;
    }
    var fi = def.fadeIn ? L * 0.3 : Math.min(90, L * 0.1);
    var fo = def.fadeOut ? L * 0.3 : Math.min(90, L * 0.1);
    for (q = 0; q < m; q++) S.fade[q] = smooth(0, fi, S.s[q]) * smooth(0, fo, L - S.s[q]);
    return S;
  }

  var tmpA = [0, 0, 0], tmpB = [0, 0, 0];
  function line(S, o, edge) {
    beginStrip();
    for (var i = 0; i < S.n; i++) {
      tmpA[0] = S.c[i * 3]; tmpA[1] = S.c[i * 3 + 1]; tmpA[2] = S.c[i * 3 + 2];
      mix3(tmpA, edge, o.mixEdge, tmpB);
      mix3(tmpB, COL.white, Math.min(1, o.mixWhite + o.hotWhite * S.hot[i]), tmpB);
      var a = o.a * S.fade[i];
      for (var side = -1; side <= 1; side += 2) {
        V[0] = S.x[i]; V[1] = S.y[i]; V[2] = S.nx[i]; V[3] = S.ny[i];
        V[4] = S.sp[i]; V[5] = S.s[i]; V[6] = side; V[7] = S.k[i];
        V[8] = tmpB[0]; V[9] = tmpB[1]; V[10] = tmpB[2]; V[11] = a;
        V[12] = o.b; V[13] = o.amp; V[14] = o.k; V[15] = o.hw;
        V[16] = o.ph; V[17] = o.kind; V[18] = o.spd; V[19] = o.seed;
        vtx();
      }
    }
    endStrip();
  }

  var QUAD = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function quad(x, y, nx, ny, r, col, a, drift, ph, kind, spd, seed) {
    beginStrip();
    for (var i = 0; i < 4; i++) {
      V[0] = x; V[1] = y; V[2] = nx; V[3] = ny;
      V[4] = 0; V[5] = 0; V[6] = QUAD[i][0]; V[7] = QUAD[i][1];
      V[8] = col[0]; V[9] = col[1]; V[10] = col[2]; V[11] = a;
      V[12] = 0; V[13] = drift; V[14] = 0; V[15] = r;
      V[16] = ph; V[17] = kind; V[18] = spd; V[19] = seed;
      vtx();
    }
    endStrip();
  }

  function emitStream(def, map, rnd, fibres, gs, small) {
    var S = sample(def, map);
    if (S.n < 3) return;
    var edge = COL[def.edge], seed = rnd(), TAU = 6.2832;
    // soft haze, wide glow, tight glow, white-hot core
    line(S, { kind: 1, b: 0, amp: 0.03, k: 0.004, hw: 96 * gs, a: 0.14, spd: 0.3, ph: rnd() * TAU, seed: seed, mixEdge: 0.4, mixWhite: 0, hotWhite: 0.1 }, edge);
    line(S, { kind: 1, b: 0, amp: 0.03, k: 0.005, hw: 36 * gs, a: 0.36, spd: 0.35, ph: rnd() * TAU, seed: seed, mixEdge: 0.05, mixWhite: 0, hotWhite: 0.15 }, edge);
    line(S, { kind: 1, b: 0, amp: 0.02, k: 0.006, hw: 9 * gs, a: 0.66, spd: 0.4, ph: rnd() * TAU, seed: seed, mixEdge: 0, mixWhite: 0, hotWhite: 0.35 }, edge);
    line(S, { kind: 1, b: 0, amp: 0.015, k: 0.006, hw: Math.max(1.4, 2.3 * gs), a: 1, spd: 0.4, ph: rnd() * TAU, seed: seed, mixEdge: 0, mixWhite: 0.1, hotWhite: 0.75 }, edge);
    for (var f = 0; f < fibres; f++) {
      var r = rnd() * 2 - 1;
      var b = (r < 0 ? -1 : 1) * Math.pow(Math.abs(r), 1.2) * 1.35;
      var ab = Math.min(1, Math.abs(b));
      line(S, {
        kind: 0, b: b,
        amp: 0.05 + 0.2 * rnd(),
        k: TAU / (380 + 700 * rnd()),
        hw: 0.5 + 0.45 * rnd(),
        a: (0.9 * Math.pow(1 - ab, 1.1) + 0.2) * (0.6 + 0.4 * rnd()) * (small ? 1.15 : 1),
        spd: 0.2 + 0.55 * rnd(), ph: rnd() * TAU, seed: rnd(),
        mixEdge: ab * 0.75, mixWhite: 0, hotWhite: 0.3 * (1 - ab)
      }, edge);
    }
    var sparks = Math.floor(S.L / (small ? 16 : 12));
    for (var q = 0; q < sparks; q++) {
      var i = Math.floor(rnd() * S.n);
      var off = (rnd() * 2 - 1) * 1.8 * S.sp[i];
      var pick = rnd();
      var col = pick < 0.55 ? COL.orange : pick < 0.8 ? COL.red : pick < 0.93 ? COL.pink : COL.amber;
      quad(S.x[i] + S.nx[i] * off, S.y[i] + S.ny[i] * off, S.nx[i], S.ny[i],
        1.1 + 2.6 * Math.pow(rnd(), 4), col, (0.5 + 0.5 * rnd()) * S.fade[i],
        3 + 9 * rnd(), rnd() * TAU, 3, 0.7 + 2.3 * rnd(), rnd());
    }
  }

  function emitDust(map, tileW, tileH, rnd, small) {
    var n = Math.floor(tileW * tileH / (small ? 11000 : 7000));
    for (var i = 0; i < n; i++) {
      var pick = rnd();
      var col = pick < 0.6 ? COL.orange : pick < 0.8 ? COL.purple : COL.blue;
      var u = map.mirror ? 0.05 + 0.7 * rnd() : 0.25 + 0.7 * rnd();
      quad(map.x0 + u * tileW, map.y0 + rnd() * tileH, 1, 0, 0.5 + 0.7 * rnd(), col, 0.12 + 0.3 * rnd(),
        4 + 10 * rnd(), rnd() * 6.2832, 3, 0.3 + 1.2 * rnd(), rnd());
    }
  }

  function emitNode(nd, map, rnd) {
    var x = map.x(nd[0]), y = map.y(nd[1]), k = nd[2];
    quad(x, y, 1, 0, 170 * map.sx, COL.pink, 0.2 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(x, y, 1, 0, 70 * map.sx, COL.amber, 0.4 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(x, y, 1, 0, 20 * map.sx, COL.white, 0.9 * k, 0, rnd() * 6.2832, 2, 0, rnd());
  }

  var count = 0, builtW = 0, flowScale = 1;
  function build() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var docH = Math.max(document.documentElement.scrollHeight, vh);
    var small = vw < 720;
    // Never squeeze the composition: on narrow screens it's cropped, not scaled down.
    var tileW = Math.max(vw, 640);
    var bgH = vh + (docH - vh) * PARALLAX;
    var tiles = Math.max(1, Math.round(bgH / (tileW * IMG_H / IMG_W)));
    var tileH = bgH / tiles;
    var gs = Math.min(1, Math.max(0.55, tileW / 1440));
    flowScale = gs;
    var crop = tileW - vw;
    len = 0; verts = 0;
    for (var t = 0; t < tiles; t++) {
      var mirror = t % 2 === 1; // alternate tiles are mirrored so long pages don't visibly repeat
      var map = {
        mirror: mirror, x0: -crop * (mirror ? 0.4 : 0.6), y0: t * tileH, sx: tileW / IMG_W, sy: tileH / IMG_H,
        x: function (px) { return this.x0 + (this.mirror ? IMG_W - px : px) * this.sx; },
        y: function (py) { return this.y0 + py * this.sy; }
      };
      var rnd = rng(9173 + t * 131);
      emitDust(map, tileW, tileH, rnd, small);
      for (var i = 0; i < STREAMS.length; i++) emitStream(STREAMS[i], map, rnd, small ? 22 : 44, gs, small);
      for (var j = 0; j < NODES.length; j++) emitNode(NODES[j], map, rnd);
    }
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, len), gl.STATIC_DRAW);
    count = verts;
    builtW = vw;
  }

  // ---------- canvas & loop ----------
  var cw = 0, ch = 0, dpr = 1;
  function size(resetHeight) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    // grow-only height: mobile address bars resize the viewport while scrolling
    ch = resetHeight ? window.innerHeight : Math.max(ch, window.innerHeight);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  var raf = 0, running = false, shown = false;
  function draw(now) {
    raf = 0;
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uView, cw, ch);
    gl.uniform1f(uScroll, (window.pageYOffset || 0) * PARALLAX);
    gl.uniform1f(uTime, REDUCE ? 16 : (now / 1000) % 20000);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uFlow, flowScale);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, count);
    if (!shown) { shown = true; canvas.classList.add('on'); }
    if (running) raf = requestAnimationFrame(draw);
  }
  function request() { if (!raf) raf = requestAnimationFrame(draw); }
  function start() { running = !REDUCE; request(); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  var rebuildTimer = 0, lastDpr = window.devicePixelRatio || 1;
  window.addEventListener('resize', function () {
    var d = window.devicePixelRatio || 1;
    if (window.innerWidth !== builtW || d !== lastDpr) {
      lastDpr = d;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () { size(true); build(); request(); }, 150);
    } else if (window.innerHeight > ch) {
      size(false);
      request();
    }
  });
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('load', function () { build(); request(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); fallback(); });

  size(true);
  build();
  start();
})();
