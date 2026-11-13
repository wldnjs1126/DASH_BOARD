import { FIXTURES, ROOM } from './room.ts'
export { ROOM } from './room.ts'

export const ZONE = {
  bed: { label: '침대존', ...FIXTURES.bed },
  activity: { label: '활동존', x: .77, y: 2.35, width: 1.73, depth: 1.47 },
  bath: { label: '화장실 입구', x: .47, y: 3.87, width: .84, depth: .43 },
  entrance: { label: '출입구', ...FIXTURES.entrance, x: 0, width: .46 },
  aisle: { label: '이동통로' },
  outside: { label: '병실 외부' },
} as const

export type Zone = keyof typeof ZONE
export type Risk = 'normal' | 'caution' | 'danger'
type Keyframe = readonly [timestamp: number, x: number, y: number, z: number, speed: number, intensity: number, presence?: boolean]

type ScenarioDefinition = {
  id: string
  label: string
  description: string
  category: 'basic' | 'fall'
  risk: Risk
  detectionTime: number
  keyframes: readonly Keyframe[]
}

const definitions = [
  { id: 'present', label: '재실', description: '대상자가 병실에 들어와 활동존에 머뭅니다.', category: 'basic', risk: 'normal', detectionTime: 2.6,
    keyframes: [[0, -.18, 3.52, 0, 0, 0, false], [1.1, .04, 3.52, 1.5, .46, .38, true], [2.6, .66, 3.44, 1.55, .61, .51], [4.7, 1.43, 3.01, 1.56, .57, .43], [7, 1.54, 2.86, 1.51, .03, .11], [13, 1.57, 2.84, 1.52, .02, .09]] },
  { id: 'absent', label: '부재', description: '대상자가 출입문을 통과해 점군이 사라집니다.', category: 'basic', risk: 'normal', detectionTime: 5.8,
    keyframes: [[0, 1.74, 2.57, 1.52, .06, .14], [2, 1.16, 2.91, 1.52, .63, .48], [4.4, .47, 3.52, 1.55, .61, .55], [5.7, .02, 3.63, 1.53, .45, .36], [5.8, -.06, 3.63, 0, 0, 0, false], [12, -.12, 3.63, 0, 0, 0, false]] },
  { id: 'movement', label: '움직임', description: '대상자가 병실 안을 걸으며 이동 궤적을 남깁니다.', category: 'basic', risk: 'normal', detectionTime: 2.2,
    keyframes: [[0, .14, 3.46, 1.48, .1, .15], [1.5, .56, 3.34, 1.55, .51, .38], [3.5, 1.16, 3.65, 1.54, .47, .53], [5.5, 1.92, 3.36, 1.55, .46, .48], [7.2, 2.31, 2.65, 1.51, .49, .55], [9.8, 1.45, 2.54, 1.56, .35, .44], [12.5, .62, 2.76, 1.53, .39, .51], [16, .47, 3.42, 1.52, .05, .16]] },
  { id: 'still', label: '장시간 미움직임', description: '활동존에서 미세한 움직임만 남는 상태를 재현합니다.', category: 'basic', risk: 'caution', detectionTime: 8,
    keyframes: [[0, 1.19, 3.33, 1.51, .41, .43], [2, 1.83, 3.19, 1.48, .16, .27], [3.2, 1.92, 3.18, .98, .02, .07], [8, 1.92, 3.18, .97, .005, .032], [15, 1.92, 3.18, .98, .005, .032]] },
  { id: 'bed', label: '침대체류', description: '침대에 접근해 앉은 뒤 침대존에 머뭅니다.', category: 'basic', risk: 'normal', detectionTime: 5.6,
    keyframes: [[0, .46, 2.94, 1.53, .3, .36], [2.6, .68, 2.12, 1.53, .38, .43], [4.2, .91, 1.89, 1.12, .21, .28], [5.6, 1.12, 1.82, .85, .04, .16], [12, 1.15, 1.81, .83, .01, .09]] },
  { id: 'sleep', label: '수면', description: '침대에 누운 뒤 호흡에 해당하는 미세 파형만 남습니다.', category: 'basic', risk: 'normal', detectionTime: 6.2,
    keyframes: [[0, 1.18, 1.86, .92, .06, .21], [2.7, 1.48, 1.71, .69, .13, .28], [4.2, 1.72, 1.68, .59, .02, .09], [6.2, 1.72, 1.68, .57, .003, .036], [15, 1.72, 1.68, .57, .003, .036]] },
  { id: 'night', label: '야간이탈', description: '침대에서 일어나 야간에 병실 출입구를 통과합니다.', category: 'basic', risk: 'caution', detectionTime: 8.3,
    keyframes: [[0, 1.72, 1.68, .58, .01, .06], [2.1, 1.21, 1.84, .96, .23, .28], [3.6, .67, 2.19, 1.48, .42, .47], [6.3, .57, 3.1, 1.53, .69, .53], [8.3, .24, 3.55, 1.54, .57, .48], [8.9, .02, 3.58, 1.51, .41, .35], [9.0, -.06, 3.59, 0, 0, 0, false], [14, -.16, 3.59, 0, 0, 0, false]] },
  { id: 'fall-general', label: '일반 낙상', description: '활동존에서 서 있다가 균형을 잃고 쓰러집니다.', category: 'fall', risk: 'danger', detectionTime: 4.75,
    keyframes: [[0, 1.39, 2.73, 1.55, .05, .12], [3.6, 1.44, 2.74, 1.55, .06, .15], [4.15, 1.54, 2.78, 1.33, .34, .41], [4.48, 1.73, 2.92, .64, .83, .81], [4.75, 1.91, 3.04, .24, .58, .98], [5.45, 1.95, 3.07, .22, .025, .1], [13, 1.95, 3.07, .21, .008, .035]] },
  { id: 'fall-bed', label: '침대에서 낙상', description: '침대 가장자리에 앉았다가 옆 통로로 미끄러집니다.', category: 'fall', risk: 'danger', detectionTime: 5.85,
    keyframes: [[0, 1.67, 1.61, .59, .01, .08], [2.8, 1.39, 1.66, .87, .19, .31], [4.95, 1.02, 1.77, 1.06, .1, .2], [5.48, .84, 1.82, .72, .47, .53], [5.85, .65, 1.96, .19, .39, .92], [6.55, .61, 2.01, .16, .02, .08], [13.5, .61, 2.01, .17, .007, .027]] },
  { id: 'fall-bath', label: '화장실 낙상', description: '화장실 입구에서 방향을 바꾸던 중 미끄러집니다.', category: 'fall', risk: 'danger', detectionTime: 6.55,
    keyframes: [[0, 2.11, 2.67, 1.54, .31, .35], [2.7, 1.69, 3.25, 1.53, .56, .49], [4.7, 1.12, 3.73, 1.52, .44, .52], [5.95, .98, 3.85, 1.42, .32, .39], [6.28, .89, 3.99, .82, .8, .79], [6.55, .82, 4.13, .2, .74, 1], [7.35, .8, 4.18, .16, .018, .07], [14, .8, 4.18, .16, .005, .03]] },
  { id: 'fall-walk', label: '이동 중 낙상', description: '병실을 가로질러 걷던 중 앞으로 넘어집니다.', category: 'fall', risk: 'danger', detectionTime: 5.35,
    keyframes: [[0, .21, 3.52, 1.51, .19, .24], [2, .68, 3.4, 1.56, .59, .52], [4.15, 1.44, 3.21, 1.52, .71, .65], [4.73, 1.75, 3.15, 1.34, .9, .7], [5.08, 2.06, 3.1, .67, 1.18, .89], [5.35, 2.26, 3.04, .25, .92, 1], [6.15, 2.37, 2.93, .21, .045, .15], [13, 2.37, 2.92, .22, .01, .04]] },
] as const satisfies readonly ScenarioDefinition[]

export interface Sample {
  timestamp: number
  x: number
  y: number
  z: number
  speed: number
  presence: boolean
  zone: Zone
  intensity: number
  event_type: string | null
}

export interface Scenario extends ScenarioDefinition {
  duration: number
  samples: Sample[]
  speedIntegral: number[]
}

const SAMPLE_RATE = 30
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function zoneAt(x: number, y: number, presence: boolean): Zone {
  if (!presence) return 'outside'
  for (const key of ['bed', 'activity', 'bath', 'entrance'] as const) {
    const area = ZONE[key]
    if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.depth) return key
  }
  return 'aisle'
}

function interpolate(a: Sample, b: Sample, timestamp: number): Sample {
  if (a.timestamp === b.timestamp || a.presence !== b.presence) return { ...a, timestamp }
  const f = (timestamp - a.timestamp) / (b.timestamp - a.timestamp)
  const x = mix(a.x, b.x, f)
  const y = mix(a.y, b.y, f)
  return {
    ...a, timestamp, x, y, zone: zoneAt(x, y, a.presence),
    z: mix(a.z, b.z, f), speed: mix(a.speed, b.speed, f), intensity: mix(a.intensity, b.intensity, f),
  }
}

function buildScenario(definition: ScenarioDefinition): Scenario {
  const { keyframes, detectionTime, id } = definition
  const duration = keyframes[keyframes.length - 1][0]
  let segment = 0
  const speedIntegral = [0]
  const timestamps = [...new Set([
    ...Array.from({ length: Math.ceil(duration * SAMPLE_RATE) + 1 }, (_, i) => Math.min(duration, i / SAMPLE_RATE)),
    ...keyframes.map(frame => frame[0]),
    detectionTime,
  ])].sort((a, b) => a - b)
  const samples: Sample[] = timestamps.map((timestamp) => {
    while (segment < keyframes.length - 2 && timestamp >= keyframes[segment + 1][0]) segment++
    const [start, ax, ay, az, av, ai, present = true] = keyframes[segment]
    const [end, bx, by, bz, bv, bi, nextPresent = true] = keyframes[segment + 1]
    const progress = clamp((timestamp - start) / (end - start), 0, 1)
    const presence = progress === 1 ? nextPresent : present
    const f = present !== nextPresent && progress < 1 ? 0 : progress
    const pathX = mix(ax, bx, progress)
    const pathY = mix(ay, by, progress)
    const x = presence ? clamp(pathX, 0, ROOM.width) : pathX
    const y = presence ? clamp(pathY, 0, ROOM.depth) : pathY
    const baseSpeed = mix(av, bv, f)
    const step = Math.sin(timestamp * 10.3)
    const breath = Math.sin(timestamp * 2.7)
    const activity = mix(ai, bi, f)
    return {
      timestamp, x, y, presence,
      zone: zoneAt(x, y, presence),
      z: presence ? Math.max(0, mix(az, bz, f) + baseSpeed * step * .038 + breath * .007) : 0,
      speed: presence ? Math.max(0, baseSpeed * (1 + step * .12)) : 0,
      intensity: presence ? clamp(activity + activity * (step * .22 + Math.sin(timestamp * 23.2) * .11) + breath * .012, 0, 1) : 0,
      event_type: timestamp >= detectionTime ? id : null,
    }
  })
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    speedIntegral.push(speedIntegral[i - 1] + (b.timestamp - a.timestamp) * (a.speed + (a.presence === b.presence ? b.speed : a.speed)) / 2)
  }
  return { ...definition, duration, samples, speedIntegral }
}

export const SCENARIOS = definitions.map(buildScenario)
export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map(scenario => [scenario.id, scenario]))
export const RISK_LABEL: Record<Risk, string> = { normal: '정상', caution: '주의', danger: '위험' }

function indexAt(scenario: Scenario, time: number) {
  let low = 0
  let high = scenario.samples.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (scenario.samples[mid].timestamp <= time) low = mid
    else high = mid - 1
  }
  return low
}

export function frameAt(scenario: Scenario, time: number) {
  const timestamp = clamp(time, 0, scenario.duration)
  const index = indexAt(scenario, timestamp)
  const a = scenario.samples[index]
  const b = scenario.samples[index + 1] ?? a
  const sample = interpolate(a, b, timestamp)
  const averageSpeed = timestamp > 0
    ? (scenario.speedIntegral[index] + (timestamp - a.timestamp) * (a.speed + sample.speed) / 2) / timestamp
    : sample.speed
  return { sample, averageSpeed, index }
}

export function historyAt(scenario: Scenario, time: number, stride = 3): Sample[] {
  const { sample, index } = frameAt(scenario, time)
  const history: Sample[] = []
  for (let i = 0; i <= index; i += stride) history.push(scenario.samples[i])
  if (history.at(-1)?.timestamp !== sample.timestamp) history.push(sample)
  return history
}

export function advanceTime(time: number, delta: number, speed: number, duration: number) {
  return clamp(time + clamp(delta, 0, 0.12) * speed, 0, duration)
}

export function detectionAt(scenario: Scenario, time: number, startedAt: number) {
  if (time < scenario.detectionTime) return null
  return {
    id: scenario.id,
    label: scenario.label,
    risk: scenario.risk,
    sample: frameAt(scenario, scenario.detectionTime).sample,
    time: startedAt + scenario.detectionTime * 1000,
  }
}

export type Detection = NonNullable<ReturnType<typeof detectionAt>>
