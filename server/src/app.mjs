import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDbConfigSummary, getPool } from './db/pool.mjs'
import { makeDbHealthHandler } from './db/health.mjs'
import { createUser, findUserByEmail } from './db/repos/usersRepo.mjs'
import { buildSession } from './middleware/buildSession.mjs'
import { joinRateLimit, loginRateLimit, partyGuestRequestRateLimit } from './middleware/rateLimit.mjs'
import {
  makeGetMeHandler,
  makePostLoginHandler,
  makePostSignupHandler,
  makePostLogoutHandler,
  makeRequireAuth,
  makeRequireHost,
  makeRequireSuperAdmin
} from './middleware/auth.mjs'
import { getSongStreamMeta, listSongsForPartySelection } from './db/repos/songsRepo.mjs'
import { createAdminSongsRouter } from './routes/apiAdminSongs.mjs'
import {
  createAdminPartiesRouter,
  createAdminPartyRequestsRouter
} from './routes/apiAdminParty.mjs'
import { createAdminSettingsRouter } from './routes/apiAdminSettings.mjs'
import { createHostPartyRequestsRouter } from './routes/apiHostPartyRequests.mjs'
import { makeHostPartyQrHandler } from './routes/apiHostPartyQr.mjs'
import { createHostPartyPlaylistRouter } from './routes/apiHostPartyPlaylist.mjs'
import { createHostControlRouter } from './routes/apiHostControl.mjs'
import { createGuestJoinRouter, createPartyGuestRouter } from './routes/apiGuestJoin.mjs'
import { streamAudioFileToResponse } from './audio/streamFile.mjs'

const UUID_SONG = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.join(__dirname, '../../client/dist')

export function createApp(options = {}) {
  const {
    getPool: getPoolInj = getPool,
    getDbConfigSummary: getDbConfigSummaryInj = getDbConfigSummary,
    sessionStore,
    sessionSecret,
    sessionMiddleware: prebuiltSession
  } =
    options
  const app = express()
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }
  app.disable('x-powered-by')
  app.use(express.json())
  const sm =
    prebuiltSession ||
    buildSession({
      getPool: getPoolInj,
      sessionStore,
      sessionSecret
    })
  app.use(sm)

  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      return next()
    }
    const p = req.path || '/'
    if (p === '/songs' || p.startsWith('/songs/') || p === '/lyrics' || p.startsWith('/lyrics/')) {
      return res.status(404).end()
    }
    next()
  })

  const requireAuth = makeRequireAuth({ getPool: getPoolInj })
  const requireHost = makeRequireHost()
  const requireSuperAdmin = makeRequireSuperAdmin()
  const getMe = makeGetMeHandler({ getPool: getPoolInj })
  const adminSongs = createAdminSongsRouter()
  const { router: hostPartyRequestRouter, postPartyRequest: postHostPartyRequest } =
    createHostPartyRequestsRouter({ getPool: getPoolInj })
  const adminPartyRequestRouter = createAdminPartyRequestsRouter({ getPool: getPoolInj })
  const adminPartiesRouter = createAdminPartiesRouter({ getPool: getPoolInj })
  const adminSettingsRouter = createAdminSettingsRouter({ getPool: getPoolInj })
  const hostPartyQrHandler = makeHostPartyQrHandler({ getPool: getPoolInj })
  const guestJoinApi = createGuestJoinRouter({
    getPool: getPoolInj,
    rateLimitPostJoin: joinRateLimit
  })
  const partyGuestApi = createPartyGuestRouter({
    getPool: getPoolInj,
    rateLimitPostActions: partyGuestRequestRateLimit
  })
  const hostPartyPlaylistApi = createHostPartyPlaylistRouter({ getPool: getPoolInj })
  const hostControlApi = createHostControlRouter({ getPool: getPoolInj })
  app.set('getPool', () => {
    return getPoolInj()
  })

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })
  app.get('/health/db', makeDbHealthHandler(getPoolInj, getDbConfigSummaryInj))
  app.get('/api/auth/me', getMe)
  app.use('/api/join', guestJoinApi)
  app.use('/api/party', partyGuestApi)
  const postLogin = makePostLoginHandler({ getPool: getPoolInj, findUserByEmail })
  const postSignup = makePostSignupHandler({ getPool: getPoolInj, findUserByEmail, createUser })
  const postLogout = makePostLogoutHandler()
  app.post('/api/auth/login', loginRateLimit, postLogin)
  app.post('/api/auth/signup', loginRateLimit, postSignup)
  app.post('/api/auth/logout', postLogout)
  // Same-origin POST aliases (optional; PWA in production may use /api only)
  app.post('/login', loginRateLimit, postLogin)
  app.post('/signup', loginRateLimit, postSignup)
  app.post('/logout', postLogout)
  app.get(
    '/api/protected/health-host',
    requireAuth,
    requireHost,
    (req, res) => {
      res.json({ ok: true, role: req.funsongUser.role })
    }
  )
  app.get(
    '/api/protected/health-super',
    requireAuth,
    requireSuperAdmin,
    (req, res) => {
      res.json({ ok: true, role: req.funsongUser.role })
    }
  )
  app.use(
    '/api/admin/songs',
    requireAuth,
    requireSuperAdmin,
    adminSongs
  )
  app.use(
    '/api/admin/party-requests',
    requireAuth,
    requireSuperAdmin,
    adminPartyRequestRouter
  )
  app.use(
    '/api/admin/parties',
    requireAuth,
    requireSuperAdmin,
    adminPartiesRouter
  )
  app.use(
    '/api/admin/settings',
    requireAuth,
    requireSuperAdmin,
    adminSettingsRouter
  )
  app.use(
    '/api/host/party-requests',
    requireAuth,
    requireHost,
    hostPartyRequestRouter
  )
  app.get(
    '/api/host/parties/:partyId/qr',
    requireAuth,
    requireHost,
    hostPartyQrHandler
  )
  app.use(
    '/api/host/parties',
    requireAuth,
    requireHost,
    hostPartyPlaylistApi
  )
  app.use(
    '/api/host',
    requireAuth,
    requireHost,
    hostControlApi
  )
  app.post(
    '/api/host/parties/request',
    requireAuth,
    requireHost,
    postHostPartyRequest
  )
  app.get('/api/songs/selectable', requireAuth, requireHost, async (req, res, next) => {
    try {
      const pool = getPoolInj()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const songs = await listSongsForPartySelection(pool)
      return res.json({ songs })
    } catch (e) {
      return next(e)
    }
  })
  app.get(
    '/api/songs/:songId/audio',
    requireAuth,
    async (req, res, next) => {
      try {
        if (!UUID_SONG.test(req.params.songId)) {
          return res.status(400).json({ error: 'invalid_song_id' })
        }
        const pool = getPoolInj()
        if (!pool) {
          return res.status(503).json({ error: 'no_database' })
        }
        const meta = await getSongStreamMeta(req.params.songId, pool)
        if (!meta || !meta.storageKey) {
          return res.status(404).end()
        }
        const u = /** @type {{ role: string } | undefined} */ (req.funsongUser)
        if (u?.role === 'super_admin') {
          return void (await streamAudioFileToResponse(
            req,
            res,
            meta.storageKey,
            meta.mime || 'audio/mpeg'
          ))
        }
        if (u?.role === 'host') {
          if (meta.status === 'published' && meta.rightsStatus !== 'blocked') {
            return void (await streamAudioFileToResponse(
              req,
              res,
              meta.storageKey,
              meta.mime || 'audio/mpeg'
            ))
          }
        }
        return res.status(403).json({ error: 'forbidden' })
      } catch (e) {
        return next(e)
      }
    }
  )

  if (process.env.NODE_ENV === 'production') {
    app.use(
      express.static(clientDist, {
        maxAge: '1h',
        index: false
      })
    )
    const sendIndex = (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    }
    app.get('/join/:partyCode', sendIndex)
    app.get('/party/:partyCode/playlist', sendIndex)
    app.get('/party/:partyCode', sendIndex)
    app.get('/host/dashboard', requireAuth, requireHost, sendIndex)
    app.get('/host/parties/new', requireAuth, requireHost, sendIndex)
    app.get('/host/party-requests/:partyId/waiting', requireAuth, requireHost, sendIndex)
    app.get('/host/parties/:partyId/qr', requireAuth, requireHost, sendIndex)
    app.get('/host/parties/:partyId/playlist', requireAuth, requireHost, sendIndex)
    app.get('/host/parties/:partyId', requireAuth, requireHost, sendIndex)
    app.get('/admin/party-requests', requireAuth, requireSuperAdmin, sendIndex)
    app.get('/admin/parties/:partyId', requireAuth, requireSuperAdmin, sendIndex)
    app.get('/admin/parties', requireAuth, requireSuperAdmin, sendIndex)
    app.get('/admin/settings', requireAuth, requireSuperAdmin, sendIndex)
    app.get('/admin', requireAuth, requireSuperAdmin, sendIndex)
    app.get(/.+/, (req, res) => {
      if (path.extname(req.path)) {
        return res.status(404).end()
      }
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  return app
}
