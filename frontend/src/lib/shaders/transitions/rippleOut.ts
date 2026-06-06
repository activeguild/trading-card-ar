// components/cardEffect/shaders/rippleOut.ts
// リップル: 中心から波紋が広がりながら消える

export const rippleOutShader = `
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
    vec4 bgColor = texture2D(u_background, uv);
    float aspect = u_resolution.x / u_resolution.y;

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    if (progress < 0.001) {
      gl_FragColor = texture2D(u_image, uv);
      return;
    }

    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect;
    float dist = length(delta);
    float maxDist = length(vec2(0.5 * aspect, 0.5));
    float r = dist / maxDist;

    // Ripple wave near the dissolve front (just outside the consumed area)
    float relPos = r - progress;
    float ringWave = sin(relPos * 60.0) * exp(-abs(relPos) * 10.0);

    vec2 dir = (dist > 0.0001) ? delta / dist : vec2(0.0);
    dir.x /= aspect;
    vec2 distortedUV = uv + dir * ringWave * 0.025;
    vec4 texColor = texture2D(u_image, clamp(distortedUV, vec2(0.0), vec2(1.0)));

    // Image vanishes inside the ripple front (r < progress).
    // Overshoot progress so the front passes r=1.0 by progress=1.
    float p = progress * 1.05;
    float mask = smoothstep(p - 0.005, p + 0.005, r) * texColor.a;
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
