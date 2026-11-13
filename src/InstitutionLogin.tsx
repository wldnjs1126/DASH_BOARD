import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Brand } from './Brand.tsx'
import { isDemoLogin } from './institutionData.ts'

export function InstitutionLogin({ onEnter }: { onEnter: () => void }) {
  const [error, setError] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (isDemoLogin(String(fields.get('id')), String(fields.get('password')))) onEnter()
    else setError(true)
  }

  return <main className="institution-login">
    <section className="institution-login-story" aria-label="CareWave 소개">
      <div><span className="login-platform">SMART CARE PLATFORM</span>
        <p className="login-headline">보이지 않아도,<br />CareWave는 늘 곁에서<br />살핍니다.</p>
        <p className="login-story-copy">일상의 작은 신호까지 살펴<br />안전하고 따뜻한 돌봄을 이어갑니다.</p>
      </div>
      <small>CAREWAVE · CONNECTING CARE</small>
    </section>
    <section className="institution-login-content">
      <div className="institution-login-inner">
        <a href="#top" className="dashboard-home" aria-label="CareWave 서비스 소개"><Brand /></a>
        <p className="login-welcome">WELCOME TO CAREWAVE</p>
        <h1 tabIndex={-1}>안전한 일상을 위한<br />스마트 케어를 시작하세요.</h1>
        <p className="login-intro">기관 관리자 로그인</p>
        <form onSubmit={submit} onChange={() => setError(false)}>
          <label htmlFor="carewave-id">아이디</label>
          <input id="carewave-id" name="id" placeholder="carewave를 입력하세요" autoCapitalize="none" spellCheck={false} autoComplete="off" required />
          <label htmlFor="carewave-password">비밀번호</label>
          <input id="carewave-password" name="password" type="password" placeholder="carewave를 입력하세요" autoComplete="off" required />
          {error && <p className="login-error" role="alert">아이디와 비밀번호에 각각 carewave를 입력해 주세요.</p>}
          <button className="institution-primary login-submit" type="submit">로그인 <ArrowRight size={16} aria-hidden="true" /></button>
        </form>
        <p className="login-note">기관용 대시보드 체험 계정</p>
        <a href="#top" className="login-return"><ArrowLeft size={15} />서비스 소개</a>
      </div>
    </section>
  </main>
}
