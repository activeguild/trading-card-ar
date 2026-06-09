import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  EFFECT_SHADERS,
  type EffectName,
} from '../lib/shaders/index'
import type { EffectSettings } from '../lib/shaders/index'

/**
 * Adapt a 2D canvas WebGL effect shader (a_position/a_texCoord)
 * to a Three.js vertex shader (position/uv).
 */
function adaptShaderForThreeJS(fragmentSource: string): string {
  return fragmentSource
    .replace(/varying\s+vec2\s+v_texCoord\s*;/g, 'varying vec2 vUv;')
    .replace(/v_texCoord/g, 'vUv')
}

const threeVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

function createEffectMaterial(
  effectName: EffectName,
  mode: number,
  blendMode: number,
  width: number,
  height: number,
): THREE.ShaderMaterial | null {
  const fragSource = EFFECT_SHADERS[effectName]
  if (!fragSource) return null
  return new THREE.ShaderMaterial({
    vertexShader: threeVertexShader,
    fragmentShader: adaptShaderForThreeJS(fragSource),
    uniforms: {
      u_image: { value: null },
      u_edgeMap: { value: null },
      u_background: { value: null },
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_borderWidth: { value: 0.05 },
      u_intensity: { value: 1.0 },
      u_speed: { value: 1.0 },
      u_mode: { value: mode },
      u_blendMode: { value: blendMode },
      u_effectColor: { value: new THREE.Vector3(1, 1, 1) },
      u_effectOnly: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

type Props = {
  cardImageUrl: string
  settings: EffectSettings
  width: number
  height: number
  scale?: number
}

export function EffectShaderPlane({ cardImageUrl, settings, width, height, scale = 1 }: Props) {
  const textureRef = useRef<THREE.Texture | null>(null)
  const edgeMapTexRef = useRef<THREE.Texture | null>(null)

  const hasBorder = settings.borderEffect !== null
  const hasInner = settings.innerEffect !== null

  const borderMaterial = useMemo(() => {
    if (!hasBorder) return null
    return createEffectMaterial(settings.borderEffect as EffectName, 0, 0, width, height)
  }, [settings.borderEffect])

  const innerMaterial = useMemo(() => {
    if (!hasInner) return null
    return createEffectMaterial(settings.innerEffect as EffectName, 1, 1, width, height)
  }, [settings.innerEffect])

  // Load card texture
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(cardImageUrl, (tex) => {
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      textureRef.current = tex
      if (borderMaterial) {
        borderMaterial.uniforms.u_image.value = tex
        borderMaterial.uniforms.u_resolution.value.set(tex.image.width, tex.image.height)
      }
      if (innerMaterial) {
        innerMaterial.uniforms.u_image.value = tex
        innerMaterial.uniforms.u_resolution.value.set(tex.image.width, tex.image.height)
      }
    })

    return () => {
      if (textureRef.current) textureRef.current.dispose()
    }
  }, [cardImageUrl, borderMaterial, innerMaterial])

  // Generate edge map texture from card image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = img.naturalWidth
      const h = img.naturalHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, w, h)

      // Compute edge map (Sobel)
      const gray = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i * 4] * 0.299 + imageData.data[i * 4 + 1] * 0.587 + imageData.data[i * 4 + 2] * 0.114) / 255
      }
      const edgeData = ctx.createImageData(w, h)
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x
          const dx = Math.abs(gray[idx + 1] - gray[idx - 1])
          const dy = Math.abs(gray[idx + w] - gray[idx - w])
          const e = dx + dy
          const t = Math.max(0, Math.min(1, (e - 0.05) / 0.15))
          const v = Math.round(t * t * (3 - 2 * t) * 255)
          const pi = idx * 4
          edgeData.data[pi] = v
          edgeData.data[pi + 1] = v
          edgeData.data[pi + 2] = v
          edgeData.data[pi + 3] = 255
        }
      }

      const edgeCanvas = document.createElement('canvas')
      edgeCanvas.width = w
      edgeCanvas.height = h
      edgeCanvas.getContext('2d')!.putImageData(edgeData, 0, 0)

      const edgeTex = new THREE.CanvasTexture(edgeCanvas)
      edgeTex.minFilter = THREE.LinearFilter
      edgeTex.magFilter = THREE.LinearFilter
      edgeMapTexRef.current = edgeTex

      if (borderMaterial) {
        borderMaterial.uniforms.u_edgeMap.value = edgeTex
      }
      if (innerMaterial) {
        innerMaterial.uniforms.u_edgeMap.value = edgeTex
      }
    }
    img.src = cardImageUrl
  }, [cardImageUrl, borderMaterial, innerMaterial])

  useFrame((_, delta) => {
    if (borderMaterial) {
      borderMaterial.uniforms.u_time.value += delta
    }
    if (innerMaterial) {
      innerMaterial.uniforms.u_time.value += delta
    }
  })

  const aspect = width / height
  const planeHeight = 1 * scale
  const planeWidth = planeHeight * aspect

  if (!hasBorder && !hasInner) return null

  return (
    <group>
      {borderMaterial && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <primitive object={borderMaterial} attach="material" />
        </mesh>
      )}
      {innerMaterial && (
        <mesh renderOrder={2}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <primitive object={innerMaterial} attach="material" />
        </mesh>
      )}
    </group>
  )
}
