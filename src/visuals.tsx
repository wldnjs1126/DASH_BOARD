import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X as CloseIcon } from 'lucide-react'
import { FIXTURES, ROOM, ROOM_SIZE } from './room.ts'
import type { Detection, Risk, Sample } from './scenarios.ts'

export const SIGNAL_COLOR: Record<Risk, string> = { normal: '#16a7c6', caution: '#e88720', danger: '#ed535e' }
const PLAN_SCALE = 100
const X = (x: number) => 42 + x * PLAN_SCALE
const Y = (y: number) => 32 + y * PLAN_SCALE

export function PanelHeading({ icon, children, suffix }: { icon: ReactNode; children: ReactNode; suffix?: ReactNode }) {
  return <div className="panel-heading">
    <h2>{icon}{children}</h2>
    {suffix}
  </div>
}

type FloorPlanProps = { sample: Sample; history: Sample[]; risk: Risk }

export function FloorPlan({ sample, history, risk }: FloorPlanProps) {
  const pattern = useId()
  const marker = SIGNAL_COLOR[risk]
  const path = history.reduce((result, point, index) => {
    if (!point.presence) return result
    const command = index > 0 && history[index - 1].presence ? 'L' : 'M'
    return result + `${command}${X(point.x).toFixed(2)},${Y(point.y).toFixed(2)} `
  }, '')
  const { bed, wardrobe, bathroom, entrance, cabinet, angledFixture } = FIXTURES
  const left = X(0)
  const right = X(ROOM.width)
  const top = Y(0)
  const bottom = Y(ROOM.depth)
  const middle = X(ROOM.width / 2)
  const bathroomEnd = X(bathroom.x + bathroom.width)
  const entranceRadius = entrance.depth * PLAN_SCALE
  return <svg className="floor-plan field-plan" viewBox="0 0 374 550" role="img" aria-label={`${ROOM_SIZE} 실증 공간 배치도와 이동 경로`}>
    <defs>
      <pattern id={pattern} width="8" height="16" patternUnits="userSpaceOnUse">
        <path d="M8 0H0V16" fill="none" stroke="#d4e4f2" strokeWidth=".55" />
      </pattern>
    </defs>
    <rect x={left} y={top} width={ROOM.width * PLAN_SCALE} height={ROOM.depth * PLAN_SCALE} fill="#f1f7fc" />
    <rect x={left} y={top} width={ROOM.width * PLAN_SCALE} height={ROOM.depth * PLAN_SCALE} fill={`url(#${pattern})`} />
    <path d={`M${left} ${Y(entrance.y)}V${top}H${right}V${bottom}H${bathroomEnd} M${X(bathroom.x)} ${bottom}H${left}`}
      fill="none" stroke="#7796b1" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
    <path d={`M${left} ${Y(entrance.y)}v${entranceRadius}`} stroke="#b7cadd" strokeWidth="4" />
    <path d={`M${left} ${Y(entrance.y)}a${entranceRadius} ${entranceRadius} 0 0 1 ${entranceRadius} ${entranceRadius}`}
      fill="none" stroke="#8aa7bf" strokeWidth="1.7" strokeDasharray="4 4" />
    <rect x={X(bathroom.x)} y={bottom - 6} width={bathroom.width * PLAN_SCALE} height="12" fill="#f3effc" stroke="#a698c4" strokeWidth="1.6" />
    <path d={`M${X(bathroom.x + .08)} ${bottom}v18`} stroke="#a698c4" strokeWidth="1.6" />
    <g fill="#e3edf6" stroke="#a8bfd3" strokeWidth="1.2">
      {Array.from({ length: 5 }, (_, i) => <rect key={i} x={X(wardrobe.x + wardrobe.width * i / 5)} y={Y(wardrobe.y)}
        width={wardrobe.width * PLAN_SCALE / 5} height={wardrobe.depth * PLAN_SCALE} />)}
    </g>
    <rect x={X(bed.x)} y={Y(bed.y)} width={bed.width * PLAN_SCALE} height={bed.depth * PLAN_SCALE}
      rx="12" fill="#fff" stroke="#9dbdd9" strokeWidth="2.2" />
    <rect x={X(bed.x + .15)} y={Y(bed.y + .17)} width="123" height="110" rx="8" fill="#e7f2fb" />
    {[.08, .78].map(offset => <rect key={offset} x={X(bed.x + 1.49)} y={Y(bed.y + offset)}
      width="36" height="63" rx="9" fill="#f5faff" stroke="#bfd3e7" />)}
    <rect x={X(cabinet.x)} y={Y(cabinet.y)} width={cabinet.width * PLAN_SCALE} height={cabinet.depth * PLAN_SCALE}
      rx="4" fill="#c8ddeb" stroke="#9ab7ce" />
    <rect x={X(cabinet.x) - 8} y={Y(cabinet.y) + 13} width="10" height="27" rx="3" fill="#cadbe3" />
    <rect x={X(angledFixture.x) - angledFixture.width * PLAN_SCALE / 2} y={Y(angledFixture.y) - angledFixture.depth * PLAN_SCALE / 2}
      width={angledFixture.width * PLAN_SCALE} height={angledFixture.depth * PLAN_SCALE} rx="3" fill="#d4dde3" stroke="#9daebb"
      transform={`rotate(${angledFixture.angle} ${X(angledFixture.x)} ${Y(angledFixture.y)})`} />
    <g className="field-plan-label" textAnchor="middle">
      <text x={middle} y="20">가로 (X) {ROOM.width.toFixed(2)} m</text>
      <text x="16" y="270" transform="rotate(-90 16 270)">세로 (Y) {ROOM.depth.toFixed(2)} m</text>
      <text x={middle} y={Y(.31)}>붙박이장</text>
      <text x={X(1.72)} y={Y(1.45)}>침대</text>
      <text x={X(1.72)} y={Y(1.65)} className="field-plan-detail">약 2.0 × 1.5 m</text>
      <text x={X(.56)} y={Y(3.27)} className="field-plan-detail">출입문</text>
      <text x={X(bathroom.x + bathroom.width / 2)} y={bottom + 35}>화장실</text>
      <text x={X(bathroom.x + bathroom.width / 2)} y={bottom + 53} className="field-plan-detail">출입문 폭 {bathroom.width.toFixed(2)} m</text>
    </g>
    <path d={path} fill="none" stroke="#12abc0" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
    {history.filter((point, i) => point.presence && i % 18 === 0).map(point =>
      <circle key={point.timestamp} cx={X(point.x)} cy={Y(point.y)} r="2.7" fill="#fff" stroke="#12abc0" strokeWidth="1.25" />
    )}
    {sample.presence && <g transform={`translate(${X(sample.x)} ${Y(sample.y)})`}>
      <circle r="12" fill={marker} opacity=".18" />
      <circle className="plan-pulse" r="11" fill="none" stroke={marker} strokeWidth="1.5" />
      <circle r="5.8" fill={marker} stroke="white" strokeWidth="2" />
    </g>}
    <g transform="translate(112 539)" className="field-plan-detail">
      <circle cy="-4" r="4.5" fill={marker} /><text x="9">감지 위치</text>
      <path d="M72 -4h14" stroke="#12abc0" strokeWidth="2" strokeDasharray="4 2" /><text x="91">이동 경로</text>
    </g>
  </svg>
}

export function ViewDialog({ title, closeLabel, close, children, wide = false }: {
  title: string; closeLabel: string; close: () => void; children: ReactNode; wide?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className={`view-dialog${wide ? ' view-dialog-wide' : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}>
    <header><h2 id={titleId}>{title}</h2>
      <button className="icon-button" type="button" onClick={close} aria-label={closeLabel} autoFocus><CloseIcon size={17} /></button>
    </header>
    {children}
  </dialog>
}

export function SignalChart({ label, unit, color, max, history, field, duration, detection, elapsed, icon }: {
  label: string
  unit: string
  color: string
  max: number
  history: Sample[]
  field: 'intensity' | 'z' | 'speed'
  duration: number
  detection: Detection | null
  elapsed: number
  icon: ReactNode
}) {
  const gradient = useId()
  const value = history.at(-1)?.[field] ?? 0
  const w = 400
  const h = 104
  const left = 32
  const right = 386
  const top = 12
  const bottom = 80
  const x = (t: number) => left + (right - left) * t / duration
  const y = (v: number) => bottom - (bottom - top) * Math.min(v / max, 1)
  const line = history.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.timestamp).toFixed(2)},${y(point[field]).toFixed(2)}`).join(' ')
  const area = `${line} L${x(elapsed)},${bottom} H${left} Z`
  const warning = detection && detection.risk !== 'normal'
  const eventX = detection ? x(detection.sample.timestamp) : 0
  return <article className="panel chart-panel" aria-label={label}>
    <PanelHeading icon={icon}>
      {label}
    </PanelHeading>
    <output className="chart-reading" style={{ color }} aria-live="off">{value.toFixed(2)} <small>{unit}</small></output>
    <svg className="signal-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label} 시계열`}>
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor={color} stopOpacity=".2" />
          <stop offset="1" stopColor={color} stopOpacity=".025" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}>
        <line x1={left} x2={right} y1={y(max * i / 4)} y2={y(max * i / 4)} className="chart-guide" />
        <text x={left - 6} y={y(max * i / 4) + 3} textAnchor="end">{(max * i / 4).toFixed(max === 2 ? 1 : 2)}</text>
        <line x1={x(duration * i / 4)} x2={x(duration * i / 4)} y1={top} y2={bottom} className="chart-guide" />
        <text x={x(duration * i / 4)} y="98" textAnchor="middle">{Number((duration * i / 4).toFixed(1))}s</text>
      </g>)}
      {history.length > 1 && <path d={area} fill={`url(#${gradient})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <line x1={x(elapsed)} x2={x(elapsed)} y1={top} y2={bottom} stroke={color} strokeOpacity=".23" />
      <circle cx={x(elapsed)} cy={y(value)} r="3.25" fill={color} stroke="white" strokeWidth="1.15" />
      {warning && <g style={{ color: SIGNAL_COLOR[detection.risk] }}>
        <line x1={eventX} x2={eventX} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1.3" strokeDasharray="4 3" />
        <rect x={eventX - 17} y="0" width="34" height="12" rx="4" fill="currentColor" fillOpacity=".13" />
        <text x={eventX} y="9" textAnchor="middle" className="event-tick">감지</text>
      </g>}
    </svg>
  </article>
}
