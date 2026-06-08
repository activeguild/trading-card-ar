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
  const packCanvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = cardImageUrl
  }, [cardImageUrl])

  useCardEffectRenderer(canvasRef, packCanvasRef, image, settings)

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} className={className} />
      <canvas ref={packCanvasRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxHeight: '140%', maxWidth: '140%', pointerEvents: 'none', display: 'none' }} />
    </div>
  )
}
