export const INSTITUTION_DATE = '2026-11-13'
export const PREVIOUS_DATE = '2026-11-12'
export const LEVEL_LABELS = { normal: '정상', watch: '관찰', caution: '주의', danger: '위험', unknown: '판별 불가' } as const
export type Level = keyof typeof LEVEL_LABELS
export type RoomRecord = {
  id: string; label?: string; name: string; age: number | null; gender: string; height: number | null; weight: number | null
  guardian?: string; guardianPhone?: string
  level: Level; occupied: boolean; online: boolean; reason: string
}

export const roomLabel = (room: RoomRecord) => room.label ?? `${room.id}호`
export const roomHref = (roomId: string) => `#room/${roomId}`
export const isDemoRoom = (roomId: string) => ROOMS.some(room => room.id === roomId)

export const ROOMS: readonly RoomRecord[] = [
  { id: '201', name: '이순자', age: 84, gender: '여성', height: 151, weight: 49, level: 'danger', occupied: true, online: true, reason: '이동 중 높이가 급격히 낮아진 뒤 바닥 가까이에서 움직임이 감소했습니다.' },
  { id: '202', name: '정만수', age: 79, gender: '남성', height: 168, weight: 65, level: 'watch', occupied: true, online: true, reason: '오전 활동 시간이 평소보다 조금 짧았습니다.' },
  { id: '203', name: '김영자', age: 82, gender: '여성', height: 154, weight: 52, level: 'caution', occupied: true, online: true, reason: '최근 2시간 동안 평소보다 침대 체류가 길고 움직임이 감소했습니다.' },
  { id: '204', name: '윤복자', age: 81, gender: '여성', height: 157, weight: 55, level: 'normal', occupied: true, online: true, reason: '활동과 휴식이 평소 생활패턴 범위에 있습니다.' },
  { id: '205', name: '최복례', age: 83, gender: '여성', height: 153, weight: 50, level: 'normal', occupied: true, online: true, reason: '이전 주의 신호 이후 활동이 평소 범위로 돌아왔습니다.' },
  { id: '206', name: '오경수', age: 80, gender: '남성', height: 165, weight: 62, level: 'watch', occupied: true, online: true, reason: '침대에서 일어난 시간이 평소보다 늦었습니다.' },
  { id: '207', name: '조순희', age: 78, gender: '여성', height: 155, weight: 53, level: 'normal', occupied: true, online: true, reason: '활동과 휴식이 평소 생활패턴 범위에 있습니다.' },
  { id: '208', name: '박정숙', age: 86, gender: '여성', height: 150, weight: 47, level: 'watch', occupied: true, online: true, reason: '장시간 미움직임 이후 움직임이 다시 감지돼 관찰 중입니다.' },
  { id: '209', name: '임성호', age: 77, gender: '남성', height: 170, weight: 68, level: 'unknown', occupied: false, online: false, reason: '센서 데이터가 들어오지 않아 현재 상태를 판별할 수 없습니다.' },
  { id: '210', name: '한상철', age: 85, gender: '남성', height: 163, weight: 60, level: 'caution', occupied: true, online: true, reason: '평소보다 야간이탈이 잦아 생활 변화를 확인해야 합니다.' },
]

export const SMS_LABELS = { sent: '발송 완료', failed: '발송 실패', none: '미발송' } as const
export type CareEvent = {
  id: string; room: string; date: string; time: string; type: string; duration: string
  level: Level; confirmed: boolean; sms: keyof typeof SMS_LABELS; retries: number; location: string; note: string
}

export const ALERTS: readonly CareEvent[] = [
  { id: 'fall-203', room: '203', date: INSTITUTION_DATE, time: '14:32:07', type: '낙상 의심', duration: '1분', level: 'danger', confirmed: false, sms: 'sent', retries: 2, location: '침실 · 활동 구역', note: '높이와 움직임이 급격히 감소한 구간이 감지되었습니다.' },
  { id: 'still-208', room: '208', date: INSTITUTION_DATE, time: '14:18:36', type: '장시간 움직임 없음', duration: '48분', level: 'caution', confirmed: false, sms: 'sent', retries: 1, location: '침실 · 침대 구역', note: '평소 활동 시간대에 움직임이 장시간 감지되지 않았습니다.' },
  { id: 'bed-201', room: '201', date: INSTITUTION_DATE, time: '13:54:20', type: '침대 이탈', duration: '8분', level: 'watch', confirmed: true, sms: 'none', retries: 0, location: '침실 · 침대 구역', note: '대상자가 침대 구역에서 벗어났습니다.' },
  { id: 'activity-205', room: '205', date: INSTITUTION_DATE, time: '13:27:42', type: '활동량 급감', duration: '42분', level: 'caution', confirmed: false, sms: 'failed', retries: 1, location: '침실 · 활동 구역', note: '같은 시간대의 평소 활동량보다 움직임이 크게 줄었습니다.' },
  { id: 'motion-210', room: '210', date: INSTITUTION_DATE, time: '12:46:00', type: '비정상 움직임 감지', duration: '5분', level: 'watch', confirmed: true, sms: 'none', retries: 0, location: '침실 · 출입구', note: '출입구 근처에서 평소와 다른 움직임이 기록되었습니다.' },
]

function history(room: string, id: string, time: string, type: string, duration: string, level: Level, note: string, date = INSTITUTION_DATE): CareEvent {
  return { room, id, time, type, duration, level, note, date, confirmed: true, sms: 'none', retries: 0, location: '침실 · 침대 구역' }
}

const roomHistory = [
  { ...history('203', 'long-bed-203', '13:08:12', '침대 체류', '1시간 22분', 'caution', '평소 낮 시간 평균보다 긴 침대 체류가 감지되었습니다.'), confirmed: false },
  history('203', 'signal-203', '07:31:05', '데이터 미수신', '54분', 'watch', '일시적으로 센서 데이터가 수신되지 않았습니다.'),
  history('203', 'night-203', '02:04:48', '야간 이탈', '43분', 'caution', '야간 시간대에 침대 구역을 벗어났습니다.'),
  history('203', 'fall-before-203', '18:42:30', '낙상 의심', '1분', 'danger', '이동 높이의 급격한 변화가 감지되었습니다.', PREVIOUS_DATE),
  history('203', 'still-before-203', '10:37:11', '미움직임', '38분', 'normal', '휴식 시간 동안 움직임이 줄었습니다.', PREVIOUS_DATE),
  history('201', 'fall-201', '14:30:12', '낙상 의심', '2분', 'danger', '바닥 가까이에서 움직임이 감소했습니다.'),
  history('209', 'signal-209', '13:48:02', '데이터 미수신', '44분', 'watch', '장비의 마지막 응답 이후 데이터가 수신되지 않고 있습니다.'),
]

export function getRoomHistory(roomId: string) {
  return [...ALERTS, ...roomHistory].filter(event => event.room === roomId)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}

export function getFacilityStats(rooms: readonly RoomRecord[] = ROOMS) {
  const roomIds = new Set(rooms.map(room => room.id))
  const majorAlerts = [...ALERTS, ...roomHistory.filter(event => event.id === 'fall-201')]
  return {
    total: rooms.filter(room => room.name).length,
    occupied: rooms.filter(room => room.occupied).length,
    alerts: majorAlerts.filter(event => roomIds.has(event.room) && event.date === INSTITUTION_DATE && (event.level === 'danger' || event.level === 'caution')).length,
    atRisk: rooms.filter(room => room.level === 'danger').length,
  }
}

export const TIMELINE_LABELS = { activity: '활동', bed: '침대 체류', sleep: '수면 추정', away: '부재', offline: '데이터 미수신' } as const
type TimelineKind = keyof typeof TIMELINE_LABELS
type Interval = { start: number; end: number; kind: TimelineKind }

export function getRoomDay(room: RoomRecord, date: string) {
  if (!isDemoRoom(room.id)) return { segments: [] as Interval[], activity: 0, bed: 0, sleep: 0, exits: 0 }
  const offset = Number(room.id) - 203 + (date === PREVIOUS_DATE ? -7 : 0)
  const first = 90 + offset * 2
  const second = 390 + offset * 3
  const morningActivity = 60 + offset * 2
  const afternoonActivity = 158 - offset * 3
  const offline = !room.online && date === INSTITUTION_DATE
  const segments: Interval[] = [
    { start: 0, end: first, kind: 'sleep' }, { start: first, end: first + 30, kind: 'activity' },
    { start: first + 30, end: first + 90, kind: 'away' }, { start: first + 90, end: second, kind: 'sleep' },
    { start: second, end: second + morningActivity, kind: 'activity' }, { start: second + morningActivity, end: second + 112, kind: 'offline' },
    { start: second + 112, end: second + 112 + afternoonActivity, kind: 'activity' }, { start: second + 112 + afternoonActivity, end: second + 358, kind: 'bed' },
    { start: second + 358, end: second + 382, kind: 'activity' }, { start: second + 382, end: offline ? 828 : 872, kind: 'bed' },
  ]
  if (offline) segments.push({ start: 828, end: 872, kind: 'offline' })
  if (date === PREVIOUS_DATE) segments.push({ start: 872, end: 1320, kind: 'activity' }, { start: 1320, end: 1440, kind: 'sleep' })
  const total = (kind: TimelineKind) => segments.filter(segment => segment.kind === kind).reduce((sum, segment) => sum + segment.end - segment.start, 0)
  return { segments, activity: total('activity'), bed: total('bed') + total('sleep'), sleep: total('sleep'), exits: 1 + Number(offset % 2 === 0) }
}

export const DEMO_CREDENTIAL = 'carewave'
export const isDemoLogin = (id: string, password: string) => id.trim() === DEMO_CREDENTIAL && password === DEMO_CREDENTIAL
