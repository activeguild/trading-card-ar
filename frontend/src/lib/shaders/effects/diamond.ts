// components/cardEffect/shaders/diamond.ts

export const diamondShader = `
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
  uniform float u_effectOnly; // 0=normal, 1=add, 2=screen
  uniform sampler2D u_edgeMap;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    float dx = min(uv.x, 1.0 - uv.x);
    float dy = min(uv.y, 1.0 - uv.y);
    float edgeDist = min(dx, dy);

    float edgeMask;
    if (u_mode < 0.5) {
      edgeMask = smoothstep(u_borderWidth, 0.0, edgeDist);
    } else {
      edgeMask = 1.0;
    }

    // Faceted sparkle pattern
    vec2 grid = floor(uv * 30.0);
    float sparkle = hash(grid + floor(u_time * u_speed * 2.0));
    sparkle = pow(sparkle, 6.0) * edgeMask * u_intensity;

    // Prismatic color based on facet
    float hue = hash(grid) + u_time * u_speed * 0.1;
    float r = abs(sin(hue * 6.28)) * 0.5 + 0.5;
    float g = abs(sin((hue + 0.33) * 6.28)) * 0.5 + 0.5;
    float b = abs(sin((hue + 0.67) * 6.28)) * 0.5 + 0.5;
    vec3 prismColor = vec3(r, g, b) * u_effectColor * sparkle;

    // Sweeping light reflection
    float sweep = sin(uv.x * 3.0 + uv.y * 2.0 - u_time * u_speed * 2.0);
    sweep = pow(max(0.0, sweep), 4.0) * edgeMask * u_intensity * 0.5;
    vec3 sweepColor = vec3(1.0, 1.0, 1.0) * sweep;

    vec3 diamondColor = prismColor + sweepColor;
    float diamondAlpha = max(sparkle, sweep);

    if (u_mode < 0.5) {
      float inImage = step(u_borderWidth, dx) * step(u_borderWidth, dy);
      vec2 imageUv = (uv - u_borderWidth) / (1.0 - 2.0 * u_borderWidth);
      vec4 imgColor = texture2D(u_image, clamp(imageUv, 0.0, 1.0));
      vec3 color = imgColor.rgb * inImage + diamondColor * (1.0 - inImage);
      float alpha = max(diamondAlpha * (1.0 - inImage), imgColor.a * inImage);
      gl_FragColor = vec4(color, alpha);
    } else if (u_mode < 1.5) {
      // Overlay mode with blend modes
      vec3 effect = diamondColor;  // the effect color for this shader
      float mask = diamondAlpha;          // the edge mask value
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
      // Outline mode: diamond on full opaque area
      vec2 grid = floor(uv * 30.0);
      float sparkle = hash(grid + floor(u_time * u_speed * 2.0));
      sparkle = pow(sparkle, 6.0) * u_intensity;
      float hue = hash(grid) + u_time * u_speed * 0.1;
      float r = abs(sin(hue * 6.28)) * 0.5 + 0.5;
      float g = abs(sin((hue + 0.33) * 6.28)) * 0.5 + 0.5;
      float b = abs(sin((hue + 0.67) * 6.28)) * 0.5 + 0.5;
      vec3 prism = vec3(r, g, b) * u_effectColor * sparkle;
      float sweep = sin(uv.x * 3.0 + uv.y * 2.0 - u_time * u_speed * 2.0);
      sweep = pow(max(0.0, sweep), 4.0) * u_intensity * 0.5;
      vec3 sweepCol = vec3(1.0, 1.0, 1.0) * sweep;
      float mask = max(sparkle, sweep) * texColor.a;
      vec3 effect = prism + sweepCol;
      vec3 color;
      if (u_blendMode < 0.5) {
        color = mix(texColor.rgb, effect, mask * 0.7);
      } else if (u_blendMode < 1.5) {
        color = texColor.rgb + effect * mask;
      } else {
        color = 1.0 - (1.0 - texColor.rgb) * (1.0 - effect * mask);
      }
      gl_FragColor = vec4(color, texColor.a);
    }
  }
`;
