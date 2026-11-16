import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ViewDialog } from './visuals.tsx'

export type SmsKind = 'caution' | 'danger'
export type SmsResult = 'accepted' | 'failed' | 'unknown'
type SmsResponse = { token?: string; kind?: SmsKind; delay?: number; sms?: SmsResult; smsDetail?: string; notice?: string; error?: string }

export async function guardianSms(body: object): Promise<SmsResponse> {
  const response = await fetch('/api/guardian-sms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const result: SmsResponse = await response.json().catch(() => ({}))
  if (!response.ok || !Object.keys(result).length) throw new Error(result.error ?? '현재 문자 체험을 사용할 수 없습니다.')
  return result
}

export function stopGuardianSms(token: string) {
  const body = JSON.stringify({ action: 'stop', token })
  if (!navigator.sendBeacon('/api/guardian-sms', new Blob([body], { type: 'application/json' }))) {
    void fetch('/api/guardian-sms', { method: 'POST', body, keepalive: true }).catch(() => {})
  }
}

export function GuardianSmsDialog({ phone, room, arm, close }: {
  phone: string; room: string; arm: (token: string, kind: SmsKind, delay: number) => void; close: () => void
}) {
  const [token, setToken] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const cancelled = useRef(false)
  const pendingToken = useRef('')
  const accessCode = useRef('')

  useEffect(() => {
    cancelled.current = false
    function cancel() {
      cancelled.current = true
      if (pendingToken.current) stopGuardianSms(pendingToken.current)
    }
    window.addEventListener('pagehide', cancel)
    return () => {
      window.removeEventListener('pagehide', cancel)
      cancel()
    }
  }, [])

  async function requestCode(pass: string) {
    const result = await guardianSms({ action: 'start', phone, room, pass })
    if (!result.token) throw new Error('현재 문자 체험을 사용할 수 없습니다.')
    if (cancelled.current) return stopGuardianSms(result.token)
    if (pendingToken.current) stopGuardianSms(pendingToken.current)
    pendingToken.current = result.token
    accessCode.current = pass
    setToken(result.token)
    setValue('')
    setNotice(result.notice ?? '문자로 받은 6자리 인증번호를 입력해 주세요.')
  }

  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (error) {
      if (!cancelled.current) setError(error instanceof Error ? error.message : '다시 시도해 주세요.')
    } finally {
      if (!cancelled.current) setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      if (!token) return requestCode(value.trim())
      const result = await guardianSms({ action: 'verify', token, code: value })
      if (!result.kind || typeof result.delay !== 'number') throw new Error('문자 체험을 시작하지 못했습니다.')
      if (cancelled.current) return
      pendingToken.current = ''
      arm(token, result.kind, result.delay)
    })
  }

  return <ViewDialog title="보호자 연락처 인증" closeLabel="문자 인증 닫기" close={close}>
    <form className="subject-form" onSubmit={submit}>
      <p>{room}에 등록한 본인 휴대전화로 인증 문자와 첫 주의·위험 알림을 받습니다.</p>
      <div className="subject-fields"><label>{token ? '문자 인증번호' : '심사위원 체험 코드'}
        <input required value={value} onChange={event => setValue(event.target.value)}
          key={token ? 'otp' : 'demo'} type={token ? 'text' : 'password'} inputMode={token ? 'numeric' : undefined}
          pattern={token ? '[0-9]{6}' : undefined} maxLength={token ? 6 : 128} autoComplete={token ? 'one-time-code' : 'off'} />
      </label></div>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="room-form-error" role="alert">{error}</p>}
      <div className="subject-actions"><button type="button" className="subject-button" onClick={close}>닫기</button>
        {token && <button type="button" className="subject-button" disabled={busy} onClick={() => { void run(() => requestCode(accessCode.current)) }}>인증 문자 다시 받기</button>}
        <button type="submit" className="subject-button subject-primary" disabled={busy}>{busy ? '처리 중…' : token ? '인증하고 체험 시작' : '인증 문자 받기'}</button></div>
    </form>
  </ViewDialog>
}
