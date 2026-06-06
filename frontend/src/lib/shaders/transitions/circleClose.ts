// components/cardEffect/shaders/circleClose.ts

export const circleCloseShader = `
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
    float aspect = u_resolution.x / u_resolution.y;

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Circle shrinking to center
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect;
    float dist = length(delta);
    float maxDist = length(vec2(0.5 * aspect, 0.5));
    // Push radius slightly negative at progress=1 so the center pixel fully disappears.
    float radius = (1.0 - progress) * maxDist - progress * 0.02;

    float mask = smoothstep(radius + 0.01, radius - 0.01, dist) * texColor.a;
    vec4 bgColor = texture2D(u_background, uv);
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
