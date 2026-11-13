import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, Footprints, MapPin, Moon, DoorOpen, UserRound } from 'lucide-react'
import { DAY_MINUTES, getSubjectReport, summarizeDay } from './reportData.ts'
import type { Subject } from './subjectDirectory.ts'
import './daily-report.css'

const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const duration = (minutes: number) => minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`

export function DailyReport({ subject }: { subject: Subject | null }) {
  return <main className="daily-report">
    <h1 className="report-page-title" tabIndex={-1}>하루 생활 분석 리포트</h1>
    {subject ? <SubjectReport key={subject.id} subject={subject} /> : <section className="panel subject-empty"><CalendarDays size={25} />
      <h2>분석할 대상자가 없습니다</h2><a className="subject-button subject-primary" href="#subjects">대상자 정보 열기</a>
    </section>}
  </main>
}

function SubjectReport({ subject }: { subject: Subject }) {
  const { days, baseline } = useMemo(() => getSubjectReport(subject.id), [subject.id])
  const [date, setDate] = useState(days[0].date)
  const day = days.find(entry => entry.date === date) ?? days[0]
  const { activity, sleep, exits, still } = summarizeDay(day)
  const metrics = [
    { icon: Footprints, label: '활동 시간', value: `${activity}분`, difference: activity - baseline.activity, unit: '분' },
    { icon: Moon, label: '수면 추정', value: duration(sleep), difference: sleep - baseline.sleep, unit: '분' },
    { icon: DoorOpen, label: '야간이탈', value: `${exits}회`, difference: exits - baseline.exits, unit: '회' },
    { icon: Clock3, label: '장시간 미움직임', value: `${still}회`, difference: still - baseline.still, unit: '회' },
  ]
  const events = [
    ...day.exits.map(minute => ({ minute, label: '야간이탈' })),
    ...day.still.map(minute => ({ minute, label: '장시간 미움직임' })),
  ].sort((a, b) => a.minute - b.minute)

  return <>
      <section className="panel daily-report-heading" aria-label="분석 대상과 날짜">
        <div className="report-subject">
          <span className="report-subject-icon"><UserRound size={23} aria-hidden="true" /></span>
          <div><span>분석 대상</span><strong>{subject.name}</strong><p><MapPin size={14} aria-hidden="true" />{subject.room}</p></div>
        </div>
      <label className="daily-report-date"><CalendarDays size={16} aria-hidden="true" /> 분석 날짜
        <select value={date} onChange={event => setDate(event.target.value)}>
          {days.map(entry => <option key={entry.date} value={entry.date}>{entry.date}</option>)}
        </select>
      </label>
      </section>
    <div aria-live="polite" className="daily-report-results">
      <p className="daily-report-summary">활동 {duration(activity)} · 수면 추정 {duration(sleep)} · {events.length ? `확인할 이벤트 ${events.length}건` : '확인할 이벤트 없음'}</p>
      <dl className="daily-report-metrics">
        {metrics.map(({ icon: Icon, label, value, difference, unit }) => <div className="panel" key={label}>
          <dt><Icon size={15} aria-hidden="true" />{label}</dt>
          <dd><strong>{value}</strong><span>평소 대비 {difference === 0 ? '같음' : `${difference > 0 ? '+' : '−'}${Math.abs(difference)}${unit}`}</span></dd>
        </div>)}
      </dl>
      <div className="daily-report-detail">
        <section className="panel" aria-labelledby="report-timeline-title">
          <h2 id="report-timeline-title">24시간 흐름</h2>
          <div className="daily-report-time-axis" aria-hidden="true">
            {['00시', '06시', '12시', '18시', '24시'].map(label => <span key={label}>{label}</span>)}
          </div>
          <dl className="daily-report-tracks">
            {([{ label: '수면 추정', segments: day.sleep, tone: 'sleep' }, { label: '활동', segments: day.activity, tone: 'activity' }] as const).map(track =>
              <div key={track.tone}>
                <dt>{track.label}</dt>
                <dd className={`daily-report-track ${track.tone}`} role="img" aria-label={track.segments.map(([start, end]) => `${time(start)}~${time(end)}`).join(', ')}>
                  {track.segments.map(([start, end]) => <i key={start} title={`${time(start)}~${time(end)}`}
                    style={{ left: `${start / DAY_MINUTES * 100}%`, width: `${(end - start) / DAY_MINUTES * 100}%` }} />)}
                </dd>
              </div>,
            )}
          </dl>
        </section>
        <section className="panel" aria-labelledby="report-events-title">
          <h2 id="report-events-title">확인할 이벤트</h2>
          {events.length ? <ul className="daily-report-events">{events.map(({ minute, label }) => <li key={`${minute}-${label}`}>
            <time>{time(minute)}</time><span>{label}</span>
          </li>)}</ul> : <p className="daily-report-no-events">이 날짜에 확인할 이벤트가 없습니다.</p>}
        </section>
      </div>
    </div>
    <footer className="daily-report-note">
      <p>비교 기준 · 활동 {duration(baseline.activity)} · 수면 {duration(baseline.sleep)} · 야간이탈 {baseline.exits}회 · 장시간 미움직임 {baseline.still}회</p>
      <p>데이터 출처 · CareWave 시연 시나리오</p>
    </footer>
  </>
}
