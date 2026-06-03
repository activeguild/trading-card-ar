import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EffectSettings } from '../lib/effectRenderer'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D cardTexture;
uniform float uTime;
uniform bool uHologram;
uniform bool uNeon;
uniform bool uGlow;
uniform vec3 uGlowColor;
uniform vec2 uCardSize;  // normalized card area within padded canvas
uniform vec2 uPadding;   // padding ratio

varying vec2 vUv;

const float BORDER_RATIO = 0.04;
const float GLOW_WIDTH = 0.035;
const float SPEED = 0.7;
const float NEON_INTENSITY = 1.2;

vec3 hsvToRgb(float h, float s, float v) {
  vec3 c = vec3(h * 6.0, s, v);
  vec3 p = abs(fract(vec3(c.x, c.x + 4.0, c.x + 2.0) / 6.0) * 6.0 - 3.0) - 1.0;
  return v * mix(vec3(1.0), clamp(p, 0.0, 1.0), s);
}

void main() {
  // Map UV to padded canvas coordinates
  float padX = uPadding.x;
  float padY = uPadding.y;

  // Card area in UV space
  float cardLeft = padX;
  float cardRight = 1.0 - padX;
  float cardBottom = padY;
  float cardTop = 1.0 - padY;

  bool insideCard = vUv.x >= cardLeft && vUv.x <= cardRight &&
                    vUv.y >= cardBottom && vUv.y <= cardTop;

  // Normalized position within total canvas
  float xn = vUv.x;
  float yn = vUv.y;

  // Card-local UV for texture sampling
  vec2 cardUv = (vUv - vec2(cardLeft, cardBottom)) / vec2(cardRight - cardLeft, cardTop - cardBottom);

  // Edge detection from texture (simplified Sobel)
  float edgeVal = 0.0;
  if (insideCard) {
    vec2 texelSize = vec2(1.0) / uCardSize;
    float tl = dot(texture2D(cardTexture, cardUv + vec2(-texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(cardTexture, cardUv + vec2(texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(cardTexture, cardUv + vec2(-texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(cardTexture, cardUv + vec2(texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float l = dot(texture2D(cardTexture, cardUv + vec2(-texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float r = dot(texture2D(cardTexture, cardUv + vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float t = dot(texture2D(cardTexture, cardUv + vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float b = dot(texture2D(cardTexture, cardUv + vec2(0.0, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float dx = abs(-tl + tr - 2.0*l + 2.0*r - bl + br);
    float dy = abs(tl + 2.0*t + tr - bl - 2.0*b - br);
    float e = dx + dy;
    edgeVal = smoothstep(0.05, 0.2, e);
  }

  // Rainbow color
  float hue = fract(xn * 0.5 + yn * 0.3 + uTime * SPEED * 0.15);
  vec3 rainbow = hsvToRgb(hue, 0.8, 1.0);

  float er = 0.0, eg = 0.0, eb = 0.0, ea = 0.0;

  // Border detection
  float borderWidth = BORDER_RATIO;
  bool inBorder = false;
  if (insideCard) {
    float distLeft = cardUv.x;
    float distRight = 1.0 - cardUv.x;
    float distBottom = cardUv.y;
    float distTop = 1.0 - cardUv.y;
    float minDist = min(min(distLeft, distRight), min(distBottom, distTop));
    inBorder = minDist < borderWidth;
  }

  // 1. HOLOGRAM (border)
  if (uHologram && inBorder) {
    float diag = (xn + yn) / 2.0;
    float shift = sin(diag * 6.0 + uTime * SPEED * 2.0) * 0.3 + 0.7;
    er += rainbow.r * shift;
    eg += rainbow.g * shift;
    eb += rainbow.b * shift;
    ea = max(ea, shift);
  }

  // 2. NEON (inside, not border)
  if (uNeon && insideCard && !inBorder) {
    if (edgeVal > 0.0) {
      float pulse = sin(uTime * SPEED * 3.0) * 0.3 + 0.7;
      float travel = sin(xn * 10.0 + yn * 8.0 - uTime * SPEED * 4.0) * 0.3 + 0.7;
      float str = edgeVal * pulse * travel * NEON_INTENSITY;
      er += rainbow.r * str;
      eg += rainbow.g * str;
      eb += rainbow.b * str;
      ea = max(ea, str);
    }
  }

  // 3. GLOW (outside card)
  if (uGlow && !insideCard) {
    // Distance to card edge
    float dx = 0.0;
    float dy = 0.0;
    if (vUv.x < cardLeft) dx = cardLeft - vUv.x;
    else if (vUv.x > cardRight) dx = vUv.x - cardRight;
    if (vUv.y < cardBottom) dy = cardBottom - vUv.y;
    else if (vUv.y > cardTop) dy = vUv.y - cardTop;
    float dist = sqrt(dx * dx + dy * dy) / (cardRight - cardLeft);

    if (dist < GLOW_WIDTH) {
      float str = 1.0 - dist / GLOW_WIDTH;
      str = str * str;
      float pulse = sin(uTime * SPEED * 2.0) * 0.2 + 0.8;
      float travel = sin((xn - yn) * 4.0 + uTime * SPEED * 2.5) * 0.3 + 0.7;
      str *= pulse * travel * 0.8;
      er += uGlowColor.r * str;
      eg += uGlowColor.g * str;
      eb += uGlowColor.b * str;
      ea = max(ea, str);
    }
  }

  ea = clamp(ea, 0.0, 1.0);
  vec3 effectColor = clamp(vec3(er, eg, eb), 0.0, 1.0);

  gl_FragColor = vec4(effectColor, ea);
}
`

type Props = {
  cardImageUrl: string
  settings: EffectSettings
  width: number
  height: number
  scale?: number
}

export function EffectShaderPlane({ cardImageUrl, settings, width, height, scale = 1 }: Props) {
  const textureRef = useRef<THREE.Texture | null>(null)

  const paddingRatio = 0.05

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          cardTexture: { value: null },
          uTime: { value: 0 },
          uHologram: { value: settings.hologram },
          uNeon: { value: settings.neon },
          uGlow: { value: settings.glow },
          uGlowColor: { value: new THREE.Vector3(...settings.glowColor) },
          uCardSize: { value: new THREE.Vector2(width, height) },
          uPadding: { value: new THREE.Vector2(paddingRatio / (1 + 2 * paddingRatio), paddingRatio / (1 + 2 * paddingRatio)) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  // Update uniforms when settings change
  useEffect(() => {
    material.uniforms.uHologram.value = settings.hologram
    material.uniforms.uNeon.value = settings.neon
    material.uniforms.uGlow.value = settings.glow
    material.uniforms.uGlowColor.value.set(...settings.glowColor)
  }, [settings, material])

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(cardImageUrl, (tex) => {
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      textureRef.current = tex
      material.uniforms.cardTexture.value = tex
      material.uniforms.uCardSize.value.set(tex.image.width, tex.image.height)
    })

    return () => {
      if (textureRef.current) textureRef.current.dispose()
    }
  }, [cardImageUrl, material])

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta
  })

  const aspect = width / height
  // Scale to include padding area
  const totalScale = scale * (1 + 2 * paddingRatio)
  const planeHeight = 1 * totalScale
  const planeWidth = planeHeight * aspect

  return (
    <mesh renderOrder={1}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
