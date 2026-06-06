// components/cardEffect/shaders/spiral.ts
// スパイラル: 螺旋模様で消えていく

export const spiralShader = `
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
    float aspect = u_resolution.x / u_resolution.y;

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect;

    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // Spiral pattern: angle + distance creates spiral arms.
    // Overshoot progress so the threshold sweeps past spiral=1.0 by progress=1.
    float spiral = fract((angle / 6.28318 + dist * 3.0) * 4.0);
    float p = progress * 1.1;
    float spiralMask = smoothstep(p - 0.05, p + 0.05, spiral);

    float mask = spiralMask * texColor.a;
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
