// components/cardEffect/shaders/sparkle.ts

export const sparkleShader = `
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // 4-pointed star
  float star(vec2 p, float size) {
    float s1 = smoothstep(size, 0.0, abs(p.x)) * smoothstep(size * 0.06, 0.0, abs(p.y));
    float s2 = smoothstep(size, 0.0, abs(p.y)) * smoothstep(size * 0.06, 0.0, abs(p.x));
    float d1 = abs(p.x + p.y) * 0.707;
    float d2 = abs(p.x - p.y) * 0.707;
    float s3 = smoothstep(size * 0.6, 0.0, d1) * smoothstep(size * 0.04, 0.0, d2);
    float s4 = smoothstep(size * 0.6, 0.0, d2) * smoothstep(size * 0.04, 0.0, d1);
    float core = smoothstep(size * 0.12, 0.0, length(p));
    return max(max(s1, s2), max(s3, s4)) + core;
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    float t = u_time * u_speed;
    float totalSparkle = 0.0;
    vec3 totalColor = vec3(0.0);

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);

    // u_borderWidth (0.01-0.2) controls sparkle count (1-20)
    float numSparkles = max(u_borderWidth * 100.0, 1.0);

    for (int i = 0; i < 20; i++) {
      float fi = float(i);
      if (fi >= numSparkles) continue;
      float seed1 = hash(vec2(fi * 13.7 + 1.0, fi * 7.3 + 3.0));
      float seed2 = hash(vec2(fi * 31.1 + 5.0, fi * 57.9 + 11.0));
      float seed3 = hash(vec2(fi * 53.3 + 17.0, fi * 23.1 + 29.0));

      // Position
      vec2 pos = vec2(seed1, seed2);
      // Twinkle: each star blinks on/off
      float phase = seed3 * 6.28;
      float twinkle = pow(max(0.0, sin(t * (1.5 + seed1 * 2.0) + phase)), 4.0);

      float size = 0.015 + seed3 * 0.02;
      float s = star(uv - pos, size) * twinkle * u_intensity;

      vec3 sColor;
      if (isPrism) {
        float hue = fract(seed1 + t * 0.1);
        sColor = vec3(
          sin(hue * 6.28) * 0.5 + 0.5,
          sin(hue * 6.28 + 2.094) * 0.5 + 0.5,
          sin(hue * 6.28 + 4.189) * 0.5 + 0.5
        );
        sColor = mix(sColor, vec3(1.0), twinkle * 0.5);
      } else {
        sColor = mix(u_effectColor, vec3(1.0), twinkle * 0.4);
      }

      totalSparkle += s;
      totalColor += sColor * s;
    }

    totalSparkle = clamp(totalSparkle, 0.0, 1.0);
    totalColor = totalSparkle > 0.0 ? totalColor / max(totalSparkle, 0.001) : vec3(0.0);

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = totalSparkle * opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, totalColor, mask * 0.7);
      color += totalColor * mask * 0.3;
    } else {
      color = texColor.rgb + totalColor * mask * 0.6;
    }

    float alpha = texColor.a + mask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(totalColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
