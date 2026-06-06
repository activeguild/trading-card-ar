// components/cardEffect/shaders/diamondWipe.ts

export const diamondWipeShader = `
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

    // Diamond: shrinks from outside toward center
    vec2 center = vec2(0.5, 0.5);
    float dist = abs(uv.x - center.x) + abs(uv.y - center.y);
    float maxDist = 1.0;
    // Push threshold slightly negative at progress=1 so the center pixel fully disappears.
    float threshold = (1.0 - progress) * maxDist - progress * 0.03;

    float mask = smoothstep(threshold + 0.02, threshold - 0.02, dist) * texColor.a;
    vec4 bgColor = texture2D(u_background, uv);
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
