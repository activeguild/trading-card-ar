// components/cardEffect/shaders/ripple.ts
// リップル: 中心から波紋(同心円)が広がる連続エフェクト

export const rippleShader = `
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

  void main() {
    vec2 uv = v_texCoord;
    float aspect = u_resolution.x / u_resolution.y;
    float t = u_time * u_speed;

    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect;
    float dist = length(delta);

    // Continuous expanding rings (phase: dist - t)
    float phase = dist * 14.0 - t * 4.0;
    float ringWave = sin(phase);
    float ringEdge = pow(0.5 + 0.5 * ringWave, 6.0);

    // Radial distortion sampled along ripple direction
    vec2 dir = (dist > 0.0001) ? delta / dist : vec2(0.0);
    dir.x /= aspect;
    float ripple = ringWave * exp(-dist * 0.6) * u_borderWidth * u_intensity;
    vec2 distortedUv = clamp(uv + dir * ripple * 0.4, 0.0, 1.0);
    vec4 distorted = texture2D(u_image, distortedUv);
    vec4 texColor = texture2D(u_image, uv);

    vec3 ringColor = u_effectColor * ringEdge * u_intensity;

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    vec3 base = u_mode >= 1.5 ? texColor.rgb : distorted.rgb;
    float baseAlpha = u_mode >= 1.5 ? texColor.a : distorted.a;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = base + ringColor * 0.6;
    } else {
      color = base + ringColor;
    }

    if (u_effectOnly > 0.5) {
      float mask = ringEdge * u_intensity * opacity;
      gl_FragColor = vec4(ringColor * opacity, mask);
    } else {
      gl_FragColor = vec4(color * opacity, baseAlpha * opacity);
    }
  }
`;
