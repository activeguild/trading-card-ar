// components/cardEffect/shaders/cellophane.ts

export const cellophaneShader = `
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

  // Smooth noise for surface distortion
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    // Simulate tilting
    float tilt = sin(u_time * u_speed * 0.8) * 0.5 + 0.5;

    // === Surface distortion: cellophane wrinkles/bumps ===
    // Low-freq warping (big gentle curves)
    float warp1 = noise(uv * 3.0 + u_time * u_speed * 0.1) * 0.08;
    float warp2 = noise(uv * 6.0 - u_time * u_speed * 0.05) * 0.04;
    // Med-freq wrinkles
    float wrinkle = noise(uv * 15.0 + vec2(u_time * u_speed * 0.07, 0.0)) * 0.02;

    // Distorted reflection angle (no longer a straight line)
    float angle = uv.x * 0.4 + uv.y * 0.6 + warp1 + warp2 + wrinkle;

    // Reflection peak position
    float reflectPeak = mix(0.1, 0.9, tilt);
    float reflectDist = abs(angle - reflectPeak);

    // === Reflection layers ===
    // Broad sheen (varies in width due to distortion)
    float sheen = smoothstep(0.6, 0.0, reflectDist) * 0.3;
    // Focused reflection
    float reflect = smoothstep(0.25, 0.0, reflectDist) * 0.6;
    // Sharp peak (now wobbly, not straight)
    float peak = smoothstep(0.05, 0.0, reflectDist);

    // === Surface micro-variation: local brightness differences ===
    float micro = noise(uv * 40.0) * 0.3 + 0.85;
    reflect *= micro;
    peak *= micro;

    // === Thin-film interference ===
    float film1 = sin((angle - reflectPeak) * 40.0 + u_time * u_speed * 0.5) * 0.5 + 0.5;
    float film2 = sin((angle - reflectPeak) * 25.0 - u_time * u_speed * 0.3) * 0.5 + 0.5;
    float filmMask = smoothstep(0.4, 0.05, reflectDist);
    float filmEffect = (film1 * 0.6 + film2 * 0.4) * filmMask;

    float totalStrength = (sheen + reflect + peak * 0.8) * u_intensity;

    // === Color ===
    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);

    vec3 effectColor;
    if (isPrism) {
      float hue = fract(angle * 2.0 - tilt * 0.5);
      vec3 filmColor = hsv2rgb(vec3(hue, 0.4 * filmMask, 1.0));
      effectColor = mix(filmColor, vec3(1.0), peak * 0.7);
      vec3 band1 = hsv2rgb(vec3(fract(hue + 0.33), 0.5, 1.0));
      vec3 band2 = hsv2rgb(vec3(fract(hue + 0.66), 0.5, 1.0));
      effectColor += (band1 * film1 + band2 * film2) * filmMask * 0.2;
    } else {
      effectColor = mix(u_effectColor, vec3(1.0), peak * 0.6);
      effectColor += u_effectColor * filmEffect * 0.15;
    }

    // Outline mode: mask to opaque parts, overlay: full area
    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = totalStrength * opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, effectColor, mask * 0.6);
      color += vec3(peak * 0.5 * u_intensity) * texColor.a;
    } else {
      color = texColor.rgb + effectColor * mask * 0.5;
    }

    // Overlay: alpha includes effect area, outline: only opaque parts
    float alpha = texColor.a + mask * (1.0 - texColor.a);

    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(effectColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
