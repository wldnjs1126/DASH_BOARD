import { timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pathToFileURL } from 'node:url'

const SEND_URL = 'https://api.solapi.com/messages/v4/send-many/detail'
const TOKEN_FORMAT = /^[a-f0-9]{64}$/i
const MAX_REQUEST_BYTES = 4096

async function readBody(stream, limit) {
  const chunks = []
  let length = 0
  for await (const chunk of stream) {
    length += chunk.length
    if (length > limit) throw new RangeError('Body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function sendToSolapi(authorization, body) {
  return new Promise((resolve, reject) => {
    const upstream = httpsRequest(SEND_URL, {
      method: 'POST',
      family: 4,
      signal: AbortSignal.timeout(6500),
      headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, async response => {
      try {
        resolve({ status: response.statusCode, body: await readBody(response, 64 * 1024) })
      } catch (error) {
        reject(error)
      }
    })
    upstream.on('error', reject)
    upstream.end(body)
  })
}

export function smsRelay(token, send = sendToSolapi) {
  if (!TOKEN_FORMAT.test(token ?? '')) throw new Error('CAREWAVE_SMS_RELAY_TOKEN must be 64 hexadecimal characters.')
  const expected = Buffer.from(token)
  return async (req, res) => {
    function reply(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(body)
    }

    if (req.method === 'GET' && req.url === '/health') return reply(200, '{"ok":true}')
    if (req.method !== 'POST' || req.url !== '/sms') return reply(404, '{"errorCode":"CareWaveRelayNotFound"}')
    const supplied = req.headers['x-carewave-relay-token']
    if (typeof supplied !== 'string' || !TOKEN_FORMAT.test(supplied)
      || !timingSafeEqual(expected, Buffer.from(supplied))) {
      return reply(401, '{"errorCode":"CareWaveRelayUnauthorized"}')
    }
    const authorization = req.headers.authorization
    if (typeof authorization !== 'string' || !authorization.startsWith('HMAC-SHA256 ')) {
      return reply(400, '{"errorCode":"CareWaveRelayInvalidRequest"}')
    }
    let body
    try {
      body = await readBody(req, MAX_REQUEST_BYTES)
      const { messages, showMessageList } = JSON.parse(body)
      if (!Array.isArray(messages) || messages.length !== 1 || messages[0]?.type !== 'SMS' || showMessageList !== true) {
        return reply(400, '{"errorCode":"CareWaveRelayInvalidRequest"}')
      }
    } catch {
      return reply(400, '{"errorCode":"CareWaveRelayInvalidRequest"}')
    }
    try {
      const result = await send(authorization, body)
      return reply(result.status, result.body)
    } catch {
      return reply(502, '{"errorCode":"CareWaveRelayUpstreamUncertain"}')
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer({ requestTimeout: 8000, headersTimeout: 4000 }, smsRelay(process.env.CAREWAVE_SMS_RELAY_TOKEN))
    .listen(8788, '127.0.0.1', () => console.log('CareWave SMS relay listening on 127.0.0.1:8788'))
}
