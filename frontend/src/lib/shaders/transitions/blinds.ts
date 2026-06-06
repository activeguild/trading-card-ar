// components/cardEffect/shaders/blinds.ts

export const blindsShader = `
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
    vec4 texColor = texture2D(u_image, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Horizontal blinds (8 slats)
    float slats = 8.0;
    float slat = fract(uv.y * slats);
    // Overshoot progress so the threshold sweeps past slat=1.0 by progress=1.
    float p = progress * 1.05;
    float mask = smoothstep(p - 0.02, p + 0.02, slat) * texColor.a;
    vec4 bgColor = texture2D(u_background, uv);
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
