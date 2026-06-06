// components/cardEffect/shaders/rgbSplit.ts

export const rgbSplitShader = `
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

    // Oscillating RGB channel separation
    float t = u_time * u_speed;
    float pulse = sin(t * 2.0) * 0.5 + 0.5;
    float amount = u_borderWidth * u_intensity * pulse;

    // Each channel shifts in a different direction
    float angle1 = t * 0.5;
    float angle2 = t * 0.5 + 2.094; // +120 degrees
    float angle3 = t * 0.5 + 4.189; // +240 degrees

    vec2 offsetR = vec2(cos(angle1), sin(angle1)) * amount;
    vec2 offsetG = vec2(cos(angle2), sin(angle2)) * amount;
    vec2 offsetB = vec2(cos(angle3), sin(angle3)) * amount;

    float r = texture2D(u_image, uv + offsetR).r;
    float g = texture2D(u_image, uv + offsetG).g;
    float b = texture2D(u_image, uv + offsetB).b;
    float a = max(max(
      texture2D(u_image, uv + offsetR).a,
      texture2D(u_image, uv + offsetG).a),
      texture2D(u_image, uv + offsetB).a);

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    vec3 color = vec3(r, g, b) * opacity;

    if (u_effectOnly > 0.5) {
      vec3 diff = abs(color - texColor.rgb);
      float mask = max(max(diff.r, diff.g), diff.b) * opacity;
      gl_FragColor = vec4(color * mask, mask);
    } else {
      gl_FragColor = vec4(color, a * opacity);
    }
  }
`;
