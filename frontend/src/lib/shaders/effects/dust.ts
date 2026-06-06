// components/cardEffect/shaders/dust.ts
// ダスト: 細かな光の粒子が舞う

export const dustShader = `
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

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    float t = u_time * u_speed;

    // 3 layers of drifting dust at different scales/speeds/directions
    float d1 = pow(hash(floor(uv * 280.0 + vec2(t * 8.0, t * 3.0))), 25.0) * 28.0;
    float d2 = pow(hash(floor(uv * 180.0 + vec2(-t * 5.0, t * 6.0))), 22.0) * 22.0;
    float d3 = pow(hash(floor(uv * 110.0 + vec2(t * 2.0, -t * 4.0))), 18.0) * 16.0;
    float dust = (d1 + d2 + d3) * u_intensity * 0.35;

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    vec3 dustColor = u_effectColor * dust;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = texColor.rgb + dustColor * 0.7;
    } else {
      color = texColor.rgb + dustColor;
    }

    if (u_effectOnly > 0.5) {
      float mask = dust * opacity;
      gl_FragColor = vec4(dustColor * opacity, mask);
    } else {
      gl_FragColor = vec4(color * opacity, texColor.a * opacity);
    }
  }
`;
