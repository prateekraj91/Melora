// GLSL for DreamyBackground (WebGL1). Five soft gaussian blobs, one per
// palette colour, drifting slowly over a near-black base derived from the
// palette, with low-frequency value-noise warping and ordered-ish dithering so
// the very smooth gradients don't band.

export const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform float u_time;
uniform float u_energy;
uniform vec3 u_colors[5];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // Low-frequency warp: the whole field breathes and bends very slowly.
  vec2 warp = vec2(noise(p * 1.3 + vec2(t * 0.020, 0.0)), noise(p * 1.3 + vec2(7.3, -t * 0.017)));
  p += (warp - 0.5) * 0.22;

  float e = clamp(u_energy, 0.0, 1.0);
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 centre = vec2(
      0.5 * aspect + 0.38 * aspect * sin(t * (0.031 + 0.007 * fi) + fi * 1.7),
      0.5 + 0.34 * cos(t * (0.027 + 0.006 * fi) + fi * 2.3)
    );
    float r = (0.36 + 0.07 * sin(t * 0.05 + fi)) * (1.0 + 0.25 * e);
    vec2 d = p - centre;
    float w = exp(-dot(d, d) / (r * r));
    sum += u_colors[i] * w;
    wsum += w;
  }

  vec3 avg = (u_colors[0] + u_colors[1] + u_colors[2] + u_colors[3] + u_colors[4]) / 5.0;
  vec3 field = sum / max(wsum, 1e-3);
  float cover = 1.0 - exp(-wsum * 1.4);
  // Dim enough that white lyrics stay readable on top.
  float brightness = 0.30 + 0.12 * e;
  vec3 base = avg * 0.05;
  vec3 col = mix(base, field * brightness, cover);

  // Soft vignette.
  vec2 q = uv - 0.5;
  col *= 1.0 - 0.35 * dot(q, q) * 2.0;

  // Dither (±0.5 LSB, changes every frame) to kill banding.
  col += (hash(gl_FragCoord.xy + fract(t) * 91.7) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`
