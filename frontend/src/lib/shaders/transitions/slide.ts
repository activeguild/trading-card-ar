// components/cardEffect/shaders/slide.ts

export const slideShader = `
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

  void main() {
    vec2 uv = v_texCoord;

    // Progress: 0 = fully visible, 1 = fully split apart
    float t = fract(u_time * u_speed * 0.2);
    // Ease-in-out for natural motion
    float progress = t * t * (3.0 - 2.0 * t);
    // Slide distance: each half moves up to 0.6 off-screen
    float slide = progress * 0.6;

    // Split at center
    vec4 color = vec4(0.0);
    if (uv.x < 0.5) {
      // Left half: slides left
      vec2 sampleUv = vec2(uv.x + slide, uv.y);
      if (sampleUv.x < 0.5) {
        color = texture2D(u_image, sampleUv);
      }
    } else {
      // Right half: slides right
      vec2 sampleUv = vec2(uv.x - slide, uv.y);
      if (sampleUv.x >= 0.5) {
        color = texture2D(u_image, sampleUv);
      }
    }

    // Subtle edge glow at the split line
    float splitDist = abs(uv.x - 0.5);
    float edgeGlow = smoothstep(0.02, 0.0, splitDist) * progress * 0.3;
    color.rgb += vec3(edgeGlow);

    vec4 bgColor = texture2D(u_background, uv);
    float mask = color.a;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
