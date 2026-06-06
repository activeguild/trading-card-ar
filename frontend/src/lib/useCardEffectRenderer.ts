import { useEffect, useRef } from 'react'
import { vertexShader } from './shaders/common'
import {
  EFFECT_SHADERS,
  TRANSITION_SHADERS,
  type EffectName,
  type TransitionName,
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

function renderPass(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  w: number,
  h: number,
  imageTex: WebGLTexture,
  edgeMapTex: WebGLTexture,
  bgTex: WebGLTexture,
  time: number,
  borderWidth: number,
  intensity: number,
  speed: number,
  mode: number,
  blendMode: number,
  effectColor: [number, number, number],
  effectOnly: number,
  framebuffer: WebGLFramebuffer | null = null,
) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.viewport(0, 0, w, h)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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
}

// Total cycle ~30s: still(2s) + effect loop(24s) + transition(4s)
const STILL_DURATION = 2
const EFFECT_DURATION = 24
const TRANSITION_DURATION = 4

export function useCardEffectRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  image: HTMLImageElement | null,
  config: RendererConfig,
) {
  const animRef = useRef(0)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    cancelAnimationFrame(animRef.current)

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

    // Framebuffers: fbo1 for layering effects, fbo2 for transition source
    const fbo1 = createFramebuffer(gl, w, h)
    const fbo2 = createFramebuffer(gl, w, h)

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

    // Render effect-applied card to a target (framebuffer or screen)
    // When both border + inner are set, layers them:
    //   1. Render border effect (with card) → fbo1
    //   2. Render inner effect using fbo1 as source → target
    function renderEffectedCard(cfg: RendererConfig, time: number, target: WebGLFramebuffer | null) {
      const hasEffect = cfg.borderEffect !== null || cfg.innerEffect !== null

      if (!hasEffect) {
        // No effects: render plain card
        const shader = EFFECT_SHADERS.hologram
        const prog = getProgram(shader)
        if (!prog) return
        renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, 0, 0, 0, 0, 1, 0, [1, 1, 1], 0, target)
        return
      }

      if (cfg.borderEffect && cfg.innerEffect) {
        // Layer 1: border effect → fbo1
        const borderShader = EFFECT_SHADERS[cfg.borderEffect]
        const borderProg = getProgram(borderShader)
        if (!borderProg) return
        renderPass(gl!, borderProg, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 0, 0, [1, 1, 1], 0, fbo1.fb)

        // Layer 2: inner effect, using fbo1 result as source → target
        const innerShader = EFFECT_SHADERS[cfg.innerEffect]
        const innerProg = getProgram(innerShader)
        if (!innerProg) return
        renderPass(gl!, innerProg, w, h, fbo1.tex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 1, 1, [1, 1, 1], 0, target)
      } else if (cfg.borderEffect) {
        const shader = EFFECT_SHADERS[cfg.borderEffect]
        const prog = getProgram(shader)
        if (!prog) return
        renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 0, 0, [1, 1, 1], 0, target)
      } else if (cfg.innerEffect) {
        const shader = EFFECT_SHADERS[cfg.innerEffect]
        const prog = getProgram(shader)
        if (!prog) return
        renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 1, 1, [1, 1, 1], 0, target)
      }
    }

    const startTime = performance.now()

    const render = () => {
      const cfg = configRef.current
      const elapsed = (performance.now() - startTime) / 1000

      const hasTransition = cfg.transition !== null
      const hasEffect = cfg.borderEffect !== null || cfg.innerEffect !== null

      // Timeline: still → effect loop → transition → repeat
      const transDuration = hasTransition ? TRANSITION_DURATION : 0
      const effectDur = hasEffect ? EFFECT_DURATION : 0
      const totalCycle = STILL_DURATION + effectDur + transDuration

      // If nothing is selected, just show the card
      if (!hasTransition && !hasEffect) {
        const shader = EFFECT_SHADERS.hologram
        const prog = getProgram(shader)
        if (prog) renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, 0, 0, 0, 0, 1, 0, [1, 1, 1], 0)
        animRef.current = requestAnimationFrame(render)
        return
      }

      const phase = totalCycle > 0 ? elapsed % totalCycle : 0

      if (phase < STILL_DURATION) {
        // Still phase: show card with effects
        renderEffectedCard(cfg, phase, null)
      } else if (phase < STILL_DURATION + effectDur) {
        // Effect loop phase
        const t = phase - STILL_DURATION
        renderEffectedCard(cfg, t, null)
      } else {
        // Transition phase: render effect card to FBO, then transition uses it
        const t = phase - STILL_DURATION - effectDur

        // Render effected card (or plain) to fbo2
        renderEffectedCard(cfg, phase, fbo2.fb)

        // Render transition to screen, using fbo2 texture as u_image
        const transShader = TRANSITION_SHADERS[cfg.transition!]
        const transProg = getProgram(transShader)
        if (transProg) {
          renderPass(gl!, transProg, w, h, fbo2.tex, edgeMapTex, bgTex, t, 0.05, 1.0, 1.0, 1, 0, [1, 1, 1], 0)
        }
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
      gl.deleteTexture(fbo2.tex)
      gl.deleteFramebuffer(fbo2.fb)
    }
  }, [canvasRef, image])
}
