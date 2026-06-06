// components/cardEffect/shaders/energy.ts

export const energyShader = `
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);

    float t = u_time * u_speed;

    float baseMask = 1.0;

    // Animated energy tendrils using noise
    float n1 = noise(uv * 8.0 + vec2(t * 1.5, t * 0.8));
    float n2 = noise(uv * 12.0 - vec2(t * 0.7, t * 1.2));
    float n3 = noise(uv * 20.0 + vec2(t * 2.0, -t));

    // Combine: sharp energy lines
    float energy = pow(n1, 3.0) + pow(n2, 4.0) * 0.5 + pow(n3, 5.0) * 0.3;
    energy *= baseMask * u_intensity * 2.0;

    // Electric flicker
    float flicker = sin(t * 15.0) * 0.1 + sin(t * 23.0) * 0.05 + 0.95;
    energy *= flicker;

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);
    vec3 energyColor;
    if (isPrism) {
      energyColor = mix(vec3(0.2, 0.5, 1.0), vec3(0.8, 0.2, 1.0), n1);
      energyColor = mix(energyColor, vec3(1.0, 1.0, 1.0), pow(energy, 2.0) * 0.5);
    } else {
      energyColor = mix(u_effectColor, vec3(1.0), pow(energy, 2.0) * 0.5);
    }

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = energy * opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, energyColor, mask * 0.6);
      color += energyColor * mask * 0.3;
    } else {
      color = texColor.rgb + energyColor * mask * 0.6;
    }

    float alpha = texColor.a + mask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(energyColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
