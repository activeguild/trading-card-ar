// components/cardEffect/shaders/explode.ts
// 爆散: 画像が中心から各方向へ飛び散って消える

export const explodeShader = `
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

    float gridSize = 20.0;
    vec2 grid = floor(uv * gridSize);
    vec2 cellCenter = (grid + 0.5) / gridSize;
    vec2 dir = cellCenter - vec2(0.5);
    float dist = length(dir);
    vec2 normDir = dist > 0.001 ? dir / dist : vec2(0.0);
    float jitter = (hash(grid) - 0.5) * 0.3;
    vec2 offset = (normDir + vec2(jitter, jitter * 0.5)) * progress * 0.45;

    vec2 sampleUv = uv - offset;
    vec4 color = vec4(0.0);
    if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
      // Stay in original cell to keep chunks discrete
      vec2 sampleGrid = floor(sampleUv * gridSize);
      if (sampleGrid.x == grid.x && sampleGrid.y == grid.y) {
        color = texture2D(u_image, sampleUv);
      }
    }
    float fade = 1.0 - smoothstep(0.5, 1.0, progress);
    float mask = color.a * fade;
    gl_FragColor = vec4(mix(bgColor.rgb, color.rgb, mask), max(bgColor.a, mask));
  }
`;
