// components/cardEffect/shaders/flicker.ts
// フリッカー: 画像が断続的にちらつきながらフェードアウト

export const flickerShader = `
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

  float hash(float x) { return fract(sin(x * 127.1) * 43758.5); }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Flicker frequency grows with progress
    float flickerRate = floor(u_time * (4.0 + progress * 24.0));
    float flickerVal = hash(flickerRate);
    float onFraction = 1.0 - progress * 1.05;
    float on = step(1.0 - clamp(onFraction, 0.0, 1.0), flickerVal);

    float fade = 1.0 - smoothstep(0.6, 1.0, progress);
    float mask = on * fade * texColor.a;
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
