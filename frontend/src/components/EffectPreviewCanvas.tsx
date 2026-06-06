import { useEffect, useRef, useState } from 'react'
import { useCardEffectRenderer } from '../lib/useCardEffectRenderer'
import type { EffectSettings } from '../lib/shaders/index'

type Props = {
  cardImageUrl: string
  settings: EffectSettings
  className?: string
}

export function EffectPreviewCanvas({ cardImageUrl, settings, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = cardImageUrl
  }, [cardImageUrl])

  useCardEffectRenderer(canvasRef, image, settings)

  return <canvas ref={canvasRef} className={className} />
}
