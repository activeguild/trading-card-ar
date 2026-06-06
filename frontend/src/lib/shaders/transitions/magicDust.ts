// components/cardEffect/shaders/magicDust.ts
// 魔法の粒子: 画像が小さな粒子に分解されてキラキラと舞い上がりながら消える

export const magicDustShader = `
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
  uniform sampler2D u_background;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 bgColor = texture2D(u_background, uv);

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Original alpha at this pixel — only opaque areas of the source image
    // should receive the effect (transparent regions pass through to bg).
    float origAlpha = texture2D(u_image, uv).a;

    if (origAlpha < 0.01) {
      gl_FragColor = bgColor;
      return;
    }

    if (progress < 0.001) {
      gl_FragColor = texture2D(u_image, uv);
      return;
    }

    // Particle grid dispersal
    float gridSize = 40.0;
    vec2 grid = floor(uv * gridSize);
    float r = hash(grid);
    float r2 = hash(grid + vec2(31.0, 17.0));

    // texCoord y=1 is bottom; bottom particles lift first so the image
    // dissolves upward (rising toward the top of the canvas).
    // Delay distribution chosen so max(delay) + liftDuration is well under 1.0
    // with margin, guaranteeing every particle finishes by progress~0.85.
    float yBias = (1.0 - uv.y) * 0.08;
    float delay = 0.05 + r * 0.45 + yBias;
    float liftDuration = 0.25;
    float lift = clamp((progress - delay) / liftDuration, 0.0, 1.0);

    // Hard cutoff: once progress passes the longest possible lift window,
    // force everything off so no stray dither pixels or sparkle remain.
    float cutoff = 1.0 - smoothstep(0.85, 0.95, progress);

    // Particles drift upward + slight horizontal sway as they take off
    vec2 sampleUV = uv + vec2((r2 - 0.5) * 0.04 * lift, lift * 0.18);
    sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));
    vec4 texColor = texture2D(u_image, sampleUV);

    // Granular dithered fade for a particle-like edge
    float cellNoise = hash(floor(uv * 240.0));
    float visible = 1.0 - lift;
    visible = step(cellNoise * 0.55, visible);

    // Gate dispersal by the source image's original alpha so transparent
    // regions never participate in the effect.
    float mask = visible * origAlpha * cutoff;

    // Sparkle is gated by the active lift window only — zero before the cell
    // starts lifting and zero after it finishes, so the sparkle appears and
    // disappears gradually with the dispersal wave.
    float active = sin(3.14159 * lift);
    float twinkleHash = hash(floor(uv * 110.0) + floor(progress * 22.0));
    float twinkle = pow(twinkleHash, 28.0) * 28.0;
    float sparkle = active * (0.55 + twinkle) * origAlpha * cutoff;

    // Per-particle brightness variation around the user-selected color
    vec3 magicColor = u_effectColor * mix(0.7, 1.4, r2);

    vec3 color = mix(bgColor.rgb, texColor.rgb, mask);
    color += magicColor * sparkle * 1.4;

    float alpha = max(bgColor.a, mask + sparkle * 0.5);
    gl_FragColor = vec4(color, alpha);
  }
`;
