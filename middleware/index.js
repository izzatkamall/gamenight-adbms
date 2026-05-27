require('dotenv').config()
const http      = require('http')
const express   = require('express')
const { WebSocketServer, WebSocket } = require('ws')
const { createClient } = require('@supabase/supabase-js')
const Redis     = require('ioredis')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocketServer({ server })

const redis = new Redis(process.env.REDIS_URL)
redis.on('error', err => console.error('[Redis]', err.message))

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } },
  }
)

// room_id → Set<{ ws, userId }>
const roomClients = new Map()

function roomBroadcast(roomId, data) {
  const clients = roomClients.get(roomId)
  if (!clients) return
  const msg = JSON.stringify(data)
  for (const { ws } of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}

async function handleVote(ws, roomId, userId, voting_session_id, game_id) {
  const votersKey = `voters:${roomId}:${voting_session_id}`
  const votesKey  = `vote:${roomId}:${voting_session_id}`

  const alreadyVoted = await redis.sismember(votersKey, userId)
  if (alreadyVoted) {
    ws.send(JSON.stringify({ type: 'error', message: 'Already voted' }))
    return
  }

  await redis.sadd(votersKey, userId)
  await redis.zincrby(votesKey, 1, String(game_id))

  // Fetch all current tallies
  const raw = await redis.zrangebyscore(votesKey, '-inf', '+inf', 'WITHSCORES')
  const tallies = []
  for (let i = 0; i < raw.length; i += 2) {
    tallies.push({ game_id: parseInt(raw[i], 10), votes: parseInt(raw[i + 1], 10) })
  }

  console.log(`[vote] user=${userId.slice(0,8)} game=${game_id} tallies=${JSON.stringify(tallies)}`)
  roomBroadcast(roomId, { type: 'vote_update', tallies })

  // Check for majority
  const { data: members } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)

  const memberCount = members?.length ?? 2
  const majority    = Math.ceil(memberCount / 2)
  const winner      = tallies.find(t => t.votes >= majority)

  if (winner) {
    const now = new Date().toISOString()
    await Promise.all([
      supabase.from('voting_sessions')
        .update({ ended_at: now, winner_game_id: winner.game_id })
        .eq('id', voting_session_id),
      supabase.from('rooms')
        .update({ status: 'session_active' })
        .eq('id', roomId),
      supabase.from('game_sessions')
        .insert({ room_id: roomId, game_id: winner.game_id, started_at: now }),
    ])

    await redis.del(votesKey, votersKey)
    console.log(`[vote_end] winner=${winner.game_id} room=${roomId.slice(0,8)}`)
    roomBroadcast(roomId, { type: 'vote_end', winner_game_id: winner.game_id })
  }
}

wss.on('connection', ws => {
  let roomId = null
  let userId = null

  ws.on('message', async raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    console.log(`[msg] type=${msg.type} from=${userId?.slice(0,8) ?? 'unknown'}`)

    // ── JOIN ──────────────────────────────────────────────────────────
    if (msg.type === 'join') {
      const { room_id, user_id } = msg
      if (!room_id || !user_id) return

      const { data, error } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', room_id)
        .eq('user_id', user_id)
        .single()

      if (error || !data) {
        console.log(`[join DENIED] user=${user_id?.slice(0,8)} room=${room_id?.slice(0,8)} err=${error?.message}`)
        ws.send(JSON.stringify({ type: 'error', message: 'Not a room member' }))
        return
      }

      roomId = room_id
      userId = user_id

      if (!roomClients.has(roomId)) roomClients.set(roomId, new Set())
      roomClients.get(roomId).add({ ws, userId })

      ws.send(JSON.stringify({ type: 'joined', room_id: roomId }))
      console.log(`[join OK] user=${userId.slice(0,8)} room=${roomId.slice(0,8)} clients=${roomClients.get(roomId).size}`)
      return
    }

    if (!roomId) {
      console.log(`[msg ignored] no roomId, type=${msg.type}`)
      return
    }

    // ── VOTE ──────────────────────────────────────────────────────────
    if (msg.type === 'vote') {
      const { voting_session_id, game_id } = msg
      if (!voting_session_id || !game_id) return
      try {
        await handleVote(ws, roomId, userId, voting_session_id, game_id)
      } catch (err) {
        console.error('[vote error]', err.message, err.stack)
      }
    }
  })

  ws.on('close', () => {
    if (!roomId || !roomClients.has(roomId)) return
    const clients = roomClients.get(roomId)
    for (const client of clients) {
      if (client.ws === ws) { clients.delete(client); break }
    }
    if (clients.size === 0) roomClients.delete(roomId)
  })

  ws.on('error', err => console.error('[WS]', err.message))
})

app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`[middleware] listening on :${PORT}`))
