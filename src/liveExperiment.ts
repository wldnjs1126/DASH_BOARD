import { useEffect, useRef, useState } from 'react'
import type { CareEvent, Level, RoomRecord } from './institutionData.ts'

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const REPEAT_DELAY = 60000

type LiveEvent = CareEvent & { simulated: true; occurredAt: number }
export type LiveRoomStatus = { level: Level; reason: string; time: string }

function createEvent(room: string, fall: boolean): LiveEvent {
  const now = new Date()
  return {
    id: `live-${crypto.randomUUID()}`, room, date: dateFormat.format(now), time: timeFormat.format(now),
    simulated: true, occurredAt: now.getTime(), type: fall ? '낙상 의심' : '장시간 미움직임',
    level: fall ? 'danger' : 'caution', duration: '—', confirmed: false, sms: 'none', retries: 0,
    location: fall ? '활동 구역' : '침대 구역',
    note: fall ? '높이가 급격히 낮아진 뒤 바닥 가까이에서 움직임이 줄었습니다.' : '침대 구역에서 일정 시간 움직임이 감지되지 않았습니다.',
  }
}

export function useLiveExperiment(enabled: boolean, rooms: RoomRecord[], paused = false) {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [frame, setFrame] = useState(() => ({ now: Date.now(), roll: Math.random() }))
  const nextAlertAt = useRef<number | null>(null)

  function addEvent(room: string, fall: boolean) {
    const event = createEvent(room, fall)
    setFrame(previous => ({ ...previous, now: event.occurredAt }))
    setEvents(previous => [event, ...previous].slice(0, 100))
    nextAlertAt.current = event.occurredAt + REPEAT_DELAY
    return event
  }

  useEffect(() => {
    if (!enabled) return
    const tick = () => setFrame({ now: Date.now(), roll: Math.random() })
    tick()
    const timer = window.setInterval(tick, 3500)
    return () => window.clearInterval(timer)
  }, [enabled])

  useEffect(() => {
    if (!enabled || paused || !rooms.length) return
    let timer: number
    function schedule(delay: number) {
      timer = window.setTimeout(() => {
        const room = rooms[Math.floor(Math.random() * rooms.length)]
        addEvent(room.id, Math.random() < .5)
        schedule(REPEAT_DELAY)
      }, delay)
    }
    const now = Date.now()
    nextAlertAt.current ??= now + 8000 + Math.random() * 10000
    schedule(Math.max(0, nextAlertAt.current - now))
    return () => window.clearTimeout(timer)
  }, [enabled, rooms, paused])

  const statuses = new Map<string, LiveRoomStatus>(rooms.map((room, index) => {
    const recent = events.find(event => event.room === room.id && frame.now - event.occurredAt < 23000)
    if (recent) return [room.id, { level: recent.level, reason: recent.note, time: recent.time }] as const
    const watch = (frame.roll + index * .37) % 1 < .27
    return [room.id, { level: watch ? 'watch' : 'normal', reason: watch ? '움직임이 잠시 줄어 다음 상태를 관찰하고 있습니다.' : '활동과 휴식이 평소 범위로 표시됩니다.', time: timeFormat.format(frame.now) }] as const
  }))

  function reset() {
    nextAlertAt.current = null
    setEvents([])
  }

  function updateSms(id: string, sms: CareEvent['sms']) {
    setEvents(previous => previous.map(event => event.id === id ? { ...event, sms } : event))
  }

  return { events, statuses, reset, addEvent, updateSms }
}
