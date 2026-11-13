import assert from 'node:assert/strict'
import test from 'node:test'
import { DAY_MINUTES, getSubjectReport, summarizeDay } from '../src/reportData.ts'
import { DEMO_SUBJECT_ID } from '../src/subjectDirectory.ts'

test('새 대상자의 날짜별 기록을 같은 ID로 다시 열면 동일한 데이터가 표시된다', () => {
  const first = getSubjectReport('registered-subject-1')
  const second = getSubjectReport('registered-subject-2')

  assert.deepEqual(first, getSubjectReport('registered-subject-1'))
  assert.equal(first.days.length, 5)
  assert.notDeepEqual(first.days.map(summarizeDay), second.days.map(summarizeDay))
  assert.notDeepEqual(summarizeDay(first.days[0]), summarizeDay(first.days[1]))
  assert.deepEqual(getSubjectReport(DEMO_SUBJECT_ID).days.map(day => day.date), ['2026-11-12', '2026-11-11'])
})

test('생성된 활동과 수면 구간은 겹치지 않고 야간이탈은 수면 중단과 일치한다', () => {
  for (let index = 0; index < 50; index++) {
    for (const day of getSubjectReport(`registered-subject-${index}`).days) {
      const timeline = [...day.activity, ...day.sleep].sort(([startA], [startB]) => startA - startB)
      let previousEnd = 0
      for (const [start, end] of timeline) {
        assert.ok(previousEnd <= start && start < end && end <= DAY_MINUTES)
        previousEnd = end
      }
      for (const exit of day.exits) {
        assert.ok(day.sleep.some(([, end]) => end === exit))
        assert.ok(exit < 360)
      }
    }
  }
})
