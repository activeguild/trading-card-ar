// components/cardEffect/shaders/hearts.ts
// ハート: ハートが浮かび上がる

export const heartsShader = `
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

  // Heart shape SDF
  float heartShape(vec2 p, float size) {
    p /= size;
    p.y = -p.y;
    p.y -= 0.3;
    float a = atan(p.x, p.y) / 3.14159;
    float r = length(p);
    float h = abs(a);
    float d = (13.0 * h - 22.0 * h * h + 10.0 * h * h * h) / (6.0 - 5.0 * h);
    return smoothstep(d - 0.02, d, r);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    float t = u_time * u_speed;

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);

    float totalHeart = 0.0;
    vec3 totalColor = vec3(0.0);

    float numHearts = max(u_borderWidth * 100.0, 5.0);
    for (int i = 0; i < 15; i++) {
      float fi = float(i);
      if (fi >= numHearts) continue;

      float s1 = hash(vec2(fi * 13.7 + 1.0, fi * 7.3 + 3.0));
      float s2 = hash(vec2(fi * 31.1 + 5.0, fi * 57.9 + 11.0));
      float s3 = hash(vec2(fi * 41.3 + 7.0, fi * 23.1 + 13.0));

      // Float upward, wrap around
      float speed = 0.15 + s1 * 0.2;
      float x = s1 + sin(t * (0.3 + s2 * 0.5) + fi) * 0.08;
      float y = fract(s2 - t * speed);

      // Slight sway
      x += sin(t * (0.5 + s3) + fi * 2.0) * 0.03;

      vec2 heartPos = vec2(x, y);
      float size = 0.02 + s3 * 0.025;

      float heart = 1.0 - heartShape(uv - heartPos, size);
      // Fade near top and bottom
      heart *= smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.85, y);
      heart *= u_intensity;

      vec3 hColor;
      if (isPrism) {
        hColor = mix(vec3(1.0, 0.4, 0.6), vec3(1.0, 0.6, 0.8), s1);
        hColor = mix(hColor, vec3(0.8, 0.4, 1.0), s3);
      } else {
        hColor = u_effectColor * (0.8 + s1 * 0.4);
      }

      totalHeart += heart * (0.5 + s2 * 0.5);
      totalColor += hColor * heart * (0.5 + s2 * 0.5);
    }

    totalHeart = clamp(totalHeart, 0.0, 1.0);
    totalColor = totalHeart > 0.0 ? totalColor / max(totalHeart, 0.001) : vec3(0.0);
    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = totalHeart * opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, totalColor, mask * 0.7);
      color += totalColor * mask * 0.3;
    } else {
      color = texColor.rgb + totalColor * mask * 0.5;
    }

    float alpha = texColor.a + mask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(totalColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
