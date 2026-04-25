import 'dotenv/config'
import http from 'node:http'
import { assertProductionEnv } from './assertProductionEnv.mjs'
import { createApp } from './app.mjs'
import { getDbConfigSummary, getPool } from './db/pool.mjs'
import { buildSession } from './middleware/buildSession.mjs'
import { warnDevelopmentEnv } from './warnDevEnv.mjs'
import { attachPartySocketIo } from './socket/partySocket.mjs'
import { startPartyExpiryInterval } from './services/partyExpiryService.mjs'

assertProductionEnv()
warnDevelopmentEnv()

const sessionMiddleware = buildSession({ getPool })
const app = createApp({ getPool, sessionMiddleware })
const httpServer = http.createServer(app)
const io = attachPartySocketIo(httpServer, { getPool, sessionMiddleware })
app.set('io', io)
startPartyExpiryInterval({
  getPool,
  getIo: () => /** @type {import('socket.io').Server} */ (app.get('io')),
  intervalMs: 60_000
})

const port = Number.parseInt(String(process.env.PORT), 10) || 3000
const host = '0.0.0.0'

httpServer.listen(port, host, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const dbConfigSummary = getDbConfigSummary()
  const sslMode =
    dbConfigSummary.sslRejectUnauthorized === false
      ? 'rejectUnauthorized=false'
      : dbConfigSummary.sslRejectUnauthorized === true
      ? 'rejectUnauthorized=true'
      : 'default'
  console.log(`[funsong] Node ${process.version} (use Node 20+ in production; see package.json engines)`)
  console.log(`FunSong server [${mode}] on http://localhost:${port} (bound ${host})`)
  console.log(
    `[funsong] DB SSL mode: ${sslMode}; PGSSL_REJECT_UNAUTHORIZED env set: ${dbConfigSummary.pgsslRejectUnauthorizedEnvSet}`
  )
  if (process.env.NODE_ENV !== 'production') {
    const db = Boolean(String(process.env.DATABASE_URL || '').trim())
    console.log(`[funsong] DATABASE_URL: ${db ? 'configured' : 'not set'}`)
  }
})
