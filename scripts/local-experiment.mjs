import { readFile } from 'node:fs/promises'

export function localExperiment() {
  return {
    name: 'carewave-local-experiment',
    async generateBundle() {
      if (process.env.CAREWAVE_INCLUDE_EXPERIMENT !== '1') return
      try {
        const source = await readFile(new URL('../experiment.local.json', import.meta.url), 'utf8')
        this.emitFile({ type: 'asset', fileName: 'experiment-records.json', source })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    },
    configureServer(server) {
      server.middlewares.use('/__local-experiment', async (request, response) => {
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
          response.writeHead(403).end()
          return
        }
        try {
          const data = await readFile(new URL('../experiment.local.json', import.meta.url), 'utf8')
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(data)
        } catch {
          response.writeHead(404).end()
        }
      })
    },
  }
}
