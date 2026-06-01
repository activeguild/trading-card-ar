import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D videoTexture;
varying vec2 vUv;
void main() {
  // Top half is color, bottom half is alpha mask
  vec2 colorUv = vec2(vUv.x, vUv.y * 0.5 + 0.5);
  vec2 alphaUv = vec2(vUv.x, vUv.y * 0.5);
  vec4 color = texture2D(videoTexture, colorUv);
  float alpha = texture2D(videoTexture, alphaUv).r;
  gl_FragColor = vec4(color.rgb, alpha);
}
`

type Props = {
  src: string
  width: number
  height: number
}

export function TransparentVideo({ src, width, height }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const textureRef = useRef<THREE.VideoTexture | null>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          videoTexture: { value: null },
        },
        transparent: true,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useEffect(() => {
    const video = document.createElement('video')
    video.src = src
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.play().catch(() => {})
    videoRef.current = video

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    textureRef.current = texture
    material.uniforms.videoTexture.value = texture

    return () => {
      video.pause()
      video.src = ''
      texture.dispose()
    }
  }, [src, material])

  useFrame(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true
    }
  })

  // Scale slightly larger than 1.0 to cover card edges
  const scale = 1.05
  const aspect = width / height
  const planeHeight = scale
  const planeWidth = planeHeight * aspect

  return (
    <mesh>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
