// Aurora fragment shader — volumetric altitude-sweep using triangle-wave
// noise for sharp V-shaped ridges (wispy tendrils rather than blobby
// clouds).
//
// The core structure is a loop over rising horizontal "sheets" of aurora.
// Each iteration ray-plane intersects a sheet at increasing altitude,
// samples warped triangle-fBm at that position, assigns a height-indexed
// color from a sin-based rotation, and accumulates with exponential
// falloff so near bands dominate. A horizon clip (rd.y-dependent) plus a
// viewport-relative vertical crop keep the aurora in the upper band.
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform vec3  uHueA;
  uniform vec3  uHueB;
  uniform vec2  uAltitudeMask;
  uniform float uBandCount;
  uniform float uDebug; // 0 = normal, 1 = solid magenta (check #5)

  varying vec2 vUv;

  // Triangle primitive — abs of a fractional shifted centreline. Gives
  // sharp V-shaped ridges instead of smooth sine humps.
  float tri(float x) {
    return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
  }

  // 2-D triangle with a small perpendicular shift so stacked octaves
  // don't align into grid artefacts.
  vec2 tri2(vec2 p) {
    return vec2(
      tri(p.x + tri(p.y * 2.0)),
      tri(p.y + tri(p.x * 2.0))
    );
  }

  // Warped triangle-fBm — 5 octaves, each warping the next sample by the
  // current octave's gradient. The domain-warp is what gives aurora
  // their "caught in wind" feel instead of isotropic puffs.
  float triNoise(vec2 p, float spd, float t) {
    float rz = 0.0;
    float z  = 1.8;
    float z2 = 2.5;
    vec2  bp = p;
    for (int k = 0; k < 5; k++) {
      vec2 dg = tri2(bp * 1.85) * 0.75;
      p  += dg / z2;
      bp *= 1.3;
      z2 *= 0.45;
      z  *= 0.42;
      rz += tri(p.x + tri(p.y)) / z;
      p  *= vec2(0.77, 0.89);
      p  += vec2(t * spd * 0.05, t * spd * 0.06);
    }
    return rz;
  }

  void main() {
    // Diagnostic override — solid magenta so we can tell whether the
    // fragment shader runs at all through the layer-masked render.
    if (uDebug > 0.5) {
      gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
      return;
    }

    // Centred, aspect-corrected NDC uv.
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    float t = uTime * uSpeed;

    // Ray setup — camera below origin looking forward with mild vertical tilt.
    vec3 ro = vec3(0.0, 0.0, -6.7);
    vec3 rd = normalize(vec3(uv * 0.8, 1.3));

    vec3 col = vec3(0.0);

    // Altitude sweep. Each iteration ray-plane-intersects a sheet at
    // altitude h, samples fBm, assigns a height-indexed hue, and
    // accumulates with exp falloff so near bands dominate far ones.
    for (int i = 0; i < 64; i++) {
      if (float(i) >= uBandCount) break;
      float fi = float(i);

      // Rays pointing below horizon can't reach upward aurora sheets.
      if (rd.y <= 0.0001) continue;

      // Accelerating altitude — pow(fi, 1.4) spreads sheets further as
      // we climb, so the upper bands read as thinner streaks.
      float h = 0.8 + pow(fi, 1.4) * 0.002;

      // Horizontal sheet intersection.
      vec2 bpos = ro.xz + rd.xz * ((h - ro.y) / rd.y);

      // fBm sample — small scale gives fine filamentary detail.
      float rz = triNoise(bpos * 0.045, 0.06, t);

      // Hue cycles green -> cyan -> pink -> violet as bands stack up.
      // uHueA controls the anchor direction in RGB sin-space; uHueB is
      // an additional offset (left at 0 by default).
      vec3 tint = sin(1.0 - uHueA + uHueB + fi * 0.043) * 0.5 + 0.5;

      // Blend new band into accumulator, attenuate everything so
      // contributions don't explode.
      col = mix(col, tint * rz, 0.5) * exp2(-fi * 0.065 - 2.5);
    }

    // Horizon clip — rays near the horizontal plane get suppressed.
    col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);

    // The exp2(-2.5) floor means raw output is dim; scale before tone map.
    col *= 42.0;

    // Soft saturation / tonemap so bright bands don't clip to pure white.
    col = col / (col + vec3(0.25));

    // Vertical viewport crop — aurora sits as a band, not the full sky.
    float vCrop =
      smoothstep(uAltitudeMask.x, uAltitudeMask.y, vUv.y)
      * (1.0 - smoothstep(0.85, 1.0, vUv.y));

    gl_FragColor = vec4(col, clamp(vCrop * uIntensity, 0.0, 1.0));
  }
`;

export default fragmentShader;
