import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crown, Users, Clock, Star, Gamepad2, StopCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'

export default function SessionActive() {
  const { id }   = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom]             = useState(null)
  const [session, setSession]       = useState(null)
  const [game, setGame]             = useState(null)
  const [members, setMembers]       = useState([])
  const [elapsed, setElapsed]       = useState(0)
  const [ending, setEnding]         = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [loading, setLoading]       = useState(true)
  const timerRef      = useRef(null)
  const loadAbortRef  = useRef(null)
  const showRatingRef = useRef(false)  // readable inside async loadData

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      loadAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (user?.id) loadData()
  }, [id, user?.id])

  // Live timer
  useEffect(() => {
    if (!session) return
    const startMs = new Date(session.started_at).getTime()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.id])

  // Realtime — show rating modal when game_sessions.ended_at is set
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel(`game-session-${session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${session.id}`,
      }, payload => {
        if (payload.new?.ended_at) {
          clearInterval(timerRef.current)
          showRatingRef.current = true
          setShowRating(true)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session?.id])

  async function loadData() {
    // If the rating modal is already showing, never run loadData — it would
    // navigate away mid-rating. This guards against auth token refresh events
    // re-triggering this effect while the user is rating.
    if (showRatingRef.current) return

    loadAbortRef.current?.abort()
    const ctrl = new AbortController()
    loadAbortRef.current = ctrl
    const sig = ctrl.signal

    try {
      const [r0, r1] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', id).single().abortSignal(sig),
        supabase.rpc('get_room_members', { p_room_id: id }).abortSignal(sig),
      ])

      if (sig.aborted) return

      const roomData    = r0.data
      const membersData = r1.data

      if (!roomData) { navigate(`/rooms/${id}`); return }

      // Room status may not have propagated yet — wait up to 2s
      if (roomData.status !== 'session_active') {
        // Never navigate away if the rating modal is already visible
        if (showRatingRef.current) return
        await new Promise(r => setTimeout(r, 1500))
        if (sig.aborted) return
        const { data: retryRoom } = await supabase
          .from('rooms').select('status').eq('id', id).single().abortSignal(sig)
        if (sig.aborted) return
        if (retryRoom?.status !== 'session_active') {
          if (!showRatingRef.current) navigate(`/rooms/${id}`)
          return
        }
      }

      // Retry up to 3 times for the game_sessions row
      let sessionData = null
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1000))
        if (sig.aborted) return
        const { data } = await supabase
          .from('game_sessions')
          .select('*, games(*)')
          .eq('room_id', id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()
          .abortSignal(sig)
        if (data) { sessionData = data; break }
      }

      if (sig.aborted) return

      if (!sessionData) { navigate(`/rooms/${id}`); return }

      setRoom(roomData)
      setSession(sessionData)
      setGame(sessionData.games)
      setMembers(membersData ?? [])
      setLoading(false)
    } catch (err) {
      if (sig.aborted || err?.name === 'AbortError') return
      navigate(`/rooms/${id}`)
    }
  }

  async function endSession() {
    if (!session || ending) return
    setEnding(true)
    const now             = new Date().toISOString()
    const durationMinutes = Math.max(1, Math.round(elapsed / 60))

    // 10s timeout — show rating modal regardless of whether DB calls complete
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)

    try {
      await Promise.all([
        supabase.from('game_sessions')
          .update({ ended_at: now, duration_minutes: durationMinutes })
          .eq('id', session.id)
          .abortSignal(ctrl.signal),
        supabase.from('rooms')
          .update({ status: 'open' })
          .eq('id', id)
          .abortSignal(ctrl.signal),
      ])
    } catch { /* timeout or network error — proceed to rating anyway */ }

    clearTimeout(t)
    clearInterval(timerRef.current)
    // Refresh materialized view in background — don't block the rating modal
    supabase.rpc('refresh_room_stats').catch(() => {})
    setEnding(false)
    showRatingRef.current = true
    setShowRating(true)
  }

  const hours   = Math.floor(elapsed / 3600)
  const mins    = Math.floor((elapsed % 3600) / 60)
  const secs    = elapsed % 60
  const timeStr = hours > 0
    ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`

  const isHost = room?.host_id === user?.id

  if (loading) return <LoadingState />

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-cyan"    style={{ top: '-100px', right: '-150px', opacity: 0.15 }} />
      <div className="glow-orb-violet"  style={{ bottom: '-80px', left: '-80px', opacity: 0.1 }} />

      <div className="max-w-2xl mx-auto relative z-10 animate-slide-up">

        {/* Game banner */}
        <div className="glass rounded-2xl overflow-hidden border border-secondary/20 mb-6">
          <div className="relative aspect-video bg-white/[0.04]">
            {game?.cover_url ? (
              <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gamepad2 size={48} className="text-slate-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <p className="text-xs text-secondary font-bold uppercase tracking-widest mb-1">Now Playing</p>
              <h1 className="font-display font-bold text-3xl text-white">{game?.title}</h1>
              {(game?.genre ?? game?.genres ?? []).slice(0, 3).map(g => (
                <span key={g} className="inline-block mr-2 mt-1 text-[11px] text-slate-400
                  bg-white/[0.08] px-2 py-0.5 rounded-full">{g}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Timer + End Session */}
        <div className="glass rounded-2xl p-6 border border-white/[0.08] mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Session Time</p>
              <p className="font-display font-bold text-4xl text-white tabular-nums">{timeStr}</p>
            </div>
            {isHost ? (
              <button
                onClick={endSession}
                disabled={ending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10
                  border border-red-500/25 text-red-400 hover:bg-red-500/20
                  font-semibold transition-all disabled:opacity-50 flex-shrink-0"
              >
                <StopCircle size={16} />
                {ending ? 'Ending…' : 'End Session'}
              </button>
            ) : (
              <p className="text-slate-600 text-sm text-right">
                Waiting for host<br />to end the session…
              </p>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="glass rounded-2xl p-6 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-slate-500" />
            <h2 className="font-display font-semibold text-sm text-white">Playing Now</h2>
            <span className="text-xs text-slate-600 bg-white/[0.04] border border-white/[0.06]
              px-2 py-0.5 rounded-full ml-1">{members.length}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map(m => (
              <div key={m.user_id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl
                  bg-white/[0.04] border border-white/[0.06]">
                <Avatar username={m.username} size="sm" />
                <span className="text-sm text-white font-medium">{m.username}</span>
                {room.host_id === m.user_id && (
                  <Crown size={11} className="text-yellow-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rating modal */}
      {showRating && (
        <RatingModal
          game={game}
          sessionId={session?.id}
          userId={user?.id}
          roomId={id}
          onDone={() => navigate(`/rooms/${id}`)}
        />
      )}
    </div>
  )
}

/* ── Rating modal ──────────────────────────────────────────────── */
function RatingModal({ game, sessionId, userId, roomId, onDone }) {
  const [hover, setHover]           = useState(0)
  const [selected, setSelected]     = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  async function submit() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('submit_session_rating', {
      p_session_id: sessionId,
      p_user_id:    userId,
      p_game_id:    game?.id,
      p_rating:     selected,
    })

    if (rpcError) {
      console.error('[submit_session_rating]', rpcError.message)
      setError('Failed to submit. Try again.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6
      bg-background/80 backdrop-blur-md">
      <div className="glass rounded-3xl p-8 border border-primary/25 max-w-sm w-full text-center
        shadow-[0_0_60px_rgba(124,58,237,0.2)] animate-slide-up">

        <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Session Complete</p>
        <h2 className="font-display font-bold text-2xl text-white mb-1">Rate the Session</h2>
        <p className="text-slate-400 text-sm mb-6">
          How was <span className="text-white font-medium">{game?.title}</span>?
        </p>

        {/* Stars */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={32}
                className={n <= (hover || selected) ? 'text-yellow-400' : 'text-slate-700'}
                fill={n <= (hover || selected) ? 'currentColor' : 'none'}
              />
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="space-y-2">
          <button
            onClick={submit}
            disabled={!selected || submitting}
            className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Rating'}
          </button>
          <button onClick={onDone} className="btn-ghost w-full py-3 text-sm text-slate-500">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Loading skeleton ──────────────────────────────────────────── */
function LoadingState() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    </div>
  )
}
