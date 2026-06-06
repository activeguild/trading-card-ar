// components/cardEffect/shaders/burn.ts
// バーン: 端から燃えるように消えていく

export const burnShader = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_borderWidth;
  uniform float u_intensity;
  uniform float u_speed;
  uniform float u_mode;
  uniform vec3 u_effectColor;
  uniform float u_blendMode;
  uniform float u_effectOnly;
  uniform sampler2D u_edgeMap;
  uniform sampler2D u_background;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // No burn yet: pass through original image
    if (progress < 0.001) {
      gl_FragColor = texColor;
      return;
    }

    // Noise-based burn edge
    float n = noise(uv * 6.0) * 0.4
            + noise(uv * 12.0) * 0.3
            + noise(uv * 24.0) * 0.2
            + noise(uv * 48.0) * 0.1;

    // Burn from edges inward
    float dx = min(uv.x, 1.0 - uv.x);
    float dy = min(uv.y, 1.0 - uv.y);
    float edgeDist = min(dx, dy) * 2.0;
    float burnMap = edgeDist * 0.6 + n * 0.4;

    // Overshoot progress so the burn threshold sweeps past burnMap=1.0 by progress=1.
    float p = progress * 1.1;
    float burnEdge = smoothstep(p - 0.05, p + 0.05, burnMap);

    // Glow at burn edge (orange/red). Damp to zero at the very end so
    // no residual fire is visible when the dispersal completes.
    float glowFade = 1.0 - smoothstep(0.9, 1.0, progress);
    float edgeGlow = smoothstep(p + 0.08, p, burnMap)
                   * smoothstep(p - 0.08, p, burnMap) * glowFade;
    vec3 fireColor = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.8, 0.0), edgeGlow);

    float burnMask = burnEdge * texColor.a;
    vec3 color = mix(bgColor.rgb, texColor.rgb, burnMask);
    color += fireColor * edgeGlow * texColor.a * 2.0;

    float alpha = max(bgColor.a, burnMask + edgeGlow * texColor.a);
    gl_FragColor = vec4(color, alpha);
  }
`;
