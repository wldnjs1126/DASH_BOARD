import { DEMO_SUBJECT_ID } from './subjectDirectory.ts'

type Segment = readonly [start: number, end: number]
export type ReportDay = {
  date: string
  activity: readonly Segment[]
  sleep: readonly Segment[]
  exits: readonly number[]
  still: readonly number[]
}

export const DAY_MINUTES = 1440
const reportDates = ['2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09', '2026-11-08']
const demoDays: readonly ReportDay[] = [
  {
    date: '2026-11-12',
    activity: [[461, 490], [607, 631], [822, 850], [1013, 1056]],
    sleep: [[0, 122], [137, 266], [280, 461], [1408, 1440]],
    exits: [122, 266],
    still: [915],
  },
  {
    date: '2026-11-11',
    activity: [[455, 499], [594, 623], [787, 833], [1004, 1054]],
    sleep: [[0, 208], [219, 457], [1416, 1440]],
    exits: [208],
    still: [],
  },
]

export function summarizeDay(day: ReportDay) {
  const minutes = (segments: readonly Segment[]) => segments.reduce((total, [start, end]) => total + end - start, 0)
  return { activity: minutes(day.activity), sleep: minutes(day.sleep), exits: day.exits.length, still: day.still.length }
}

function randomFor(key: string) {
  let state = 2166136261
  for (const char of key) state = Math.imul(state ^ char.codePointAt(0)!, 16777619)

  return (min: number, max: number) => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return min + Math.floor(((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296 * (max - min + 1))
  }
}

function makeDay(subjectId: string, date: string): ReportDay {
  const routine = randomFor(subjectId)
  const random = randomFor(`${subjectId}/${date}`)
  const pace = routine(18, 41)
  const wake = routine(348, 455) + random(-12, 12)
  const bedtime = routine(1300, 1420) + random(-14, 14)
  const exitFrequency = routine(0, 2)
  const exitCount = Math.max(0, exitFrequency + random(-1, 1))
  const exits = Array.from({ length: exitCount }, (_, i) => 45 + 82 * i + random(0, 48))
  const sleep: Segment[] = []
  let sleepStart = 0
  for (const minute of exits) {
    sleep.push([sleepStart, minute])
    sleepStart = minute + random(6, 17)
  }
  sleep.push([sleepStart, wake], [bedtime, DAY_MINUTES])

  const activity = [wake + 35, 605, 805, 1030].map((start, i): Segment => {
    const from = start + random(0, 31)
    return [from, from + pace + random(-9, 10) + i]
  })
  const still = random(0, 2) === 0 ? [random(910, 980)] : []
  return { date, activity, sleep, exits, still }
}

export function getSubjectReport(subjectId: string) {
  if (subjectId === DEMO_SUBJECT_ID) {
    return { days: demoDays, baseline: { activity: 160, sleep: 450, exits: 1, still: 0 } }
  }

  const days = reportDates.map(date => makeDay(subjectId, date))
  const referenceDays = ['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04'].map(date => summarizeDay(makeDay(subjectId, date)))
  const average = (key: keyof ReturnType<typeof summarizeDay>) => Math.round(referenceDays.reduce((total, day) => total + day[key], 0) / referenceDays.length)
  return { days, baseline: { activity: average('activity'), sleep: average('sleep'), exits: average('exits'), still: average('still') } }
}
