/**
 * Encode effect frames to stacked mp4 (color + alpha) using ffmpeg.wasm.
 * Writes PNG frames one-by-one to FFmpeg FS, then encodes with frame%05d.png pattern.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core/dist/umd/ffmpeg-core.js?url'
import wasmURL from '@ffmpeg/core/dist/umd/ffmpeg-core.wasm?url'
import { type EffectData, type EffectSettings, renderEffectOnlyFrame } from './effectRenderer'

const FPS = 24
const DURATION = 8
const TOTAL_FRAMES = FPS * DURATION

export async function encodeEffectVideo(
  data: EffectData,
  settings: EffectSettings,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const { totalWidth: tw, totalHeight: th } = data
  const stackedH = th * 2

  // 1. Load FFmpeg (from npm package, no CDN dependency)
  const ffmpeg = new FFmpeg()
  await ffmpeg.load({
    coreURL: await toBlobURL(coreURL, 'text/javascript'),
    wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
  })

  // 2. Render frames as PNGs and write to FFmpeg FS
  const outCanvas = document.createElement('canvas')
  outCanvas.width = tw
  outCanvas.height = stackedH
  const ctx = outCanvas.getContext('2d')!

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const time = i / FPS
    const { color, alpha } = renderEffectOnlyFrame(data, time, settings)

    // Top half: color
    const colorImageData = ctx.createImageData(tw, th)
    for (let p = 0; p < tw * th; p++) {
      colorImageData.data[p * 4] = color[p * 3]
      colorImageData.data[p * 4 + 1] = color[p * 3 + 1]
      colorImageData.data[p * 4 + 2] = color[p * 3 + 2]
      colorImageData.data[p * 4 + 3] = 255
    }
    ctx.putImageData(colorImageData, 0, 0)

    // Bottom half: alpha as grayscale
    const alphaImageData = ctx.createImageData(tw, th)
    for (let p = 0; p < tw * th; p++) {
      const a = alpha[p]
      alphaImageData.data[p * 4] = a
      alphaImageData.data[p * 4 + 1] = a
      alphaImageData.data[p * 4 + 2] = a
      alphaImageData.data[p * 4 + 3] = 255
    }
    ctx.putImageData(alphaImageData, 0, th)

    // Write as PNG
    const blob = await new Promise<Blob>((resolve) => {
      outCanvas.toBlob((b) => resolve(b!), 'image/png')
    })
    await ffmpeg.writeFile(
      `frame${String(i).padStart(5, '0')}.png`,
      new Uint8Array(await blob.arrayBuffer()),
    )

    onProgress?.(Math.round(((i + 1) / TOTAL_FRAMES) * 80))
  }

  // 3. Encode with ffmpeg
  const padW = Math.ceil(tw / 2) * 2
  const padH = Math.ceil(stackedH / 2) * 2

  await ffmpeg.exec([
    '-framerate', String(FPS),
    '-i', 'frame%05d.png',
    '-vf', `pad=${padW}:${padH}`,
    '-c:v', 'libx264',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-y', 'output.mp4',
  ])

  onProgress?.(95)

  const output = await ffmpeg.readFile('output.mp4')

  onProgress?.(100)

  return new Blob([output], { type: 'video/mp4' })
}
