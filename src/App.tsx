import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownUp, BedDouble, Box, CalendarClock, ChevronDown, Clock3, DoorOpen,
  Footprints, Layers3, LogOut, MapPin, Maximize, Minimize, Moon, Pause, Play,
  RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert, UserRound, Waves, X, Zap,
} from 'lucide-react'
import { Brand } from './Brand.tsx'
import { CARE_PAGES, CareSidebar } from './CareSidebar.tsx'
import { DailyReport } from './DailyReport.tsx'
import { experimentRooms } from './experiment.ts'
import type { ExperimentRecording } from './experiment.ts'
import { useLiveExperiment } from './liveExperiment.ts'
import { AlertHistory, InstitutionAlert, InstitutionClock, InstitutionOverview, InstitutionSettings, RoomDetailHeader, RoomDetails } from './Institution.tsx'
import { InstitutionLogin } from './InstitutionLogin.tsx'
import { readFacilityRooms, roomSubject, updateRoom, writeFacilityRooms } from './facilityRooms.ts'
import { roomHref, roomLabel } from './institutionData.ts'
import type { CareEvent, RoomRecord } from './institutionData.ts'
import { Landing } from './Landing.tsx'
import { ROOM_SIZE } from './room.ts'
import { Room3D } from './Room3D.tsx'
import {
  advanceTime, detectionAt, frameAt, historyAt, RISK_LABEL, SCENARIO_BY_ID, SCENARIOS, ZONE,
} from './scenarios.ts'
import type { Detection, Risk, Scenario } from './scenarios.ts'
import { DEMO_SUBJECT } from './subjectDirectory.ts'
import type { Subject, SubjectDetails } from './subjectDirectory.ts'
import { RoomDeleteDialog, RoomEditor, Subjects } from './Subjects.tsx'
import { FloorPlan, PanelHeading, SignalChart, ViewDialog } from './visuals.tsx'
import './care-workspace.css'
import './institution.css'

const ICONS = [UserRound, DoorOpen, Footprints, Clock3, BedDouble, Moon, LogOut]
const SESSION_KEY = 'carewave.institution.session'
const INITIAL_TIME = 5.8
const TIME_ZONE = 'Asia/Seoul'
const clockFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeLabel = (time: number) => clockFormatter.format(time)
const dateTimeLabel = (time: number) => `${dateFormatter.format(time)} ${timeLabel(time)}`

function useReplay() {
  const [scenario, setScenario] = useState(SCENARIO_BY_ID.movement)
  const [time, setTime] = useState(INITIAL_TIME)
  const [startedAt, setStartedAt] = useState(() => Date.now() - INITIAL_TIME * 1000)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [acknowledged, setAcknowledged] = useState(false)
  const clock = useRef(INITIAL_TIME)

  function start(next: Scenario) {
    clock.current = 0
    setTime(0)
    setStartedAt(Date.now())
    setAcknowledged(false)
    setScenario(next)
    setPlaying(true)
  }

  function toggle() {
    if (playing) setPlaying(false)
    else if (time >= scenario.duration) start(scenario)
    else setPlaying(true)
  }

  function seek(value: number) {
    clock.current = value
    setTime(value)
    if (value < scenario.detectionTime) setAcknowledged(false)
    if (value >= scenario.duration) setPlaying(false)
  }

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let previous: number | undefined
    function tick(now: number) {
      if (previous !== undefined) {
        clock.current = advanceTime(clock.current, (now - previous) / 1000, rate, scenario.duration)
        setTime(clock.current)
        if (clock.current >= scenario.duration) {
          setPlaying(false)
          return
        }
      }
      previous = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, rate, scenario, startedAt])

  return { scenario, time, startedAt, playing, rate, acknowledged, start, toggle, seek, setRate, acknowledge: () => setAcknowledged(true) }
}

function Metric({ icon, label, children, sub, tone = 'normal' }: {
  icon: ReactNode; label: string; children: ReactNode; sub: ReactNode; tone?: Risk
}) {
  return <article className={`panel metric tone-${tone}`}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-copy"><div className="metric-label">{label}</div><div className="metric-value">{children}</div><div className="metric-sub">{sub}</div></div>
  </article>
}

function WarningDialog({ detection, subject, close }: { detection: Detection; subject: Subject; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const risk = detection.risk
  const title = risk === 'danger' ? '낙상 발생' : '야간이탈 감지'
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={`warning-dialog tone-${risk}`} aria-labelledby="warning-title"
    aria-describedby="warning-description" onCancel={event => { event.preventDefault(); close() }}>
    <button className="icon-button dialog-close" aria-label="경고 닫기" onClick={close}><X size={18} /></button>
    <div className="dialog-head"><span className="dialog-icon"><TriangleAlert size={28} /></span>
      <div><h2 id="warning-title">{title}</h2><p id="warning-description">{detection.label} 이벤트가 감지되었습니다.</p></div>
    </div>
    <dl className="dialog-details">
      <div><dt><CalendarClock size={16} /> 발생 일시</dt><dd>{dateTimeLabel(detection.time)}</dd></div>
      <div><dt><MapPin size={16} /> 장소</dt><dd>{subject.room}</dd></div>
      <div><dt><UserRound size={16} /> 대상자</dt><dd>{subject.name}</dd></div>
      <div><dt><Layers3 size={16} /> 발생 위치</dt><dd>{ZONE[detection.sample.zone].label} · X {detection.sample.x.toFixed(2)} / Y {detection.sample.y.toFixed(2)}</dd></div>
      <div><dt><ShieldAlert size={16} /> 위험도</dt><dd className="dialog-risk">{RISK_LABEL[risk]}</dd></div>
    </dl>
    <button className="confirm-button" onClick={close} autoFocus>확인</button>
  </dialog>
}

function TechnologyDemo() {
  const subject = DEMO_SUBJECT
  const replay = useReplay()
  const { scenario, time, startedAt, playing, rate, acknowledged, start, toggle, seek, setRate, acknowledge } = replay
  const { sample } = frameAt(scenario, time)
  const history = historyAt(scenario, time)
  const detection = detectionAt(scenario, time, startedAt)
  const risk = detection?.risk ?? 'normal'
  const showWarning = detection && !acknowledged && (scenario.category === 'fall' || scenario.id === 'night')
  const zone = ZONE[sample.zone].label
  const ended = time >= scenario.duration
  const [expandedView, setExpandedView] = useState<'plan' | 'cloud' | null>(null)
  const demo = useRef<HTMLDivElement>(null)
  const [presenting, setPresenting] = useState(false)

  useEffect(() => {
    const syncFullscreen = () => setPresenting(document.fullscreenElement === demo.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function toggleFullscreen() {
    if (document.fullscreenElement === demo.current && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
    } else if (presenting) {
      setPresenting(false)
    } else {
      try { await demo.current?.requestFullscreen() } catch { setPresenting(true) }
    }
  }

  return <div ref={demo} className={`dashboard dashboard-embedded${presenting ? ' technology-presenting' : ''}`}>
    <div className="workspace">
      <div className="page-title"><h3>병실 모니터링</h3><span className="dashboard-subject"><UserRound size={15} /> {subject.name} <i /> <MapPin size={15} /> {subject.room} <i /> {ROOM_SIZE}
        <button type="button" className="view-expand" onClick={() => void toggleFullscreen()}>{presenting ? <Minimize size={13} /> : <Maximize size={13} />}{presenting ? '전체 화면 종료' : '전체 화면'}</button>
      </span></div>

      <section className="metrics" aria-label="상태 요약">
        <Metric icon={<UserRound />} label="현재 재실 상태" sub={sample.presence ? '병실 내 1명' : '병실 내 0명'}>
          <span className={sample.presence ? 'metric-green' : ''}>{sample.presence ? '재실' : '부재'}</span>
        </Metric>
        <Metric icon={<MapPin />} label="현재 위치" sub={sample.presence ? `X ${sample.x.toFixed(2)} / Y ${sample.y.toFixed(2)}` : '측정 좌표 없음'}>{zone}</Metric>
        <Metric icon={risk === 'normal' ? <ShieldCheck /> : <ShieldAlert />} label="위험도"
          sub={risk === 'normal' ? '경고 없음' : acknowledged ? '경고 확인됨' : '이벤트 감지됨'} tone={risk}>
          <span className={`risk-value ${risk === 'normal' ? 'metric-green' : ''}`}><i />{RISK_LABEL[risk]}</span>
        </Metric>
      </section>

      <section className="panel simulation-panel" aria-label="시나리오 실행 및 재생 제어">
        <div className="scenario-groups">
          <div className="scenario-group">
            <h2><Zap size={17} /> 기본 이벤트 <small>7종</small></h2>
            <div className="basic-buttons">
              {SCENARIOS.filter(item => item.category === 'basic').map((item, i) => {
                const Icon = ICONS[i]
                return <button key={item.id} className="scenario-button" aria-pressed={scenario.id === item.id}
                  title={item.description} onClick={() => start(item)}><Icon size={17} /><span>{item.label}</span></button>
              })}
            </div>
          </div>
          <div className="scenario-group fall-group">
            <h2><TriangleAlert size={17} /> 낙상 시나리오 <small>4종</small></h2>
            <div className="fall-buttons">
              {SCENARIOS.filter(item => item.category === 'fall').map((item, i) =>
                <button key={item.id} className="scenario-button fall-button" aria-pressed={scenario.id === item.id}
                  title={item.description} onClick={() => start(item)}><span className="fall-number" aria-hidden="true">{i + 1}</span><span>{item.label}</span></button>
              )}
            </div>
          </div>
        </div>
        <div className="transport">
          <button className="play-button icon-button" aria-label={playing ? '일시정지' : '재생'} title={playing ? '일시정지' : '재생'} onClick={toggle}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <button className="icon-button restart-button" aria-label="재시작" title="재시작" onClick={() => start(scenario)}><RotateCcw size={17} /></button>
          <div className="speed-control"><select aria-label="재생속도" value={rate} onChange={event => setRate(Number(event.target.value))}>
            <option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="4">4×</option>
          </select><ChevronDown size={13} /></div>
          <span className="playback-status"><i className={playing ? 'playing' : ''} />{ended ? '재생 완료' : playing ? '재생 중' : '일시정지'}</span>
          <input className="timeline" type="range" aria-label="시뮬레이션 시간" min={0} max={scenario.duration} step=".01"
            value={time} style={{ background: `linear-gradient(to right, #3694ea ${time / scenario.duration * 100}%, #e1ebf5 ${time / scenario.duration * 100}%)` }}
            onChange={event => seek(Number(event.target.value))} />
          <span className="elapsed">{time.toFixed(1)} <span>/ {scenario.duration.toFixed(1)} s</span></span>
        </div>
      </section>

      <section className="monitor-grid" aria-label="병실 시각화">
        <article className="panel monitor-panel">
          <PanelHeading icon={<Layers3 />} suffix={<button className="view-expand" type="button" aria-label="실증 공간 배치도 확대"
            onClick={() => setExpandedView('plan')}><Maximize size={13} /> 확대</button>}>실증 공간 배치도</PanelHeading>
          <div className="plan-stage"><FloorPlan sample={sample} history={history} risk={risk} /></div>
        </article>
        <article className="panel monitor-panel">
          <PanelHeading icon={<Box />} suffix={<button className="view-expand" type="button" aria-label="3D 점군 확대"
            onClick={() => setExpandedView('cloud')}><Maximize size={13} /> 확대</button>}>3D 점군</PanelHeading>
          <Room3D sample={sample} risk={risk} />
        </article>
      </section>

      <section className="chart-grid" aria-label="동적 분석 그래프">
        <SignalChart icon={<Waves />} label="움직임 강도" field="intensity" unit="" color="#358ce7" max={1}
          history={history} duration={scenario.duration} detection={detection} elapsed={time} />
        <SignalChart icon={<ArrowDownUp />} label="높이 변화 (Z축)" field="z" unit="m" color="#378de7" max={2}
          history={history} duration={scenario.duration} detection={detection} elapsed={time} />
        <SignalChart icon={<Footprints />} label="이동속도 추이" field="speed" unit="m/s" color="#358ce7" max={1.5}
          history={history} duration={scenario.duration} detection={detection} elapsed={time} />
      </section>
    </div>
    {expandedView === 'plan' && <ViewDialog title="실증 공간 배치도" closeLabel="배치도 닫기" close={() => setExpandedView(null)}>
      <FloorPlan sample={sample} history={history} risk={risk} />
    </ViewDialog>}
    {expandedView === 'cloud' && <ViewDialog title="3D 점군" closeLabel="3D 점군 닫기" close={() => setExpandedView(null)} wide>
      <Room3D sample={sample} risk={risk} interactive />
    </ViewDialog>}
    {showWarning && <WarningDialog detection={detection} subject={subject} close={acknowledge} key={`${scenario.id}-${startedAt}`} />}
  </div>
}

function readRoute() {
  return window.location.hash.slice(1)
}

function readSession() {
  try { return sessionStorage.getItem(SESSION_KEY) === 'active' } catch { return false }
}

function readAlertIds(key: string): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

export function App({ experiment = null, publicDemo = false }: { experiment?: ExperimentRecording[] | null; publicDemo?: boolean }) {
  const [route, setRoute] = useState(readRoute)
  const [signedIn, setSignedIn] = useState(readSession)
  const [rooms, setRooms] = useState(() => readFacilityRooms(experiment ? experimentRooms(experiment) : undefined))
  const [editor, setEditor] = useState<RoomRecord | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RoomRecord | null>(null)
  const [storageError, setStorageError] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => window.matchMedia('(min-width: 721px)').matches)
  const [confirmedIds, setConfirmedIds] = useState(() => readAlertIds('carewave.institution.confirmed'))
  const [activeAlert, setActiveAlert] = useState<CareEvent | null>(null)
  const [routeType, roomId, roomView] = route.split('/')
  const room = route === 'daily-report' ? rooms.find(entry => entry.name) : routeType === 'room' ? rooms.find(entry => entry.id === roomId) : undefined
  const recording = experiment?.find(entry => entry.id === room?.id)
  const showReport = Boolean(room && (roomView === 'report' || route === 'daily-report'))
  const page = route === 'demo' || route === 'daily-report' || route.startsWith('room/') ? 'dashboard' : route === 'subjects' ? 'subjects' : route === 'alerts' ? 'alerts' : route === 'settings' ? 'settings' : null
  const showLogin = route === 'login' || route === 'demo-entry' || Boolean(page && !signedIn)
  const screen = showLogin ? 'login' : page ?? 'landing'
  const liveEnabled = Boolean(experiment && signedIn && page && !showLogin)
  const { events: liveEvents, statuses, reset: resetLiveEvents } = useLiveExperiment(liveEnabled, rooms)
  const displayedRooms = liveEnabled ? rooms.map(entry => ({ ...entry, ...statuses.get(entry.id), occupied: true })) : rooms
  const displayedRoom = displayedRooms.find(entry => entry.id === room?.id)
  const lastShownEvent = useRef<string | null>(null)
  const latestLiveEvent = liveEvents[0]
  const previousScreen = useRef(`${screen}/${room?.id ?? ''}/${showReport}`)
  const isConfirmed = (event: CareEvent) => event.confirmed || confirmedIds.includes(event.id)
  const alerts = liveEvents.filter(event => rooms.some(entry => entry.id === event.room))
  const roomAlerts = room ? alerts.filter(event => event.room === room.id) : []
  const pendingAlerts = alerts.filter(event => !isConfirmed(event))
  const alertRoom = activeAlert && rooms.find(entry => entry.id === activeAlert.room)

  useEffect(() => {
    if (!liveEnabled || !latestLiveEvent || lastShownEvent.current === latestLiveEvent.id) return
    if (screen === 'alerts') {
      lastShownEvent.current = latestLiveEvent.id
      return
    }
    if (editor || deleting || activeAlert) return
    lastShownEvent.current = latestLiveEvent.id
    setActiveAlert(latestLiveEvent)
  }, [liveEnabled, latestLiveEvent, screen, editor, deleting, activeAlert])

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const title = screen === 'landing' ? '비카메라 시니어 돌봄' : screen === 'login' ? '로그인' : room ? `${roomLabel(room)} ${showReport ? '생활 리포트' : '상세정보'}` : CARE_PAGES[screen].label
    document.title = `CareWave | ${title}`
    const screenKey = `${screen}/${room?.id ?? ''}/${showReport}`
    if (previousScreen.current !== screenKey) {
      previousScreen.current = screenKey
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      const focusTarget = screen === 'login' ? '.login-submit' : 'h1[tabindex="-1"]'
      document.querySelector<HTMLElement>(focusTarget)?.focus({ preventScroll: true })
    }

    // Hash targets may mount only after the hash change, such as on browser Back.
    const target = screen === 'landing' && route ? document.getElementById(route) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [route, screen, room, showReport])

  function setSession(active: boolean) {
    setSignedIn(active)
    try {
      if (active) sessionStorage.setItem(SESSION_KEY, 'active')
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // The in-memory session still works when browser storage is blocked.
    }
  }

  function signOut() {
    resetLiveEvents()
    setSession(false)
    setActiveAlert(null)
    window.location.hash = 'login'
  }

  function confirmAlert(event: CareEvent) {
    if (!isConfirmed(event)) {
      const next = [...confirmedIds, event.id]
      setConfirmedIds(next)
      if (!event.simulated) {
        try { localStorage.setItem('carewave.institution.confirmed', JSON.stringify(next.filter(id => !id.startsWith('live-')))) } catch { setStorageError(true) }
      }
    }
    setActiveAlert(null)
  }

  function saveRooms(next: RoomRecord[]) {
    setRooms(next)
    try {
      writeFacilityRooms(next, Boolean(experiment))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  function saveRoom(details: SubjectDetails) {
    const existing = editor === 'new' ? undefined : editor ?? undefined
    const next = updateRoom(details, existing)
    saveRooms(existing ? rooms.map(entry => entry.id === existing.id ? next : entry) : [...rooms, next])
    setEditor(null)
  }

  function removeRoom() {
    if (!deleting) return
    saveRooms(rooms.filter(entry => entry.id !== deleting.id))
    if (room?.id === deleting.id) window.location.hash = 'demo'
    setDeleting(null)
  }

  if (screen === 'login') return <InstitutionLogin onEnter={() => {
    setSession(true)
    if (!page) window.location.hash = 'demo'
  }} />
  if (screen === 'landing') return <Landing dashboardPreview={<TechnologyDemo />} signedIn={signedIn} />

  const headerSubtitle = publicDemo
    ? '실증에서 확인한 이벤트 유형을 바탕으로 구성했습니다.'
    : experiment ? '실증에서 수집한 데이터를 바탕으로 구성했습니다.' : '관리자 대시보드'

  return <div className={`care-shell institution-shell${sidebarExpanded ? '' : ' care-shell-collapsed'}`}>
    <CareSidebar page={screen} expanded={sidebarExpanded} toggle={() => setSidebarExpanded(current => !current)} navigate={() => {
      if (window.matchMedia('(max-width: 720px)').matches) setSidebarExpanded(false)
    }} />
    <div className="care-content">
      {storageError && <p className="care-storage-error" role="status">브라우저 저장소를 사용할 수 없어 변경 내용이 이 탭에서만 유지됩니다.</p>}
      {room && !showReport ? <RoomDetailHeader room={room} recording={recording} subtitle={headerSubtitle} /> : <header className="institution-header">
        <div><p className="institution-header-title">비카메라 센서 기반 시니어 생활패턴 AI 위험감지 서비스</p>
          <p className="institution-header-subtitle">{headerSubtitle}</p>
        </div>
        <div className="institution-header-actions"><InstitutionClock />
          <button type="button" className="icon-button institution-signout" title="로그아웃" aria-label="로그아웃" onClick={signOut}><LogOut size={17} /></button></div>
      </header>}
      {screen === 'dashboard' && !room && <InstitutionOverview rooms={displayedRooms} addRoom={() => setEditor('new')} pendingAlerts={pendingAlerts} openAlert={setActiveAlert} experimentAlerts={experiment ? liveEvents : undefined} publicDemo={publicDemo} />}
      {screen === 'dashboard' && room && (showReport ? <div className="institution-report-view">
        <a className="institution-secondary" href={roomHref(room.id)}>{roomLabel(room)} 상세정보로 돌아가기</a>
        {recording ? <RoomDetails key={`${room.id}/report`} room={room} recording={recording} publicDemo={publicDemo} reportOnly isConfirmed={isConfirmed} confirm={confirmAlert} roomAlerts={roomAlerts} /> : <DailyReport subject={room.name ? roomSubject(room) : null} />}
      </div> : <RoomDetails key={room.id} room={displayedRoom ?? room} recording={recording} publicDemo={publicDemo} liveStatus={liveEnabled ? statuses.get(room.id) : undefined} roomAlerts={roomAlerts} edit={() => setEditor(room)} remove={() => setDeleting(room)} isConfirmed={isConfirmed} confirm={confirmAlert} />)}
      {screen === 'subjects' && <Subjects rooms={rooms} add={() => setEditor('new')} edit={setEditor} remove={setDeleting} />}
      {screen === 'alerts' && <AlertHistory alerts={alerts} rooms={rooms} isConfirmed={isConfirmed} openAlert={setActiveAlert} confirm={confirmAlert} />}
      {screen === 'settings' && <InstitutionSettings signOut={signOut} />}
    </div>
    {activeAlert && alertRoom && <InstitutionAlert key={activeAlert.id} event={activeAlert} room={alertRoom} close={() => setActiveAlert(null)} confirm={() => confirmAlert(activeAlert)} />}
    {editor && <RoomEditor room={editor === 'new' ? undefined : editor} rooms={rooms} close={() => setEditor(null)} save={saveRoom} />}
    {deleting && <RoomDeleteDialog room={deleting} close={() => setDeleting(null)} remove={removeRoom} />}
  </div>
}
