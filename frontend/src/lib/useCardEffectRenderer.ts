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
) {
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
}

// --- Main hook ---

export interface RendererConfig {
  transition: TransitionName | null
  borderEffect: EffectName | null
  innerEffect: EffectName | null
}

const STILL_DURATION = 1.5 // seconds: show card before transition
const TRANSITION_DURATION = 3 // seconds for transition
const EFFECT_LOOP_DURATION = 4 // seconds per effect loop

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

    // Render the card image with no effects (static display)
    function renderStatic() {
      // Use any effect shader to passthrough with time=0
      const shader = EFFECT_SHADERS.hologram
      const prog = getProgram(shader)
      if (!prog) return
      renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, 0, 0, 0, 0, 1, 0, [1, 1, 1], 0)
    }

    // Render border effect (outer frame mode = 0, or overlay mode with borderMask)
    function renderBorderEffect(effectName: EffectName, time: number) {
      const shader = EFFECT_SHADERS[effectName]
      const prog = getProgram(shader)
      if (!prog) return
      // mode=0 for outer frame effect
      renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 0, 0, [1, 1, 1], 0)
    }

    // Render inner effect (overlay mode = 1)
    function renderInnerEffect(effectName: EffectName, time: number) {
      const shader = EFFECT_SHADERS[effectName]
      const prog = getProgram(shader)
      if (!prog) return
      // mode=1 for overlay
      renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 1, 1, [1, 1, 1], 0)
    }

    // Render transition
    function renderTransition(transName: TransitionName, time: number) {
      const shader = TRANSITION_SHADERS[transName]
      const prog = getProgram(shader)
      if (!prog) return
      renderPass(gl!, prog, w, h, imageTex, edgeMapTex, bgTex, time, 0.05, 1.0, 1.0, 1, 0, [1, 1, 1], 0)
    }

    const startTime = performance.now()

    const render = () => {
      const cfg = configRef.current
      const elapsed = (performance.now() - startTime) / 1000

      const hasTransition = cfg.transition !== null
      const hasEffect = cfg.borderEffect !== null || cfg.innerEffect !== null

      // Calculate total cycle duration
      const transDuration = hasTransition ? TRANSITION_DURATION : 0
      const effectDuration = hasEffect ? EFFECT_LOOP_DURATION : 0
      const totalCycle = STILL_DURATION + transDuration + effectDuration
      const phase = totalCycle > 0 ? elapsed % totalCycle : elapsed

      if (phase < STILL_DURATION) {
        // Still phase: show card
        if (hasEffect) {
          // Show effects during still phase too
          gl!.viewport(0, 0, w, h)
          gl!.clearColor(0, 0, 0, 0)
          gl!.clear(gl!.COLOR_BUFFER_BIT)
          if (cfg.borderEffect) {
            renderBorderEffect(cfg.borderEffect, phase)
          } else if (cfg.innerEffect) {
            renderInnerEffect(cfg.innerEffect, phase)
          } else {
            renderStatic()
          }
          // If both effects, render inner on top via readback + composite
          if (cfg.borderEffect && cfg.innerEffect) {
            // For simplicity, just show border effect during still
            // Inner overlay is blended in the shader
          }
        } else {
          renderStatic()
        }
      } else if (hasTransition && phase < STILL_DURATION + transDuration) {
        // Transition phase
        const t = phase - STILL_DURATION
        renderTransition(cfg.transition!, t)
      } else {
        // Effect loop phase (or transition done, no effects → show static)
        if (hasEffect) {
          const t = phase - STILL_DURATION - transDuration
          gl!.viewport(0, 0, w, h)
          gl!.clearColor(0, 0, 0, 0)
          gl!.clear(gl!.COLOR_BUFFER_BIT)
          if (cfg.borderEffect && cfg.innerEffect) {
            // Show border effect (includes image)
            renderBorderEffect(cfg.borderEffect, t)
          } else if (cfg.borderEffect) {
            renderBorderEffect(cfg.borderEffect, t)
          } else if (cfg.innerEffect) {
            renderInnerEffect(cfg.innerEffect, t)
          }
        } else {
          // No effects, transition done → clear canvas
          gl!.viewport(0, 0, w, h)
          gl!.clearColor(0, 0, 0, 0)
          gl!.clear(gl!.COLOR_BUFFER_BIT)
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
    }
  }, [canvasRef, image])
}
