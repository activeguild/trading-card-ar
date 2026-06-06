// components/cardEffect/shaders/matrix.ts
// マトリックス: デジタルレインが流れ落ちる

export const matrixShader = `
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

  void main() {
    vec2 uv = v_texCoord;
    vec4 texColor = texture2D(u_image, uv);
    float t = u_time * u_speed;

    float baseMask = 1.0;

    // Digital rain columns
    float cols = 30.0;
    float col = floor(uv.x * cols);
    float colRand = hash(vec2(col, 0.0));

    // Each column falls at different speed and phase
    float fallSpeed = 0.5 + colRand * 1.5;
    float fallPos = fract(t * fallSpeed * 0.3 + colRand * 10.0);

    // Trail: bright at head, fading behind
    float headY = fallPos;
    float trailLen = 0.3 + colRand * 0.4;
    float distFromHead = uv.y - headY;
    if (distFromHead < 0.0) distFromHead += 1.0; // wrap

    float trail = smoothstep(trailLen, 0.0, distFromHead);
    float head = smoothstep(0.02, 0.0, distFromHead);

    // Character-like flicker
    vec2 charGrid = vec2(col, floor(uv.y * cols * 1.5));
    float charFlicker = step(0.4, hash(charGrid + floor(t * 8.0)));

    float rain = (trail * 0.5 + head) * charFlicker * baseMask * u_intensity;

    bool isPrism = (u_effectColor.r > 0.95 && u_effectColor.g > 0.95 && u_effectColor.b > 0.95);
    vec3 rainColor;
    if (isPrism) {
      rainColor = vec3(0.1, 1.0, 0.3); // classic green
      rainColor = mix(rainColor, vec3(1.0), head * 0.7);
    } else {
      rainColor = mix(u_effectColor, vec3(1.0), head * 0.5);
    }

    float opacity = u_mode >= 1.5 ? texColor.a : 1.0;
    float mask = rain * opacity;

    vec3 color;
    if (u_blendMode < 0.5) {
      color = mix(texColor.rgb, rainColor, mask * 0.6);
    } else {
      color = texColor.rgb + rainColor * mask * 0.5;
    }

    float alpha = texColor.a + mask * (1.0 - texColor.a);
    if (u_effectOnly > 0.5) {
      gl_FragColor = vec4(rainColor * mask, mask);
    } else {
      gl_FragColor = vec4(color, alpha);
    }
  }
`;
