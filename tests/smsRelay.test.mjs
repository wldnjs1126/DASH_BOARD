import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { smsRelay } from '../scripts/sms-relay.mjs'

test('SMS relay authenticates requests and forwards only a single SMS to the provider', async () => {
  const token = 'a'.repeat(64)
  const authorization = 'HMAC-SHA256 mock'
  const payload = { showMessageList: true, messages: [{ type: 'SMS', text: 'CareWave' }] }
  const requests = []
  const relay = smsRelay(token, async (auth, body) => {
    requests.push([auth, JSON.parse(body)])
    return { status: 403, body: Buffer.from('{"errorCode":"Forbidden"}') }
  })
  const call = async (url, method, headers, body = null) => {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { url, method, headers })
    let status
    let output
    await relay(req, { writeHead(code) { status = code }, end(result) { output = JSON.parse(result) } })
    return [status, output]
  }
  const headers = { 'x-carewave-relay-token': token, authorization }
  assert.deepEqual(await call('/health', 'GET', {}), [200, { ok: true }])
  assert.equal((await call('/sms', 'POST', { ...headers, 'x-carewave-relay-token': 'b'.repeat(64) }, payload))[0], 401)
  assert.equal((await call('/other', 'POST', headers, payload))[0], 404)
  assert.equal((await call('/sms', 'POST', headers, { ...payload, messages: [...payload.messages, ...payload.messages] }))[0], 400)
  assert.equal(requests.length, 0)
  assert.deepEqual(await call('/sms', 'POST', headers, payload), [403, { errorCode: 'Forbidden' }])
  assert.deepEqual(requests, [[authorization, payload]])
})
