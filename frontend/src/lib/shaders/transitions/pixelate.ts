// components/cardEffect/shaders/pixelate.ts

export const pixelateShader = `
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

    float t = clamp(u_time * u_speed * 0.2, 0.0, 1.0);
    float progress = t * t * (3.0 - 2.0 * t);

    // Pixel size grows from 1px to large blocks, then fades
    float pixelSize = mix(1.0, 80.0, progress);
    vec2 pixelUv = floor(uv * u_resolution / pixelSize) * pixelSize / u_resolution;
    vec4 texColor = texture2D(u_image, pixelUv);

    // Fade out in second half
    float fade = 1.0 - smoothstep(0.5, 1.0, progress);
    float mask = fade * texColor.a;
    vec4 bgColor = texture2D(u_background, uv);
    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
