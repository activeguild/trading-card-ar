// components/cardEffect/shaders/bokeh.ts
// ボケ: ふわふわした光の玉が浮遊する

export const bokehShader = `
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

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    float t = u_time * u_speed;

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);

    float totalBokeh = 0.0;
    vec3 totalColor = vec3(0.0);

    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float s1 = hash(vec2(fi * 7.3, fi * 13.1));
      float s2 = hash(vec2(fi * 23.7, fi * 31.3));
      float s3 = hash(vec2(fi * 41.1, fi * 53.7));

      // Floating position
      vec2 pos = vec2(
        s1 + sin(t * (0.2 + s2 * 0.3) + fi) * 0.15,
        s2 + cos(t * (0.15 + s1 * 0.25) + fi * 1.7) * 0.1
      );

      float radius = 0.03 + s3 * 0.05;
      float dist = length(uv - pos);

      // Soft circle with bright edge (bokeh ring)
      float ring = smoothstep(radius, radius * 0.7, dist) * 0.6;
      float core = smoothstep(radius * 0.5, 0.0, dist) * 0.4;
      float bokeh = (ring + core) * u_intensity * (0.5 + s3 * 0.5);

      // Subtle pulse
      bokeh *= 0.7 + 0.3 * sin(t * (1.0 + s1) + fi * 2.0);

      vec3 bColor;
      if (isPrism) {
        float hue = fract(s1 + t * 0.05);
        bColor = vec3(
          sin(hue * 6.28) * 0.5 + 0.5,
          sin(hue * 6.28 + 2.094) * 0.5 + 0.5,
          sin(hue * 6.28 + 4.189) * 0.5 + 0.5
        ) * 0.8 + 0.2;
      } else {
        bColor = u_effectColor * (0.8 + s3 * 0.4);
      }

      totalBokeh += bokeh;
      totalColor += bColor * bokeh;
    }

    totalBokeh = clamp(totalBokeh, 0.0, 1.0);
    totalColor = totalBokeh > 0.0 ? totalColor / max(totalBokeh, 0.001) : vec3(0.0);
    float mask = totalBokeh * (u_mode >= 1.5 ? texColor.a : 1.0);

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, totalColor, mask * 0.5);
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
