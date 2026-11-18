import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { onRequestPost } from '../functions/api/guardian-sms.js'

async function withSmsEnvironment(run) {
  const sqlite = new DatabaseSync(':memory:')
  const env = {
    CAREWAVE_SMS_DEMO_CODE: 'local-stability-code',
    SOLAPI_API_KEY: 'mock-key', SOLAPI_API_SECRET: 'mock-secret', SOLAPI_SENDER: '0212345678',
    CAREWAVE_SMS_DB: {
      prepare(sql) {
        const statement = sqlite.prepare(sql)
        const bind = (...args) => ({
          bind, run: () => statement.run(...args), first: () => statement.get(...args),
        })
        return bind()
      },
      batch(statements) { return Promise.all(statements.map(statement => statement.run())) },
    },
  }
  const state = { now: 1_800_000_000_000, rejected: false, dropped: false, messages: [] }
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  Date.now = () => state.now
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.solapi.com/messages/v4/send-many/detail')
    assert.equal(init.redirect, 'manual')
    const message = JSON.parse(init.body).messages[0]
    state.messages.push(message)
    await new Promise(resolve => setTimeout(resolve, 2))
    if (state.dropped) throw new TypeError('Network connection lost')
    if (state.rejected) return Response.json({ errorCode: 'Forbidden' }, { status: 403 })
    return Response.json({ messageList: [{ statusCode: '2000' }] })
  }
  const call = async body => {
    const response = await onRequestPost({ env, request: new Request('https://carewave.test/api/guardian-sms', {
      method: 'POST', headers: { Origin: 'https://carewave.test', 'CF-Connecting-IP': '192.0.2.1' },
      body: JSON.stringify(body),
    }) })
    return { status: response.status, ...await response.json() }
  }
  const start = phone => call({ action: 'start', phone, room: '101호', pass: env.CAREWAVE_SMS_DEMO_CODE })
  const verify = (phone, token) => {
    const message = state.messages.findLast(message => message.to === phone && message.text.includes('인증번호'))
    const code = message.text.match(/인증번호 (\d{6})/)[1]
    return call({ action: 'verify', token, code })
  }
  try { await run({ state, sqlite, call, start, verify }) }
  finally { globalThis.fetch = originalFetch; Date.now = originalNow; sqlite.close() }
}

test('200 sessions on shared Wi-Fi verify and claim one alert each across 4 quota windows', async () => {
  await withSmsEnvironment(async ({ state, call, start, verify }) => {
    for (let wave = 0; wave < 4; wave++) {
      state.now += 60 * 60_000
      const phones = Array.from({ length: 50 }, (_, index) => `0109000${String(wave * 50 + index).padStart(4, '0')}`)
      const sessions = await Promise.all(phones.map(start))
      assert.ok(sessions.every(session => session.status === 200))
      const timers = await Promise.all(sessions.map((session, index) => verify(phones[index], session.token)))
      assert.ok(timers.every(result => result.status === 200))
      state.now += Math.max(...timers.map(result => result.delay))
      const results = await Promise.all(sessions.map(async session => {
        const concurrent = await Promise.all(Array.from({ length: 3 }, () => call({ action: 'alert', token: session.token })))
        assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409, 409])
        assert.equal(concurrent.find(result => result.status === 200).sms, 'accepted')
      }))
      assert.equal(results.length, 50)
    }
    assert.equal(state.messages.length, 400)
  })
})

test('provider rejections do not exhaust quotas and repeated limited requests do not prolong cooldown', async () => {
  await withSmsEnvironment(async ({ state, sqlite, start }) => {
    state.rejected = true
    for (let attempt = 0; attempt < 20; attempt++) {
      assert.equal((await start('01090001000')).status, 502)
    }
    assert.equal(sqlite.prepare('SELECT SUM(count) AS total FROM sms_limit').get().total, 0)
    state.rejected = false
    assert.equal((await start('01090001000')).status, 200)
    for (let attempt = 0; attempt < 10; attempt++) {
      const blocked = await start('01090001000')
      assert.equal(blocked.status, 429)
      assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 60)
    }
    state.now += 60_000
    assert.equal((await start('01090001000')).status, 200)
  })
})

test('a lost provider response leaves a delivered OTP usable and never retries alert SMS automatically', async () => {
  await withSmsEnvironment(async ({ state, call, start, verify }) => {
    state.dropped = true
    const session = await start('01090002000')
    assert.equal(session.status, 200)
    assert.equal(session.unconfirmed, true)
    assert.match(session.notice, /ConnectionError/)
    const timer = await verify('01090002000', session.token)
    assert.equal(timer.status, 200)
    state.now += timer.delay
    const results = await Promise.all([call({ action: 'alert', token: session.token }), call({ action: 'alert', token: session.token })])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
    assert.equal(results.find(result => result.status === 200).sms, 'unknown')
    assert.equal(state.messages.length, 2)
  })
})
