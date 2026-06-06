// components/cardEffect/shaders/zoomOut.ts

export const zoomOutShader = `
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

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Zoom out from center + fade
    float scale = 1.0 + progress * 2.0;
    vec2 center = vec2(0.5, 0.5);
    vec2 sampleUv = (uv - center) * scale + center;

    vec4 color = vec4(0.0);
    if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
      color = texture2D(u_image, sampleUv);
    }
    color *= (1.0 - progress);
    vec4 bgColor = texture2D(u_background, uv);
    float mask = color.a;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
