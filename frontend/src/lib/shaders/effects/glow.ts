// components/cardEffect/shaders/glow.ts

export const glowShader = `
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
  uniform float u_effectOnly; // 0=normal, 1=add
  uniform sampler2D u_edgeMap;

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    float dx = min(uv.x, 1.0 - uv.x);
    float dy = min(uv.y, 1.0 - uv.y);
    float edgeDist = min(dx, dy);

    // Soft glow falloff
    float glowBase = smoothstep(u_borderWidth, 0.0, edgeDist);
    float glowSoft = smoothstep(u_borderWidth * 2.5, 0.0, edgeDist) * 0.3;

    // Pulsating brightness
    float pulse = sin(u_time * u_speed * 2.0) * 0.3 + 0.7;

    // Traveling highlight
    float travel = sin((uv.x - uv.y) * 4.0 + u_time * u_speed * 2.5) * 0.5 + 0.5;
    float travel2 = sin((uv.x + uv.y) * 3.0 - u_time * u_speed * 1.8) * 0.5 + 0.5;

    float glowStrength = (glowBase + glowSoft) * pulse * u_intensity;
    glowStrength *= (0.6 + travel * 0.25 + travel2 * 0.15);

    vec3 glowColor = u_effectColor * glowStrength;

    if (u_mode < 1.5) {
      // Overlay mode
      float mask = glowStrength;
      vec3 color;
      if (u_blendMode < 0.5) {
        // Normal: soft blend
        color = mix(texColor.rgb, u_effectColor, mask * 0.5);
      } else {
        // Add: glow on top, capped to avoid white blowout
        color = texColor.rgb + glowColor * 0.4;
      }
      float alpha = texColor.a + mask * (1.0 - texColor.a);
      if (u_effectOnly > 0.5) {
        gl_FragColor = vec4(u_effectColor * mask, mask);
      } else {
        gl_FragColor = vec4(color, alpha);
      }
    } else {
      // Outline mode
      float rawEdge = texture2D(u_edgeMap, uv).r;
      float edgeVal = clamp(rawEdge * (u_borderWidth / 0.05), 0.0, 1.0);
      float mask = edgeVal;
      float p = sin(u_time * u_speed * 2.0) * 0.3 + 0.7;
      float t1 = sin((uv.x - uv.y) * 4.0 + u_time * u_speed * 2.5) * 0.5 + 0.5;
      float t2 = sin((uv.x + uv.y) * 3.0 - u_time * u_speed * 1.8) * 0.5 + 0.5;
      mask *= p * u_intensity * (0.6 + t1 * 0.25 + t2 * 0.15);
      vec3 effect = u_effectColor * mask;
      vec4 base = vec4(mix(effect, texColor.rgb, texColor.a), texColor.a);
      vec3 color;
      if (u_blendMode < 0.5) {
        color = mix(base.rgb, effect, mask * 0.7);
      } else {
        color = base.rgb + effect * mask;
      }
      float alpha = texColor.a + mask * (1.0 - texColor.a);
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
