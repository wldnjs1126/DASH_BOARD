import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowDown, ArrowRight, BellRing, BrainCircuit, ChevronRight, ClipboardList,
  BedDouble, Box, Clock3, DoorOpen, Footprints, HeartHandshake, Layers3, Moon, Play,
  Radar, ShieldCheck, TriangleAlert, UserRound, VideoOff,
} from 'lucide-react'
import { Brand } from './Brand.tsx'
import { Room3D } from './Room3D.tsx'
import { frameAt, historyAt, ROOM, SCENARIO_BY_ID, ZONE } from './scenarios.ts'
import { FloorPlan } from './visuals.tsx'
import './landing.css'

const examples = [
  { id: 'movement', title: '일상 활동', time: 5.8, note: '이동 경로와 현재 위치를 확인합니다.' },
  { id: 'night', title: '야간이탈', time: 8.45, note: '야간에 침대에서 일어나 출입구에 접근하면 주의 상태로 표시합니다.' },
  { id: 'fall-general', title: '낙상 의심', time: 6.4, note: '높이가 급격히 낮아지고 움직임이 줄어든 시점을 표시합니다.' },
] as const

const stages = [
  { icon: Radar, title: '센서 감지', text: 'mmWave 센서가 영상 촬영 없이 재실 여부, 위치, 움직임을 감지합니다.' },
  { icon: Activity, title: '이벤트 분류', text: '센서 신호를 재실·부재, 침대 체류, 수면 추정 등의 생활 이벤트로 분류합니다.' },
  { icon: BrainCircuit, title: 'AI 패턴 분석', text: '최근 활동량, 수면, 야간이탈 등을 개인의 평소 생활패턴과 비교합니다.' },
  { icon: ShieldCheck, title: '위험도 판단', text: '변화의 정도에 따라 정상·관찰·주의·위험 단계로 구분합니다.' },
  { icon: BellRing, title: '상태 확인', text: '기관 관리자와 보호자가 현재 상태와 확인이 필요한 이벤트를 살펴봅니다.' },
]

const events = [
  { icon: UserRound, title: '재실·부재', text: '생활공간에 대상자가 있는지 확인합니다.' },
  { icon: Footprints, title: '움직임 감지', text: '공간 안에서 움직임이 발생한 위치와 이동 경로를 살핍니다.' },
  { icon: Clock3, title: '장시간 미움직임', text: '일정 시간 이상 움직임이 감지되지 않는 상태를 확인합니다.' },
  { icon: BedDouble, title: '침대 체류', text: '침대 주변에 머문 시간과 체류 상태를 확인합니다.' },
  { icon: Moon, title: '수면 추정', text: '침대 체류와 움직임 패턴을 바탕으로 수면 상태를 추정합니다.' },
  { icon: DoorOpen, title: '야간이탈', text: '야간에 침대에서 일어나거나 생활공간을 벗어나는 상황을 확인합니다.' },
  { icon: TriangleAlert, title: '낙상 의심', text: '높이가 급격히 낮아지고 움직임이 줄어드는 등 낙상이 의심되는 변화를 확인합니다.' },
]

const riskLevels = [
  { level: 'normal', label: '정상', text: '평소 생활패턴 범위' },
  { level: 'watch', label: '관찰', text: '일부 변화 확인' },
  { level: 'caution', label: '주의', text: '지속적인 이상 변화' },
  { level: 'danger', label: '위험', text: '즉각적인 확인이 필요' },
]

const careUsers = [
  {
    icon: ClipboardList, title: '기관 관리자', description: '여러 대상자의 상태를 한 화면에 모아 확인 우선순위를 정합니다.',
    features: ['대상자별 현재 상태', '생활 이벤트와 위험도', '최근 이상 행동 및 알림 내역', '일별 생활패턴'],
  },
  {
    icon: HeartHandshake, title: '보호자', description: '떨어져 지내는 가족의 일상과 주요 변화를 확인합니다.',
    features: ['현재 상태', '주요 생활 이벤트', '생활패턴 변화', '위험 발생 정보'],
  },
]

const exampleResidents = [
  { name: '김○○', presence: '재실', event: '정상 활동', risk: riskLevels[0] },
  { name: '이○○', presence: '재실', event: '야간이탈 1회', risk: riskLevels[1] },
  { name: '박○○', presence: '부재', event: '외출', risk: riskLevels[0] },
  { name: '최○○', presence: '재실', event: '장시간 미움직임', risk: riskLevels[2] },
]

const detailsLinks = [
  ['service', '서비스 소개'],
  ['how-it-works', '작동 방식'],
  ['features', '감지 이벤트'],
  ['ai-analysis', 'AI 분석'],
  ['care-users', '이용 대상'],
  ['dashboard', '모니터링'],
  ['privacy', '프라이버시'],
]

function RiskBadge({ risk }: { risk: typeof riskLevels[number] }) {
  return <span className={`landing-risk landing-risk-${risk.level}`}>{risk.label}</span>
}

function DemoLink({ children, light = false }: { children: string; light?: boolean }) {
  return <a className={`landing-action ${light ? 'landing-action-light' : ''}`} href="#demo">{children}<ArrowRight size={17} aria-hidden="true" /></a>
}

function RoomPreview() {
  const [selected, setSelected] = useState(0)
  const [view, setView] = useState<'3d' | '2d'>('3d')
  const example = examples[selected]
  const scenario = SCENARIO_BY_ID[example.id]
  const { sample } = frameAt(scenario, example.time)
  const history = historyAt(scenario, example.time)
  const heightLine = history.map((point, i) =>
    `${i ? 'L' : 'M'}${(point.timestamp / example.time * 190 + 5).toFixed(1)},${(49 - point.z * 24).toFixed(1)}`,
  ).join(' ')
  const riskLabel = { normal: '정상', caution: '주의', danger: '위험' }[scenario.risk]
  return <div className="landing-preview" aria-labelledby="room-preview-title">
    <div className="landing-preview-head">
      <div><span className="landing-preview-label"><Layers3 size={15} aria-hidden="true" /> 병실 모니터링</span><h2 id="room-preview-title">{ROOM.name}</h2></div>
      <span className="landing-sample">시뮬레이션 예시</span>
    </div>
    <div className="landing-preview-controls" role="group" aria-label="시뮬레이션 예시 선택">
      {examples.map((item, index) =>
        <button key={item.id} type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>{item.title}</button>,
      )}
    </div>
    <div className="landing-preview-grid">
      <div className="landing-view">
        <div className="landing-view-toggle" role="group" aria-label="병실 표시 방식">
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><Box size={13} aria-hidden="true" /> 3D 점군</button>
          <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}><Layers3 size={13} aria-hidden="true" /> 2D 경로</button>
        </div>
        {view === '3d'
          ? <Room3D sample={sample} risk={scenario.risk} />
          : <div className="landing-plan"><FloorPlan sample={sample} history={history} risk={scenario.risk} /></div>}
      </div>
      <div className="landing-readings">
        <div className={`landing-reading landing-reading-${scenario.risk}`}>
          <span>위험도</span>
          <strong><i />{riskLabel}</strong>
        </div>
        <div className="landing-reading"><span>현재 위치</span><strong>{ZONE[sample.zone].label}</strong></div>
        <div className="landing-reading landing-height">
          <span>높이 변화</span><strong>{sample.z.toFixed(2)} <small>m</small></strong>
          <svg viewBox="0 0 200 51" role="img" aria-label="예시의 높이 변화 그래프">
            <path d="M5 13H195 M5 31H195 M5 49H195" stroke="#dce9f3" strokeWidth="1" fill="none" />
            <path d={heightLine} stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
    </div>
    <p className="landing-preview-note" aria-live="polite">{example.note}</p>
  </div>
}

export function Landing({ dashboardPreview }: { dashboardPreview: ReactNode }) {
  return <div className="landing" id="top">
    <header className="landing-header">
      <div className="landing-shell landing-nav">
        <a className="landing-brand" href="#top" aria-label="CareWave 처음으로"><Brand /></a>
        <nav aria-label="서비스 소개 메뉴">
          <a href="#service">서비스 소개</a>
          <a href="#features">감지 이벤트</a>
          <a href="#ai-analysis">AI 분석</a>
        </nav>
        <DemoLink>사용해보기</DemoLink>
      </div>
    </header>
    <main>
      <section className="landing-hero-band" aria-labelledby="landing-title">
        <div className="landing-hero landing-shell">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><Radar size={17} aria-hidden="true" /> mmWave 센서 · 시니어 돌봄</p>
          <h1 id="landing-title" tabIndex={-1}>카메라 없이<br />생활 변화를<br className="landing-hero-break" /> <em>살핍니다</em></h1>
          <p className="landing-lead">CareWave는 센서로 움직임을 감지하고 AI로 평소와 다른 생활 변화를 분석합니다. 기관 관리자와 보호자는 낙상 의심과 야간이탈 신호를 한눈에 확인할 수 있습니다.</p>
          <div className="landing-hero-actions">
            <DemoLink light>사용해보기</DemoLink>
            <a className="landing-text-link" href="#service">서비스 살펴보기 <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
          <p className="landing-demo-note"><Play size={13} aria-hidden="true" /> 가상 병실에서 11개 이벤트를 직접 재생할 수 있습니다.</p>
        </div>
        <RoomPreview />
        </div>
      </section>

      <section id="service" className="landing-service" aria-labelledby="service-title">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">서비스 소개</p>
            <h2 id="service-title">확인이 필요한 순간을<br className="landing-mobile-break" /> 한눈에</h2>
            <p>기관 관리자가 여러 시니어의 상태를 계속 살피거나, 보호자가 떨어져 지내는 가족의 안전을 하루 종일 확인하기는 어렵습니다. 침실처럼 카메라 설치가 부담스러운 공간에서도 확인이 필요한 변화를 파악할 수 있도록 CareWave를 설계했습니다.</p>
          </div>
          <div className="landing-benefits">
            <article><span><VideoOff aria-hidden="true" /></span><h3>개인 생활공간 보호</h3><p>침실과 같은 공간에서도 영상 촬영 없이 재실 여부와 움직임을 감지합니다.</p></article>
            <article><span><Activity aria-hidden="true" /></span><h3>평소와 다른 변화 감지</h3><p>낙상 의심, 장시간 미움직임, 야간이탈을 확인하고 활동·수면의 변화도 살핍니다.</p></article>
            <article><span><ClipboardList aria-hidden="true" /></span><h3>상태와 위험도 통합 확인</h3><p>현재 상태, 최근 이벤트, 위험도와 생활패턴을 한 화면에서 확인합니다.</p></article>
          </div>
        </div>
      </section>

      <nav className="landing-shell landing-contents" aria-label="서비스 상세 목차">
        {detailsLinks.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <section id="how-it-works" className="landing-shell landing-workflow" aria-labelledby="workflow-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">작동 방식</p>
          <h2 id="workflow-title">센서 신호가 돌봄 정보로 바뀌는 과정</h2>
        </div>
        <ol className="landing-steps">
          {stages.map(({ icon: Icon, title, text }, index) =>
            <li key={title}><span className="landing-step-icon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p>
              {index < stages.length - 1 && <ChevronRight className="landing-step-arrow" size={18} aria-hidden="true" />}
            </li>,
          )}
        </ol>
      </section>

      <section id="features" className="landing-service" aria-labelledby="features-title">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">감지 이벤트</p>
            <h2 id="features-title">센서 신호를 일상 행동으로 읽습니다</h2>
            <p>센서에서 얻은 재실 여부, 위치, 높이, 움직임을 생활 이벤트로 정리해 돌봄에 필요한 상황을 확인할 수 있습니다.</p>
          </div>
          <ul className="landing-event-list">
            {events.map(({ icon: Icon, title, text }) => <li key={title}>
              <span className="landing-step-icon"><Icon aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div>
            </li>)}
          </ul>
        </div>
      </section>

      <section id="ai-analysis" className="landing-shell landing-detail-section" aria-labelledby="analysis-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">개인별 AI 분석</p>
          <h2 id="analysis-title">하루의 기록을 평소 생활패턴과 비교합니다</h2>
          <p>일별 생활 데이터를 쌓아 개인의 평소 활동과 수면 패턴을 파악합니다. 활동이 줄거나 야간이탈이 늘어나는 등 이전과 달라진 흐름을 비교해 확인 우선순위를 판단합니다.</p>
        </div>
        <div className="landing-detail-grid">
          <article className="landing-detail-card">
            <h3 className="landing-icon-heading"><BrainCircuit size={20} aria-hidden="true" />개인별 생활패턴</h3>
            <p>활동 시간, 수면 추정 시간, 야간이탈과 장시간 미움직임 횟수를 일별로 집계합니다. 평소 기준과 비교해 달라진 항목을 확인하고, 해당 이벤트의 발생 시각을 살펴볼 수 있습니다.</p>
          </article>
          <article className="landing-detail-card">
            <h3>서비스의 위험도 기준</h3>
            <ul className="landing-risk-list">
              {riskLevels.map(risk => <li key={risk.level}><span>{risk.text}</span><RiskBadge risk={risk} /></li>)}
            </ul>
          </article>
        </div>
      </section>

      <section id="care-users" className="landing-service" aria-labelledby="care-users-title">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="landing-kicker">이용 대상</p>
            <h2 id="care-users-title">관리자와 보호자가 확인하는 정보</h2>
          </div>
          <div className="landing-detail-grid">
            {careUsers.map(({ icon: Icon, title, description, features }) => <article className="landing-detail-card" key={title}>
              <h3 className="landing-icon-heading"><Icon size={20} aria-hidden="true" />{title}</h3>
              <p>{description}</p>
              <ul className="landing-checklist">{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            </article>)}
          </div>
        </div>
      </section>

      <section id="dashboard" className="landing-shell landing-detail-section" aria-labelledby="monitoring-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">통합 모니터링</p>
          <h2 id="monitoring-title">대상자 현황과 위험 알림을 한곳에서</h2>
          <p>아래에서 이벤트를 선택하면 실증 공간의 2D 배치도, 3D 점군, 위험도와 그래프가 함께 바뀝니다. 대상자별 상태와 위험 알림을 모아 보는 관리 화면 예시도 확인할 수 있습니다.</p>
        </div>
        <div className="landing-dashboard-frame">
          <div className="landing-dashboard-bar">
            <span className="landing-sample"><Play size={13} aria-hidden="true" /> 가상 데이터로 체험</span>
            <DemoLink>대시보드 크게 보기</DemoLink>
          </div>
          {dashboardPreview}
        </div>
        <div className="landing-detail-grid landing-monitor-grid">
          <article className="landing-detail-card">
            <div className="landing-card-heading"><h3>대상자 현황</h3><span className="landing-sample">관리 화면 예시</span></div>
            <table className="landing-residents">
              <thead><tr><th scope="col">대상자</th><th scope="col">재실</th><th scope="col">최근 이벤트</th><th scope="col">위험도</th></tr></thead>
              <tbody>{exampleResidents.map(row => <tr key={row.name}>
                <th scope="row">{row.name}</th><td>{row.presence}</td><td>{row.event}</td><td><RiskBadge risk={row.risk} /></td>
              </tr>)}</tbody>
            </table>
          </article>
          <article className="landing-detail-card">
            <h3 className="landing-icon-heading"><BellRing size={19} aria-hidden="true" />위험 알림 예시</h3>
            <ul className="landing-risk-list">
              <li><span>장시간 미움직임 확인</span><RiskBadge risk={riskLevels[2]} /></li>
              <li><span>야간이탈 횟수 증가</span><RiskBadge risk={riskLevels[1]} /></li>
            </ul>
            <p>시연에서는 일반·침대·화장실 입구·이동 중 낙상과 일상 이벤트를 포함한 11개 시나리오를 재생할 수 있습니다.</p>
          </article>
        </div>
      </section>

      <section id="privacy" className="landing-service" aria-labelledby="privacy-title">
        <div className="landing-shell landing-privacy">
          <span className="landing-privacy-icon"><VideoOff size={34} aria-hidden="true" /></span>
          <div className="landing-section-heading">
            <p className="landing-kicker">프라이버시</p>
            <h2 id="privacy-title">카메라 영상 없이 생활 상태를 감지합니다</h2>
            <p>침실 같은 개인 생활공간에서는 mmWave 센서로 재실 여부, 위치, 움직임을 감지합니다. 돌봄에 필요한 생활 이벤트와 패턴을 중심으로 화면에 표시합니다.</p>
          </div>
        </div>
      </section>

      <section className="landing-shell landing-final" aria-labelledby="landing-final-title">
        <div>
          <h2 id="landing-final-title">낙상 의심은 화면에 어떻게 표시될까요?</h2>
          <p>시뮬레이션에서 <strong>일반 낙상</strong>을 선택해 위치, 높이 그래프, 위험 경고가 함께 바뀌는 모습을 확인해보세요.</p>
        </div>
        <DemoLink light>사용해보기</DemoLink>
      </section>
    </main>
    <footer className="landing-shell landing-footer">
      <a className="landing-brand" href="#top" aria-label="CareWave 처음으로"><Brand /></a>
      <p>비카메라 센서 기반 시니어 생활패턴 AI 위험감지 서비스 개발 및 실증</p>
      <a href="#demo-entry">운영자 이름으로 입장 <ChevronRight size={15} aria-hidden="true" /></a>
    </footer>
  </div>
}
