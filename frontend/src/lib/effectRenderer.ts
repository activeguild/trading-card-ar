/**
 * Canvas-based card effect renderer.
 * Ports the Python effect logic to TypeScript for real-time preview.
 */

export type EffectSettings = {
  hologram: boolean
  neon: boolean
  glow: boolean
  glowColor: [number, number, number] // RGB 0-1
}

const BORDER_RATIO = 0.04
const GLOW_WIDTH = 0.035
const SPEED = 0.7
const NEON_INTENSITY = 1.2
const GLOW_PADDING_RATIO = 0.05 // 5% padding on each side for outer glow

// Precomputed data for a card image
export type EffectData = {
  cardWidth: number
  cardHeight: number
  padX: number
  padY: number
  totalWidth: number
  totalHeight: number
  edgeMap: Float32Array
  borderMask: Float32Array
  edgeDist: Float32Array
  cardImageData: ImageData
}

export function prepareEffectData(cardImage: HTMLImageElement): EffectData {
  const cw = cardImage.naturalWidth
  const ch = cardImage.naturalHeight
  const padX = Math.round(cw * GLOW_PADDING_RATIO)
  const padY = Math.round(ch * GLOW_PADDING_RATIO)
  const tw = cw + padX * 2
  const th = ch + padY * 2

  // Get card pixel data
  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width = cw
  tmpCanvas.height = ch
  const tmpCtx = tmpCanvas.getContext('2d')!
  tmpCtx.drawImage(cardImage, 0, 0)
  const cardImageData = tmpCtx.getImageData(0, 0, cw, ch)

  // Edge map (on card pixels)
  const edgeMap = computeEdgeMap(cardImageData)

  // Border mask (on padded canvas, card area only)
  const borderMask = new Float32Array(tw * th)
  const border = Math.round(cw * BORDER_RATIO)
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const cx = x - padX
      const cy = y - padY
      if (cx >= 0 && cx < cw && cy >= 0 && cy < ch) {
        if (cx < border || cx >= cw - border || cy < border || cy >= ch - border) {
          borderMask[y * tw + x] = 1
        }
      }
    }
  }

  // Edge distance from card boundary (for outer glow)
  const edgeDist = new Float32Array(tw * th)
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const cx = x - padX
      const cy = y - padY
      // Distance to nearest card edge
      const dx = cx < 0 ? -cx : cx >= cw ? cx - cw + 1 : Math.min(cx, cw - 1 - cx)
      const dy = cy < 0 ? -cy : cy >= ch ? cy - ch + 1 : Math.min(cy, ch - 1 - cy)
      if (cx < 0 || cx >= cw || cy < 0 || cy >= ch) {
        // Outside card: distance from card boundary
        edgeDist[y * tw + x] = Math.sqrt(
          (cx < 0 ? cx * cx : cx >= cw ? (cx - cw + 1) ** 2 : 0) +
          (cy < 0 ? cy * cy : cy >= ch ? (cy - ch + 1) ** 2 : 0)
        ) / cw
      } else {
        // Inside card: distance from edge
        edgeDist[y * tw + x] = Math.min(dx, dy) / cw
      }
    }
  }

  return { cardWidth: cw, cardHeight: ch, padX, padY, totalWidth: tw, totalHeight: th, edgeMap, borderMask, edgeDist, cardImageData }
}

function computeEdgeMap(imageData: ImageData): Float32Array {
  const { width: w, height: h, data } = imageData
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255
  }
  const edge = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const dx = Math.abs(gray[idx + 1] - gray[idx - 1])
      const dy = Math.abs(gray[idx + w] - gray[idx - w])
      const e = dx + dy
      const t = Math.max(0, Math.min(1, (e - 0.05) / 0.15))
      edge[idx] = t * t * (3 - 2 * t)
    }
  }
  return edge
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const h6 = h * 6
  const hi = Math.floor(h6) % 6
  const f = h6 - Math.floor(h6)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const table: [number, number, number][] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]]
  return table[hi]
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  data: EffectData,
  time: number,
  settings: EffectSettings,
): void {
  const { cardWidth: cw, cardHeight: ch, padX, padY, totalWidth: tw, totalHeight: th, edgeMap, borderMask, edgeDist, cardImageData } = data

  // Draw card centered in padded canvas
  const frame = ctx.createImageData(tw, th)
  const out = frame.data

  // First, draw card pixels into the padded frame
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const si = (cy * cw + cx) * 4
      const di = ((cy + padY) * tw + (cx + padX)) * 4
      out[di] = cardImageData.data[si]
      out[di + 1] = cardImageData.data[si + 1]
      out[di + 2] = cardImageData.data[si + 2]
      out[di + 3] = 255
    }
  }

  const t = time

  // Render effects per pixel
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const idx = y * tw + x
      const xn = x / tw
      const yn = y / th
      const cx = x - padX
      const cy = y - padY
      const insideCard = cx >= 0 && cx < cw && cy >= 0 && cy < ch

      let er = 0, eg = 0, eb = 0, ea = 0

      // Rainbow color
      const hue = ((xn * 0.5 + yn * 0.3 + t * SPEED * 0.15) % 1 + 1) % 1
      const [rr, rg, rb] = hsvToRgb(hue, 0.8, 1)

      // 1. HOLOGRAM (border)
      if (settings.hologram && borderMask[idx] > 0) {
        const diag = (xn + yn) / 2
        const shift = Math.sin(diag * 6 + t * SPEED * 2) * 0.3 + 0.7
        const str = borderMask[idx] * shift
        er += rr * str
        eg += rg * str
        eb += rb * str
        ea = Math.max(ea, str)
      }

      // 2. NEON (inside border, edge-based)
      if (settings.neon && insideCard && borderMask[idx] === 0) {
        const edgeIdx = cy * cw + cx
        const edgeVal = edgeMap[edgeIdx]
        if (edgeVal > 0) {
          const pulse = Math.sin(t * SPEED * 3) * 0.3 + 0.7
          const travel = Math.sin(xn * 10 + yn * 8 - t * SPEED * 4) * 0.3 + 0.7
          const str = edgeVal * pulse * travel * NEON_INTENSITY
          er += rr * str
          eg += rg * str
          eb += rb * str
          ea = Math.max(ea, str)
        }
      }

      // 3. GLOW (outside card)
      if (settings.glow && !insideCard) {
        const dist = edgeDist[idx]
        const glowMax = GLOW_WIDTH
        if (dist < glowMax) {
          let str = 1 - dist / glowMax
          str = str * str // quadratic falloff
          const pulse = Math.sin(t * SPEED * 2) * 0.3 + 0.7
          const travel = Math.sin((xn - yn) * 4 + t * SPEED * 2.5) * 0.5 + 0.5
          str *= pulse * (0.7 + travel * 0.3) * 0.8
          const [gr, gg, gb] = settings.glowColor
          er += gr * str
          eg += gg * str
          eb += gb * str
          ea = Math.max(ea, str)
        }
      }

      // Blend effect onto the frame (additive for hologram/neon, replace for glow outside)
      if (ea > 0) {
        const pi = idx * 4
        const blendAlpha = Math.min(ea, 1)
        if (insideCard) {
          // Additive blend on card
          out[pi] = Math.min(255, out[pi] + er * 255 * blendAlpha)
          out[pi + 1] = Math.min(255, out[pi + 1] + eg * 255 * blendAlpha)
          out[pi + 2] = Math.min(255, out[pi + 2] + eb * 255 * blendAlpha)
        } else {
          // Outside card: just the effect color
          out[pi] = Math.min(255, er * 255)
          out[pi + 1] = Math.min(255, eg * 255)
          out[pi + 2] = Math.min(255, eb * 255)
          out[pi + 3] = Math.min(255, blendAlpha * 255)
        }
      }
    }
  }

  ctx.putImageData(frame, 0, 0)
}

/** Render effect-only frame for video export (color + alpha stacked) */
export function renderEffectOnlyFrame(
  data: EffectData,
  time: number,
  settings: EffectSettings,
): { color: Uint8Array; alpha: Uint8Array } {
  const { cardWidth: cw, cardHeight: ch, padX, padY, totalWidth: tw, totalHeight: th, edgeMap, borderMask, edgeDist } = data
  const color = new Uint8Array(tw * th * 3)
  const alpha = new Uint8Array(tw * th)
  const t = time

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const idx = y * tw + x
      const xn = x / tw
      const yn = y / th
      const cx = x - padX
      const cy = y - padY
      const insideCard = cx >= 0 && cx < cw && cy >= 0 && cy < ch

      let er = 0, eg = 0, eb = 0, ea = 0

      const hue = ((xn * 0.5 + yn * 0.3 + t * SPEED * 0.15) % 1 + 1) % 1
      const [rr, rg, rb] = hsvToRgb(hue, 0.8, 1)

      if (settings.hologram && insideCard && borderMask[idx] > 0) {
        const diag = (xn + yn) / 2
        const shift = Math.sin(diag * 6 + t * SPEED * 2) * 0.3 + 0.7
        const str = borderMask[idx] * shift
        er += rr * str; eg += rg * str; eb += rb * str
        ea = Math.max(ea, str)
      }

      if (settings.neon && insideCard && borderMask[idx] === 0) {
        const edgeVal = edgeMap[cy * cw + cx]
        if (edgeVal > 0) {
          const pulse = Math.sin(t * SPEED * 3) * 0.3 + 0.7
          const travel = Math.sin(xn * 10 + yn * 8 - t * SPEED * 4) * 0.3 + 0.7
          const str = edgeVal * pulse * travel * NEON_INTENSITY
          er += rr * str; eg += rg * str; eb += rb * str
          ea = Math.max(ea, str)
        }
      }

      if (settings.glow && !insideCard) {
        const dist = edgeDist[idx]
        if (dist < GLOW_WIDTH) {
          let str = 1 - dist / GLOW_WIDTH
          str = str * str
          const pulse = Math.sin(t * SPEED * 2) * 0.3 + 0.7
          const travel = Math.sin((xn - yn) * 4 + t * SPEED * 2.5) * 0.5 + 0.5
          str *= pulse * (0.7 + travel * 0.3) * 0.8
          const [gr, gg, gb] = settings.glowColor
          er += gr * str; eg += gg * str; eb += gb * str
          ea = Math.max(ea, str)
        }
      }

      const ci = idx * 3
      color[ci] = Math.min(255, er * 255)
      color[ci + 1] = Math.min(255, eg * 255)
      color[ci + 2] = Math.min(255, eb * 255)
      alpha[idx] = Math.min(255, ea * 255)
    }
  }

  return { color, alpha }
}
