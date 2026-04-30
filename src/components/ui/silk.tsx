'use client'

import { useEffect, useRef } from 'react'

interface SilkProps {
  speed?: number
  scale?: number
  color?: string
  noiseIntensity?: number
  rotation?: number
}

function hexToVec3(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const VERT_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec3  u_color;
uniform float u_speed;
uniform float u_scale;
uniform float u_noiseIntensity;
uniform float u_rotation;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value     += amplitude * gnoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  uv *= u_scale;

  float c = cos(u_rotation);
  float s = sin(u_rotation);
  uv = mat2(c, -s, s, c) * uv;

  float t = u_time * u_speed * 0.15;

  vec2 q = vec2(
    fbm(uv + vec2(0.0, 0.0) + t),
    fbm(uv + vec2(5.2, 1.3) + t)
  );

  vec2 r = vec2(
    fbm(uv + u_noiseIntensity * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(uv + u_noiseIntensity * q + vec2(8.3, 2.8) + 0.126 * t)
  );

  float f = fbm(uv + u_noiseIntensity * r);

  vec3 col = mix(vec3(0.04, 0.04, 0.04), u_color, clamp(f * f * 4.0, 0.0, 1.0));
  col = mix(col, u_color * 0.85, clamp(length(q), 0.0, 1.0));
  col = mix(col, u_color * 1.1, f * f * f);

  gl_FragColor = vec4(col, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Silk shader compile error: ${log}`)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  const prog = gl.createProgram()!
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Silk program link error: ${gl.getProgramInfoLog(prog)}`)
  }
  return prog
}

export function Silk({
  speed = 5,
  scale = 1.1,
  color = '#3B82F6',
  noiseIntensity = 1.7,
  rotation = 0,
}: SilkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = 'ontouchstart' in window
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio ?? 1, 2)

    let program: WebGLProgram
    try {
      program = createProgram(gl)
    } catch {
      return
    }

    gl.useProgram(program)

    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const aPos = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime     = gl.getUniformLocation(program, 'u_time')
    const uRes      = gl.getUniformLocation(program, 'u_resolution')
    const uColor    = gl.getUniformLocation(program, 'u_color')
    const uSpeed    = gl.getUniformLocation(program, 'u_speed')
    const uScale    = gl.getUniformLocation(program, 'u_scale')
    const uNoise    = gl.getUniformLocation(program, 'u_noiseIntensity')
    const uRotation = gl.getUniformLocation(program, 'u_rotation')

    const [r, g, b] = hexToVec3(color)
    gl.uniform3f(uColor, r, g, b)
    gl.uniform1f(uSpeed, speed)
    gl.uniform1f(uScale, scale)
    gl.uniform1f(uNoise, noiseIntensity)
    gl.uniform1f(uRotation, rotation)

    function resize() {
      if (!canvas) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width  = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl!.viewport(0, 0, canvas.width, canvas.height)
      gl!.uniform2f(uRes, canvas.width, canvas.height)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let rafId = 0
    const startTime = performance.now()

    function render() {
      const t = (performance.now() - startTime) * 0.001
      gl!.uniform1f(uTime, t)
      gl!.drawArrays(gl!.TRIANGLES, 0, 6)
      if (!reduceMotion) rafId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
