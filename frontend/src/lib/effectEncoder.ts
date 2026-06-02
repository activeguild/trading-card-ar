/**
 * Encode effect frames to stacked mp4 (color + alpha) using ffmpeg.wasm.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { type EffectData, type EffectSettings, renderEffectOnlyFrame } from './effectRenderer'

const FPS = 24
const DURATION = 8
const TOTAL_FRAMES = FPS * DURATION

let ffmpeg: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
  // Use single-threaded core to avoid CORS requirements
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  return ffmpeg
}

export async function encodeEffectVideo(
  data: EffectData,
  settings: EffectSettings,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ff = await getFFmpeg()
  const { totalWidth: tw, totalHeight: th } = data
  const stackedH = th * 2

  // Generate and write each frame as raw RGB
  const frameSize = tw * stackedH * 3
  const rawBuffer = new Uint8Array(TOTAL_FRAMES * frameSize)

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const time = i / FPS
    const { color, alpha } = renderEffectOnlyFrame(data, time, settings)

    const offset = i * frameSize
    // Top half: color
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const si = (y * tw + x) * 3
        const di = offset + (y * tw + x) * 3
        rawBuffer[di] = color[si]
        rawBuffer[di + 1] = color[si + 1]
        rawBuffer[di + 2] = color[si + 2]
      }
    }
    // Bottom half: alpha as grayscale RGB
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const a = alpha[y * tw + x]
        const di = offset + ((y + th) * tw + x) * 3
        rawBuffer[di] = a
        rawBuffer[di + 1] = a
        rawBuffer[di + 2] = a
      }
    }

    onProgress?.(Math.round(((i + 1) / TOTAL_FRAMES) * 80))
  }

  await ff.writeFile('input.raw', rawBuffer)

  await ff.exec([
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    '-s', `${tw}x${stackedH}`,
    '-r', String(FPS),
    '-i', 'input.raw',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    '-y', 'output.mp4',
  ])

  onProgress?.(95)

  const output = await ff.readFile('output.mp4')
  await ff.deleteFile('input.raw')
  await ff.deleteFile('output.mp4')

  onProgress?.(100)

  return new Blob([output], { type: 'video/mp4' })
}
