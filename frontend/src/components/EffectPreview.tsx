import { useEffect, useRef } from 'react'

type Props = {
  cardSrc: string
  effectSrc: string
  width?: number
}

export function EffectPreview({ cardSrc, effectSrc, width = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cardImg = new Image()
    cardImg.crossOrigin = 'anonymous'
    cardImg.src = cardSrc

    const video = document.createElement('video')
    video.src = effectSrc
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true

    let ready = false

    cardImg.onload = () => {
      const aspect = cardImg.height / cardImg.width
      const h = Math.round(width * aspect)
      canvas.width = width
      canvas.height = h

      video.play().catch(() => {})

      const draw = () => {
        // Draw card
        ctx.drawImage(cardImg, 0, 0, width, h)

        if (video.readyState >= 2) {
          // Video is stacked: color on top half, alpha mask on bottom half
          const vw = video.videoWidth
          const vh = video.videoHeight / 2 // half height = one frame

          // Draw color part to offscreen canvas to read pixels
          const offscreen = document.createElement('canvas')
          offscreen.width = vw
          offscreen.height = vh
          const offCtx = offscreen.getContext('2d')!

          // Get color frame (top half)
          offCtx.drawImage(video, 0, 0, vw, vh, 0, 0, vw, vh)
          const colorData = offCtx.getImageData(0, 0, vw, vh)

          // Get mask frame (bottom half)
          offCtx.drawImage(video, 0, vh, vw, vh, 0, 0, vw, vh)
          const maskData = offCtx.getImageData(0, 0, vw, vh)

          // Apply mask as alpha
          for (let i = 0; i < colorData.data.length; i += 4) {
            colorData.data[i + 3] = maskData.data[i] // R channel of mask as alpha
          }
          offCtx.putImageData(colorData, 0, 0)

          // Draw composited effect on top of card
          ctx.drawImage(offscreen, 0, 0, vw, vh, 0, 0, width, h)
        }

        rafRef.current = requestAnimationFrame(draw)
      }

      ready = true
      draw()
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      video.pause()
      video.src = ''
    }
  }, [cardSrc, effectSrc, width])

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }}
    />
  )
}
