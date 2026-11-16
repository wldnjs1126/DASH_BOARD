import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { onRequestPost } from '../functions/api/guardian-sms.js'

test('guardian SMS verifies the number, claims one alert, and honors cancellation', async () => {
  const sqlite = new DatabaseSync(':memory:')
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql)
      const bind = (...args) => ({ bind, run: () => statement.run(...args), first: () => statement.get(...args) })
      return bind()
    },
    batch(statements) { return Promise.all(statements.map(statement => statement.run())) },
  }
  const env = {
    CAREWAVE_SMS_DB: db, CAREWAVE_SMS_DEMO_CODE: 'testing-demo-code',
    SOLAPI_API_KEY: 'mock-key', SOLAPI_API_SECRET: 'mock-secret', SOLAPI_SENDER: '0212345678',
  }
  const sent = []
  let providerResult
  let providerStatus = 200
  const relayUrl = 'https://sms.carewave.test/sms'
  const relayToken = 'a'.repeat(64)
  let expectedUrl = 'https://api.solapi.com/messages/v4/send-many/detail'
  const previousFetch = globalThis.fetch
  const previousNow = Date.now
  let now = 1_800_000_000_000
  Date.now = () => now
  globalThis.fetch = async (url, init) => {
    assert.equal(url, expectedUrl)
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers['X-CareWave-Relay-Token'], url === relayUrl ? relayToken : undefined)
    const body = JSON.parse(init.body)
    assert.equal(body.showMessageList, true)
    assert.equal(body.messages[0].type, 'SMS')
    sent.push(body.messages[0])
    return Response.json(providerResult ?? { messageList: [{ statusCode: '2000' }] }, { status: providerStatus })
  }
  const origin = 'https://carewave.test'
  const call = async (body, requestOrigin = origin, config = env) => {
    const response = await onRequestPost({ env: config, request: new Request(`${origin}/api/guardian-sms`, {
      method: 'POST', headers: { Origin: requestOrigin }, body: JSON.stringify(body),
    }) })
    return [response.status, await response.json()]
  }
  const start = (phone, pass = env.CAREWAVE_SMS_DEMO_CODE) => call({ action: 'start', phone, pass, room: '103호' })
  const codeOf = message => message.text.match(/인증번호 (\d{6})/)[1]

  try {
    assert.equal((await call({ action: 'start' }, 'https://example.org'))[0], 403)
    assert.equal((await call({ action: 'start' }, origin, {}))[0], 503)
    assert.equal((await start('01012340000', 'wrong-code'))[0], 403)
    assert.equal(sent.length, 0)
    const [started, { token }] = await start('01012340000')
    assert.equal(started, 200)
    const [limited, retry] = await start('01012340000')
    assert.equal(limited, 429)
    assert.match(retry.error, /약 \d+(초|분)/)
    assert.equal((await call({ action: 'alert', token }))[0], 409)
    assert.equal((await call({ action: 'verify', token, code: '11111' }))[0], 400)
    const [verified, { delay, kind }] = await call({ action: 'verify', token, code: codeOf(sent[0]) })
    assert.equal(verified, 200)
    now += 1000
    assert.deepEqual(await call({ action: 'verify', token, code: codeOf(sent[0]) }), [200, { kind, delay: delay - 1000 }])
    assert.equal((await call({ action: 'alert', token }))[0], 409)
    now += delay - 1000
    const deliveries = await Promise.all([call({ action: 'alert', token }), call({ action: 'alert', token })])
    assert.deepEqual(deliveries.map(([status]) => status).sort(), [200, 409])
    assert.equal(sent.length, 2)
    assert.equal(sent[1].to, '01012340000')
    assert.ok(sent[1].text.includes(`103호 ${kind === 'danger' ? '낙상 의심' : '장시간 미움직임'}`))

    for (const [suffix, cancel] of [['0001', true], ['0002', false]]) {
      const [status, next] = await start(`0101234${suffix}`)
      assert.equal(status, 200)
      const [success] = await call({ action: 'verify', token: next.token, code: codeOf(sent.at(-1)) })
      assert.equal(success, 200)
      if (cancel) await call({ action: 'stop', token: next.token })
      now += cancel ? 20_000 : 41_000
      assert.equal((await call({ action: 'alert', token: next.token }))[0], 409)
    }
    assert.equal(sent.length, 4)

    providerResult = { failedMessageList: [{ statusCode: '1062' }] }
    const [failed, senderError] = await start('01012340003')
    assert.equal(failed, 502)
    assert.match(senderError.error, /발신번호.*1062/)
    providerResult = { failedMessageList: [{ statusCode: 1030 }] }
    const [balanceFailed, balanceError] = await start('01012340004')
    assert.equal(balanceFailed, 502)
    assert.match(balanceError.error, /잔액.*1030/)
    providerResult = { groupInfo: { count: { registeredSuccess: 1, registeredFailed: 0 } } }
    assert.equal((await start('01012340003'))[0], 200)

    providerStatus = 403
    const rejections = [
      ['Forbidden', '발송은 API Key 에 직접 지정한 IP 에서만 할 수 있습니다. private-detail', /발송 서버의 IP를 차단/],
      ['Forbidden', '이 API Key 에는 message:send-sms 권한이 없습니다.', /문자 발송 권한이 없습니다/],
      ['SignatureDoesNotMatch', 'private-detail', /키와 시크릿을 확인/],
      ['Forbidden', 'Forbidden', /SMS 발송 권한과 발송 서버의 허용 IP/],
    ]
    for (const [index, [errorCode, errorMessage, expected]] of rejections.entries()) {
      providerResult = { errorCode, errorMessage }
      const [status, result] = await start(`0101234000${index + 5}`)
      assert.equal(status, 502)
      assert.match(result.error, expected)
      assert.doesNotMatch(result.error, /private-detail/)
    }

    providerStatus = 200
    providerResult = undefined
    const [alertStart, alertSession] = await start('01012340010')
    assert.equal(alertStart, 200)
    const [alertVerified, alertTiming] = await call({ action: 'verify', token: alertSession.token, code: codeOf(sent.at(-1)) })
    assert.equal(alertVerified, 200)
    now += alertTiming.delay
    providerStatus = 403
    providerResult = { errorCode: 'Forbidden', errorMessage: '발송은 API Key 에 직접 지정한 IP 에서만 할 수 있습니다. private-detail' }
    assert.deepEqual(await call({ action: 'alert', token: alertSession.token }), [200, {
      sms: 'failed', smsDetail: '발송 서버 IP 차단 · SOLAPI Forbidden',
    }])
    assert.equal((await call({ action: 'alert', token: alertSession.token }))[0], 409)

    providerStatus = 503
    providerResult = { errorCode: 'ServiceUnavailable' }
    const [uncertain, otp] = await start('+82 (10) 1234-0011')
    assert.equal(uncertain, 200)
    assert.equal(otp.unconfirmed, true)
    assert.match(otp.notice, /ServiceUnavailable/)
    assert.match(otp.notice, /인증번호가 도착하면 입력/)
    assert.equal(sent.at(-1).to, '01012340011')
    assert.equal((await call({ action: 'verify', token: otp.token, code: codeOf(sent.at(-1)) }))[0], 200)

    now += 10 * 60_000
    const relayRequest = { action: 'start', phone: '01012340012', pass: env.CAREWAVE_SMS_DEMO_CODE, room: '103호' }
    const beforeRelay = sent.length
    const [invalidRelay, badConfig] = await call(relayRequest, origin, { ...env, CAREWAVE_SMS_RELAY_URL: relayUrl })
    assert.equal(invalidRelay, 502)
    assert.match(badConfig.error, /RelayConfig/)
    assert.equal(sent.length, beforeRelay)
    expectedUrl = relayUrl
    const relayEnv = { ...env, CAREWAVE_SMS_RELAY_URL: relayUrl, CAREWAVE_SMS_RELAY_TOKEN: relayToken }
    providerStatus = 200
    providerResult = undefined
    const [relayStart, { token: relaySession }] = await call(relayRequest, origin, relayEnv)
    assert.equal(relayStart, 200)
    const [relayVerified, relayTiming] = await call({ action: 'verify', token: relaySession, code: codeOf(sent.at(-1)) }, origin, relayEnv)
    assert.equal(relayVerified, 200)
    now += relayTiming.delay
    assert.deepEqual(await call({ action: 'alert', token: relaySession }, origin, relayEnv), [200, { sms: 'accepted' }])
    assert.equal(sent.length, beforeRelay + 2)
  } finally {
    sqlite.close()
    Date.now = previousNow
    globalThis.fetch = previousFetch
  }
})
