// components/cardEffect/shaders/scan.ts
// スキャンライン: 光の走査線が画像を上下にスキャンする

export const scanShader = `
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
    float t = u_time * u_speed;

    // Main scan line moving up and down
    float scanPos = abs(mod(t * 0.4, 2.0) - 1.0);
    float scanDist = abs(uv.y - scanPos);
    float scanLine = smoothstep(0.03, 0.0, scanDist) * u_intensity;
    float scanGlow = smoothstep(0.15, 0.0, scanDist) * u_intensity * 0.3;

    // Horizontal scan lines (CRT-like)
    float crt = sin(uv.y * u_resolution.y * 0.5) * 0.03 * u_intensity;

    // Color
    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);
    vec3 scanColor;
    if (isPrism) {
      scanColor = mix(vec3(0.2, 0.8, 1.0), vec3(1.0), scanLine * 0.5);
    } else {
      scanColor = mix(u_effectColor, vec3(1.0), scanLine * 0.5);
    }

    float mask = (scanLine + scanGlow) * (u_mode >= 1.5 ? texColor.a : 1.0);

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, scanColor, mask * 0.6) - crt;
    } else {
      color = texColor.rgb + scanColor * mask * 0.5 - crt;
    }

    float alpha = texColor.a + mask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(scanColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
