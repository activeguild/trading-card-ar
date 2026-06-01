import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'

type Props = {
  src: string
  width: number
  height: number
}

export function CardPlane({ src, width, height }: Props) {
  const texture = useLoader(THREE.TextureLoader, src)
  const aspect = width / height
  const planeHeight = 1
  const planeWidth = planeHeight * aspect

  return (
    <mesh position={[0, 0, -0.001]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
