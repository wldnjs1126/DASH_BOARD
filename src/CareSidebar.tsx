import { Activity, Bell, House, PanelLeftClose, PanelLeftOpen, Settings, UsersRound } from 'lucide-react'
import { Brand } from './Brand.tsx'

export const CARE_PAGES = {
  dashboard: { href: '#demo', label: '실시간 모니터링', icon: Activity },
  subjects: { href: '#subjects', label: '대상자 관리', icon: UsersRound },
  alerts: { href: '#alerts', label: '알림 내역', icon: Bell },
  settings: { href: '#settings', label: '설정', icon: Settings },
} as const

export type CarePage = keyof typeof CARE_PAGES

export function CareSidebar({ page, expanded, toggle, navigate }: {
  page: CarePage; expanded: boolean; toggle: () => void; navigate: () => void
}) {
  return <aside className="care-sidebar institution-sidebar">
    <div className="care-sidebar-heading">
      <a className="institution-sidebar-brand" href="#demo" aria-label="CareWave 대시보드" onClick={navigate}><Brand /></a>
      <button className="icon-button care-sidebar-toggle" type="button" aria-expanded={expanded} aria-controls="care-navigation"
        aria-label={expanded ? '사이드바 접기' : '사이드바 펼치기'} title={expanded ? '사이드바 접기' : '사이드바 펼치기'} onClick={toggle}>
        {expanded ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
      </button>
    </div>
    <nav id="care-navigation" aria-label="돌봄 관리">
      {Object.entries(CARE_PAGES).map(([key, { href, label, icon: Icon }]) => <a key={key} href={href}
        aria-current={key === page ? 'page' : undefined} aria-label={label} title={label} onClick={navigate}>
        <Icon size={19} aria-hidden="true" /><span className="care-nav-label">{label}</span>
      </a>)}
      <a href="#top" className="care-service-link" aria-label="서비스 소개" title="서비스 소개" onClick={navigate}>
        <House size={19} aria-hidden="true" /><span className="care-nav-label">서비스 소개</span>
      </a>
    </nav>
    <footer className="institution-sidebar-footer"><strong>CareWave</strong><small>기관 관리자</small></footer>
  </aside>
}
