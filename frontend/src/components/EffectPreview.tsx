import { useEffect, useRef, useState } from 'react'

type Props = {
  cardSrc: string
  effectSrc: string
  width?: number
}

export function EffectPreview({ cardSrc, effectSrc, width = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [canvasHeight, setCanvasHeight] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cardImg = new Image()
    cardImg.crossOrigin = 'anonymous'
    cardImg.src = cardSrc

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = effectSrc

    let running = true

    const draw = () => {
      if (!running) return

      // Draw card as base
      ctx.drawImage(cardImg, 0, 0, canvas.width, canvas.height)

      // Overlay effect if video is ready
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const vw = video.videoWidth
        const vh = video.videoHeight / 2

        const offscreen = document.createElement('canvas')
        offscreen.width = vw
        offscreen.height = vh
        const offCtx = offscreen.getContext('2d')!

        offCtx.drawImage(video, 0, 0, vw, vh, 0, 0, vw, vh)
        const colorData = offCtx.getImageData(0, 0, vw, vh)

        offCtx.drawImage(video, 0, vh, vw, vh, 0, 0, vw, vh)
        const maskData = offCtx.getImageData(0, 0, vw, vh)

        for (let i = 0; i < colorData.data.length; i += 4) {
          colorData.data[i + 3] = maskData.data[i]
        }
        offCtx.putImageData(colorData, 0, 0)

        ctx.drawImage(offscreen, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    cardImg.onload = () => {
      const aspect = cardImg.height / cardImg.width
      const h = Math.round(width * aspect)
      canvas.width = width
      canvas.height = h
      setCanvasHeight(h)
      draw()
    }

    // Try to play video, retry on user interaction if blocked
    const tryPlay = () => {
      video.play().catch(() => {
        document.addEventListener('touchstart', () => video.play().catch(() => {}), {
          once: true,
        })
      })
    }
    video.addEventListener('canplay', tryPlay, { once: true })
    tryPlay()

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      video.pause()
      video.src = ''
    }
  }, [cardSrc, effectSrc, width])

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: '100%',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        display: canvasHeight > 0 ? 'block' : 'none',
      }}
    />
  )
}
