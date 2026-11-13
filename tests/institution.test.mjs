import assert from 'node:assert/strict'
import test from 'node:test'
import { ALERTS, getFacilityStats, getRoomDay, getRoomHistory, INSTITUTION_DATE, isDemoLogin, PREVIOUS_DATE, ROOMS } from '../src/institutionData.ts'
import { roomLabelKey, roomRowSizes, roomSubject, updateRoom } from '../src/facilityRooms.ts'

test('기관 시연 계정은 아이디와 비밀번호가 모두 일치해야 한다', () => {
  assert.equal(isDemoLogin('carewave', 'carewave'), true)
  assert.equal(isDemoLogin('other', 'carewave'), false)
  assert.equal(isDemoLogin('carewave', 'other'), false)
})

test('기관 요약과 경보가 표시되는 병실 상세 데이터가 일치한다', () => {
  assert.deepEqual(getFacilityStats(), { total: 10, occupied: 9, alerts: 4, atRisk: 1 })
  for (const alert of ALERTS) {
    assert.ok(ROOMS.some(room => room.id === alert.room))
    assert.ok(getRoomHistory(alert.room).some(event => event.id === alert.id))
  }
})

test('호실 표시 이름을 바꿔도 기존 이력과 데이터는 같은 호실에 연결된다', () => {
  const original = ROOMS.find(room => room.id === '203')
  const renamed = updateRoom({ ...roomSubject(original), room: '별관 1실', name: '변경한 이름' }, original)
  assert.equal(renamed.id, '203')
  assert.equal(roomSubject(renamed).room, '별관 1실')
  assert.equal(roomSubject(renamed).name, '변경한 이름')
  assert.ok(getRoomHistory(renamed.id).some(event => event.id === 'fall-203'))
  assert.deepEqual(getRoomDay(renamed, INSTITUTION_DATE), getRoomDay(original, INSTITUTION_DATE))
  assert.equal(getFacilityStats(ROOMS.filter(room => room.id !== '203')).alerts, 3)
  assert.equal(roomLabelKey('２０３ 호'), roomLabelKey('203'))
  const added = updateRoom({ ...roomSubject(original), room: '301' })
  assert.notEqual(added.id, original.id)
  assert.deepEqual(getRoomDay(added, INSTITUTION_DATE).segments, [])
})

test('호실 수가 달라져도 각 행이 비슷한 개수의 카드로 채워진다', () => {
  assert.deepEqual(roomRowSizes(0, 5), [])
  assert.deepEqual(roomRowSizes(3, 5), [3])
  assert.deepEqual(roomRowSizes(11, 5), [4, 4, 3])
  assert.deepEqual(roomRowSizes(11, 2), [2, 2, 2, 2, 2, 1])
})

test('각 병실과 날짜의 요약은 겹치지 않는 타임라인 구간으로 계산된다', () => {
  for (const room of ROOMS) {
    for (const date of [INSTITUTION_DATE, PREVIOUS_DATE]) {
      const { segments, activity } = getRoomDay(room, date)
      let previousEnd = 0
      let activityMinutes = 0
      for (const { start, end, kind } of segments) {
        assert.equal(start, previousEnd)
        assert.ok(end > start && end <= 1440)
        previousEnd = end
        if (kind === 'activity') activityMinutes += end - start
      }
      assert.equal(activity, activityMinutes)
    }
  }
  assert.notEqual(getRoomDay(ROOMS[0], INSTITUTION_DATE).activity, getRoomDay(ROOMS[2], INSTITUTION_DATE).activity)
})
