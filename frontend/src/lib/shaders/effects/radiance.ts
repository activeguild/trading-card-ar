// components/cardEffect/shaders/radiance.ts
// ラディアンス: 中心から放射状の光線が広がる

export const radianceShader = `
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

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    float aspect = u_resolution.x / u_resolution.y;
    float t = u_time * u_speed;

    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    delta.x *= aspect;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // 12 rays gently breathing in count phase
    float rayCount = 12.0;
    float rays = 0.5 + 0.5 * cos(angle * rayCount + sin(t * 0.6) * 0.7);
    float raySharp = pow(rays, 5.0);

    // Outward-traveling brightness wave along each ray
    float travel = 0.5 + 0.5 * sin(dist * 6.0 - t * 3.0);
    float radial = pow(travel, 3.0);

    // Soft falloff toward edges
    float distFade = exp(-dist * 1.1);

    float ray = raySharp * (0.4 + 0.6 * radial) * distFade * u_intensity;

    vec3 rayColor = u_effectColor * ray * 1.7;

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = texColor.rgb + rayColor * 0.6;
    } else {
      color = texColor.rgb + rayColor;
    }

    if (u_effectOnly > 0.5) {
      float mask = ray * opacity;
      gl_FragColor = vec4(rayColor * opacity, mask);
    } else {
      gl_FragColor = vec4(color * opacity, texColor.a * opacity);
    }
  }
`;
