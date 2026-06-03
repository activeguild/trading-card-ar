import { useEffect, useRef } from 'react'
import {
  type EffectData,
  type EffectSettings,
  prepareEffectData,
  renderFrame,
} from '../lib/effectRenderer'

type Props = {
  cardImageUrl: string
  settings: EffectSettings
  className?: string
}

export function EffectPreviewCanvas({ cardImageUrl, settings, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const dataRef = useRef<EffectData | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      dataRef.current = prepareEffectData(img)
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = dataRef.current.totalWidth
      canvas.height = dataRef.current.totalHeight
      startRef.current = performance.now()

      const loop = () => {
        if (!dataRef.current || !canvas) return
        const ctx = canvas.getContext('2d')!
        const t = ((performance.now() - startRef.current) / 1000) % 8
        renderFrame(ctx, dataRef.current, t, settingsRef.current)
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()
    }
    img.src = cardImageUrl

    return () => cancelAnimationFrame(rafRef.current)
  }, [cardImageUrl])

  return <canvas ref={canvasRef} className={className} />
}
