// components/cardEffect/shaders/slideV.ts

export const slideVShader = `
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

    float t = fract(u_time * u_speed * 0.2);
    float progress = t * t * (3.0 - 2.0 * t);
    float slide = progress * 0.6;

    vec4 color = vec4(0.0);
    if (uv.y < 0.5) {
      // Top half: slides up
      vec2 sampleUv = vec2(uv.x, uv.y + slide);
      if (sampleUv.y < 0.5) {
        color = texture2D(u_image, sampleUv);
      }
    } else {
      // Bottom half: slides down
      vec2 sampleUv = vec2(uv.x, uv.y - slide);
      if (sampleUv.y >= 0.5) {
        color = texture2D(u_image, sampleUv);
      }
    }

    float splitDist = abs(uv.y - 0.5);
    float edgeGlow = smoothstep(0.02, 0.0, splitDist) * progress * 0.3;
    color.rgb += vec3(edgeGlow);

    vec4 bgColor = texture2D(u_background, uv);
    float mask = color.a;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
