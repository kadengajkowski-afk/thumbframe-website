// Anisotropic Kuwahara with depth-modulated kernel size.
// Close objects (station) get kernel ~4 for crisp edges.
// Far objects (nebula) get kernel ~10 for soft painterly backdrop.

import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform float uKernelNear;
  uniform float uKernelFar;
  uniform vec2 uResolution;

  #define KUWAHARA_N 8

  float lum(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  vec2 getStructure(vec2 uv, vec2 texel) {
    float sxx = 0.0, sxy = 0.0, syy = 0.0;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 off = vec2(float(i), float(j)) * texel;
        float cx = lum(texture2D(inputBuffer, uv+off+vec2(texel.x,0.0)).rgb) -
                   lum(texture2D(inputBuffer, uv+off-vec2(texel.x,0.0)).rgb);
        float cy = lum(texture2D(inputBuffer, uv+off+vec2(0.0,texel.y)).rgb) -
                   lum(texture2D(inputBuffer, uv+off-vec2(0.0,texel.y)).rgb);
        sxx += cx*cx; sxy += cx*cy; syy += cy*cy;
      }
    }
    sxx /= 25.0; sxy /= 25.0; syy /= 25.0;
    float disc = sqrt(max(0.0, (sxx-syy)*(sxx-syy) + 4.0*sxy*sxy));
    float l1 = 0.5*(sxx+syy+disc);
    float l2 = 0.5*(sxx+syy-disc);
    vec2 dir = vec2(sxy, l1-sxx);
    float angle = length(dir) > 0.0001 ? atan(dir.y, dir.x) : 0.0;
    float aniso = (l1+l2 > 0.0001) ? (l1-l2)/(l1+l2) : 0.0;
    return vec2(angle, aniso);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = 1.0 / uResolution;

    // Per-object Kuwahara intensity by depth-buffer value:
    //   Nebula has depthWrite=false, so its pixels leave the depth buffer
    //   at the clear value (~1.0). Planet meshes write sub-unity depth
    //   values (typical range 0.996–0.999 for the galaxy overview). We
    //   map that directly — anything with a "real" depth-buffer write
    //   (i.e., actual 3D geometry) gets the near kernel; anything still
    //   at clear depth (nebula + empty space) gets the far kernel.
    //
    //   smoothstep(0.9985, 0.99995) gives a clean near→far transition
    //   across the very narrow band between "farthest written geometry"
    //   and "clear depth." Planets land solidly in near; nebula lands
    //   solidly in far. No mid-range smearing.
    float d = texture2D(depthBuffer, uv).r;
    float depthNorm = smoothstep(0.9985, 0.99995, d);
    float radius = mix(uKernelNear, uKernelFar, depthNorm);

    vec2 st = getStructure(uv, texel);
    float cosA = cos(st.x);
    float sinA = sin(st.x);
    float stretch = 1.0 + st.y * 3.0;

    vec3 sectorSum[KUWAHARA_N];
    float sectorLumSum[KUWAHARA_N];
    float sectorLum2Sum[KUWAHARA_N];
    float sectorW[KUWAHARA_N];
    for (int s = 0; s < KUWAHARA_N; s++) {
      sectorSum[s] = vec3(0.0);
      sectorLumSum[s] = 0.0;
      sectorLum2Sum[s] = 0.0;
      sectorW[s] = 0.0;
    }

    int r = int(radius);
    for (int i = -10; i <= 10; i++) {
      for (int j = -10; j <= 10; j++) {
        if (abs(i) > r || abs(j) > r) continue;
        vec2 p = vec2(float(i), float(j));
        float dist = length(p);
        if (dist > radius) continue;

        vec2 rotP = vec2(cosA*p.x+sinA*p.y, -sinA*p.x+cosA*p.y);
        rotP.x /= max(stretch, 1.0);

        vec2 sUv = uv + p * texel;
        vec3 col = texture2D(inputBuffer, clamp(sUv, vec2(0.0), vec2(1.0))).rgb;
        float l = lum(col);

        float sAngle = atan(rotP.y, rotP.x) + PI;
        int sector = int(floor(sAngle / (2.0*PI) * float(KUWAHARA_N)));
        sector = clamp(sector, 0, KUWAHARA_N-1);

        float nDist = dist / radius;
        float w = 1.0 - nDist*nDist;
        w = w*w;

        sectorSum[sector] += col*w;
        sectorLumSum[sector] += l*w;
        sectorLum2Sum[sector] += l*l*w;
        sectorW[sector] += w;
      }
    }

    vec3 result = inputColor.rgb;
    float minVar = 1e10;
    for (int s = 0; s < KUWAHARA_N; s++) {
      if (sectorW[s] < 0.001) continue;
      vec3 mean = sectorSum[s] / sectorW[s];
      float meanL = sectorLumSum[s] / sectorW[s];
      float v = sectorLum2Sum[s] / sectorW[s] - meanL*meanL;
      if (v < minVar) { minVar = v; result = mean; }
    }

    outputColor = vec4(result, inputColor.a);
  }
`;

export class KuwaharaEffect extends Effect {
  constructor({ kernelNear = 2.0, kernelFar = 6.0, resolution = new Vector2(1, 1) } = {}) {
    super('KuwaharaEffect', fragmentShader, {
      uniforms: new Map([
        ['uKernelNear', new Uniform(kernelNear)],
        ['uKernelFar', new Uniform(kernelFar)],
        ['uResolution', new Uniform(resolution)],
      ]),
      // Request depth buffer access from the EffectComposer
      attributes: 1, // EffectAttribute.DEPTH
    });
  }

  setSize(width, height) {
    this.uniforms.get('uResolution').value.set(width, height);
  }
}
