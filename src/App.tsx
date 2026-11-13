import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, ArrowDownUp, ArrowRight, BedDouble, Box, CalendarClock, ChevronDown, Clock3, DoorOpen,
  Footprints, Layers3, LogOut, MapPin, Maximize, Minimize, Moon, Pause, Play, Radio,
  RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert, UserRound, Waves, X, Zap,
} from 'lucide-react'
import { Brand } from './Brand.tsx'
import { CARE_PAGES, CareSidebar } from './CareSidebar.tsx'
import { DailyReport } from './DailyReport.tsx'
import { Landing } from './Landing.tsx'
import { ROOM_SIZE } from './room.ts'
import { Room3D } from './Room3D.tsx'
import {
  advanceTime, detectionAt, frameAt, historyAt, RISK_LABEL, SCENARIO_BY_ID, SCENARIOS, ZONE,
} from './scenarios.ts'
import type { Detection, Risk, Scenario } from './scenarios.ts'
import { DEMO_SUBJECT, readDirectory, writeDirectory } from './subjectDirectory.ts'
import type { Subject, SubjectDetails, SubjectDirectory } from './subjectDirectory.ts'
import { Subjects } from './Subjects.tsx'
import { FloorPlan, PanelHeading, SignalChart, ViewDialog } from './visuals.tsx'
import './care-workspace.css'

const ICONS = [UserRound, DoorOpen, Footprints, Clock3, BedDouble, Moon, LogOut]
const DASHBOARD_TITLE = CARE_PAGES.dashboard.label
const INITIAL_TIME = 5.8
const SESSION_KEY = 'carewave.demo.operator'
const TIME_ZONE = 'Asia/Seoul'
const clockFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeLabel = (time: number) => clockFormatter.format(time)
const dateTimeLabel = (time: number) => `${dateFormatter.format(time)} ${timeLabel(time)}`

function getOperator() {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

function Login({ onEnter }: { onEnter: (operator: string) => void }) {
  const [name, setName] = useState('시연 운영자')
  const scenario = SCENARIO_BY_ID.movement
  const { sample } = frameAt(scenario, INITIAL_TIME)

  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) onEnter(name.trim())
  }

  return <div className="entry-page">
    <header className="entry-header"><a href="#top" className="dashboard-home"><Brand /></a><span className="mode-badge"><Radio size={14} /> 시뮬레이션 모드</span></header>
    <main className="entry-layout">
      <section className="entry-content">
        <span className="entry-kicker"><Activity size={16} /> 병실 모니터링</span>
        <h1 tabIndex={-1}>CareWave<br />{DASHBOARD_TITLE}</h1>
        <p>병실 내 움직임과 이상 이벤트를 재생하고<br className="desktop-break" /> 위치, 높이, 이동속도의 변화를 확인하세요.</p>
        <form onSubmit={enter}>
          <label htmlFor="operator">운영자 이름</label>
          <div className="entry-input"><UserRound size={18} /><input id="operator" name="operator" value={name}
            onChange={event => setName(event.target.value)} maxLength={24} required autoComplete="off" /></div>
          <button className="entry-submit" disabled={!name.trim()}>시뮬레이션 시작 <ArrowRight size={18} /></button>
        </form>
        <small>시연용 입장 화면 · 가상 대상자 데이터 사용</small>
      </section>
      <div className="entry-preview" aria-hidden="true">
        <div className="preview-label"><span><Layers3 size={17} /> 병실 A-01</span><span className="live-pill"><i /> 재실</span></div>
        <FloorPlan sample={sample} history={historyAt(scenario, INITIAL_TIME)} risk="normal" />
        <div className="preview-signal"><Activity size={20} /><svg viewBox="0 0 265 35" preserveAspectRatio="none">
          <path d="M0 25h28l10-4 8 5 10-17 10 22 9-14 8 7 19 1 13-7 9 3 8-15 10 26 10-14 8 6h17l11-4 8 6 10-18 11 22 9-10 8 3h21"
            fill="none" stroke="#4195e8" strokeWidth="2" strokeLinejoin="round" />
        </svg><span>{sample.z.toFixed(2)} <small>m</small></span></div>
      </div>
    </main>
  </div>
}

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

type DashboardProps = { embedded: true } | { embedded?: false; subject: Subject; operator: string; logout: () => void }

function Dashboard(props: DashboardProps) {
  const { embedded } = props
  const subject = props.embedded ? DEMO_SUBJECT : props.subject
  const replay = useReplay()
  const { scenario, time, startedAt, playing, rate, acknowledged, start, toggle, seek, setRate, acknowledge } = replay
  const { sample } = frameAt(scenario, time)
  const history = historyAt(scenario, time)
  const detection = detectionAt(scenario, time, startedAt)
  const risk = detection?.risk ?? 'normal'
  const showWarning = detection && !acknowledged && (scenario.category === 'fall' || scenario.id === 'night')
  const zone = ZONE[sample.zone].label
  const ended = time >= scenario.duration
  const [full, setFull] = useState(false)
  const [presentation, setPresentation] = useState(false)
  const [expandedView, setExpandedView] = useState<'plan' | 'cloud' | null>(null)
  const [wallTime, setWallTime] = useState(Date.now)
  const presentationActive = full || presentation

  useEffect(() => {
    if (embedded) return
    const handleFull = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFull)
    const timer = window.setInterval(() => setWallTime(Date.now()), 1000)
    return () => {
      document.removeEventListener('fullscreenchange', handleFull)
      window.clearInterval(timer)
    }
  }, [embedded])

  async function fullscreen() {
    if (presentation) {
      setPresentation(false)
      return
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      if (!document.fullscreenElement) setPresentation(true)
    }
  }

  function exit() {
    if (props.embedded) return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    props.logout()
  }

  const Workspace = embedded ? 'div' : 'main'
  const Title = embedded ? 'h3' : 'h1'
  return <div className={`dashboard ${embedded ? 'dashboard-embedded' : ''} ${presentationActive ? 'is-presenting' : ''}`}>
    {!props.embedded && <header className="app-header">
      <div className="header-brand"><Brand /><span className="brand-description">시니어 생활패턴 위험감지</span></div>
      <div className="header-tools">
        <span className="wall-time">{dateTimeLabel(wallTime)}</span>
        <span className="mode-badge"><Radio size={14} /> 시뮬레이션 모드</span>
        <button className="fullscreen-button" onClick={() => void fullscreen()} aria-pressed={presentationActive}
          aria-label={presentation ? '발표 모드 종료' : full ? '전체 화면 종료' : '전체 화면'}>
          {presentationActive ? <Minimize size={16} /> : <Maximize size={16} />}
          <span>{presentation ? '발표 모드 종료' : full ? '전체 화면 종료' : '전체 화면'}</span>
        </button>
        <button className="icon-button logout-button" onClick={exit} aria-label="시연 종료" title={`${props.operator} · 시연 종료`}><LogOut size={17} /></button>
      </div>
    </header>}
    <Workspace className="workspace">
      <div className="page-title"><Title tabIndex={-1}>{DASHBOARD_TITLE}</Title><span className="dashboard-subject"><UserRound size={15} /> {subject.name} <i /> <MapPin size={15} /> {subject.room} <i /> {ROOM_SIZE}</span></div>

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
    </Workspace>
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

export function App() {
  const [route, setRoute] = useState(readRoute)
  const [operator, setOperator] = useState(getOperator)
  const [directory, setDirectory] = useState(readDirectory)
  const [storageError, setStorageError] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => window.matchMedia('(min-width: 721px)').matches)
  const screen = route === 'subjects' ? 'subjects' : route === 'daily-report' ? 'report' : route === 'demo' ? 'dashboard' : route === 'demo-entry' ? 'entry' : 'landing'
  const previousScreen = useRef(screen)
  const selected = directory.subjects.find(subject => subject.id === directory.selectedId) ?? null

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const title = screen === 'landing' ? '비카메라 시니어 돌봄' : screen === 'report' ? '하루 생활 분석 리포트' : screen === 'subjects' ? CARE_PAGES.subjects.label : DASHBOARD_TITLE
    document.title = `CareWave | ${title}`
    if (previousScreen.current !== screen) {
      previousScreen.current = screen
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
    }

    // Hash targets may mount only after the hash change, such as on browser Back.
    const target = screen === 'landing' && route ? document.getElementById(route) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [route, screen])

  function setSession(name: string) {
    setOperator(name)
    try {
      if (name) sessionStorage.setItem(SESSION_KEY, name)
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // The in-memory session still works when browser storage is blocked.
    }
  }

  function updateDirectory(next: SubjectDirectory) {
    setDirectory(next)
    try {
      writeDirectory(next)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  function saveSubject(details: SubjectDetails, id?: string) {
    const subject = { ...details, id: id ?? crypto.randomUUID() }
    const subjects = id ? directory.subjects.map(entry => entry.id === id ? subject : entry) : [...directory.subjects, subject]
    updateDirectory({ subjects, selectedId: subject.id })
  }

  function removeSubject(id: string) {
    const subjects = directory.subjects.filter(subject => subject.id !== id)
    updateDirectory({ subjects, selectedId: directory.selectedId === id ? subjects[0]?.id ?? null : directory.selectedId })
  }

  if (screen === 'entry') return <Login onEnter={name => { setSession(name); window.location.hash = 'demo' }} />
  if (screen === 'landing') return <Landing dashboardPreview={<Dashboard embedded />} />

  return <div className={`care-shell${sidebarExpanded ? '' : ' care-shell-collapsed'}`}>
    <CareSidebar page={screen} expanded={sidebarExpanded} toggle={() => setSidebarExpanded(current => !current)} navigate={() => {
      if (window.matchMedia('(max-width: 720px)').matches) setSidebarExpanded(false)
    }} />
    <div className="care-content">
      {storageError && <p className="care-storage-error" role="status">브라우저 저장소를 사용할 수 없어 변경 내용이 이 탭에서만 유지됩니다.</p>}
      {screen === 'dashboard' && selected ? <Dashboard key={selected.id} subject={selected} operator={operator || '시연 운영자'} logout={() => {
        setSession('')
        window.location.hash = 'top'
      }} /> : <>
        <header className="app-header"><Brand /></header>
        {screen === 'subjects' && <Subjects subjects={directory.subjects} selected={selected} select={id => updateDirectory({ ...directory, selectedId: id })}
          save={saveSubject} remove={removeSubject} />}
        {screen === 'report' && <DailyReport subject={selected} />}
        {screen === 'dashboard' && <main className="subjects-page">
          <h1 tabIndex={-1}>{DASHBOARD_TITLE}</h1>
          <section className="panel subject-empty"><UserRound size={25} /><h2>모니터링할 대상자가 없습니다</h2>
            <a className="subject-button subject-primary" href="#subjects">대상자 정보 열기</a></section>
        </main>}
      </>}
    </div>
  </div>
}
