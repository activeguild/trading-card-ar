// components/cardEffect/shaders/meteor.ts

export const meteorShader = `
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

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  // 4-pointed star shape
  float starShape(vec2 p, float size) {
    float spike1 = smoothstep(size, 0.0, abs(p.x)) * smoothstep(size * 0.08, 0.0, abs(p.y));
    float spike2 = smoothstep(size, 0.0, abs(p.y)) * smoothstep(size * 0.08, 0.0, abs(p.x));
    float d1 = abs(p.x + p.y) * 0.707;
    float d2 = abs(p.x - p.y) * 0.707;
    float spike3 = smoothstep(size * 0.7, 0.0, d1) * smoothstep(size * 0.06, 0.0, d2);
    float spike4 = smoothstep(size * 0.7, 0.0, d2) * smoothstep(size * 0.06, 0.0, d1);
    float core = smoothstep(size * 0.15, 0.0, length(p));
    return max(max(spike1, spike2), max(spike3, spike4)) + core;
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);

    // UV: (0,0)=top-left, (1,1)=bottom-right
    // Fall direction: top-right to bottom-left (down + slight left)
    vec2 dir = normalize(vec2(-0.25, 1.0));
    vec2 perp = vec2(-dir.y, dir.x);

    float totalEffect = 0.0;
    vec3 totalColor = vec3(0.0);

    // u_borderWidth (0.01-0.2) controls meteor count (1-20)
    float numMeteors = max(u_borderWidth * 100.0, 1.0);

    for (int i = 0; i < 20; i++) {
      float fi = float(i);
      if (fi >= numMeteors) continue;
      float seed = hash(fi * 17.3);
      float seed2 = hash(fi * 31.7 + 5.0);
      float seed3 = hash(fi * 53.1 + 11.0);

      // Staggered cycles
      float cycleLen = 1.5 + seed * 2.0;
      float offset = seed2 * cycleLen;
      float t = fract((u_time * u_speed * 0.5 + offset) / cycleLen);

      // Origin: top-right area, above and to the right
      float originX = 0.3 + seed * 0.9;
      float originY = -0.1 - seed2 * 0.3;

      // Head position: falls along dir
      float travel = t * 1.8;
      vec2 head = vec2(
        originX + dir.x * travel,
        originY + dir.y * travel
      );

      // Vector from head to current pixel
      vec2 toUv = uv - head;
      float alongDist = dot(toUv, -dir); // positive = behind head (tail)
      float acrossDist = abs(dot(toUv, perp));

      // Tail
      float tailLen = 0.1 + seed3 * 0.15;
      float tailFade = smoothstep(0.0, tailLen * 0.3, alongDist)
                     * smoothstep(tailLen, tailLen * 0.2, alongDist);
      float tailWidth = 0.006 + seed3 * 0.006;
      float taperWidth = tailWidth * max(1.0 - alongDist / tailLen * 0.7, 0.1);
      float tailMask = tailFade * smoothstep(taperWidth, 0.0, acrossDist);

      // Star at head
      vec2 headOffset = uv - head;
      float starSize = 0.02 + seed * 0.015;
      float star = starShape(headOffset, starSize) * 0.8;

      float meteor = (tailMask + star) * u_intensity;
      float brightness = 0.5 + seed2 * 0.5;
      meteor *= brightness;

      // Color
      vec3 meteorColor;
      if (isPrism) {
        float hue = fract(seed * 0.7 + t * 0.3);
        meteorColor = hsv2rgb(vec3(hue, 0.35, 1.0));
        meteorColor = mix(meteorColor, vec3(1.0), star * 0.7);
      } else {
        meteorColor = mix(u_effectColor, vec3(1.0), star * 0.5);
      }

      totalEffect += meteor;
      totalColor += meteorColor * meteor;
    }

    totalEffect = clamp(totalEffect, 0.0, 1.0);
    totalColor = totalEffect > 0.0 ? totalColor / max(totalEffect, 0.001) : vec3(0.0);

    // Outline mode: mask to opaque parts, overlay: full area
    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = totalEffect * opacity;

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
