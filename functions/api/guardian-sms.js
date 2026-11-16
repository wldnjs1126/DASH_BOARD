const encoder = new TextEncoder()
const MINUTE = 60_000
const kinds = { danger: '낙상 의심', caution: '장시간 미움직임' }

const schema = [
  `CREATE TABLE IF NOT EXISTS sms_session (
    id TEXT PRIMARY KEY, phone TEXT, code TEXT, room TEXT NOT NULL,
    state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    expires INTEGER NOT NULL, kind TEXT, due INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sms_limit (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)`,
]

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function sign(secret, value) {
  const key = await hmacKey(secret)
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function phoneKeyForStorage(secret) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`carewave:sms:phone:${secret}`))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptPhone(secret, phone) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await phoneKeyForStorage(secret), encoder.encode(phone))
  return JSON.stringify([Array.from(iv), Array.from(new Uint8Array(encrypted))])
}

async function decryptPhone(secret, stored) {
  const [iv, encrypted] = JSON.parse(stored)
  const phone = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(iv) }, await phoneKeyForStorage(secret), Uint8Array.from(encrypted))
  return new TextDecoder().decode(phone)
}

async function sendSms(env, phone, text) {
  const date = new Date().toISOString()
  const salt = crypto.randomUUID().replaceAll('-', '')
  const signature = await sign(env.SOLAPI_API_SECRET, date + salt)
  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: { Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ showMessageList: true, messages: [{ to: phone, from: env.SOLAPI_SENDER, text, type: 'SMS' }] }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json().catch(() => null)
    const failed = Array.isArray(data?.failedMessageList) ? data.failedMessageList[0] : undefined
    const message = Array.isArray(data?.messageList) ? data.messageList[0] : undefined
    const code = String(failed?.statusCode ?? data?.errorCode ?? data?.statusCode ?? message?.statusCode ?? `HTTP-${response.status}`)
    const detail = /^[A-Za-z0-9_-]{3,45}$/.test(code) ? code : `HTTP-${response.status}`
    if (response.status === 401 || response.status === 403) {
      // Use provider text for classification only; never return it to the browser.
      const reason = typeof data?.errorMessage === 'string' ? data.errorMessage : ''
      if (/직접\s*지정한\s*IP|허용\s*IP/i.test(reason)) return { status: 'sourceIp', detail }
      if (/권한이\s*없습니다|message:send-sms/i.test(reason)) return { status: 'permission', detail }
      if (['InvalidAPIKey', 'SignatureDoesNotMatch'].includes(code)) return { status: 'credentials', detail }
      return { status: 'forbidden', detail }
    }
    if (['1062', '2062', '3013'].includes(code) || (code === '3040' && /등록되지 않은 발신번호/.test(failed?.statusMessage ?? ''))) return { status: 'sender', detail }
    if (['1030', '2025', '2230'].includes(code)) return { status: 'balance', detail }
    if (response.status >= 500) return { status: 'unknown', detail }

    const counts = data?.groupInfo?.count
    if (response.ok && !failed && (['2000', '3000', '4000'].includes(String(message?.statusCode))
      || (!message && counts?.registeredSuccess === 1 && counts?.registeredFailed === 0))) {
      return { status: 'accepted' }
    }
    return { status: response.ok && !failed && !message && !data?.errorCode ? 'unknown' : 'failed', detail }
  } catch {
    // The provider may have received a request whose response was lost.
    return { status: 'unknown' }
  }
}

async function quota(db, key, now, limit, windowSize) {
  const expires = (Math.floor(now / windowSize) + 1) * windowSize
  const bucket = `${key}:${expires}`
  const allowed = await db.prepare(`INSERT INTO sms_limit VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET count = sms_limit.count + 1
    WHERE sms_limit.count < ? RETURNING count`).bind(bucket, expires, limit).first()
  return { allowed: Boolean(allowed), bucket, expires }
}

function retryMessage(expires, now) {
  const seconds = Math.max(1, Math.ceil((expires - now) / 1000))
  const remaining = seconds < 60 ? `약 ${seconds}초` : `약 ${Math.ceil(seconds / 60)}분`
  return reply({ error: `인증 문자 요청 한도에 도달했습니다. ${remaining} 후 다시 시도해 주세요.` }, 429)
}

async function start(env, body, request, now) {
  if (typeof body.pass !== 'string' || body.pass.length > 128) return reply({ error: '체험 코드를 입력해 주세요.' }, 403)
  const key = await hmacKey(env.SOLAPI_API_SECRET)
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(env.CAREWAVE_SMS_DEMO_CODE))
  if (!await crypto.subtle.verify('HMAC', key, expected, encoder.encode(body.pass))) return reply({ error: '체험 코드가 올바르지 않습니다.' }, 403)
  const phone = typeof body.phone === 'string' ? body.phone.normalize('NFKC').replace(/[\s()-]/g, '').replace(/^\+82(?:0)?(?=10\d{8}$)/, '0') : ''
  if (!/^010\d{8}$/.test(phone)) return reply({ error: '010 휴대전화 번호를 입력해 주세요.' }, 400)
  const room = typeof body.room === 'string' && /^\d{1,5}호?$/.test(body.room) ? body.room.replace(/호?$/, '호') : '등록 호실'
  const db = env.CAREWAVE_SMS_DB
  await db.batch(schema.map(sql => db.prepare(sql)))
  await db.batch(['sms_session', 'sms_limit'].map(table => db.prepare(`DELETE FROM ${table} WHERE expires <= ?`).bind(now)))
  const ip = await sign(env.SOLAPI_API_SECRET, `ip:${request.headers.get('CF-Connecting-IP') ?? 'local'}`)
  const phoneKey = await sign(env.SOLAPI_API_SECRET, `phone:${phone}`)
  const cooldown = await quota(db, `cooldown:${phoneKey}`, now, 1, MINUTE)
  if (!cooldown.allowed) return retryMessage(cooldown.expires, now)
  const limits = [[`phone:${phoneKey}`, 3, 10 * MINUTE], [`ip:${ip}`, 12, 10 * MINUTE], ['total', 50, 60 * MINUTE]]
  for (const [key, maximum, windowSize] of limits) {
    const result = await quota(db, key, now, maximum, windowSize)
    if (!result.allowed) return retryMessage(result.expires, now)
  }
  const token = crypto.randomUUID()
  const id = await sign(env.SOLAPI_API_SECRET, token)
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  const digest = await sign(env.SOLAPI_API_SECRET, `${id}:${code}`)
  await db.prepare(`INSERT INTO sms_session (id, phone, code, room, state, expires) VALUES (?, ?, ?, ?, 'otp', ?)`)
    .bind(id, await encryptPhone(env.SOLAPI_API_SECRET, phone), digest, room, now + 5 * MINUTE).run()
  const { status: sms, detail } = await sendSms(env, phone, `[CareWave] 인증번호 ${code} (5분간 유효)`)
  if (sms === 'unknown') {
    // A timeout can occur after SOLAPI receives the request. Keep any delivered code usable.
    return reply({ token, notice: '문자 접수 상태를 확인하지 못했습니다. 인증번호가 도착하면 입력하고, 도착하지 않으면 잠시 후 다시 요청해 주세요.' })
  }
  if (sms !== 'accepted') {
    await db.prepare(`DELETE FROM sms_session WHERE id = ?`).bind(id).run()
    await db.prepare('DELETE FROM sms_limit WHERE bucket = ?').bind(cooldown.bucket).run()
    const errors = {
      credentials: '문자 서비스 인증이 실패했습니다. Cloudflare에 등록한 SOLAPI API 키와 시크릿을 확인해 주세요.',
      sourceIp: 'SOLAPI가 발송 서버의 IP를 차단했습니다. API 키의 허용 IP에 발송 서버의 고정 공인 IP를 등록해야 합니다.',
      permission: 'SOLAPI API 키에 문자 발송 권한이 없습니다. 키의 SMS 발송 권한(message:send-sms)을 확인해 주세요.',
      forbidden: 'SOLAPI가 문자 발송을 허용하지 않았습니다. API 키의 SMS 발송 권한과 발송 서버의 허용 IP 설정을 확인해 주세요.',
      sender: 'SOLAPI에 등록된 발신번호가 아닙니다. 발신번호 등록 상태를 확인해 주세요.',
      balance: 'SOLAPI 잔액이 부족하거나 잔액 차감에 실패했습니다. 콘솔에서 잔액을 확인해 주세요.',
      failed: 'SOLAPI가 인증 문자 요청을 거절했습니다. 발송 내역에서 오류 코드를 확인해 주세요.',
    }
    return reply({ error: `${errors[sms]}${detail ? ` (SOLAPI ${detail})` : ''}` }, 502)
  }
  return reply({ token })
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply({ error: '잘못된 요청입니다.' }, 403)
  if (!env.CAREWAVE_SMS_DB || !env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !/^\d{8,11}$/.test(env.SOLAPI_SENDER ?? '') || (env.CAREWAVE_SMS_DEMO_CODE?.length ?? 0) < 12) {
    return reply({ error: '문자 체험을 준비 중입니다. 호실 정보는 저장되었습니다.' }, 503)
  }

  try {
    const raw = await request.text()
    if (raw.length > 1024) return reply({ error: '잘못된 요청입니다.' }, 400)
    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object') return reply({ error: '잘못된 요청입니다.' }, 400)
    const db = env.CAREWAVE_SMS_DB
    const now = Date.now()
    if (body.action === 'start') return await start(env, body, request, now)
    if (typeof body.token !== 'string' || !/^[a-f0-9-]{36}$/.test(body.token)) return reply({ error: '체험 세션이 없습니다.' }, 400)
    const id = await sign(env.SOLAPI_API_SECRET, body.token)

    if (body.action === 'stop') {
      await db.prepare('DELETE FROM sms_session WHERE id = ?').bind(id).run()
      return reply({ stopped: true })
    }
    if (body.action === 'verify' && typeof body.code === 'string' && /^\d{6}$/.test(body.code)) {
      const kind = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'danger' : 'caution'
      const delay = 8_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 10_001
      const digest = await sign(env.SOLAPI_API_SECRET, `${id}:${body.code}`)
      const armed = await db.prepare(`UPDATE sms_session SET state = 'armed', kind = ?, due = ?, expires = ?
        WHERE id = ? AND state = 'otp' AND attempts < 5 AND expires > ? AND code = ? RETURNING id`)
        .bind(kind, now + delay, now + 40_000, id, now, digest).first()
      if (armed) return reply({ kind, delay })
      const existing = await db.prepare(`SELECT kind, due FROM sms_session
        WHERE id = ? AND state = 'armed' AND expires > ? AND code = ?`).bind(id, now, digest).first()
      if (existing) return reply({ kind: existing.kind, delay: Math.max(0, existing.due - now) })
      await db.prepare(`UPDATE sms_session SET attempts = attempts + 1, phone = CASE WHEN attempts = 4 THEN NULL ELSE phone END
        WHERE id = ? AND state = 'otp' AND attempts < 5`).bind(id).run()
      return reply({ error: '인증번호가 맞지 않거나 만료되었습니다.' }, 400)
    }
    if (body.action === 'alert') {
      // DELETE with RETURNING claims this session before any provider request, even across simultaneous requests.
      const claimed = await db.prepare(`DELETE FROM sms_session WHERE id = ? AND state = 'armed'
        AND due <= ? AND expires > ? RETURNING phone, room, kind`).bind(id, now, now).first()
      if (!claimed?.phone) return reply({ error: '문자 체험이 종료되었거나 이미 처리되었습니다.' }, 409)
      const phone = await decryptPhone(env.SOLAPI_API_SECRET, claimed.phone)
      const { status, detail } = await sendSms(env, phone, `[CareWave 체험] ${claimed.room} ${kinds[claimed.kind]} 알림입니다.`)
      if (status === 'accepted' || status === 'unknown') return reply({ sms: status })
      const reasons = { sourceIp: '발송 서버 IP 차단', permission: 'SMS 발송 권한 없음', credentials: 'API 키 인증 실패', forbidden: 'SOLAPI 요청 거절', sender: '발신번호 등록 오류', balance: 'SOLAPI 잔액 오류' }
      const reason = reasons[status]
      return reply({ sms: 'failed', smsDetail: [reason, detail && `SOLAPI ${detail}`].filter(Boolean).join(' · ') })
    }
    return reply({ error: '잘못된 요청입니다.' }, 400)
  } catch {
    return reply({ error: '문자 체험을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503)
  }
}
