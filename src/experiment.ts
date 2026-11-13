import type { CareEvent, Level, RoomRecord } from './institutionData.ts'

export const EXPERIMENT_DATE = '2026-11-12'
export const EXPERIMENT_START = '00:00:00'

const TYPES = {
  MOVEMENT: '움직임', PRESENCE: '재실', ABSENCE: '부재', BED_STAY: '침대 체류', SLEEP: '수면 추정',
  NIGHT_EXIT: '야간이탈', INACTIVITY: '장시간 미움직임', FALL_SUSPECTED: '낙상 의심',
} as const
const ZONES = { ROOM: '방', BED: '침대 구역', OUTSIDE: '방 밖', EXIT: '출입구' } as const
type EventType = keyof typeof TYPES
type SecondsRange = readonly [start: number, end: number]
type ExperimentEvent = {
  id: number; type: EventType; start: number; detected: number | null; end: number | null
  duration: number | null; zone: keyof typeof ZONES | null
}
export type ExperimentRecording = {
  id: 'A' | 'B' | 'C' | 'D'; duration: number; occupied: boolean; gaps: SecondsRange[]; events: ExperimentEvent[]
  profile?: { age: string; gender: string; height: number; weight: number }
}

export function experimentClock(seconds: number) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(Math.floor(seconds) % 60)}`
}

export function experimentDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const remainder = Math.floor(seconds) % 60
  return [hours && `${hours}시간`, minutes && `${minutes}분`, remainder && `${remainder}초`].filter(Boolean).join(' ') || '0초'
}

function eventLevel(type: EventType): Level {
  if (type === 'FALL_SUSPECTED') return 'danger'
  if (type === 'NIGHT_EXIT' || type === 'INACTIVITY') return 'caution'
  return 'normal'
}

export function experimentEvents(recording: ExperimentRecording): CareEvent[] {
  return recording.events.map<CareEvent>(event => ({
    id: `experiment-${recording.id}-${event.id}`, room: recording.id, date: EXPERIMENT_DATE,
    time: experimentClock(event.start), detectedTime: event.detected === null ? undefined : experimentClock(event.detected),
    type: TYPES[event.type], duration: event.duration === null ? '종료 미기록' : experimentDuration(event.duration),
    level: eventLevel(event.type), confirmed: false, sms: 'unknown', retries: null,
    location: event.zone ? ZONES[event.zone] : '기록 없음',
    note: event.detected === null ? '감지 시각 미기록' : `감지 시각 ${experimentClock(event.detected)}`,
  })).sort((left, right) => right.time.localeCompare(left.time))
}

export const isExperimentAlert = (event: CareEvent) => event.level === 'danger' || event.level === 'caution'

export function experimentRooms(recordings: ExperimentRecording[]): RoomRecord[] {
  return recordings.map((recording, index) => {
    const alerts = experimentEvents(recording).filter(isExperimentAlert)
    const danger = alerts.filter(event => event.level === 'danger').length
    const caution = alerts.length - danger
    const summary = [danger && `낙상 의심 ${danger}건`, caution && `주의 이벤트 ${caution}건`].filter(Boolean).join(', ')
    return { id: recording.id, label: `${101 + index}호`, name: recording.id, age: null, gender: '', height: null, weight: null, ...recording.profile, occupied: recording.occupied, online: false,
      level: danger ? 'danger' : caution ? 'caution' : 'normal', reason: summary ? `실증 기록에서 ${summary}이 확인됐습니다.` : '실증 기록에서 주의·위험 이벤트가 확인되지 않았습니다.' }
  })
}

export const EXPERIMENT_TIMELINE_LABELS = {
  activity: '움직임', bed: '침대 체류', sleep: '수면 추정', away: '부재·야간이탈', offline: '데이터 미수신',
  presence: '재실', still: '장시간 미움직임',
} as const
type Kind = keyof typeof EXPERIMENT_TIMELINE_LABELS
type Segment = { start: number; end: number; kind: Kind }
const layers: readonly [Kind, EventType[]][] = [
  ['offline', []], ['away', ['ABSENCE', 'NIGHT_EXIT']], ['sleep', ['SLEEP']], ['activity', ['MOVEMENT']],
  ['still', ['INACTIVITY']], ['bed', ['BED_STAY']], ['presence', ['PRESENCE']],
]

export function experimentDay(recording: ExperimentRecording) {
  const bounds = (event: ExperimentEvent): SecondsRange | null => {
    const end = Math.min(recording.duration, event.end ?? event.start + (event.duration ?? 0))
    const start = Math.max(0, event.start)
    return start < end ? [start, end] : null
  }
  const ranges = (types: EventType[]) => recording.events.filter(event => types.includes(event.type)).flatMap(event => {
    const range = bounds(event)
    return range ? [range] : []
  })
  const tracks = layers.map(([kind, types]) => ({ kind, ranges: kind === 'offline' ? recording.gaps : ranges(types) }))
  const boundaries = [...new Set(tracks.flatMap(track => track.ranges.flat()))].sort((a, b) => a - b)
  const segments: Segment[] = []
  for (let index = 1; index < boundaries.length; index++) {
    const start = boundaries[index - 1]
    const end = boundaries[index]
    const kind = tracks.find(track => track.ranges.some(([from, to]) => from <= start && end <= to))?.kind
    if (!kind) continue
    const previous = segments.at(-1)
    if (previous?.kind === kind && previous.end === start) previous.end = end
    else segments.push({ start, end, kind })
  }

  function total(types: EventType[]) {
    let cursor = 0
    let sum = 0
    for (const [start, end] of ranges(types).sort(([a], [b]) => a - b)) {
      sum += Math.max(0, end - Math.max(cursor, start))
      cursor = Math.max(cursor, end)
    }
    return sum
  }

  return { segments, activity: total(['MOVEMENT']), bed: total(['BED_STAY', 'SLEEP']), sleep: total(['SLEEP']),
    exits: recording.events.filter(event => event.type === 'NIGHT_EXIT').length }
}

export async function loadExperiment(): Promise<ExperimentRecording[] | null> {
  const path = import.meta.env.DEV ? '/__local-experiment' : `${import.meta.env.BASE_URL}experiment-records.json`
  const response = await fetch(path)
  return response.ok ? response.json() : null
}
