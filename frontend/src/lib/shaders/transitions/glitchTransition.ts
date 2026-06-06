// components/cardEffect/shaders/glitchTransition.ts
// グリッチ消滅: グリッチしながら消えていく

export const glitchTransitionShader = `
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

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 uv = v_texCoord;
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Increasing glitch intensity
    float glitchAmount = progress * progress;

    // Random horizontal slices
    float sliceY = floor(uv.y * 30.0);
    float sliceRand = hash(sliceY + floor(u_time * 15.0) * 100.0);
    float glitchActive = step(1.0 - glitchAmount * 0.8, sliceRand);

    // Shift amount increases with progress
    float shift = (hash(sliceY + floor(u_time * 20.0) * 50.0) - 0.5) * glitchAmount * 0.5 * glitchActive;

    vec2 glitchUv = vec2(uv.x + shift, uv.y);

    // RGB split increasing with progress
    float rgbShift = glitchAmount * 0.03;
    float r = texture2D(u_image, glitchUv + vec2(rgbShift, 0.0)).r;
    float g = texture2D(u_image, glitchUv).g;
    float b = texture2D(u_image, glitchUv - vec2(rgbShift, 0.0)).b;
    float a = texture2D(u_image, glitchUv).a;

    // Random block disappearance
    vec2 blockGrid = floor(uv * 10.0);
    float blockRand = hash(dot(blockGrid, vec2(7.0, 13.0)) + floor(u_time * 5.0));
    float blockVisible = step(progress * 1.2, blockRand);

    vec3 imgColor = vec3(r, g, b);

    // Color flash on glitch
    vec3 flashColor = vec3(hash(sliceY + u_time), 0.0, hash(sliceY + u_time + 1.0));
    imgColor = mix(imgColor, flashColor, glitchActive * glitchAmount * 0.3);

    float mask = a * blockVisible * (1.0 - progress * 0.3);
    gl_FragColor = vec4(mix(bgColor.rgb, imgColor, mask), max(bgColor.a, mask));
  }
`;
