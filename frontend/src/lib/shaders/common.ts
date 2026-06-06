// components/cardEffect/shaders/common.ts

export const vertexShader = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

export interface EffectUniforms {
  u_time: number;
  u_resolution: [number, number];
  u_borderWidth: number;
  u_intensity: number;
  u_speed: number;
  u_mode: number; // 0 = outer frame, 1 = overlay
}

export const DEFAULT_UNIFORMS: EffectUniforms = {
  u_time: 0,
  u_resolution: [512, 512],
  u_borderWidth: 0.05,
  u_intensity: 1.0,
  u_speed: 1.0,
  u_mode: 0,
};
