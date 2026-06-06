// components/cardEffect/shaders/melt.ts
// メルト: 画像が液状化して下に流れ落ちて消える

export const meltShader = `
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

  float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

  void main() {
    vec2 uv = v_texCoord;
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Each vertical column drips down with random speed
    float col = floor(uv.x * 60.0);
    float speed = 0.5 + hash(col) * 0.8;
    float drip = progress * speed * 1.3;

    vec2 sampleUv = vec2(uv.x, uv.y + drip);
    vec4 color = vec4(0.0);
    if (sampleUv.y <= 1.0) {
      color = texture2D(u_image, sampleUv);
    }
    float fade = 1.0 - smoothstep(0.6, 1.0, progress);
    float mask = color.a * fade;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
