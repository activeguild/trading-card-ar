import { useEffect, useState } from 'react'
import * as THREE from 'three'

type Props = {
  src: string
  width: number
  height: number
}

export function CardPlane({ src, width, height }: Props) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      setTexture(tex)
    })
    return () => {
      texture?.dispose()
    }
  }, [src])

  const aspect = width / height
  const planeHeight = 1
  const planeWidth = planeHeight * aspect

  if (!texture) return null

  return (
    <mesh position={[0, 0, -0.001]} renderOrder={0}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
