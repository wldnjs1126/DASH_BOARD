import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  advanceTime, detectionAt, frameAt, historyAt, ROOM, SCENARIOS, SCENARIO_BY_ID,
} from '../src/scenarios.ts'
import { FIXTURES } from '../src/room.ts'

for (const scenario of SCENARIOS) {
  test(`${scenario.label}: 시간축, 측정 범위, 이벤트 감지`, () => {
    assert.equal(scenario.samples[0].timestamp, 0)
    assert.equal(scenario.samples.at(-1).timestamp, scenario.duration)
    for (const [i, sample] of scenario.samples.entries()) {
      if (i > 0) assert.ok(sample.timestamp > scenario.samples[i - 1].timestamp)
      assert.ok(sample.intensity >= 0 && sample.intensity <= 1)
      assert.ok(sample.speed >= 0 && sample.z >= 0)
      if (sample.presence) {
        assert.ok(sample.x >= 0 && sample.x <= ROOM.width)
        assert.ok(sample.y >= 0 && sample.y <= ROOM.depth)
      } else {
        assert.equal(sample.zone, 'outside')
        assert.equal(sample.z + sample.speed + sample.intensity, 0)
      }
    }
    const time = scenario.detectionTime
    const startedAt = 1_000_000
    assert.equal(detectionAt(scenario, time - .001, startedAt), null)
    assert.equal(frameAt(scenario, time - .001).sample.event_type, null)
    const detection = detectionAt(scenario, time, startedAt)
    assert.equal(detection.time, startedAt + time * 1000)
    assert.equal(detection.sample.event_type, scenario.id)
    assert.equal(detectionAt(scenario, scenario.duration, startedAt).sample.timestamp, time)
    const betweenSamples = time + .014
    const { sample, averageSpeed } = frameAt(scenario, betweenSamples)
    assert.deepEqual(historyAt(scenario, betweenSamples).at(-1), sample)
    assert.ok(averageSpeed >= 0)
  })
}

test('4종 낙상은 서로 다른 경로, 높이, 속도를 사용하고 이후 움직임이 감소한다', () => {
  const fallScenarios = SCENARIOS.filter(scenario => scenario.category === 'fall')
  assert.equal(fallScenarios.length, 4)
  const impactPoints = new Set()
  const speeds = new Set()
  for (const scenario of fallScenarios) {
    const before = frameAt(scenario, scenario.detectionTime - .65).sample
    const impact = frameAt(scenario, scenario.detectionTime).sample
    const after = frameAt(scenario, scenario.duration).sample
    assert.equal(scenario.risk, 'danger')
    assert.ok(before.z - impact.z > .5)
    assert.ok(impact.z < .3 && after.z < .3)
    assert.ok(after.speed < .05 && after.intensity < .08)
    assert.equal(impact.presence, true)
    assert.equal(after.presence, true)
    impactPoints.add(`${impact.x}/${impact.y}`)
    speeds.add(impact.speed.toFixed(2))
  }
  assert.equal(impactPoints.size, 4)
  assert.equal(speeds.size, 4)
  assert.equal(frameAt(SCENARIO_BY_ID['fall-bath'], 6.55).sample.zone, 'bath')
})

test('재실, 부재, 수면과 야간이탈의 상태 전환', () => {
  assert.equal(SCENARIOS.length, 11)
  assert.equal(SCENARIOS.filter(scenario => scenario.category === 'basic').length, 7)
  const { present, absent, sleep, night } = SCENARIO_BY_ID
  assert.equal(frameAt(present, 0).sample.presence, false)
  assert.equal(frameAt(present, present.duration).sample.presence, true)
  assert.equal(frameAt(absent, 5.799).sample.presence, true)
  assert.equal(frameAt(absent, 5.8).sample.presence, false)
  assert.equal(frameAt(sleep, sleep.duration).sample.zone, 'bed')
  assert.ok(frameAt(sleep, sleep.duration).sample.intensity < .06)
  assert.equal(detectionAt(night, night.duration, 0).risk, 'caution')
  assert.equal(detectionAt(night, night.duration, 0).sample.zone, 'entrance')
  assert.equal(frameAt(night, night.duration).sample.presence, false)
})

test('재생 속도 배율과 프레임 드롭, 종료 시간 제한', () => {
  assert.equal(advanceTime(2, .1, .5, 8), 2.05)
  assert.equal(advanceTime(2, .1, 4, 8), 2.4)
  assert.equal(advanceTime(2, 5, 1, 8), 2.12)
  assert.equal(advanceTime(7.9, .1, 4, 8), 8)
  assert.equal(advanceTime(2, -1, 1, 8), 2)
  assert.equal(frameAt(SCENARIO_BY_ID.bed, -1).sample.timestamp, 0)
  assert.equal(frameAt(SCENARIO_BY_ID.bed, 500).sample.timestamp, SCENARIO_BY_ID.bed.duration)
})

test('실증 공간의 출입문과 가구 위치를 시나리오에 반영한다', () => {
  const { entrance, bed, wardrobe } = FIXTURES
  assert.deepEqual([ROOM.width, ROOM.depth], [2.9, 4.3])
  assert.equal(FIXTURES.bathroom.width, .5)
  for (const [id, time] of [['present', 1.1], ['absent', 5.7], ['night', 8.9]]) {
    const { sample } = frameAt(SCENARIO_BY_ID[id], time)
    assert.equal(sample.zone, 'entrance')
    assert.ok(sample.x < .1 && sample.y >= entrance.y && sample.y <= entrance.y + entrance.depth)
  }
  for (const scenario of SCENARIOS) {
    for (const sample of scenario.samples.filter(point => point.presence)) {
      assert.ok(sample.y > wardrobe.y + wardrobe.depth, scenario.label)
      if (!['bed', 'sleep', 'night', 'fall-bed'].includes(scenario.id)) {
        assert.ok(sample.x < bed.x || sample.y < bed.y || sample.y > bed.y + bed.depth, scenario.label)
      }
    }
  }
})
