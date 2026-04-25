import 'dotenv/config'
import http from 'node:http'
import { assertProductionEnv } from './assertProductionEnv.mjs'
import { createApp } from './app.mjs'
import { getPool } from './db/pool.mjs'
import { buildSession } from './middleware/buildSession.mjs'
import { warnDevelopmentEnv } from './warnDevEnv.mjs'
import { attachPartySocketIo } from './socket/partySocket.mjs'

assertProductionEnv()
warnDevelopmentEnv()

const sessionMiddleware = buildSession({ getPool })
const app = createApp({ getPool, sessionMiddleware })
const httpServer = http.createServer(app)
const io = attachPartySocketIo(httpServer, { getPool, sessionMiddleware })
app.set('io', io)

const port = Number.parseInt(String(process.env.PORT), 10) || 3000
const host = '0.0.0.0'

httpServer.listen(port, host, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  console.log(`FunSong server [${mode}] on http://localhost:${port} (bound ${host})`)
  if (process.env.NODE_ENV !== 'production') {
    const db = Boolean(String(process.env.DATABASE_URL || '').trim())
    console.log(`[funsong] DATABASE_URL: ${db ? 'configured' : 'not set'}`)
  }
})
