// components/cardEffect/shaders/neon.ts

export const neonShader = `
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
    vec4 texColor = texture2D(u_image, uv);
    vec2 px = 1.0 / u_resolution;

    // Edge detection via luminance difference (Sobel-like)
    float c  = dot(texture2D(u_image, uv).rgb, vec3(0.299, 0.587, 0.114));
    float l  = dot(texture2D(u_image, uv - vec2(px.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float r  = dot(texture2D(u_image, uv + vec2(px.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float t  = dot(texture2D(u_image, uv - vec2(0.0, px.y)).rgb, vec3(0.299, 0.587, 0.114));
    float b  = dot(texture2D(u_image, uv + vec2(0.0, px.y)).rgb, vec3(0.299, 0.587, 0.114));

    float edge = abs(l - r) + abs(t - b);
    edge = smoothstep(0.05, 0.2, edge);

    // Neon pulse
    float pulse = sin(u_time * u_speed * 3.0) * 0.3 + 0.7;
    // Traveling wave along edges
    float wave = sin(uv.x * 10.0 + uv.y * 8.0 - u_time * u_speed * 4.0) * 0.3 + 0.7;

    float neonStrength = edge * pulse * wave * u_intensity * 2.0;

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);
    vec3 neonColor;
    if (isPrism) {
      float hue = fract(uv.x * 0.5 + uv.y * 0.3 + u_time * u_speed * 0.1);
      vec3 c1 = vec3(1.0, 0.1, 0.5);
      vec3 c2 = vec3(0.1, 0.5, 1.0);
      vec3 c3 = vec3(0.1, 1.0, 0.5);
      neonColor = mix(mix(c1, c2, smoothstep(0.0, 0.5, hue)), c3, smoothstep(0.5, 1.0, hue));
    } else {
      neonColor = u_effectColor;
    }

    // Glow: sample wider for bloom effect
    float glow = 0.0;
    for (int i = 1; i <= 3; i++) {
      float fi = float(i);
      float s = fi * 2.0;
      glow += abs(dot(texture2D(u_image, uv + vec2(px.x * s, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) - c);
      glow += abs(dot(texture2D(u_image, uv - vec2(px.x * s, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) - c);
      glow += abs(dot(texture2D(u_image, uv + vec2(0.0, px.y * s)).rgb, vec3(0.299, 0.587, 0.114)) - c);
      glow += abs(dot(texture2D(u_image, uv - vec2(0.0, px.y * s)).rgb, vec3(0.299, 0.587, 0.114)) - c);
    }
    glow = smoothstep(0.1, 0.5, glow / 12.0) * pulse * u_intensity * 0.5;

    float totalMask = (neonStrength + glow);
    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    totalMask *= opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, neonColor, totalMask * 0.6);
      color += neonColor * totalMask * 0.4;
    } else {
      color = texColor.rgb + neonColor * totalMask * 0.7;
    }

    float alpha = texColor.a + totalMask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(neonColor * totalMask, totalMask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
