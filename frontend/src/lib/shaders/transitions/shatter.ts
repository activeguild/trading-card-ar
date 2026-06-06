// components/cardEffect/shaders/shatter.ts
// シャッター: 画像が破片に割れて散っていく

export const shatterShader = `
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

    // Grid of shards
    float gridSize = 8.0;
    vec2 grid = floor(uv * gridSize);
    float shard = hash(grid);
    float shard2 = hash(grid + vec2(100.0));

    // Each shard falls at a different time
    float shardDelay = shard * 0.6;
    float shardProgress = clamp((progress - shardDelay) / (1.0 - shardDelay), 0.0, 1.0);

    // Shard movement: falls down and slightly sideways
    vec2 shardOffset = vec2(
      (shard2 - 0.5) * shardProgress * 0.3,
      shardProgress * shardProgress * 0.5
    );

    // Rotation effect via UV distortion
    vec2 shardCenter = (grid + 0.5) / gridSize;
    vec2 localUv = uv - shardCenter;
    float angle = shardProgress * (shard - 0.5) * 3.0;
    float c = cos(angle);
    float s = sin(angle);
    vec2 rotatedUv = vec2(localUv.x * c - localUv.y * s, localUv.x * s + localUv.y * c);
    vec2 sampleUv = shardCenter + rotatedUv + shardOffset;

    // Check if still within the shard's grid cell
    vec2 sampleGrid = floor(sampleUv * gridSize);
    float visible = (sampleGrid == grid) ? 1.0 : 0.0;

    // Fade as shard falls
    float fade = 1.0 - shardProgress;

    vec4 texColor = texture2D(u_image, sampleUv);
    float mask = visible * fade * texColor.a;

    gl_FragColor = vec4(mix(bgColor.rgb, texColor.rgb, mask), max(bgColor.a, mask));
  }
`;
