import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  TRANSITION_SHADERS,
  PACK_IMAGE_MAP,
  type TransitionName,
  type PackType,
} from '../lib/shaders/index'

function createEmptyTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

const CYCLE_DURATION = 30
const PACK_SHOW_DURATION = 3
const TRANSITION_DURATION = 4

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

type Props = {
  transition: TransitionName
  packType: PackType
  width: number
  height: number
  scale?: number
}

export function PackTransitionPlane({ transition, packType, width, height, scale = 1 }: Props) {
  const textureRef = useRef<THREE.Texture | null>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const startTimeRef = useRef(performance.now())

  const material = useMemo(() => {
    const fragSource = TRANSITION_SHADERS[transition]
    if (!fragSource) return null
    return new THREE.ShaderMaterial({
      vertexShader: threeVertexShader,
      fragmentShader: adaptShaderForThreeJS(fragSource),
      uniforms: {
        u_image: { value: createEmptyTexture() },
        u_edgeMap: { value: createEmptyTexture() },
        u_background: { value: createEmptyTexture() },
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(width, height) },
        u_borderWidth: { value: 0.05 },
        u_intensity: { value: 1.0 },
        u_speed: { value: 1.0 },
        u_mode: { value: 1 },
        u_blendMode: { value: 0 },
        u_effectColor: { value: new THREE.Vector3(1, 1, 1) },
        u_effectOnly: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }, [transition])

  // Load pack texture
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const packSrc = PACK_IMAGE_MAP[packType]
    loader.load(packSrc, (tex) => {
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      textureRef.current = tex
      if (material) {
        material.uniforms.u_image.value = tex
        material.uniforms.u_resolution.value.set(tex.image.width, tex.image.height)
      }
    })
    return () => {
      if (textureRef.current) textureRef.current.dispose()
    }
  }, [packType, material])

  useFrame(() => {
    if (!material || !meshRef.current) return
    const elapsed = (performance.now() - startTimeRef.current) / 1000
    const phase = elapsed % CYCLE_DURATION
    const inPackShow = phase < PACK_SHOW_DURATION
    const inTransition = phase >= PACK_SHOW_DURATION && phase < PACK_SHOW_DURATION + TRANSITION_DURATION

    if (inPackShow) {
      meshRef.current.visible = true
      material.uniforms.u_time.value = 0
    } else if (inTransition) {
      meshRef.current.visible = true
      material.uniforms.u_time.value = phase - PACK_SHOW_DURATION
    } else {
      meshRef.current.visible = false
    }
  })

  if (!material) return null

  const aspect = width / height
  // Pack is slightly larger than the card
  const totalScale = scale * 1.15
  const planeHeight = 1 * totalScale
  const planeWidth = planeHeight * aspect

  return (
    <mesh ref={meshRef} renderOrder={3} position={[0, 0, 0.001]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
