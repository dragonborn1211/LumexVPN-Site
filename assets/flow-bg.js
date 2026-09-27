/* Animated flowing-light background.
   Streams of light in the style of assets/bg-flow.webp, drawn with WebGL: sharp at any
   size and pixel density, and moving — fibre bundles sway, pulses of light run along
   the streams, sparks twinkle. The streams are laid out from the page itself: they are
   routed through the free space between cards, buttons and lines of text, narrow where
   it gets tight and meet in bright crossings, so they flow around the content instead
   of behind it. Behind them sits deep space: nebula gas with dust lanes, a star field,
   galaxies and the odd supernova; it scrolls slower than the page, which reads as depth.
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
  var CELL = 12; // step (CSS px) of the free-space grid the streams are routed through
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
  var U = uniforms(prog, ['u_view', 'u_scroll', 'u_time', 'u_dpr', 'u_flow']);

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

  // def.pts: [x, y, bundle spread, rgb, hotness 0..1 (1 = white-hot crossing), free room around it], page px
  var STEP = 7, SUB = 6;
  function sample(def) {
    var P = def.pts, n = P.length, i, j;
    var cx = [], cy = [];
    for (i = 0; i < n; i++) { cx.push(P[i][0]); cy.push(P[i][1]); }
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
      k: new Float32Array(m), room: new Float32Array(m)
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
      S.sp[q] = A[2] + (B[2] - A[2]) * e;
      var ca = A[3], cb = B[3];
      S.c[q * 3] = ca[0] + (cb[0] - ca[0]) * e;
      S.c[q * 3 + 1] = ca[1] + (cb[1] - ca[1]) * e;
      S.c[q * 3 + 2] = ca[2] + (cb[2] - ca[2]) * e;
      S.hot[q] = Math.pow(A[4] + (B[4] - A[4]) * e, 1.5);
      S.room[q] = A[5] + (B[5] - A[5]) * e;
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
    var fi = def.fadeIn || Math.min(90, L * 0.1);
    var fo = def.fadeOut || Math.min(90, L * 0.1);
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
      if (o.room) a *= smooth(o.room[0], o.room[1], S.room[i]); // wide glows fade where the stream squeezes past content
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

  function emitStream(def, rnd, fibres, gs, small) {
    var S = sample(def);
    if (S.n < 3) return;
    var edge = COL[def.edge], seed = rnd(), TAU = 6.2832;
    fibres = Math.round(fibres * (def.w < 0.6 ? 0.5 : 1));
    // soft haze, wide glow, tight glow, white-hot core
    line(S, { kind: 1, b: 0, amp: 0.03, k: 0.004, hw: 96 * gs, a: 0.14, spd: 0.3, ph: rnd() * TAU, seed: seed, mixEdge: 0.4, mixWhite: 0, hotWhite: 0.1, room: [16, 130 * gs] }, edge);
    line(S, { kind: 1, b: 0, amp: 0.03, k: 0.005, hw: 36 * gs, a: 0.36, spd: 0.35, ph: rnd() * TAU, seed: seed, mixEdge: 0.05, mixWhite: 0, hotWhite: 0.15, room: [6, 48 * gs] }, edge);
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

  // specks of dust drifting in the free space between the content
  function emitDust(F, rnd, small) {
    var n = Math.floor(F.vw * F.docH / (small ? 14000 : 9000));
    for (var i = 0; i < n; i++) {
      var x = rnd() * F.vw, y = rnd() * F.docH, pick = rnd();
      var col = pick < 0.6 ? COL.orange : pick < 0.8 ? COL.purple : COL.blue;
      var size = 0.5 + 0.7 * rnd(), a = 0.12 + 0.3 * rnd(), drift = 4 + 10 * rnd(), ph = rnd() * 6.2832, spd = 0.3 + 1.2 * rnd(), seed = rnd();
      if (F.room(x, y) < 20) continue;
      quad(x, y, 1, 0, size, col, a, drift, ph, 3, spd, seed);
    }
  }

  // a bright crossing; its glow is kept to the room around it so it doesn't wash over text
  function emitNode(nd, sx, rnd) {
    var k = nd.k, r = nd.room;
    quad(nd.x, nd.y, 1, 0, Math.min(170 * sx, 50 + 2.2 * r), COL.pink, 0.2 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(nd.x, nd.y, 1, 0, Math.min(70 * sx, 30 + 1.2 * r), COL.amber, 0.4 * k, 0, rnd() * 6.2832, 2, 0, rnd());
    quad(nd.x, nd.y, 1, 0, 20 * sx, COL.white, 0.9 * k, 0, rnd() * 6.2832, 2, 0, rnd());
  }

  // ---------- deep space ----------
  var NEB_PAR = 0.18;   // scroll factor of the nebula and the far stars (the streams scroll with the page)
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

  // ---------- routing: the streams flow around the page content ----------
  // The page is rasterised onto a coarse grid where cards, buttons, images and the actual line
  // boxes of text are blocked. A distance field then says how much free room every point has.
  // Streams are routed through that room with A*, smoothed into curves, and narrowed where it
  // gets tight; where two of them meet, a crossing lights up.
  function alphaOf(c) {
    if (!c || c === 'transparent') return 0;
    var m = /rgba?\(([^)]*)\)/.exec(c);
    if (!m) return 1;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  }
  // anything with a fill or a full outline is a solid block; a lone divider line is not
  function isBox(cs) {
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (alphaOf(cs.backgroundColor) > 0.2) return true;
    var sides = ['Top', 'Right', 'Bottom', 'Left'], n = 0;
    for (var i = 0; i < 4; i++) {
      var b = 'border' + sides[i];
      if (cs[b + 'Style'] !== 'none' && parseFloat(cs[b + 'Width']) > 0 && alphaOf(cs[b + 'Color']) > 0.02) n++;
    }
    return n >= 2;
  }
  function scanObstacles() {
    var out = [], ox = window.pageXOffset || 0, oy = window.pageYOffset || 0;
    out.bar = 0; // height of a sticky/fixed bar at the top of the page
    var range = document.createRange();
    function push(r) { if (r.width > 1 && r.height > 1) out.push(r.left + ox, r.top + oy, r.right + ox, r.bottom + oy); }
    (function walk(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          if (!/\S/.test(n.nodeValue)) continue;
          range.selectNodeContents(n);
          var rs = range.getClientRects(); // one box per line of text, not the whole paragraph
          for (var i = 0; i < rs.length; i++) push(rs[i]);
        } else if (n.nodeType === 1 && n !== canvas) {
          var tag = n.nodeName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'template') continue;
          var cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          // the sticky header moves with the viewport: streams may cross under it, but shouldn't run along it
          if (cs.position === 'fixed' || cs.position === 'sticky') {
            var hr = n.getBoundingClientRect();
            if (hr.top <= 1 && hr.width > window.innerWidth * 0.5) out.bar = Math.max(out.bar, hr.bottom);
            continue;
          }
          if (/^(img|svg|video|canvas|iframe|input|textarea|select|button)$/.test(tag) || isBox(cs)) push(n.getBoundingClientRect());
          else walk(n);
        }
      }
    })(document.querySelector('.page') || document.body);
    return out;
  }

  // exact Euclidean distance transform (Felzenszwalb & Huttenlocher), in cells²
  function edt1(f, n, d, v, z) {
    var k = 0, q, s;
    v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (q = 1; q < n; q++) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    for (k = 0, q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  }
  function edt(f, cols, rows) {
    var m = Math.max(cols, rows), g = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1), i, j;
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) g[j] = f[j * cols + i];
      edt1(g, rows, d, v, z);
      for (j = 0; j < rows; j++) f[j * cols + i] = d[j];
    }
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) g[i] = f[j * cols + i];
      edt1(g, cols, d, v, z);
      for (i = 0; i < cols; i++) f[j * cols + i] = d[i];
    }
  }

  function buildField(rects, vw, docH, small) {
    var bar = rects.bar || 0;
    var padX = small ? 72 : 120, padY = 160; // the grid runs past the screen edges: streams may leave the screen
    var cols = Math.ceil((vw + 2 * padX) / CELL), rows = Math.ceil((docH + 2 * padY) / CELL), n = cols * rows, i, j, k;
    var f = new Float64Array(n).fill(1e10);
    for (var r = 0; r < rects.length; r += 4) {
      var i0 = Math.max(0, Math.floor((rects[r] + padX) / CELL)), i1 = Math.min(cols - 1, Math.floor((rects[r + 2] + padX) / CELL));
      var j0 = Math.max(0, Math.floor((rects[r + 1] + padY) / CELL)), j1 = Math.min(rows - 1, Math.floor((rects[r + 3] + padY) / CELL));
      for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) f[j * cols + i] = 0;
    }
    edt(f, cols, rows);
    var D = new Float32Array(n), cost = new Float32Array(n);
    var EDGE = small ? 40 : 56, PREF = small ? 64 : 110, MIN = small ? 8 : 14;
    for (k = 0; k < n; k++) D[k] = f[k] > 0 ? Math.min(4000, Math.sqrt(f[k]) * CELL - CELL * 0.5) : 0;
    for (j = 0; j < rows; j++) {
      var y = (j + 0.5) * CELL - padY;
      for (i = 0; i < cols; i++) {
        k = j * cols + i;
        var x = (i + 0.5) * CELL - padX;
        var room = Math.max(0, Math.min(D[k], Math.min(x, vw - x) + EDGE));
        var lack = 1 - Math.min(room, PREF) / PREF;
        // prefer the middle of wide channels, stay on screen, and pass behind content only if there is no other way
        cost[k] = 1 + 10 * lack * lack + (D[k] < MIN ? 250 : 0) + (y > -CELL && y < bar ? 40 : 0);
      }
    }
    function bil(x, y) {
      var gx = Math.min(Math.max((x + padX) / CELL - 0.5, 0), cols - 1.001), gy = Math.min(Math.max((y + padY) / CELL - 0.5, 0), rows - 1.001);
      var ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, o = iy * cols + ix;
      return (D[o] * (1 - fx) + D[o + 1] * fx) * (1 - fy) + (D[o + cols] * (1 - fx) + D[o + cols + 1] * fx) * fy;
    }
    return {
      cols: cols, rows: rows, padX: padX, padY: padY, vw: vw, docH: docH, D: D, cost: cost, edge: EDGE,
      room: bil, // free room around a point, from the content only
      vis: function (x, y) { return Math.min(bil(x, y), Math.min(x, vw - x) + EDGE); }, // …and from the screen edges
      grad: function (x, y) {
        var gx = bil(x + CELL, y) - bil(x - CELL, y), gy = bil(x, y + CELL) - bil(x, y - CELL), l = Math.hypot(gx, gy) || 1;
        return [gx / l, gy / l];
      },
      cell: function (x, y) {
        var i = Math.min(cols - 1, Math.max(0, Math.floor((x + padX) / CELL))), j = Math.min(rows - 1, Math.max(0, Math.floor((y + padY) / CELL)));
        return j * cols + i;
      }
    };
  }

  function Heap() { this.key = []; this.val = []; this.size = 0; }
  Heap.prototype.push = function (v, key) {
    var i = this.size++, K = this.key, W = this.val;
    while (i > 0) { var p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; W[i] = W[p]; i = p; }
    K[i] = key; W[i] = v;
  };
  Heap.prototype.pop = function () {
    var K = this.key, W = this.val, top = W[0], n = --this.size;
    if (n > 0) {
      var key = K[n], v = W[n], i = 0;
      for (;;) {
        var l = 2 * i + 1;
        if (l >= n) break;
        var c = l + 1 < n && K[l + 1] < K[l] ? l + 1 : l;
        if (K[c] >= key) break;
        K[i] = K[c]; W[i] = W[c]; i = c;
      }
      K[i] = key; W[i] = v;
    }
    return top;
  };

  var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function astar(F, a, b) {
    var cols = F.cols, rows = F.rows, n = cols * rows, cost = F.cost;
    var g = F.g || (F.g = new Float32Array(n)), from = F.from || (F.from = new Int32Array(n)), done = F.done || (F.done = new Uint8Array(n));
    g.fill(Infinity); done.fill(0);
    var s = F.cell(a.x, a.y), t = F.cell(b.x, b.y), tx = t % cols, ty = (t / cols) | 0;
    // search only a band around the segment's height
    var jlo = Math.max(0, Math.min(s / cols | 0, ty) - 40), jhi = Math.min(rows - 1, Math.max(s / cols | 0, ty) + 40);
    var heap = new Heap();
    g[s] = 0; from[s] = -1; heap.push(s, 0);
    while (heap.size) {
      var k = heap.pop();
      if (k === t) break;
      if (done[k]) continue;
      done[k] = 1;
      var x = k % cols, y = (k / cols) | 0;
      for (var d = 0; d < 8; d++) {
        var nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || nx >= cols || ny < jlo || ny > jhi) continue;
        var m = ny * cols + nx;
        if (done[m]) continue;
        var ng = g[k] + DIRS[d][2] * 0.5 * (cost[k] + cost[m]);
        if (ng < g[m]) {
          g[m] = ng; from[m] = k;
          var ex = Math.abs(nx - tx), ey = Math.abs(ny - ty);
          heap.push(m, ng + 1.3 * (Math.max(ex, ey) + 0.4142 * Math.min(ex, ey)));
        }
      }
    }
    var out = [];
    if (g[t] === Infinity) { out = [[a.x, a.y], [b.x, b.y]]; out.cost = 1e9; return out; }
    out.cost = g[t];
    for (var c = t; c !== -1; c = from[c]) out.push([(c % cols + 0.5) * CELL - F.padX, ((c / cols | 0) + 0.5) * CELL - F.padY]);
    out.reverse();
    out[0] = [a.x, a.y];
    out[out.length - 1] = [b.x, b.y];
    return out;
  }

  function resample(P, step) {
    var out = [[P[0][0], P[0][1]]], carry = 0;
    for (var i = 1; i < P.length; i++) {
      var ax = P[i - 1][0], ay = P[i - 1][1], dx = P[i][0] - ax, dy = P[i][1] - ay, L = Math.hypot(dx, dy);
      for (var t = step - carry; t < L; t += step) out.push([ax + dx * t / L, ay + dy * t / L]);
      carry = (carry + L) % step;
    }
    var last = P[P.length - 1], end = out[out.length - 1];
    if (Math.hypot(last[0] - end[0], last[1] - end[1]) > step * 0.3) out.push([last[0], last[1]]);
    else out[out.length - 1] = [last[0], last[1]];
    return out;
  }

  // Taut-string smoothing: pull every point towards its neighbours, push it back out of the
  // content where it got too close. Pinned points (crossings, ends) stay put.
  function relax(F, P, iters, clear) {
    for (var it = 0; it < iters; it++) {
      for (var i = 1; i < P.length - 1; i++) {
        var p = P[i];
        if (p[2]) continue;
        p[0] += 0.5 * ((P[i - 1][0] + P[i + 1][0]) / 2 - p[0]);
        p[1] += 0.5 * ((P[i - 1][1] + P[i + 1][1]) / 2 - p[1]);
        var d = F.room(p[0], p[1]);
        if (d < clear) { var gr = F.grad(p[0], p[1]), mv = Math.min(clear - d, 4); p[0] += gr[0] * mv; p[1] += gr[1] * mv; }
      }
    }
  }

  // Route a stream through its anchors; returns the smoothed path and the arc positions of its crossings.
  function arcs(P) {
    var s = [0];
    for (var i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    return s;
  }
  // A slow sideways wave, so long runs through a channel read as flowing light rather than a
  // ruled line. It fades out towards pinned points and never takes more than the spare room.
  function meander(F, P, s, clear, wave) {
    if (!wave) return;
    var pins = [];
    for (var i = 0; i < P.length; i++) if (P[i][2]) pins.push(s[i]);
    var off = [];
    for (i = 0; i < P.length; i++) {
      var a = P[Math.max(i - 2, 0)], b = P[Math.min(i + 2, P.length - 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      var near = 1e9;
      for (var j = 0; j < pins.length; j++) near = Math.min(near, Math.abs(s[i] - pins[j]));
      var spare = Math.max(0, F.room(P[i][0], P[i][1]) - clear - 10);
      var amp = Math.min(wave.amp, 0.4 * spare) * smooth(0, 220, near);
      var o = amp * Math.sin(6.2832 * s[i] / wave.len + wave.ph);
      off.push([-ty / tl * o, tx / tl * o]);
    }
    for (i = 0; i < P.length; i++) if (!P[i][2]) { P[i][0] += off[i][0]; P[i][1] += off[i][1]; }
  }

  function routeStream(F, anchors, clear, wave) {
    var P = [], keys = [];
    for (var i = 0; i + 1 < anchors.length; i++) {
      var from = anchors[i], raw = null;
      var to = anchors[i + 1];
      if (i > 0 && from.k && P.length > 6) {
        // if the way on turns right back, first carry on past the crossing, so the stream passes
        // through it instead of bouncing off it
        var back = P[P.length - 7], dx = from.x - back[0], dy = from.y - back[1], dl = Math.hypot(dx, dy) || 1;
        var ox = to.x - from.x, oy = to.y - from.y, ol = Math.hypot(ox, oy) || 1;
        for (var lead = (dx * ox + dy * oy) / (dl * ol) < -0.5 ? 110 : 0; lead >= 40 && !raw; lead /= 2) {
          var lx = from.x + dx / dl * lead, ly = from.y + dy / dl * lead;
          if (F.room(lx, ly) >= clear) raw = [[from.x, from.y]].concat(astar(F, { x: lx, y: ly }, anchors[i + 1]));
        }
      }
      var seg = resample(raw || astar(F, from, anchors[i + 1]), CELL);
      if (i > 0) seg.shift();
      else { seg[0][2] = 1; keys.push({ at: 0, a: anchors[0] }); }
      seg[seg.length - 1][2] = anchors[i + 1].k || i + 2 === anchors.length ? 1 : 0; // waypoints only guide, crossings and ends stay
      Array.prototype.push.apply(P, seg);
      keys.push({ at: P.length - 1, a: anchors[i + 1] });
    }
    relax(F, P, 36, clear);
    var s = arcs(P);
    meander(F, P, s, clear, wave);
    relax(F, P, 6, clear);
    // arc length, and the arc position of every crossing on the way
    s = arcs(P);
    var nodes = [];
    for (i = 0; i < keys.length; i++) if (keys[i].a.k) nodes.push({ s: s[keys[i].at], k: keys[i].a.k });
    return { P: P, s: s, nodes: nodes };
  }

  var PALETTES = {
    warm: ['magenta', 'purple', 'blue', 'purple', 'magenta', 'pink', 'red', 'pink'],
    blue: ['blue', 'purple', 'blue', 'cyan'],
    violet: ['purple', 'magenta', 'purple', 'blue']
  };
  function palAt(pal, u, out) {
    var n = pal.length, i = Math.floor(u), f = u - i;
    var a = COL[pal[((i % n) + n) % n]], b = COL[pal[(((i + 1) % n) + n) % n]];
    return mix3(a, b, f * f * (3 - 2 * f), out);
  }

  // Turn a routed path into stream control points: colour, width and heat follow the crossings,
  // and the bundle never gets wider than the room around it.
  function toStream(F, R, st, sx) {
    var pts = [], P = R.P, step = 24, next = 0;
    for (var i = 0; i < P.length; i++) {
      var last = i === P.length - 1;
      if (R.s[i] < next && !P[i][2] && !last) continue;
      next = R.s[i] + step;
      var x = P[i][0], y = P[i][1], s = R.s[i], hot = 0, warm = 0, near = 1e9;
      for (var j = 0; j < R.nodes.length; j++) {
        var d = Math.abs(s - R.nodes[j].s), kk = R.nodes[j].k;
        near = Math.min(near, d);
        hot = Math.max(hot, kk * Math.exp(-Math.pow(d / (60 * sx), 2)));
        warm = Math.max(warm, kk * Math.exp(-Math.pow(d / (170 * sx), 2)));
      }
      var c = palAt(PALETTES[st.pal], (s + st.shift) / (700 * sx), [0, 0, 0]);
      mix3(c, COL.pink, smooth(0.1, 0.45, warm), c);
      mix3(c, COL.orange, smooth(0.45, 0.8, warm), c);
      mix3(c, COL.amber, smooth(0.85, 1, warm), c);
      var room = F.room(x, y);
      var want = sx * (6 + 42 * smooth(0, 240 * sx, near)) * st.w;
      pts.push([x, y, Math.max(2, Math.min(want, (room - 10) / 1.6)), c, hot, room]);
    }
    return { pts: pts, edge: st.edge, w: st.w, fadeIn: st.fadeIn ? R.s[R.s.length - 1] * st.fadeIn : 0, fadeOut: st.fadeOut ? R.s[R.s.length - 1] * st.fadeOut : 0 };
  }

  // the best free spot in a region: as much room as possible, not too far from a preferred point
  function spot(F, x0, x1, y0, y1, px, py, pull, cap) {
    var best = null, bs = -1e9;
    for (var y = y0; y <= y1; y += CELL) {
      for (var x = x0; x <= x1; x += CELL) {
        var r = F.vis(x, y), sc = Math.min(r, cap || 150) - pull * Math.hypot(x - px, y - py);
        if (sc > bs) { bs = sc; best = { x: x, y: y, room: r }; }
      }
    }
    return best || { x: px, y: py, room: F.room(px, py) };
  }
  // horizontal gaps between sections: rows that are mostly free across the screen
  function gaps(F, y0, y1, need) {
    var out = [], cur = null;
    for (var y = y0; y < y1; y += CELL) {
      var free = 0, tot = 0;
      for (var x = CELL / 2; x < F.vw; x += CELL) { tot++; if (F.vis(x, y) >= need) free++; }
      if (free >= tot * 0.5) { if (!cur) cur = { y0: y, y1: y }; cur.y1 = y; }
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  }

  // The composition: two streams fall into a bright crossing in the hero (the V), and one of them
  // zigzags down the page — along a free side channel, across a gap between sections to the next
  // crossing on the other side, and so on. At each of those crossings another stream comes down
  // that side and leaves off the edge. A couple of thin branches peel off where there is room.
  function compose(F, vw, vh, docH, small, sx) {
    var pad = F.padX, nodes = [], plan = [], i;
    var n0 = spot(F, vw * (small ? 0.5 : 0.45), vw * 0.97, 100, Math.min(vh * 0.85, docH * 0.6),
      vw * (small ? 0.8 : 0.72), Math.min(Math.max(vh * 0.5, 180), 480), 0.12);
    n0.k = 1; n0.side = 1;
    nodes.push(n0);
    var list = gaps(F, n0.y + vh * 0.3, docH - 60, small ? 18 : 30), side = 1, spacing = Math.max(vh * 0.55, 380);
    // From the hero crossing the long stream sweeps down to one side and then crosses over to the first
    // crossing below on the other side. Sweep left (as in the artwork) unless content is in the way.
    for (i = 0; i < list.length; i++) {
      var y1 = (list[i].y0 + list[i].y1) / 2;
      if (y1 - n0.y < spacing) continue;
      var yp = Math.min(y1, n0.y + vh * 0.7);
      side = astar(F, n0, channel(-1, yp)).cost <= 2.8 * astar(F, n0, channel(1, yp)).cost ? 1 : -1;
      break;
    }
    for (i = 0; i < list.length; i++) {
      var g = list[i], y = (g.y0 + g.y1) / 2;
      if (y - nodes[nodes.length - 1].y < spacing) continue;
      var nd = side < 0 ? spot(F, -pad * 0.2, vw * 0.4, g.y0, g.y1, vw * 0.1, y, 0.1) : spot(F, vw * 0.6, vw + pad * 0.2, g.y0, g.y1, vw * 0.9, y, 0.1);
      if (nd.room < (small ? 16 : 28)) continue;
      nd.k = 0.65; nd.side = side;
      nodes.push(nd);
      side = -side;
    }
    function P(x, y) { return { x: x, y: y }; }
    function channel(sd, y) { // a point in the free channel down one side of the page
      return sd < 0 ? spot(F, -pad * 0.5, vw * 0.35, y - 2 * CELL, y + 2 * CELL, 0, y, 0.02, 1e4)
                    : spot(F, vw * 0.65, vw + pad * 0.5, y - 2 * CELL, y + 2 * CELL, vw, y, 0.02, 1e4);
    }
    var dy = n0.y + 60;
    plan.push({ anchors: [P(Math.max(-pad * 0.8, n0.x - 1.05 * dy), -80), n0, P(vw + pad * 0.7, n0.y + vh * 0.12)], pal: 'blue', edge: 'blue', w: 1, shift: 0 });
    var spine = [P(Math.min(vw + pad * 0.8, n0.x + 0.7 * dy), -80), n0];
    for (i = 1; i < nodes.length; i++) { spine.push(channel(-nodes[i].side, nodes[i].y)); spine.push(nodes[i]); }
    var endSide = nodes.length > 1 ? nodes[nodes.length - 1].side : n0.side;
    spine.push(channel(endSide, docH - Math.max(140, vh * 0.2)));
    spine.push(P(endSide < 0 ? -pad * 0.8 : vw + pad * 0.8, docH + 80));
    plan.push({ anchors: spine, pal: 'warm', edge: 'magenta', w: 1, shift: 0 });
    for (i = 1; i < nodes.length; i++) {
      var nd2 = nodes[i], sd = nd2.side;
      var yTop = Math.max(nodes[i - 1].y + 80, nd2.y - vh * 0.75), yBot = Math.max(yTop + CELL, nd2.y - vh * 0.3);
      var top = sd < 0 ? spot(F, -pad * 0.4, vw * 0.35, yTop, yBot, vw * 0.04, yTop, 0.05, 1e4) : spot(F, vw * 0.65, vw + pad * 0.4, yTop, yBot, vw * 0.96, yTop, 0.05, 1e4);
      plan.push({ anchors: [top, nd2, P(sd < 0 ? -pad * 0.8 : vw + pad * 0.8, nd2.y + vh * 0.14)],
        pal: i % 2 ? 'violet' : 'blue', edge: i % 2 ? 'purple' : 'blue', w: 0.8, shift: i * 1.7, fadeIn: 0.3 });
    }

    var clear = small ? 12 : 20, routed = [], out = [];
    for (i = 0; i < plan.length; i++) routed.push(routeStream(F, plan[i].anchors, clear, { amp: small ? 14 : 38, len: (small ? 380 : 620) + 90 * i, ph: 1.9 * i }));

    // branches: thin offshoots where a stream has plenty of room, away from the crossings
    var cands = [];
    for (i = 0; i < routed.length; i++) {
      var R = routed[i];
      for (var j = 8; j < R.P.length - 8; j += 4) {
        var p = R.P[j], sj = R.s[j], far = true;
        if (p[1] < vh * 0.6 || p[0] < 0 || p[0] > vw) continue;
        for (var q = 0; q < R.nodes.length; q++) if (Math.abs(sj - R.nodes[q].s) < 320) far = false;
        if (far && sj > 200 && R.s[R.s.length - 1] - sj > 300) cands.push({ r: i, j: j, room: F.vis(p[0], p[1]) });
      }
    }
    cands.sort(function (a, b) { return b.room - a.room; });
    var picked = [];
    for (i = 0; i < cands.length && picked.length < 2; i++) {
      var cd = cands[i];
      if (cd.room < (small ? 30 : 60)) break;
      var ok = true;
      for (q = 0; q < picked.length; q++) if (Math.abs(routed[picked[q].r].P[picked[q].j][1] - routed[cd.r].P[cd.j][1]) < vh * 0.8) ok = false;
      if (ok) picked.push(cd);
    }
    for (i = 0; i < picked.length; i++) {
      var pr = routed[picked[i].r], pj = picked[i].j, a0 = pr.P[pj - 3], a1 = pr.P[pj + 3], base = pr.P[pj];
      var tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      var best = null;
      for (var sgn = -1; sgn <= 1; sgn += 2) { // veer off to whichever side has more room
        var ang = 0.55 * sgn, cx = tx * Math.cos(ang) - ty * Math.sin(ang), cy = tx * Math.sin(ang) + ty * Math.cos(ang);
        var tgt = spot(F, base[0] + cx * 420 - 100, base[0] + cx * 420 + 100, base[1] + cy * 420 - 100, base[1] + cy * 420 + 100, base[0] + cx * 420, base[1] + cy * 420, 0.1);
        if (!best || tgt.room > best.t.room) best = { t: tgt, cx: cx, cy: cy };
      }
      var split = { x: base[0], y: base[1], k: 0 };
      var R2 = routeStream(F, [split, P(base[0] + best.cx * 70, base[1] + best.cy * 70), best.t], clear, null);
      routed.push(R2);
      plan.push({ pal: plan[picked[i].r].pal === 'warm' ? 'violet' : 'blue', edge: 'purple', w: 0.45, shift: 3.3 + i, fadeIn: 0.25, fadeOut: 0.45 });
    }
    for (i = 0; i < routed.length; i++) out.push(toStream(F, routed[i], plan[i], sx));
    return { streams: out, nodes: nodes };
  }

  var count = 0, builtW = 0, builtH = 0, flowScale = 1;
  function build() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var docH = Math.max(document.documentElement.scrollHeight, vh);
    var small = vw < 720;
    var gs = Math.min(1, Math.max(0.55, Math.max(vw, 640) / 1440)); // glow widths
    var sx = Math.min(Math.max(vw, 640) / 866, 1.8);                  // bundle widths and crossings
    flowScale = gs;
    var F = buildField(scanObstacles(), vw, docH, small);
    var comp = compose(F, vw, vh, docH, small, sx);
    var rnd = rng(9173);
    len = 0; verts = 0;
    emitDust(F, rnd, small);
    for (var i = 0; i < comp.streams.length; i++) emitStream(comp.streams[i], rnd, small ? 22 : 44, gs, small);
    for (var j = 0; j < comp.nodes.length; j++) emitNode(comp.nodes[j], sx, rnd);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, len), gl.STATIC_DRAW);
    count = verts;
    builtW = vw;
    builtH = docH;
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
    gl.uniform1f(U.u_scroll, y); // the streams are laid out on the page, so they scroll with it
    gl.uniform1f(U.u_time, t);
    gl.uniform1f(U.u_dpr, dpr);
    gl.uniform1f(U.u_flow, flowScale);
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
  // the streams follow the layout: re-route when the content moves (fonts, images, an opened FAQ answer)
  function relayout() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(function () { build(); request(); }, 200); }
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (builtW && Math.abs(document.documentElement.scrollHeight - builtH) > 4) relayout();
    }).observe(document.querySelector('.page') || document.body);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); fallback(); });

  size(true);
  // measure the page once it has been laid out and painted
  requestAnimationFrame(function () { setTimeout(function () { build(); start(); }, 0); });
})();
