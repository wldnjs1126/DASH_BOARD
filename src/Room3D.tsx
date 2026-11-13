import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute,
  Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry,
  Points, PointsMaterial, RingGeometry, Scene, Sprite, SpriteMaterial, WebGLRenderer,
} from 'three'
import type { Material } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FIXTURES, ROOM } from './room.ts'
import type { Risk, Sample } from './scenarios.ts'
import { SIGNAL_COLOR } from './visuals.tsx'

const dotCount = 128
const { width: roomWidth, depth: roomDepth } = ROOM
const { bed, wardrobe, cabinet, angledFixture, bathroom, entrance } = FIXTURES
const wallHeight = 2.5
const minZoom = .75
const maxZoom = 4
const clampZoom = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom))
const fract = (n: number) => n - Math.floor(n)
const pointSeeds = Array.from({ length: dotCount }, (_, i) => ({
  a: fract(Math.sin((i + 1) * 127.1) * 43758.5453),
  b: fract(Math.sin((i + 1) * 269.5) * 23421.631),
  c: fract(Math.sin((i + 1) * 72.31) * 27419.423),
}))

function cloudPoint(sample: Sample, seed: typeof pointSeeds[number], i: number) {
  const angle = seed.a * Math.PI * 2 + sample.timestamp * .24
  const radius = Math.sqrt(seed.b)
  const spread = .16 + .31 * Math.max(0, .8 - sample.z)
  const phase = sample.timestamp * 4 + i * .51
  return [
    sample.x + Math.cos(angle) * radius * spread + Math.sin(phase) * .028,
    Math.max(.04, sample.z - (.05 + .39 * sample.z) * seed.c + Math.cos(phase * .8) * .022),
    sample.y + Math.sin(angle) * radius * spread * 1.3 + Math.cos(phase) * .025,
  ] as const
}

function makeScene(host: HTMLDivElement, interactive: boolean) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new OrthographicCamera()
  camera.position.set(8.8, 6.2, 10.3)
  camera.lookAt(roomWidth / 2, .82, roomDepth / 2)
  const render = () => renderer.render(scene, camera)
  const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null
  if (controls) {
    controls.target.set(roomWidth / 2, .82, roomDepth / 2)
    controls.minZoom = minZoom
    controls.maxZoom = maxZoom
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI / 2
    controls.update()
    controls.saveState()
    controls.addEventListener('change', render)
  }

  function lines(vertices: number[], color: string, opacity = 1, segments = true) {
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const material = new LineBasicMaterial({ color, transparent: opacity < 1, opacity })
    const line = segments ? new LineSegments(geometry, material) : new Line(geometry, material)
    scene.add(line)
    return line
  }

  function floor(x: number, y: number, w: number, d: number, color: string, height: number, opacity = 1) {
    const mesh = new Mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ color, side: DoubleSide, transparent: opacity < 1, opacity }))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x + w / 2, height, y + d / 2)
    scene.add(mesh)
  }

  function box(x: number, y: number, w: number, d: number, height: number, color: string, elevation = 0) {
    const mesh = new Mesh(new BoxGeometry(w, height, d), new MeshBasicMaterial({ color }))
    mesh.position.set(x + w / 2, elevation + height / 2, y + d / 2)
    scene.add(mesh)
    return mesh
  }

  function label(text: string, x: number, y: number, z: number, color = '#466689') {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 56
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = color
    ctx.font = '700 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 64, 28)
    const map = new CanvasTexture(canvas)
    const sprite = new Sprite(new SpriteMaterial({ map, depthTest: false }))
    sprite.position.set(x, y, z)
    sprite.scale.set(.76, .32, 1)
    scene.add(sprite)
  }

  floor(0, 0, roomWidth, roomDepth, '#eaf2fa', -.025)
  floor(bathroom.x, roomDepth - .12, bathroom.width, .12, '#b8cedc', -.01)

  const grid: number[] = []
  for (let x = 0; x <= roomWidth; x += .25) grid.push(x, 0, 0, x, 0, roomDepth)
  for (let y = 0; y <= roomDepth; y += .25) grid.push(0, 0, y, roomWidth, 0, y)
  lines(grid, '#a8bdd6', .53)
  lines([
    0, 0, 0, roomWidth, 0, 0, roomWidth, 0, 0, roomWidth, 0, roomDepth,
    roomWidth, 0, roomDepth, bathroom.x + bathroom.width, 0, roomDepth,
    bathroom.x, 0, roomDepth, 0, 0, roomDepth,
    0, 0, roomDepth, 0, 0, entrance.y + entrance.depth, 0, 0, entrance.y, 0, 0, 0,
  ], '#8fa9c6')

  const walls: number[] = []
  for (let z = .5; z <= wallHeight; z += .5) walls.push(roomWidth, z, 0, 0, z, 0, 0, z, 0, 0, z, roomDepth)
  for (let x = 0; x <= roomWidth; x += .5) walls.push(x, 0, 0, x, wallHeight, 0)
  for (let y = .5; y <= roomDepth; y += .5) walls.push(0, 0, y, 0, wallHeight, y)
  lines(walls, '#9fb7d0', .34)
  lines([0, 0, 0, 0, wallHeight, 0, 0, 0, roomDepth, 0, wallHeight, roomDepth], '#8da9c5', .72)
  label('X', roomWidth + .16, .01, roomDepth + .18, '#4e84ba')
  label('Y', roomWidth + .18, .01, -.15, '#397f83')
  label('Z', 0, wallHeight + .15, roomDepth, '#4e84ba')
  for (const n of [0, .5, 1, 1.5, 2, 2.5]) label(n.toFixed(1), -.23, n, roomDepth)

  box(bed.x, bed.y, bed.width, bed.depth, bed.height - .1, '#b7cad8')
  box(bed.x, bed.y, bed.width, bed.depth, .1, '#e5eef4', bed.height - .1)
  for (const offset of [.08, .78]) box(bed.x + 1.49, bed.y + offset, .36, .63, .075, '#fffefe', bed.height)
  for (let i = 0; i < 5; i++) {
    box(wardrobe.x + wardrobe.width * i / 5, wardrobe.y, wardrobe.width / 5 - .016, wardrobe.depth, 1.65, '#d4dee5')
  }
  box(cabinet.x, cabinet.y, cabinet.width, cabinet.depth, .55, '#99bccc')
  box(angledFixture.x - angledFixture.width / 2, angledFixture.y - angledFixture.depth / 2,
    angledFixture.width, angledFixture.depth, .28, '#c0d1da').rotation.y = -angledFixture.angle * Math.PI / 180

  const array = new Float32Array(dotCount * 3)
  const dotGeometry = new BufferGeometry()
  const positions = new BufferAttribute(array, 3)
  dotGeometry.setAttribute('position', positions)
  const dotCanvas = document.createElement('canvas')
  dotCanvas.width = dotCanvas.height = 32
  const context = dotCanvas.getContext('2d')
  if (context) {
    context.fillStyle = '#fff'
    context.beginPath()
    context.arc(16, 16, 14, 0, Math.PI * 2)
    context.fill()
  }
  const dotMap = new CanvasTexture(dotCanvas)
  const dots = new Points(dotGeometry, new PointsMaterial({
    color: SIGNAL_COLOR.normal, map: dotMap, size: 2.55, sizeAttenuation: false, opacity: .87, transparent: true,
    alphaTest: .08, depthWrite: false,
  }))
  dots.frustumCulled = false
  scene.add(dots)

  const vertical = lines([0, 0, 0, 0, 1, 0], SIGNAL_COLOR.normal, .76, false)
  const verticalPosition = vertical.geometry.getAttribute('position')
  vertical.frustumCulled = false
  const ring = new Mesh(new RingGeometry(.12, .15, 36), new MeshBasicMaterial({ color: SIGNAL_COLOR.normal, side: DoubleSide, transparent: true, opacity: .7 }))
  ring.rotation.x = -Math.PI / 2
  scene.add(ring)
  const color = new Color()

  function update(sample: Sample, risk: Risk) {
    dots.visible = ring.visible = vertical.visible = sample.presence
    if (sample.presence) {
      for (let i = 0; i < dotCount; i++) positions.setXYZ(i, ...cloudPoint(sample, pointSeeds[i], i))
      positions.needsUpdate = true
      color.set(SIGNAL_COLOR[risk])
      dots.material.color.copy(color)
      ring.material.color.copy(color)
      vertical.material.color.copy(color)
      verticalPosition.setXYZ(0, sample.x, 0, sample.y)
      verticalPosition.setXYZ(1, sample.x, sample.z, sample.y)
      verticalPosition.needsUpdate = true
      ring.position.set(sample.x, .015, sample.y)
    }
    render()
  }

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    const aspect = width / height
    const halfHeight = Math.max(2.49, 2.92 / aspect)
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  function dispose() {
    observer.disconnect()
    controls?.removeEventListener('change', render)
    controls?.dispose()
    scene.traverse((object) => {
      if ('geometry' in object && object.geometry instanceof BufferGeometry) object.geometry.dispose()
      if ('material' in object) {
        const material = object.material as Material & { map?: CanvasTexture }
        material.map?.dispose()
        material.dispose()
      }
    })
    renderer.dispose()
    renderer.domElement.remove()
  }
  return {
    update, dispose, canvas: renderer.domElement,
    zoomBy(factor: number) {
      camera.zoom = clampZoom(camera.zoom * factor)
      camera.updateProjectionMatrix()
      render()
    },
    resetView: () => controls?.reset(),
  }
}

const project = (x: number, z: number, y: number) => [155 + x * 33 - y * 19, 140 + x * 13 + y * 10 - z * 43] as const
const position = (x: number, z: number, y: number) => project(x, z, y).join(',')

function Fallback({ sample, risk, zoom }: { sample: Sample; risk: Risk; zoom: number }) {
  const color = SIGNAL_COLOR[risk]
  const width = 220 / zoom
  const height = 216 / zoom
  return <svg viewBox={`${163 - width / 2} ${130 - height / 2} ${width} ${height}`} className="room-fallback" aria-label="병실 공간과 센서 점군의 등각 투영" role="img">
    <polygon points={`${position(0, 0, 0)} ${position(roomWidth, 0, 0)} ${position(roomWidth, 0, roomDepth)} ${position(0, 0, roomDepth)}`} fill="#ecf4fc" />
    {Array.from({ length: Math.floor(roomDepth * 2) + 1 }, (_, i) => i / 2).map(y =>
      <polyline key={y} points={`${position(roomWidth, 0, y)} ${position(0, 0, y)} ${position(0, wallHeight, y)}`} fill="none" stroke="#b8cbe1" strokeWidth=".7" />
    )}
    {Array.from({ length: Math.floor(roomWidth * 2) + 1 }, (_, i) => i / 2).map(x =>
      <polyline key={x} points={`${position(x, 0, roomDepth)} ${position(x, 0, 0)} ${position(x, wallHeight, 0)}`} fill="none" stroke="#b8cbe1" strokeWidth=".7" />
    )}
    {[0, .5, 1, 1.5, 2, 2.5].map(z =>
      <polyline key={z} points={`${position(0, z, roomDepth)} ${position(0, z, 0)} ${position(roomWidth, z, 0)}`} fill="none" stroke="#b8cbe1" strokeWidth=".7" />
    )}
    <polygon points={`${position(bed.x, bed.height, bed.y)} ${position(bed.x + bed.width, bed.height, bed.y)} ${position(bed.x + bed.width, bed.height, bed.y + bed.depth)} ${position(bed.x, bed.height, bed.y + bed.depth)}`} fill="#d9e6f3" stroke="#aac2dc" />
    <text x="62" y="78">Z</text><text x="176" y="231">X</text><text x="252" y="183">Y</text>
    {sample.presence && <>
      <polyline points={`${position(sample.x, 0, sample.y)} ${position(sample.x, sample.z, sample.y)}`} stroke={color} fill="none" strokeDasharray="3 2" />
      {pointSeeds.map((seed, i) => {
        const [cx, cy] = project(...cloudPoint(sample, seed, i))
        return <circle key={i} cx={cx} cy={cy} r={i % 5 === 0 ? 1.3 : .72} fill={color} opacity={.45 + seed.c * .5} />
      })}
    </>}
  </svg>
}

export function Room3D({ sample, risk, interactive = false }: { sample: Sample; risk: Risk; interactive?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<ReturnType<typeof makeScene> | null>(null)
  const [fallback, setFallback] = useState(false)
  const [fallbackZoom, setFallbackZoom] = useState(1)

  useEffect(() => {
    if (!host.current) return
    try {
      scene.current = makeScene(host.current, interactive)
    } catch {
      setFallback(true)
      return
    }
    const active = scene.current
    const onLost = (event: Event) => {
      event.preventDefault()
      setFallback(true)
    }
    const onRestored = () => setFallback(false)
    active.canvas.addEventListener('webglcontextlost', onLost)
    active.canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      active.canvas.removeEventListener('webglcontextlost', onLost)
      active.canvas.removeEventListener('webglcontextrestored', onRestored)
      active.dispose()
      scene.current = null
    }
  }, [interactive])

  useEffect(() => {
    if (!fallback) scene.current?.update(sample, risk)
  }, [sample, risk, fallback])

  function zoomBy(factor: number) {
    if (fallback) setFallbackZoom(current => clampZoom(current * factor))
    else scene.current?.zoomBy(factor)
  }

  function resetView() {
    setFallbackZoom(1)
    if (!fallback) scene.current?.resetView()
  }

  return <div className={`room-stage${interactive ? ' room-stage-interactive' : ''}`} role="group" aria-label="센서 점군과 X·Y·Z 축">
    <div ref={host} className={`room-canvas ${fallback ? 'is-hidden' : ''}`} data-engine={fallback ? 'svg' : 'three'} />
    {fallback && <Fallback sample={sample} risk={risk} zoom={fallbackZoom} />}
    <div className="cloud-key"><span style={{ background: SIGNAL_COLOR[risk] }} /> 센서 측정 점군</div>
    {interactive && <div className="room-controls" role="group" aria-label="점군 보기 조작">
      <button className="icon-button" type="button" aria-label="점군 확대" title="점군 확대" onClick={() => zoomBy(1.25)}><Plus size={18} /></button>
      <button className="icon-button" type="button" aria-label="점군 축소" title="점군 축소" onClick={() => zoomBy(.8)}><Minus size={18} /></button>
      <button className="icon-button" type="button" aria-label="기본 시점으로 돌아가기" title="기본 시점으로 돌아가기" onClick={resetView}><RotateCcw size={16} /></button>
    </div>}
    {fallback ? <span className="fallback-label">등각 투영 모드</span> : interactive && <span className="room-hint">드래그로 회전 · 휠 또는 두 손가락으로 확대</span>}
    <div className="height-key"><span>Z</span> {sample.presence ? sample.z.toFixed(2) + ' m' : '—'}</div>
  </div>
}
