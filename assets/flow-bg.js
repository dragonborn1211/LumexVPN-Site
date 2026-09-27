/* Animated flowing-light background.
   A procedural WebGL redraw of assets/bg-flow.webp: stays sharp at any size and
   pixel density, and moves — fibre bundles sway, pulses of light run along the
   streams, sparks twinkle. Behind the streams sits deep space: nebula gas with dust
   lanes, a star field and a few distant galaxies. It is kept dim, drawn first and
   scrolls slower than the streams, so the light always stays on top.
   Without WebGL the page keeps the static image. */
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
      [430, -60, 40, 'blue', 0], [482, 40, 44, 'blue', 0], [542, 140, 32, 'purple', 0],
      [594, 226, 15, 'pink', 0.25], [628, 287, 5, 'amber', 1], [735, 290, 18, 'purple', 0.35],
      [860, 305, 46, 'blue', 0.05], [990, 350, 70, 'cyan', 0]] },
    { edge: 'magenta', pts: [
      [770, -40, 62, 'magenta', 0], [705, 110, 42, 'pink', 0.05], [652, 228, 14, 'orange', 0.35],
      [625, 288, 5, 'amber', 1], [520, 322, 13, 'orange', 0.5], [392, 370, 22, 'red', 0.1],
      [326, 404, 20, 'red', 0], [300, 446, 17, 'red', 0], [306, 484, 17, 'red', 0],
      [344, 509, 18, 'red', 0], [420, 522, 18, 'red', 0.05], [520, 524, 16, 'red', 0.1],
      [680, 566, 18, 'pink', 0.2], [722, 588, 17, 'pink', 0.28], [746, 626, 16, 'pink', 0.35],
      [740, 664, 14, 'pink', 0.33], [706, 690, 12, 'pink', 0.3],
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
    'uniform vec2 u_view; uniform float u_scroll; uniform float u_time; uniform float u_dpr; uniform float u_flow; uniform vec3 u_calm;',
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
    '    float breathe = 1.0 + 0.04 * sin(t * 0.33 + a_g.w * 6.2832);',
    '    float sway = 0.5 * a_f.y * sin(a_p.y * a_f.z + t * a_g.z + a_g.x);',
    // a_f.x: bundle offset for fibres; for glow lines, a width scale that narrows them through tight turns
    '    float bOff = kind > 0.5 ? 0.0 : a_f.x;',
    '    float hwS = kind > 0.5 ? a_f.x : 1.0;',
    '    float off = a_p.x * (bOff + sway) * breathe + a_p.z * hw * hwS;',
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
    '    float per = (kind > 0.5 ? 2400.0 : 1100.0 + 900.0 * fract(a_g.w * 5.3)) * u_flow;',
    '    float behind = fract((t * spd - a_p.y) / per + a_g.w) * per;',
    '    float comet = exp(-behind / ((kind > 0.5 ? 260.0 : 150.0) * u_flow)) * smoothstep(0.0, 14.0 * u_flow, behind);',
    // only fibres and the narrow glow lines carry comets: on the wide haze a travelling flash reads as a pale slab
    '    comet *= kind > 0.5 ? clamp(1.0 - (hw - 8.0) / 24.0, 0.0, 1.0) : 1.0;',
    '    if (kind < 0.5) {',
    '      float seg = sin(a_p.y * (0.0028 + 0.0024 * fract(a_g.w * 7.13)) + a_g.x * 3.1 + t * 0.15);',
    '      alpha *= max(smoothstep(-0.45, 0.5, seg), comet * 0.4);',
    '    }',
    '    alpha *= 1.0 + comet * (kind > 0.5 ? 0.5 : 0.8);',
    '    col = mix(col, vec3(1.0, 0.97, 0.94), comet * 0.2);',
    '  } else {',
    '    float tw = kind > 2.5 ? 0.25 + 0.75 * (0.5 + 0.5 * sin(t * a_g.z + a_g.x)) : 0.86 + 0.14 * sin(t * 0.6 + a_g.x);',
    '    alpha *= tw;',
    '    pos += tg * (sin(t * 0.22 + a_g.x) * a_f.y);',
    '    pos += (n * a_p.z + tg * a_p.w) * hw;',
    '  }',
    '  vec2 clip = (pos - vec2(0.0, u_scroll)) / u_view * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    // the first screen shows the streams at full strength; further down they settle into the background
    '  alpha *= mix(1.0, u_calm.z, smoothstep(u_calm.x, u_calm.y, a_c.y));',
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

  // ---------- deep space shaders ----------
  var HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var MIRROR = 'vec2 mirrorY(vec2 uv) { return vec2(uv.x, 1.0 - abs(1.0 - mod(uv.y, 2.0))); }\n';

  var FULL_VS = 'attribute vec2 a_v; varying vec2 v_uv; void main() { v_uv = a_v * 0.5 + 0.5; gl_Position = vec4(a_v, 0.0, 1.0); }';

  // Nebula, rendered once per layout into a texture: rgb = gas glow (normalised to 0..1), a = dust.
  var NEB_GEN_FS = HP + [
    'varying vec2 v_uv;',
    'uniform vec2 u_world; uniform float u_unit;',
    // 2D simplex noise — Ian McEwan, Ashima Arts (MIT)
    'vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }',
    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod(i, 289.0);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);',
    '  m = m * m; m = m * m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 a0 = x - floor(x + 0.5);',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);',
    '  vec3 g;',
    '  g.x = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',
    'const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);',
    'float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * snoise(p); p = OCT * p + 17.3; a *= 0.5; } return s; }',
    'float ridged(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { float n = 1.0 - abs(snoise(p)); s += a * n * n; p = OCT * p + 31.7; a *= 0.5; } return s / 0.875; }',
    'void main() {',
    '  vec2 p = v_uv * u_world / u_unit;',
    // domain warping turns plain noise into wispy, filamentary gas
    '  vec2 q = vec2(fbm(p * 0.8 + vec2(1.7, 9.2)), fbm(p * 0.8 + vec2(8.3, 2.8)));',
    '  vec2 r = p + 1.5 * q;',
    '  float gas = fbm(r + vec2(3.1, 5.4)) * 0.5 + 0.5;',
    '  float big = fbm(p * 0.28 + vec2(21.0, 4.0)) * 0.5 + 0.5;', // large scale: rich and empty parts of the sky
    '  float region = smoothstep(0.2, 0.62, big);',
    '  float glow = smoothstep(0.28, 0.8, gas) * region;',
    '  float core = pow(smoothstep(0.48, 0.9, gas), 2.0) * region;',
    // every cloud has its own colour family (blue-teal, violet, magenta, hydrogen red); outskirts turn cooler
    '  float fam = clamp(fbm(p * 0.5 + q * 0.4 + vec2(-4.0, 7.0)) * 1.2 + 0.5, 0.0, 1.0);',
    '  vec3 A = mix(vec3(0.08, 0.50, 1.00), vec3(0.58, 0.22, 1.00), smoothstep(0.3, 0.42, fam));',
    '  A = mix(A, vec3(1.00, 0.18, 0.72), smoothstep(0.48, 0.6, fam));',
    '  A = mix(A, vec3(1.00, 0.28, 0.34), smoothstep(0.68, 0.8, fam));',
    '  vec3 edge = mix(vec3(0.10, 0.42, 1.00), vec3(0.34, 0.26, 1.00), smoothstep(0.35, 0.65, fam));',
    '  vec3 c = mix(edge, A, smoothstep(0.35, 0.72, gas));',
    '  c = mix(c, c * 0.5 + 0.5, core * core * 0.5);', // the densest knots glow paler, in their own hue
    // gas glow plus the faint diffuse light of unresolved stars
    '  vec3 em = c * (glow * 0.55 + core * 1.2) + vec3(0.30, 0.34, 0.62) * 0.12 * smoothstep(0.25, 0.8, big);',
    // dust: broad dark clouds with softer filaments, only visible against the light behind it
    '  float clouds = smoothstep(0.5, 0.72, fbm(r * 0.7 + vec2(40.0, 13.0)) * 0.5 + 0.5);',
    '  float lanes = smoothstep(0.62, 0.95, ridged(r * 1.2 + vec2(11.0, 3.0)));',
    '  float dust = min(1.0, clouds * 0.9 + lanes * 0.55) * smoothstep(0.03, 0.3, dot(em, vec3(0.3, 0.45, 0.25)));',
    '  em *= 1.0 - 0.9 * dust;',
    '  gl_FragColor = vec4(min(em * 0.5, 1.0), dust);',
    '}'
  ].join('\n');

  var NEB_VS = [
    'attribute vec2 a_v;',
    'uniform vec2 u_view; uniform float u_scroll; uniform vec2 u_world;',
    'varying vec2 v_uv;',
    'void main() {',
    '  vec2 s = vec2(a_v.x * 0.5 + 0.5, 0.5 - a_v.y * 0.5) * u_view;',
    '  v_uv = (s + vec2(0.0, u_scroll)) / u_world;',
    '  gl_Position = vec4(a_v, 0.0, 1.0);',
    '}'
  ].join('\n');

  var NEB_FS = HP + MIRROR + [
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex; uniform vec3 u_bg; uniform float u_gain;',
    'void main() {',
    '  vec4 n = texture2D(u_tex, mirrorY(v_uv));', // mirrored past the end, in case the page outgrows it
    '  vec3 c = u_bg * (1.0 - 0.4 * n.a) + n.rgb * u_gain;',
    // dither: the gas is a few 8-bit levels deep and would band without it
    '  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  // Stars, galaxies and supernovae, one quad each. a_pos = (x, y, corner); a_st = (radius, brightness,
  // parallax, wrap height); a_col = (rgb, w); a_x = (type, p1, p2, dust extinction). By type:
  //   0 star, 1 star with diffraction spikes — p1, p2 = twinkle depth and speed, w = twinkle phase
  //   2 elliptical galaxy, 4 spiral galaxy   — p1, p2 = axis ratio and angle, w = spin (rad/s)
  //   3 supernova                            — p1 = seed, p2 = period (s), w = time offset
  var STAR_VS = [
    'precision highp float;',
    'attribute vec4 a_pos; attribute vec4 a_st; attribute vec4 a_col; attribute vec4 a_x;',
    'uniform vec2 u_view; uniform float u_scroll; uniform float u_time; uniform float u_dpr; uniform float u_nebScroll; uniform vec2 u_world;',
    'varying vec2 v_q; varying vec4 v_col; varying vec2 v_nuv; varying vec3 v_k;',
    'void main() {',
    '  float r = a_st.x, a = a_st.y, type = a_x.x, age = 0.0, reach = 4.5;',
    '  vec2 base = a_pos.xy;',
    '  if (type < 1.5) {',
    // under ~1.4 device px a star shimmers while scrolling: keep the size, dim it instead
    '    float minR = 1.4 / u_dpr;',
    '    if (r < minR) { a *= (r / minR) * (r / minR); r = minR; }',
    '    if (type > 0.5) reach = 16.0;',
    // two detuned waves make the twinkle irregular; deep for the few blinking stars
    '    float tw = 0.6 * sin(u_time * a_x.z + a_col.w) + 0.4 * sin(u_time * a_x.z * 2.31 + a_col.w * 3.7);',
    '    a *= max(0.0, 1.0 + a_x.y * tw);',
    '  } else if (type > 2.5 && type < 3.5) {',
    // a supernova flares once per cycle at a new random spot, then fades behind an expanding shell
    '    float cyc = (u_time + a_col.w) / a_x.z;',
    '    float idx = floor(cyc);',
    '    age = fract(cyc) * a_x.z;',
    '    vec2 h = fract(sin(vec2(idx * 12.9898 + a_x.y * 78.233, idx * 39.346 + a_x.y * 11.135)) * 43758.5453);',
    '    base = vec2(h.x * u_view.x, h.y * a_st.w - 48.0);',
    '    a *= smoothstep(0.0, 0.18, age) * exp(-age / 1.3);',
    '    reach = age < 5.5 ? 46.0 : 0.0;', // collapsed between flares: costs nothing
    '  } else if (type > 3.5) {',
    '    reach = 1.15;',
    '    age = u_time * a_col.w;', // slow rotation of the arms
    '  }',
    '  vec2 q = a_pos.zw * reach;',
    '  vec2 off = q * r;',
    // galaxies are discs seen at an angle: squash, then turn
    '  if (type > 1.5 && (type < 2.5 || type > 3.5)) { float c = cos(a_x.z), sn = sin(a_x.z); off = mat2(c, sn, -sn, c) * vec2(off.x, off.y * a_x.y); }',
    // the field wraps around, so it never runs out if the page grows after it was built
    '  float y = mod(base.y - u_scroll * a_st.z + 48.0, a_st.w) - 48.0;',
    '  vec2 s = vec2(base.x, y) + off;',
    '  v_nuv = (s + vec2(0.0, u_nebScroll)) / u_world;',
    '  vec2 clip = s / u_view * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    '  v_q = q; v_col = vec4(a_col.rgb, a); v_k = vec3(type, a_x.w, age);',
    '}'
  ].join('\n');

  var STAR_FS = HP + MIRROR + [
    'varying vec2 v_q; varying vec4 v_col; varying vec2 v_nuv; varying vec3 v_k;',
    'uniform sampler2D u_tex; uniform float u_hasNeb;',
    'float spikes(vec2 q, float len, float sharp) {',
    '  q = abs(q);',
    '  return exp(-sharp * q.y) * pow(max(0.0, 1.0 - q.x / len), 3.0) + exp(-sharp * q.x) * pow(max(0.0, 1.0 - q.y / len), 3.0);',
    '}',
    'void main() {',
    '  float d2 = dot(v_q, v_q), d = sqrt(d2), a;',
    '  vec3 col = v_col.rgb;',
    '  if (v_k.x < 1.5) {',
    '    a = exp(-2.0 * d2) + 0.1 * exp(-1.8 * d);',
    '    if (v_k.x > 0.5) a += 0.45 * spikes(v_q, 16.0, 2.6);',
    '  } else if (v_k.x < 2.5) {',
    '    a = 0.9 * exp(-6.0 * d2) + 0.45 * exp(-2.4 * d);', // bulge + exponential disc
    '  } else if (v_k.x < 3.5) {',
    '    float age = v_k.z;',
    '    float core = exp(-1.5 * d2);',
    '    float rays = 0.8 * exp(-age / 0.9) * spikes(v_q, 40.0, 2.0);',
    '    float R = 3.0 + 7.0 * age, w = 2.5 + 2.2 * age;',
    '    float shell = 0.16 * exp(-age / 2.0) * exp(-(d - R) * (d - R) / (w * w));',
    '    a = core + 0.6 * exp(-0.25 * d - age / 0.6) + 0.2 * exp(-0.3 * d) + rays + shell;',
    '    col = mix(col, vec3(1.0), clamp(core * 1.5 + rays, 0.0, 1.0) * 0.8);',
    '  } else {',
    // spiral galaxy: warm bulge, bluish two-armed disc, pink star-forming regions along the arms
    '    float arm = pow(0.5 + 0.5 * cos(2.0 * atan(v_q.y, v_q.x + 1e-4) - 3.2 * log(d + 0.03) - v_k.z), 2.0);',
    '    float disc = exp(-3.2 * d) * (1.0 - smoothstep(0.75, 1.1, d));',
    '    float lit = disc * (0.4 + 1.4 * arm * smoothstep(0.06, 0.3, d));',
    '    col = vec3(1.0, 0.86, 0.66) * (exp(-60.0 * d2) + 0.35 * exp(-12.0 * d))',
    '        + lit * mix(vec3(0.55, 0.72, 1.0), vec3(1.0, 0.45, 0.75), pow(arm, 3.0) * smoothstep(0.25, 0.55, d) * 0.7);',
    '    a = 1.0;',
    '  }',
    // far objects live inside the nebula: hidden by its dust lanes, crowded inside its glow
    '  if (u_hasNeb > 0.5 && v_k.y > 0.0) {',
    '    vec4 n = texture2D(u_tex, mirrorY(v_nuv));',
    '    float lum = dot(n.rgb, vec3(0.3, 0.45, 0.25));',
    '    a *= (1.0 - 0.9 * v_k.y * n.a) * mix(1.0, 0.45 + 5.0 * lum, v_k.y);',
    '  }',
    '  a *= v_col.a;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  function link(vsSrc, fsSrc, attrs) {
    var v = shader(gl.VERTEX_SHADER, vsSrc), f = shader(gl.FRAGMENT_SHADER, fsSrc);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    for (var i = 0; i < attrs.length; i++) gl.bindAttribLocation(p, i, attrs[i]);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }
  function uniforms(p, names) {
    var u = {};
    for (var i = 0; i < names.length; i++) u[names[i]] = gl.getUniformLocation(p, names[i]);
    return u;
  }
  // Attribute i of every program is bound to location i; switch buffers and layouts per pass.
  var enabledAttribs = 0;
  function attribs(buffer, layout, stride) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (var i = 0; i < layout.length; i++) gl.vertexAttribPointer(i, layout[i][0], gl.FLOAT, false, stride * 4, layout[i][1] * 4);
    for (i = enabledAttribs; i < layout.length; i++) gl.enableVertexAttribArray(i);
    for (i = layout.length; i < enabledAttribs; i++) gl.disableVertexAttribArray(i);
    enabledAttribs = layout.length;
  }

  var prog = link(VS, FS, ['a_c', 'a_n', 'a_p', 'a_col', 'a_f', 'a_g']);
  if (!prog) { fallback(); return; }
  var FLOATS = 20;
  var LAYOUT = [[2, 0], [2, 2], [4, 4], [4, 8], [4, 12], [4, 16]];
  var vbo = gl.createBuffer();
  var U = uniforms(prog, ['u_view', 'u_scroll', 'u_time', 'u_dpr', 'u_flow', 'u_calm']);
  var CALM_LEVEL = 0.38; // stream strength below the first screen

  // Space is optional: if any of its programs fails, the streams still run on the plain dark colour.
  var nebGen = link(FULL_VS, NEB_GEN_FS, ['a_v']);
  var nebDraw = link(NEB_VS, NEB_FS, ['a_v']);
  var starProg = link(STAR_VS, STAR_FS, ['a_pos', 'a_st', 'a_col', 'a_x']);
  var UG = nebGen && uniforms(nebGen, ['u_world', 'u_unit']);
  var UN = nebDraw && uniforms(nebDraw, ['u_view', 'u_scroll', 'u_world', 'u_bg', 'u_gain']);
  var US = starProg && uniforms(starProg, ['u_view', 'u_scroll', 'u_time', 'u_dpr', 'u_nebScroll', 'u_world', 'u_hasNeb']);
  var triBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var starBuf = gl.createBuffer();

  gl.disable(gl.DEPTH_TEST);

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
    // A bundle wider than its turning radius bunches up into a crease on the inside of the turn.
    // Through tight turns the whole bundle narrows instead (fibres reach ~2/3 of the radius), easing
    // in and out over a few dozen pixels so it reads as a smooth pinch.
    // The glow lines do the same, from the (eased) turning radius kept in S.rad.
    function ease(src, dst) {
      var W = 7, low = new Float32Array(m), a, b, w2;
      for (a = 0; a < m; a++) {
        var mn = src[a];
        for (w2 = Math.max(a - W, 0); w2 <= Math.min(a + W, m - 1); w2++) mn = Math.min(mn, src[w2]);
        low[a] = mn;
      }
      for (a = 0; a < m; a++) {
        var sum = 0, cnt = 0;
        for (b = Math.max(a - W, 0); b <= Math.min(a + W, m - 1); b++) { sum += low[b]; cnt++; }
        dst[a] = sum / cnt;
      }
    }
    var lim = new Float32Array(m), eased = new Float32Array(m);
    for (q = 0; q < m; q++) lim[q] = Math.min(S.sp[q], 0.5 / (Math.abs(S.k[q]) + 1e-6));
    ease(lim, eased);
    for (q = 0; q < m; q++) S.sp[q] = Math.min(S.sp[q], eased[q]);
    S.rad = new Float32Array(m);
    for (q = 0; q < m; q++) lim[q] = Math.min(4000, 1 / (Math.abs(S.k[q]) + 1e-6));
    ease(lim, S.rad);
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
        V[12] = o.kind > 0.5 ? Math.max(0.2, Math.min(1, 0.85 * S.rad[i] / o.hw)) : o.b; V[13] = o.amp; V[14] = o.k; V[15] = o.hw;
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
    line(S, { kind: 1, b: 0, amp: 0.02, k: 0.006, hw: 9 * gs, a: 0.66, spd: 0.4, ph: rnd() * TAU, seed: seed, mixEdge: 0, mixWhite: 0, hotWhite: 0.2 }, edge);
    line(S, { kind: 1, b: 0, amp: 0.015, k: 0.006, hw: Math.max(1.4, 2.3 * gs), a: 0.85, spd: 0.4, ph: rnd() * TAU, seed: seed, mixEdge: 0, mixWhite: 0, hotWhite: 0.3 }, edge);
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
        mixEdge: ab * 0.75, mixWhite: 0, hotWhite: 0.15 * (1 - ab)
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
    quad(x, y, 1, 0, 150 * map.sx, COL.pink, 0.1 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(x, y, 1, 0, 60 * map.sx, COL.amber, 0.2 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(x, y, 1, 0, 16 * map.sx, COL.white, 0.45 * k, 0, rnd() * 6.2832, 2, 0, rnd());
  }

  // ---------- deep space ----------
  var NEB_PAR = 0.18;   // scroll factor of the nebula and the far stars (streams: PARALLAX)
  var NEB_TEXEL = 2;    // CSS px per nebula texel: the gas is soft, bilinear upscaling hides it
  var NEB_GAIN = 0.64;  // brightness of the gas over the background colour (the texture holds it at half scale)
  // [r, g, b, weight]: blue, blue-white, white, yellow-white, orange, red
  var STAR_COL = [[0.55, 0.70, 1.00, 0.1], [0.72, 0.82, 1.00, 0.22], [0.92, 0.95, 1.00, 0.28], [1.00, 0.92, 0.78, 0.2], [1.00, 0.74, 0.48, 0.15], [1.00, 0.56, 0.44, 0.05]];
  // per = CSS px² of sky per star; ext = how much the nebula's dust and glow affect the layer;
  // blink = share of stars that twinkle hard instead of gently
  var STAR_LAYERS = [
    { par: NEB_PAR, per: 450, r: [0.45, 0.9], b: [0.25, 0.9], tw: 0.1, ext: 1, spikes: 0, blink: 0 },
    { par: 0.28, per: 2600, r: [0.6, 1.3], b: [0.4, 1.0], tw: 0.2, ext: 0.55, spikes: 0, blink: 0.1 },
    { par: 0.38, per: 30000, r: [1.0, 2.0], b: [0.7, 1.0], tw: 0.25, ext: 0.2, spikes: 0.4, blink: 0.25 }
  ];
  var GALAXY_PER = 180000;     // small elliptical smudges
  var SPIRAL_PER = 1400000;    // large spiral galaxies
  var NOVA_PAR = 0.28;
  var NOVA_TINT = [[0.55, 0.75, 1.0], [1.0, 0.55, 0.8], [1.0, 0.8, 0.5], [0.6, 1.0, 0.95]];

  var nebTex = null, nebFbo = null, nebKey = '', nebWorld = [1, 1];
  function buildNebula(w, h) {
    if (!nebGen || !nebDraw) return;
    var maxT = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048, 4096);
    var texel = Math.max(NEB_TEXEL, w / maxT, h / maxT);
    var tw = Math.ceil(w / texel), th = Math.ceil(h / texel);
    var key = w + 'x' + th;
    if (key === nebKey) return;
    if (!nebTex) { nebTex = gl.createTexture(); nebFbo = gl.createFramebuffer(); }
    gl.bindTexture(gl.TEXTURE_2D, nebTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null); // never bound while it is being rendered into
    gl.bindFramebuffer(gl.FRAMEBUFFER, nebFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, nebTex, 0);
    nebKey = '';
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      nebWorld = [tw * texel, th * texel];
      gl.viewport(0, 0, tw, th);
      gl.disable(gl.BLEND);
      gl.useProgram(nebGen);
      attribs(triBuf, [[2, 0]], 2);
      gl.uniform2f(UG.u_world, nebWorld[0], nebWorld[1]);
      gl.uniform1f(UG.u_unit, Math.min(1600, Math.max(560, w)) * 0.75); // gas features follow the screen size
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      nebKey = key;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  var sbuf = new Float32Array(1 << 16), slen = 0, starCount = 0;
  var SQ = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];
  function star(x, y, r, b, par, wrapH, c, ph, type, p1, p2, ext) {
    if (slen + 96 > sbuf.length) { var nb = new Float32Array(sbuf.length * 2); nb.set(sbuf); sbuf = nb; }
    for (var i = 0; i < 6; i++) {
      sbuf[slen++] = x; sbuf[slen++] = y; sbuf[slen++] = SQ[i][0]; sbuf[slen++] = SQ[i][1];
      sbuf[slen++] = r; sbuf[slen++] = b; sbuf[slen++] = par; sbuf[slen++] = wrapH;
      sbuf[slen++] = c[0]; sbuf[slen++] = c[1]; sbuf[slen++] = c[2]; sbuf[slen++] = ph;
      sbuf[slen++] = type; sbuf[slen++] = p1; sbuf[slen++] = p2; sbuf[slen++] = ext;
    }
  }
  function starColour(u) {
    for (var i = 0; i < STAR_COL.length - 1; i++) { u -= STAR_COL[i][3]; if (u < 0) break; }
    return STAR_COL[i];
  }
  function buildSpace(vw, vh, docH) {
    buildNebula(vw, vh + (docH - vh) * NEB_PAR + vh * 0.5);
    if (!starProg) return;
    var rnd = rng(7331), TAU = 6.2832, H, n, i;
    slen = 0;
    for (var l = 0; l < STAR_LAYERS.length; l++) {
      var L = STAR_LAYERS[l];
      H = vh + (docH - vh) * L.par + vh * 0.5 + 96;
      n = Math.round(vw * H / L.per);
      for (i = 0; i < n; i++) {
        var m = Math.pow(rnd(), 2.5); // most stars faint, a few bright
        var spikes = m > 0.55 && rnd() < L.spikes;
        var blink = rnd() < L.blink;
        star(rnd() * vw, rnd() * H - 48,
          (L.r[0] + (L.r[1] - L.r[0]) * m * (0.7 + 0.3 * rnd())) * (blink ? 1.25 : 1),
          blink ? L.b[1] : L.b[0] + (L.b[1] - L.b[0]) * m,
          L.par, H, starColour(rnd()), rnd() * TAU, spikes ? 1 : 0,
          blink ? 0.85 + 0.1 * rnd() : L.tw * (0.5 + rnd()),
          blink ? 1.6 + 2.2 * rnd() : 0.4 + 1.4 * rnd(), L.ext);
      }
    }
    H = vh + (docH - vh) * NEB_PAR + vh * 0.5 + 96;
    n = Math.round(vw * H / GALAXY_PER);
    for (i = 0; i < n; i++) {
      star(rnd() * vw, rnd() * H - 48, 2.8 + 5 * Math.pow(rnd(), 2), 0.2 + 0.16 * rnd(),
        NEB_PAR, H, rnd() < 0.6 ? [1.0, 0.9, 0.8] : [0.8, 0.86, 1.0], 0,
        2, 0.25 + 0.55 * rnd(), rnd() * TAU, 0.6);
    }
    n = Math.max(2, Math.round(vw * H / SPIRAL_PER));
    for (i = 0; i < n; i++) {
      var spin = (0.03 + 0.03 * rnd()) * (rnd() < 0.5 ? -1 : 1);
      star(rnd() * vw, rnd() * H - 48, 24 + 22 * rnd(), 0.5 + 0.2 * rnd(),
        NEB_PAR, H, [1, 1, 1], spin, 4, 0.3 + 0.55 * rnd(), rnd() * TAU, 0.3);
    }
    // supernovae: about one flare every 6–7 s somewhere on screen (none for reduced motion)
    H = vh + (docH - vh) * NOVA_PAR + vh * 0.5 + 96;
    n = REDUCE ? 0 : Math.max(1, Math.round(1.5 * H / vh));
    for (i = 0; i < n; i++) {
      var period = 8 + 6 * rnd();
      star(0, 0, 1.6, 1.8, NOVA_PAR, H, NOVA_TINT[Math.floor(rnd() * NOVA_TINT.length)], rnd() * period,
        3, rnd() * 100, period, 0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sbuf.subarray(0, slen), gl.STATIC_DRAW);
    starCount = slen / 16;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, len), gl.STATIC_DRAW);
    count = verts;
    builtW = vw;
    buildSpace(vw, vh, docH);
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
    var y = window.pageYOffset || 0, t = REDUCE ? 16 : (now / 1000) % 20000;
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, nebKey ? nebTex : null);
    if (nebKey) {
      gl.disable(gl.BLEND);
      gl.useProgram(nebDraw);
      attribs(triBuf, [[2, 0]], 2);
      gl.uniform2f(UN.u_view, cw, ch);
      gl.uniform1f(UN.u_scroll, y * NEB_PAR);
      gl.uniform2f(UN.u_world, nebWorld[0], nebWorld[1]);
      gl.uniform3f(UN.u_bg, BG[0], BG[1], BG[2]);
      gl.uniform1f(UN.u_gain, NEB_GAIN);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND);
    if (starCount) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(starProg);
      attribs(starBuf, [[4, 0], [4, 4], [4, 8], [4, 12]], 16);
      gl.uniform2f(US.u_view, cw, ch);
      gl.uniform1f(US.u_scroll, y);
      gl.uniform1f(US.u_time, t);
      gl.uniform1f(US.u_dpr, dpr);
      gl.uniform1f(US.u_nebScroll, y * NEB_PAR);
      gl.uniform2f(US.u_world, nebWorld[0], nebWorld[1]);
      gl.uniform1f(US.u_hasNeb, nebKey ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, starCount);
    }
    // streams on top — screen: overlapping light saturates softly instead of clipping
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.useProgram(prog);
    attribs(vbo, LAYOUT, FLOATS);
    gl.uniform2f(U.u_view, cw, ch);
    gl.uniform1f(U.u_scroll, y * PARALLAX);
    gl.uniform1f(U.u_time, t);
    gl.uniform1f(U.u_dpr, dpr);
    gl.uniform1f(U.u_flow, flowScale);
    gl.uniform3f(U.u_calm, ch * 0.8, ch * 1.5, CALM_LEVEL);
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
