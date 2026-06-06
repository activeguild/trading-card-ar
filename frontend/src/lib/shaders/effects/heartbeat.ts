// components/cardEffect/shaders/heartbeat.ts
// ハートビート: 鼓動のようにズームイン/アウトを繰り返す

export const heartbeatShader = `
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

    // Double-beat pattern (like a real heartbeat: lub-dub)
    float beat1 = pow(max(0.0, sin(t * 3.0)), 20.0);
    float beat2 = pow(max(0.0, sin(t * 3.0 + 0.4)), 15.0) * 0.6;
    float beat = (beat1 + beat2) * u_intensity * 0.03;

    // Zoom from center
    vec2 center = vec2(0.5, 0.5);
    vec2 sampleUv = center + (uv - center) * (1.0 - beat);
    sampleUv = clamp(sampleUv, 0.0, 1.0);

    vec4 texColor = texture2D(u_image, sampleUv);

    // Vignette pulse: edges darken on beat
    float dx = min(uv.x, 1.0 - uv.x);
    float dy = min(uv.y, 1.0 - uv.y);
    float vignette = smoothstep(0.0, 0.3, min(dx, dy));
    float vignetteEffect = 1.0 - (1.0 - vignette) * (beat1 + beat2) * u_intensity * 0.5;

    // Color tint on beat
    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);
    vec3 tint = isPrism ? vec3(1.0, 0.3, 0.3) : u_effectColor;
    float tintAmount = (beat1 + beat2) * 0.15 * u_intensity;

    vec3 color = mix(texColor.rgb, tint, tintAmount) * vignetteEffect;
    float alpha = texColor.a;

    if (u_effectOnly > 0.5) {
      float mask = (beat1 + beat2) * u_intensity * (u_mode >= 1.5 ? texColor.a : 1.0);
      gl_FragColor = vec4(tint * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
