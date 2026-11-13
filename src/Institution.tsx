import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, BedDouble, Bell, Check, ChevronDown, ChevronRight, Clock3, FileBarChart, Footprints, MessageSquare, Pencil, Plus, Radio, Repeat2, TriangleAlert, UserRound, X } from 'lucide-react'
import { roomRowSizes } from './facilityRooms.ts'
import { getFacilityStats, getRoomDay, getRoomHistory, INSTITUTION_DATE, isDemoRoom, LEVEL_LABELS, PREVIOUS_DATE, roomHref, roomLabel, SMS_LABELS, TIMELINE_LABELS } from './institutionData.ts'
import type { CareEvent, Level, RoomRecord } from './institutionData.ts'

const displayedDate = (date: string) => date.replaceAll('-', '. ')
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const duration = (minutes: number) => minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
const previewClock = `${displayedDate(INSTITUTION_DATE)} 14:32:18`
const currentDateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
const currentTimeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

export function InstitutionClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const parts = currentDateFormat.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
  return <time className="institution-clock" dateTime={now.toISOString()} aria-label="현재 한국 표준시">{part('year')}-{part('month')}-{part('day')} ({part('weekday')}) {currentTimeFormat.format(now)}</time>
}

function LevelBadge({ level }: { level: Level }) {
  return <span className={`institution-level level-${level}`}>{LEVEL_LABELS[level]}</span>
}

function SensorStatus({ online }: { online: boolean }) {
  return <span className={`institution-sensor${online ? '' : ' is-offline'}`}><i />센서 {online ? '정상' : '비정상'}</span>
}

function RoomGrid({ rooms }: { rooms: RoomRecord[] }) {
  const grid = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(5)
  useEffect(() => {
    const element = grid.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setColumns(Math.max(1, Math.min(5, Math.floor((entry.contentRect.width + 13) / 145)))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  let index = 0
  return <div className="institution-room-grid" ref={grid}>
    {roomRowSizes(rooms.length, columns).map(size => {
      const row = rooms.slice(index, index + size)
      index += size
      return <div className="institution-room-row" key={row[0].id} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {row.map(room => <a className="institution-room" href={roomHref(room.id)} key={room.id} aria-label={`${roomLabel(room)} ${LEVEL_LABELS[room.level]} 상세정보`}>
          <strong>{roomLabel(room)}</strong><span className={`institution-orb level-${room.level}`}>{LEVEL_LABELS[room.level]}</span>
          {isDemoRoom(room.id) ? <SensorStatus online={room.online} /> : <span className="institution-sensor">센서 미연결</span>}
        </a>)}
      </div>
    })}
  </div>
}

export function InstitutionOverview({ rooms, addRoom, pendingAlerts, openAlert }: {
  rooms: RoomRecord[]; addRoom: () => void; pendingAlerts: CareEvent[]; openAlert: (event: CareEvent) => void
}) {
  const featured = pendingAlerts.filter(event => event.level === 'danger' || event.level === 'caution')
  const { total, occupied, alerts, atRisk } = getFacilityStats(rooms)
  const stats = [
    ['전체 대상자', total, '명', '등록된 전체 대상자 수'],
    ['재실 인원', occupied, '명', '현재 재실 중인 대상자'],
    ['위험 이벤트', alerts, '건', '오늘 발생한 주요 경보'],
    ['위험 대상자', atRisk, '명', '현재 위험 등급인 대상자'],
  ] as const

  return <main className="institution-page institution-overview">
    <h1 className="institution-sr-only" tabIndex={-1}>기관용 관리자 대시보드</h1>
    <div className="institution-stats" aria-label="기관 상태 요약">
      {stats.map(([label, value, unit, note]) => <article className="institution-panel institution-stat" key={label}>
        <h2>{label}</h2><strong>{value} <small>{unit}</small></strong><p>{note}</p>
      </article>)}
    </div>
    <section className="institution-panel institution-room-panel" aria-labelledby="institution-rooms-title">
      <div className="institution-section-head"><h2 id="institution-rooms-title">공간별 위험도 모니터링</h2>
        <div className="institution-room-actions">
          {featured.length > 0 && <button type="button" className="institution-secondary institution-pending" onClick={() => openAlert(featured[0])}><Bell size={16} /> 미확인 경보 {featured.length}건</button>}
          <a href="#subjects" className="institution-secondary"><Pencil size={15} />호실 관리</a>
          <button type="button" className="institution-primary" onClick={addRoom}><Plus size={16} />호실 추가</button>
        </div>
      </div>
      {rooms.length > 0 ? <RoomGrid rooms={rooms} /> : <p className="institution-no-rooms">등록된 호실이 없습니다. ‘호실 추가’를 눌러 모니터링할 공간을 등록하세요.</p>}
    </section>
  </main>
}

export function RoomDetailHeader({ room }: { room: RoomRecord }) {
  return <header className="institution-header institution-detail-header">
    <h1 tabIndex={-1}>{roomLabel(room)} 상세정보</h1>
    <div className="institution-header-actions"><InstitutionClock /><span className="institution-updated"><Clock3 size={16} /><span><small>마지막 갱신</small>{room.online ? previewClock : '—'}</span></span>
      <a href="#demo" className="institution-primary"><ArrowLeft size={16} />전체 대시보드로 돌아가기</a></div>
  </header>
}

export function RoomDetails({ room, edit, remove, isConfirmed }: { room: RoomRecord; edit: () => void; remove: () => void; isConfirmed: (event: CareEvent) => boolean }) {
  const [date, setDate] = useState(INSTITUTION_DATE)
  const [timelineFocus, setTimelineFocus] = useState('')
  const day = getRoomDay(room, date)
  const previous = getRoomDay(room, PREVIOUS_DATE)
  const recorded = day.segments.length > 0
  const metrics = [
    { label: '활동시간', value: duration(day.activity), delta: day.activity - previous.activity, unit: 'time', icon: Footprints, tone: 'activity' },
    { label: '침대 체류시간', value: duration(day.bed), delta: day.bed - previous.bed, unit: 'time', icon: BedDouble, tone: 'bed' },
    { label: '수면 추정시간', value: duration(day.sleep), delta: day.sleep - previous.sleep, unit: 'time', icon: BedDouble, tone: 'sleep' },
    { label: '야간 이탈 횟수', value: `${day.exits}회`, delta: day.exits - previous.exits, unit: 'count', icon: TriangleAlert, tone: 'away' },
  ] as const

  return <main className="institution-page institution-detail">
    <div className="institution-room-top">
      <section className="institution-panel institution-resident">
        <div className="institution-section-head"><h2>대상자 정보</h2><div className="subject-actions">
          {room.name && <a className="institution-secondary" href={`${roomHref(room.id)}/report`}><FileBarChart size={14} />생활 리포트</a>}
          <button type="button" className="institution-secondary" onClick={edit}><Pencil size={14} />수정</button>
          <button type="button" className="institution-secondary subject-danger" onClick={remove}>호실 삭제</button>
        </div></div>
        <div className="institution-resident-grid"><span className="institution-resident-icon"><UserRound size={28} /></span>
          <div><strong>{room.name || '미배정'}</strong><p>{roomLabel(room)}</p></div>
          <dl>{[['나이', room.age === null ? '—' : `${room.age}세`], ['성별', room.gender || '—'], ['키', room.height === null ? '—' : `${room.height} cm`], ['몸무게', room.weight === null ? '—' : `${room.weight} kg`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>
        {(room.guardian || room.guardianPhone) && <p className="institution-guardian">보호자 · {[room.guardian, room.guardianPhone].filter(Boolean).join(' · ')}</p>}
      </section>
      <section className={`institution-panel institution-current level-${room.level}`}>
        <h2>현재 위험 등급</h2>
        <div className="institution-risk-reason"><div className="institution-current-level"><TriangleAlert size={21} /><div><small>현재 등급</small><strong>{LEVEL_LABELS[room.level]}</strong></div></div>
          <div><small>판단 사유</small><p>{room.reason}</p></div></div>
        <p className="institution-analysis-time"><small>분석 기준 시각</small>{recorded ? `${displayedDate(INSTITUTION_DATE)} 14:30` : '—'}</p>
      </section>
    </div>
    <section aria-labelledby="institution-today"><div className="institution-section-head"><h2 id="institution-today">{date === INSTITUTION_DATE ? '오늘의 생활 요약' : '전날 생활 요약'}</h2><small>{date === INSTITUTION_DATE ? '오늘 00:00부터 마지막 갱신까지' : '전날 00:00부터 24:00까지'}</small></div>
      <div className="institution-stats institution-life-stats">
        {metrics.map(({ label, value, delta, unit, icon: Icon, tone }) => <article className="institution-panel institution-life-stat" key={label}>
          <span className={`timeline-${tone}`}><Icon size={20} /></span><div><small>{label}</small><strong>{recorded ? value : '—'}</strong>
            <p>{!recorded ? '기록 없음' : date === PREVIOUS_DATE ? '전날 기록' : delta === 0 ? '전날과 같음' : `전날보다 ${unit === 'time' ? duration(Math.abs(delta)) : `${Math.abs(delta)}회`} ${delta > 0 ? '많음' : '적음'}`}</p></div>
        </article>)}
      </div>
    </section>
    <section className="institution-panel institution-timeline" aria-labelledby="institution-timeline-title">
      <div className="institution-section-head"><h2 id="institution-timeline-title">시간대별 움직임 타임라인</h2>
        <select aria-label="타임라인 날짜" value={date} onChange={event => { setDate(event.target.value); setTimelineFocus('') }}>
          <option value={INSTITUTION_DATE}>{displayedDate(INSTITUTION_DATE)} (오늘)</option><option value={PREVIOUS_DATE}>{displayedDate(PREVIOUS_DATE)} (전날)</option>
        </select></div>
      <div className="institution-timeline-axis" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i}>{clock(i * 180)}</span>)}</div>
      <div className="institution-timeline-track" role="group" aria-label="24시간 움직임 구간">
        {day.segments.map(({ start, end, kind }) => {
          const label = `${TIMELINE_LABELS[kind]} · ${clock(start)}~${clock(end)}`
          return <button key={start} type="button" className={`timeline-segment timeline-${kind}`} title={label} aria-label={label}
            onMouseEnter={() => setTimelineFocus(label)} onFocus={() => setTimelineFocus(label)} onClick={() => setTimelineFocus(label)}
            style={{ left: `${start / 14.4}%`, width: `${(end - start) / 14.4}%` }} />
        })}
      </div>
      <ul className="institution-timeline-legend">{Object.entries(TIMELINE_LABELS).map(([kind, label]) => <li key={kind}><i className={`timeline-segment timeline-${kind}`} />{label}</li>)}</ul>
      <p className="institution-timeline-help" aria-live="polite">{recorded ? timelineFocus || '구간을 선택하면 시작 시각과 종료 시각을 확인할 수 있습니다.' : '이 날짜에 등록된 생활 기록이 없습니다.'}</p>
    </section>
    <EventHistory events={getRoomHistory(room.id)} isConfirmed={isConfirmed} />
    <SensorTable room={room} />
  </main>
}

function EventHistory({ events, isConfirmed }: { events: CareEvent[]; isConfirmed: (event: CareEvent) => boolean }) {
  const [date, setDate] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState<string | null>('long-bed-203')
  const shown = events.filter(event => (!date || event.date === date) && (!level || event.level === level) && (!status || isConfirmed(event) === (status === 'confirmed')))

  return <section className="institution-panel institution-history" aria-labelledby="institution-history-title">
    <div className="institution-section-head"><h2 id="institution-history-title">이벤트 이력</h2><div className="institution-filters">
      <select aria-label="이벤트 날짜" value={date} onChange={event => setDate(event.target.value)}><option value="">전체 날짜</option>{[...new Set(events.map(event => event.date))].map(value => <option key={value} value={value}>{displayedDate(value)}</option>)}</select>
      <select aria-label="이벤트 등급" value={level} onChange={event => setLevel(event.target.value)}><option value="">전체 등급</option>{Object.entries(LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="이벤트 확인 여부" value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 확인 여부</option><option value="pending">미확인</option><option value="confirmed">확인 완료</option></select>
    </div></div>
    <div className="institution-table-scroll"><table className="institution-table">
      <thead><tr><th>시작 시각</th><th>종류</th><th>지속시간</th><th>등급</th><th>확인 여부</th><th>상세 보기</th></tr></thead>
      <tbody>{shown.map(event => <Fragment key={event.id}><tr>
        <td>{displayedDate(event.date)} {event.time}</td><th scope="row">{event.type}</th><td>{event.duration}</td><td><LevelBadge level={event.level} /></td>
        <td><span className={`institution-confirm-state${isConfirmed(event) ? '' : ' is-pending'}`}>{isConfirmed(event) ? '확인 완료' : '미확인'}</span></td>
        <td><button type="button" className="institution-text-button" aria-expanded={expanded === event.id} aria-label={`${event.type} 상세 보기`} onClick={() => setExpanded(expanded === event.id ? null : event.id)}>상세 {expanded === event.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></td>
      </tr>{expanded === event.id && <tr className="institution-event-detail"><td colSpan={6}><div><span><small>감지 위치</small><strong>{event.location}</strong></span><p>{event.note}</p></div></td></tr>}</Fragment>)}
      {!shown.length && <tr><td colSpan={6} className="institution-empty">조건에 맞는 이벤트가 없습니다.</td></tr>}</tbody>
    </table></div>
  </section>
}

function SensorTable({ room }: { room: RoomRecord }) {
  const registered = isDemoRoom(room.id)
  return <section className="institution-panel institution-history" aria-labelledby="institution-sensor-title">
    <div className="institution-section-head"><h2 id="institution-sensor-title">센서 운영 상태</h2>{registered && <SensorStatus online={room.online} />}</div>
    <div className="institution-table-scroll"><table className="institution-table">
      <thead><tr><th>센서 종류</th><th>장비 ID</th><th>설치 위치</th><th>장비 상태</th><th>데이터 수신 상태</th><th>마지막 수신 시각</th></tr></thead>
      <tbody>{registered ? <tr><th scope="row">비카메라 레이더 센서</th><td>CW-RD-{room.id}-01</td><td>천장</td><td><SensorStatus online={room.online} /></td>
        <td><span className={`institution-level level-${room.online ? 'normal' : 'danger'}`}>{room.online ? '수신 중' : '미수신'}</span></td><td>{room.online ? '14:32:16' : '13:48:02'}</td></tr> : <tr><td className="institution-empty" colSpan={6}>연결된 센서가 없습니다.</td></tr>}</tbody>
    </table></div>
  </section>
}

export function AlertHistory({ alerts, rooms, isConfirmed, openAlert, confirm }: {
  alerts: CareEvent[]; rooms: RoomRecord[]; isConfirmed: (event: CareEvent) => boolean; openAlert: (event: CareEvent) => void; confirm: (event: CareEvent) => void
}) {
  const [tab, setTab] = useState<'all' | 'pending' | 'confirmed'>('all')
  const pending = alerts.filter(event => !isConfirmed(event)).length
  const shown = alerts.filter(event => tab === 'all' || isConfirmed(event) === (tab === 'confirmed'))

  return <main className="institution-page"><section className="institution-panel institution-alerts" aria-labelledby="institution-alert-title">
    <header><h1 id="institution-alert-title" tabIndex={-1}><span><Bell size={22} /></span>실시간 알림</h1>
      <div className="institution-alert-tabs" role="group" aria-label="알림 확인 상태">
        {([['all', '전체'], ['pending', '미확인'], ['confirmed', '확인 완료']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{label}{key === 'pending' && <i>{pending}</i>}</button>)}
      </div>
    </header>
    <div className="institution-table-scroll"><table className="institution-table institution-alert-table">
      <thead><tr><th>발생 시각</th><th>호실</th><th>이름</th><th>이벤트 종류</th><th>등급</th><th>문자 발송</th><th>재전송</th><th>확인 상태</th><th><span className="institution-sr-only">확인</span></th></tr></thead>
      <tbody>{shown.map(event => {
        const confirmed = isConfirmed(event)
        const room = rooms.find(room => room.id === event.room)!
        return <tr key={event.id} className={confirmed ? '' : 'institution-alert-unread'}>
          <td><time dateTime={`${event.date}T${event.time}`}>{event.time.slice(0, 5)}</time></td>
          <td><a className="institution-room-link" href={roomHref(event.room)}>{roomLabel(room)}</a></td><td>{room.name || '미배정'}</td>
          <td>{event.level === 'danger' || event.level === 'caution' ? <button className="institution-event-button" type="button" onClick={() => openAlert(event)}>{event.type}</button> : <strong>{event.type}</strong>}</td>
          <td><LevelBadge level={event.level} /></td><td><span className={`institution-sms sms-${event.sms}`}><MessageSquare size={14} />{SMS_LABELS[event.sms]}</span></td>
          <td><span className="institution-retries">{event.retries ? <><Repeat2 size={14} />{event.retries}회</> : '—'}</span></td>
          <td><span className={`institution-confirm-state${confirmed ? '' : ' is-pending'}`}><i />{confirmed ? '확인 완료' : '미확인'}</span></td>
          <td>{confirmed ? <span className="institution-secondary institution-alert-action"><Check size={14} />완료</span> : <button className="institution-primary institution-alert-action" type="button" aria-label={`${roomLabel(room)} ${event.type} 확인`} onClick={() => confirm(event)}>확인</button>}</td>
        </tr>
      })}{!shown.length && <tr><td colSpan={9} className="institution-empty">표시할 알림이 없습니다.</td></tr>}</tbody>
    </table></div>
    <footer><span aria-live="polite"><strong>{pending}건</strong>의 확인이 필요한 알림이 있습니다.</span><span>마지막 업데이트 14:32:18</span></footer>
  </section></main>
}

export function InstitutionAlert({ event, room, close, confirm }: { event: CareEvent; room: RoomRecord; close: () => void; confirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const sms = event.sms === 'none' ? '미발송' : `보호자 문자 ${SMS_LABELS[event.sms]}`

  return <dialog ref={dialog} className={`institution-alarm level-${event.level}`} aria-labelledby={title} onCancel={e => { e.preventDefault(); close() }}>
    <header><div className="institution-alarm-icon"><Bell size={21} /></div><LevelBadge level={event.level} />
      <button className="institution-alarm-close" type="button" aria-label="알림 닫기" onClick={close}><X size={19} /></button>
    </header>
    <div className="institution-alarm-body">
      <h2 id={title}>{roomLabel(room)}</h2><p className="institution-alarm-name">{room.name || '미배정'}</p><p className="institution-alarm-event">{event.type}</p>
      <dl><div><dt><Clock3 size={15} />발생 시각</dt><dd>{displayedDate(event.date)} {event.time}</dd></div>
        <div><dt><MessageSquare size={15} />문자 발송</dt><dd>{sms}</dd></div></dl>
      <div className="institution-alarm-actions"><a className="institution-secondary" href={roomHref(event.room)} onClick={close}>상세보기 <ChevronRight size={15} /></a>
        <button className="institution-primary" type="button" autoFocus onClick={confirm}><Check size={16} />확인</button></div>
    </div>
  </dialog>
}

export function InstitutionSettings({ autoAlerts, setAutoAlerts, signOut }: { autoAlerts: boolean; setAutoAlerts: (value: boolean) => void; signOut: () => void }) {
  return <main className="institution-page"><section className="institution-panel institution-settings">
    <h1 tabIndex={-1}>설정</h1>
    <label><Radio size={18} />로그인 시 미확인 경보 표시 <input type="checkbox" checked={autoAlerts} onChange={event => setAutoAlerts(event.target.checked)} /></label>
    <button type="button" className="institution-secondary" onClick={signOut}>로그아웃</button>
  </section></main>
}
