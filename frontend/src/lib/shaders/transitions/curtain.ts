// components/cardEffect/shaders/curtain.ts
// カーテン: 左右からカーテンが閉じるように消える

export const curtainShader = `
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
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Curtains close from both sides. Overshoot the half-point so they fully
    // overlap at progress=1 (no thin seam at the center).
    float curtainEdge = progress * 0.55;
    // Add wave to the curtain edge
    float wave = sin(uv.y * 12.0 + u_time * u_speed * 2.0) * 0.02 * progress;
    float leftCurtain = smoothstep(curtainEdge + wave + 0.01, curtainEdge + wave - 0.01, uv.x);
    float rightCurtain = smoothstep(1.0 - curtainEdge - wave - 0.01, 1.0 - curtainEdge - wave + 0.01, uv.x);
    float curtain = max(leftCurtain, rightCurtain);

    float mask = (1.0 - curtain) * texColor.a;
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
