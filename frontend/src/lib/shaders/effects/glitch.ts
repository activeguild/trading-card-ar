// components/cardEffect/shaders/glitch.ts

export const glitchShader = `
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

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    float t = u_time * u_speed;

    // Glitch blocks: random horizontal slices shift
    float sliceY = floor(uv.y * 20.0);
    float sliceRand = hash(sliceY + floor(t * 8.0) * 100.0);
    float glitchActive = step(0.85, sliceRand); // 15% of slices glitch
    float shift = (hash(sliceY + floor(t * 12.0) * 50.0) - 0.5) * 0.15 * u_intensity * glitchActive;

    vec2 glitchUv = vec2(uv.x + shift, uv.y);

    // RGB split
    float rgbShift = 0.008 * u_intensity * (1.0 + glitchActive * 3.0);
    float r = texture2D(u_image, glitchUv + vec2(rgbShift, 0.0)).r;
    float g = texture2D(u_image, glitchUv).g;
    float b = texture2D(u_image, glitchUv - vec2(rgbShift, 0.0)).b;
    float a = texture2D(u_image, glitchUv).a;

    // Scanlines
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.04 * u_intensity;

    // Random color flash on glitch blocks
    vec3 flashColor = vec3(hash(sliceY + t), hash(sliceY + t + 1.0), hash(sliceY + t + 2.0));
    float flashMix = glitchActive * step(0.92, sliceRand) * 0.3 * u_intensity;

    vec3 color = vec3(r, g, b) - scanline;
    color = mix(color, flashColor, flashMix);

    // Outline mode: mask to opaque
    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;

    if (u_effectOnly > 0.5) {
      vec3 effectPart = color - texColor.rgb;
      float mask = length(effectPart) * opacity;
      gl_FragColor = vec4(effectPart * opacity, mask);
    } else {
      gl_FragColor = vec4(color * opacity, a * opacity);
    }
  }
`;
