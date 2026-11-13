import type { ExperimentRecording } from './experiment.ts'

const profiles = {
  A: { age: '30대', gender: '여성', height: 159, weight: 62 },
  B: { age: '20대', gender: '여성', height: 160, weight: 43 },
  C: { age: '20대', gender: '여성', height: 163, weight: 58 },
  D: { age: '30대', gender: '남성', height: 174, weight: 78 },
}

// The public timeline uses fictional, relative times.
export const publicExample: ExperimentRecording[] = (['A', 'B', 'C', 'D'] as const).map((id, index) => {
  const wake = 6 * 3600 + index * 900
  const end = wake + 3000
  return { id, profile: profiles[id], duration: 8 * 3600, occupied: true, gaps: [], events: [
    { id: 1, type: 'SLEEP', start: 0, detected: 1200, end: wake, duration: wake, zone: 'BED' },
    { id: 2, type: 'MOVEMENT', start: wake, detected: wake + 5, end, duration: end - wake, zone: 'ROOM' },
    { id: 3, type: 'PRESENCE', start: end, detected: end, end: 8 * 3600, duration: 8 * 3600 - end, zone: 'ROOM' },
  ] }
})
