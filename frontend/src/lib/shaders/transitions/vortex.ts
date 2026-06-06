// components/cardEffect/shaders/vortex.ts

export const vortexShader = `
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

  void main() {
    vec2 uv = v_texCoord;
    float aspect = u_resolution.x / u_resolution.y;

    // Progress: 0 = normal, 1 = fully consumed
    float t = fract(u_time * u_speed * 0.2);
    float progress = t * t * (3.0 - 2.0 * t);

    // Center of the vortex
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect; // correct for aspect ratio

    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // Spiral twist: increases with progress, stronger near center
    float twistAmount = progress * 12.0;
    float twist = twistAmount * (1.0 - smoothstep(0.0, 0.7, dist));
    float newAngle = angle + twist;

    // Shrink toward center as it gets consumed
    float shrink = 1.0 + progress * 2.0;
    float newDist = dist * shrink;

    // Reconstruct UV from polar coordinates
    vec2 newDelta = vec2(cos(newAngle), sin(newAngle)) * newDist;
    newDelta.x /= aspect;
    vec2 sampleUv = center + newDelta;

    // Fade out: outer edges disappear first, center last. Push fadeRadius
    // slightly negative at progress=1 so the center pixel fully disappears.
    float fadeRadius = mix(1.0, -0.1, progress);
    float fade = smoothstep(fadeRadius + 0.05, fadeRadius - 0.05, dist);

    vec4 color = vec4(0.0);
    if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
      color = texture2D(u_image, sampleUv);
    }
    color.a *= fade;
    color.rgb *= fade;

    vec4 bgColor = texture2D(u_background, uv);
    float mask = color.a;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
