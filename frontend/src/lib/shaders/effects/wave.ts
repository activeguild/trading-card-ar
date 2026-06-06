// components/cardEffect/shaders/wave.ts

export const waveShader = `
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

    float t = u_time * u_speed;

    // Wave distortion
    float waveX = sin(uv.y * 15.0 + t * 3.0) * u_borderWidth * u_intensity * 0.5;
    float waveY = sin(uv.x * 12.0 + t * 2.5) * u_borderWidth * u_intensity * 0.3;

    vec2 distortedUv = uv + vec2(waveX, waveY);
    distortedUv = clamp(distortedUv, 0.0, 1.0);

    vec4 texColor = texture2D(u_image, uv);
    vec4 distorted = texture2D(u_image, distortedUv);

    // Add subtle edge shimmer where distortion is strong
    float distortAmount = length(vec2(waveX, waveY));
    vec3 shimmer = u_effectColor * distortAmount * 5.0 * u_intensity;

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = distorted.rgb + shimmer * 0.3;
    } else {
      color = distorted.rgb + shimmer * 0.5;
    }

    if (u_effectOnly > 0.5) {
      float mask = distortAmount * 5.0 * u_intensity * opacity;
      gl_FragColor = vec4(shimmer * opacity, mask);
    } else {
      gl_FragColor = vec4(color * opacity, distorted.a * opacity);
    }
  }
`;
