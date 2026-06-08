import { useCallback, useEffect, useRef } from 'react'
import { vertexShader } from './shaders/common'
import {
  EFFECT_SHADERS,
  TRANSITION_SHADERS,
  PACK_IMAGE_MAP,
  type EffectName,
  type TransitionName,
  type PackType,
} from './shaders/index'
import { generateEdgeMap } from './edgeMap'

// --- WebGL helpers ---

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, vs)
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  if (!vertShader || !fragShader) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function setupGeometry(gl: WebGLRenderingContext, program: WebGLProgram) {
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])

  const posBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  const posLoc = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  const texBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
  const texLoc = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(texLoc)
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)
}

function uploadTexture(gl: WebGLRenderingContext, source: HTMLImageElement | HTMLCanvasElement): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  return texture
}

function createEmptyTexture(gl: WebGLRenderingContext): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
  return texture
}

// --- Framebuffer for offscreen rendering ---

function createFramebuffer(gl: WebGLRenderingContext, w: number, h: number) {
  const fb = gl.createFramebuffer()!
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { fb, tex }
}

// --- Render a single shader pass ---

interface PassOptions {
  gl: WebGLRenderingContext
  program: WebGLProgram
  w: number
  h: number
  imageTex: WebGLTexture
  edgeMapTex: WebGLTexture
  bgTex: WebGLTexture
  time: number
  borderWidth: number
  intensity: number
  speed: number
  mode: number
  blendMode: number
  effectColor: [number, number, number]
  effectOnly: number
  framebuffer?: WebGLFramebuffer | null
  clear?: boolean
  blendSrc?: number
  blendDst?: number
}

function renderPass(opts: PassOptions) {
  const {
    gl, program, w, h,
    imageTex, edgeMapTex, bgTex,
    time, borderWidth, intensity, speed,
    mode, blendMode, effectColor, effectOnly,
    framebuffer = null,
    clear = true,
    blendSrc = gl.SRC_ALPHA,
    blendDst = gl.ONE_MINUS_SRC_ALPHA,
  } = opts

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.viewport(0, 0, w, h)
  if (clear) {
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
  gl.enable(gl.BLEND)
  gl.blendFunc(blendSrc, blendDst)
  gl.useProgram(program)

  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time)
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), w, h)
  gl.uniform1f(gl.getUniformLocation(program, 'u_borderWidth'), borderWidth)
  gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), intensity)
  gl.uniform1f(gl.getUniformLocation(program, 'u_speed'), speed)
  gl.uniform1f(gl.getUniformLocation(program, 'u_mode'), mode)
  gl.uniform1f(gl.getUniformLocation(program, 'u_blendMode'), blendMode)
  gl.uniform3f(gl.getUniformLocation(program, 'u_effectColor'), ...effectColor)
  gl.uniform1f(gl.getUniformLocation(program, 'u_effectOnly'), effectOnly)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, imageTex)
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, edgeMapTex)
  gl.uniform1i(gl.getUniformLocation(program, 'u_edgeMap'), 1)

  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, bgTex)
  gl.uniform1i(gl.getUniformLocation(program, 'u_background'), 2)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

// --- Main hook ---

export interface RendererConfig {
  transition: TransitionName | null
  borderEffect: EffectName | null
  innerEffect: EffectName | null
  packType: PackType
}

const CYCLE_DURATION = 30
const TRANSITION_DURATION = 4

export function useCardEffectRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  packCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  image: HTMLImageElement | null,
  config: RendererConfig,
) {
  const animRef = useRef(0)
  const startTimeRef = useRef(0)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const canvas = canvasRef.current
    const packCanvas = packCanvasRef.current
    if (!canvas || !image) return

    cancelAnimationFrame(animRef.current)

    // Canvas = card image size (card fills canvas exactly)
    const MAX_SIZE = 700
    let w = image.naturalWidth
    let h = image.naturalHeight
    if (w > MAX_SIZE || h > MAX_SIZE) {
      const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    canvas.width = w
    canvas.height = h

    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    if (!gl) return

    // Textures
    const imageTex = uploadTexture(gl, image)!
    const edgeMapData = generateEdgeMap(image, w, h)
    const edgeMapCanvas = document.createElement('canvas')
    edgeMapCanvas.width = w
    edgeMapCanvas.height = h
    edgeMapCanvas.getContext('2d')!.putImageData(edgeMapData, 0, 0)
    const edgeMapTex = uploadTexture(gl, edgeMapCanvas)!
    const bgTex = createEmptyTexture(gl)!

    const fbo1 = createFramebuffer(gl, w, h)

    // --- Pack canvas setup (for transition shader on pack image) ---
    let packGl: WebGLRenderingContext | null = null
    let packTexture: WebGLTexture | null = null
    let packEdgeMapTex: WebGLTexture | null = null
    let packBgTex: WebGLTexture | null = null
    let packProgramCache = new Map<string, WebGLProgram>()
    let currentPackType: PackType | null = null
    let packReady = false

    function setupPackCanvas(pt: PackType) {
      if (pt === currentPackType && packReady) return
      currentPackType = pt
      packReady = false

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!packCanvas) return
        const pw = img.naturalWidth
        const ph = img.naturalHeight
        const MAX = 500
        let dw = pw, dh = ph
        if (dw > MAX || dh > MAX) {
          const s = Math.min(MAX / dw, MAX / dh)
          dw = Math.round(dw * s)
          dh = Math.round(dh * s)
        }
        packCanvas.width = dw
        packCanvas.height = dh

        if (!packGl) {
          packGl = packCanvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
        }
        if (!packGl) return

        // Clean old textures
        if (packTexture) packGl.deleteTexture(packTexture)
        if (packEdgeMapTex) packGl.deleteTexture(packEdgeMapTex)
        if (packBgTex) packGl.deleteTexture(packBgTex)
        packProgramCache.forEach((p) => packGl!.deleteProgram(p))
        packProgramCache = new Map()

        packTexture = uploadTexture(packGl, img)
        // Simple edge map for pack (not needed much, create empty)
        packEdgeMapTex = createEmptyTexture(packGl)
        packBgTex = createEmptyTexture(packGl)
        packReady = true
      }
      img.src = PACK_IMAGE_MAP[pt]
    }

    function getPackProgram(shaderSource: string): WebGLProgram | null {
      if (!packGl) return null
      let prog = packProgramCache.get(shaderSource)
      if (prog) return prog
      prog = linkProgram(packGl, vertexShader, shaderSource)!
      if (prog) {
        setupGeometry(packGl, prog)
        packProgramCache.set(shaderSource, prog)
      }
      return prog || null
    }

    function renderPackTransition(transitionName: TransitionName, time: number) {
      if (!packGl || !packTexture || !packEdgeMapTex || !packBgTex || !packCanvas) return
      const shader = TRANSITION_SHADERS[transitionName]
      const prog = getPackProgram(shader)
      if (!prog) return
      renderPass({
        gl: packGl,
        program: prog,
        w: packCanvas.width,
        h: packCanvas.height,
        imageTex: packTexture,
        edgeMapTex: packEdgeMapTex,
        bgTex: packBgTex,
        borderWidth: 0.05,
        intensity: 1.0,
        speed: 1.0,
        effectColor: [1, 1, 1],
        time, mode: 1, blendMode: 0, effectOnly: 0,
      })
    }

    // Build programs map (lazily compiled)
    const programCache = new Map<string, WebGLProgram>()

    function getProgram(shaderSource: string): WebGLProgram | null {
      let prog = programCache.get(shaderSource)
      if (prog) return prog
      prog = linkProgram(gl!, vertexShader, shaderSource)!
      if (prog) {
        setupGeometry(gl!, prog)
        programCache.set(shaderSource, prog)
      }
      return prog || null
    }

    // Common pass options base
    const baseOpts = {
      gl: gl!, w, h,
      edgeMapTex, bgTex,
      borderWidth: 0.05, intensity: 1.0, speed: 1.0,
      effectColor: [1, 1, 1] as [number, number, number],
    }

    // Render plain card image to target
    function renderCard(target: WebGLFramebuffer | null) {
      const shader = EFFECT_SHADERS.hologram
      const prog = getProgram(shader)
      if (!prog) return
      renderPass({
        ...baseOpts, program: prog, imageTex,
        time: 0, mode: 1, blendMode: 0, effectOnly: 0,
        borderWidth: 0, intensity: 0, speed: 0,
        framebuffer: target,
      })
    }

    // Render card with effects applied
    // Border effect: mode=0 (outer frame, card included in shader)
    // Inner effect: mode=1 (overlay, card included in shader)
    // Both: border→fbo1, then inner uses fbo1 as source
    function renderEffectedCard(cfg: RendererConfig, time: number, target: WebGLFramebuffer | null) {
      const hasBorder = cfg.borderEffect !== null
      const hasInner = cfg.innerEffect !== null

      if (!hasBorder && !hasInner) {
        renderCard(target)
        return
      }

      if (hasBorder && hasInner) {
        // Layer 1: border effect (card included) → fbo1
        const borderShader = EFFECT_SHADERS[cfg.borderEffect!]
        const borderProg = getProgram(borderShader)
        if (borderProg) {
          renderPass({
            ...baseOpts, program: borderProg, imageTex,
            time, mode: 0, blendMode: 0, effectOnly: 0,
            framebuffer: fbo1.fb,
          })
        }
        // Layer 2: inner effect using fbo1 result as source → target
        const innerShader = EFFECT_SHADERS[cfg.innerEffect!]
        const innerProg = getProgram(innerShader)
        if (innerProg) {
          renderPass({
            ...baseOpts, program: innerProg,
            imageTex: fbo1.tex,
            time, mode: 1, blendMode: 1, effectOnly: 0,
            framebuffer: target,
          })
        }
      } else if (hasBorder) {
        const shader = EFFECT_SHADERS[cfg.borderEffect!]
        const prog = getProgram(shader)
        if (prog) {
          renderPass({
            ...baseOpts, program: prog, imageTex,
            time, mode: 0, blendMode: 0, effectOnly: 0,
            framebuffer: target,
          })
        }
      } else {
        const shader = EFFECT_SHADERS[cfg.innerEffect!]
        const prog = getProgram(shader)
        if (prog) {
          renderPass({
            ...baseOpts, program: prog, imageTex,
            time, mode: 1, blendMode: 1, effectOnly: 0,
            framebuffer: target,
          })
        }
      }
    }

    startTimeRef.current = performance.now()

    const render = () => {
      const cfg = configRef.current
      const elapsed = (performance.now() - startTimeRef.current) / 1000

      const hasTransition = cfg.transition !== null
      const hasEffect = cfg.borderEffect !== null || cfg.innerEffect !== null

      // If nothing is selected, just show the card
      if (!hasTransition && !hasEffect) {
        renderCard(null)
        if (packCanvas) packCanvas.style.display = 'none'
        animRef.current = requestAnimationFrame(render)
        return
      }

      const phase = elapsed % CYCLE_DURATION
      const inTransition = hasTransition && phase < TRANSITION_DURATION

      // Render card + effects
      renderEffectedCard(cfg, elapsed, null)

      // Render transition on pack canvas
      if (hasTransition) {
        setupPackCanvas(cfg.packType)
        if (packCanvas) {
          if (inTransition && packReady) {
            packCanvas.style.display = 'block'
            renderPackTransition(cfg.transition!, phase)
          } else {
            packCanvas.style.display = inTransition ? 'block' : 'none'
          }
        }
      } else if (packCanvas) {
        packCanvas.style.display = 'none'
      }

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animRef.current)
      programCache.forEach((p) => gl.deleteProgram(p))
      gl.deleteTexture(imageTex)
      gl.deleteTexture(edgeMapTex)
      gl.deleteTexture(bgTex)
      gl.deleteTexture(fbo1.tex)
      gl.deleteFramebuffer(fbo1.fb)
      // Pack cleanup
      if (packGl) {
        if (packTexture) packGl.deleteTexture(packTexture)
        if (packEdgeMapTex) packGl.deleteTexture(packEdgeMapTex)
        if (packBgTex) packGl.deleteTexture(packBgTex)
        packProgramCache.forEach((p) => packGl!.deleteProgram(p))
      }
    }
  }, [canvasRef, image])

  const reset = useCallback(() => {
    startTimeRef.current = performance.now()
  }, [])

  return { reset }
}
