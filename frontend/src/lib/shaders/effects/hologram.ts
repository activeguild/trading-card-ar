// components/cardEffect/shaders/hologram.ts

export const hologramShader = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_borderWidth;
  uniform float u_intensity;
  uniform float u_speed;
  uniform float u_mode; // 0 = outer, 1 = overlay, 2 = outline
  uniform vec3 u_effectColor;
  uniform float u_blendMode;
  uniform float u_effectOnly; // 0=normal, 1=add, 2=screen
  uniform sampler2D u_edgeMap;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    // Distance from edge (0 at edge, 1 at center)
    float dx = min(uv.x, 1.0 - uv.x);
    float dy = min(uv.y, 1.0 - uv.y);
    float edgeDist = min(dx, dy);

    // Border mask
    float border = smoothstep(0.0, u_borderWidth, edgeDist);
    float borderMask = 1.0 - border;

    // Rainbow hue based on position + time
    float hue = fract((uv.x + uv.y) * 0.5 + u_time * u_speed * 0.3);
    vec3 rainbow = hsv2rgb(vec3(hue, 0.8, 1.0)) * u_intensity;

    if (u_mode < 0.5) {
      // Outer frame mode: extend canvas, effect outside image
      float inImage = step(u_borderWidth, dx) * step(u_borderWidth, dy);
      float outerBorder = (1.0 - inImage);
      vec2 imageUv = (uv - u_borderWidth) / (1.0 - 2.0 * u_borderWidth);
      vec4 imgColor = texture2D(u_image, clamp(imageUv, 0.0, 1.0));
      vec3 color = rainbow * (1.0 - inImage) + imgColor.rgb * inImage;
      float alpha = max(borderMask * (1.0 - inImage), imgColor.a * inImage);
      gl_FragColor = vec4(color, alpha);
    } else if (u_mode < 1.5) {
      // Overlay mode with blend modes
      vec3 effect = rainbow;
      float mask = borderMask;
      vec3 color;
      if (u_blendMode < 0.5) {
        // Normal: mix
        color = mix(texColor.rgb, effect, mask * 0.7);
      } else if (u_blendMode < 1.5) {
        // Add
        color = texColor.rgb + effect * mask * 0.4;
      } else {
        // Screen
        color = 1.0 - (1.0 - texColor.rgb) * (1.0 - effect * mask);
      }
      float alpha = texColor.a + mask * (1.0 - texColor.a);
      if (u_effectOnly > 0.5) {
        gl_FragColor = vec4(effect * mask, mask);
      } else {
        gl_FragColor = vec4(color, alpha);
      }
    } else {
      // Outline mode: effect along alpha boundary
      float rawEdge = texture2D(u_edgeMap, uv).r;
      float edgeVal = clamp(rawEdge * (u_borderWidth / 0.05), 0.0, 1.0);
      float mask = edgeVal;
      // Avoid black haze: use effect color as base for transparent pixels
      vec3 effect = rainbow;
      vec4 base = vec4(mix(effect, texColor.rgb, texColor.a), texColor.a);
      vec3 color;
      if (u_blendMode < 0.5) {
        color = mix(base.rgb, effect, mask * 0.7);
      } else if (u_blendMode < 1.5) {
        color = base.rgb + effect * mask;
      } else {
        color = 1.0 - (1.0 - base.rgb) * (1.0 - effect * mask);
      }
      float alpha = texColor.a + mask * (1.0 - texColor.a);
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
