import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Check, Users, Gamepad2, Clock, Crown, X, AlertCircle, TrendingUp, Star, Vote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'

export default function RoomLobby() {
  const { id }   = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom]           = useState(null)
  const [members, setMembers]     = useState([])
  const [games, setGames]         = useState([])
  const [shortlist, setShortlist] = useState([])
  const [ratings, setRatings]     = useState({})
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [copied, setCopied]       = useState(false)
  const [closing, setClosing]           = useState(false)
  const [startingVote, setStartingVote] = useState(false)

  useEffect(() => {
    if (user) loadRoom()
  }, [id, user])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) loadRoom()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user, id])

  // Supabase Realtime — navigate all room members when voting starts
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`room-vote-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
        payload => {
          if (payload.new?.status === 'voting') {
            navigate(`/rooms/${id}/vote`)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadRoom() {
    setLoading(true)
    const [
      { data: roomData },
      { data: membersData },
      { data: gamesData },
      { data: shortlistData },
    ] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).single(),
      supabase.rpc('get_room_members', { p_room_id: id }),
      supabase.rpc('get_common_games',  { p_room_id: id }),
      supabase.rpc('get_shortlist',     { p_room_id: id }),
    ])

    if (!roomData) { setNotFound(true); setLoading(false); return }

    setRoom(roomData)
    setMembers(membersData ?? [])
    setGames(gamesData ?? [])
    setShortlist(shortlistData ?? [])
    setLoading(false)
  }

  async function rateGame(gameId, rating) {
    await supabase.rpc('update_user_preferences', {
      p_user_id: user.id,
      p_game_id: gameId,
      p_rating:  rating,
    })
    setRatings(prev => ({ ...prev, [gameId]: rating }))
    // Re-rank the shortlist after a new rating
    const { data } = await supabase.rpc('get_shortlist', { p_room_id: id })
    if (data) setShortlist(data)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function closeRoom() {
    setClosing(true)
    await supabase.from('rooms').update({ status: 'closed' }).eq('id', id)
    setRoom(r => ({ ...r, status: 'closed' }))
    setClosing(false)
  }

  async function startVote() {
    if (shortlist.length === 0) return
    setStartingVote(true)

    // Create voting session
    const { data: vsData, error } = await supabase
      .from('voting_sessions')
      .insert({ room_id: id })
      .select('id')
      .single()

    if (error || !vsData) {
      setStartingVote(false)
      return
    }

    // Flip room to 'voting' — Realtime subscription will navigate everyone
    await supabase.from('rooms').update({ status: 'voting' }).eq('id', id)
    setStartingVote(false)
  }

  const isHost = room?.host_id === user?.id

  if (loading)  return <LoadingState />
  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">Room not found</h2>
        <p className="text-slate-500 text-sm mb-6">This room doesn't exist or you're not a member.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary px-6 py-2.5">
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-100px', left: '-150px', opacity: 0.2 }} />

      <div className="max-w-5xl mx-auto relative z-10 animate-slide-up">

        {/* Room header */}
        <div className="glass rounded-2xl p-6 border border-white/[0.08] mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display font-bold text-2xl text-white">{room.name}</h1>
                <StatusBadge status={room.status} />
              </div>
              <p className="text-slate-500 text-sm">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {room.status === 'open' && (
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10
                    text-slate-300 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
                >
                  <span className="font-display font-bold tracking-widest text-primary">{room.invite_code}</span>
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
              {room.status === 'voting' && (
                <button
                  onClick={() => navigate(`/rooms/${id}/vote`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary text-sm font-semibold"
                >
                  <Vote size={14} /> Join Vote
                </button>
              )}
              {isHost && room.status === 'open' && shortlist.length > 0 && (
                <button
                  onClick={startVote}
                  disabled={startingVote}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary text-sm font-semibold
                    transition-all disabled:opacity-50"
                >
                  <Vote size={14} />
                  {startingVote ? 'Starting…' : 'Start Vote'}
                </button>
              )}
              {isHost && room.status === 'open' && (
                <button
                  onClick={closeRoom}
                  disabled={closing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20
                    text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all disabled:opacity-50"
                >
                  <X size={14} /> Close Room
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">

          {/* Members panel */}
          <div className="glass rounded-2xl p-6 border border-white/[0.08] h-fit">
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-slate-500" />
              <h2 className="font-display font-semibold text-white">Members</h2>
            </div>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <Avatar username={m.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.username}</p>
                  </div>
                  {room.host_id === m.user_id && (
                    <Crown size={13} className="text-yellow-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Games column */}
          <div className="space-y-6">

            {/* Group Picks — shortlist ranked by preference */}
            {shortlist.length > 0 && (
              <div className="glass rounded-2xl p-6 border border-primary/20">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp size={16} className="text-primary" />
                  <h2 className="font-display font-semibold text-white">Group Picks</h2>
                  <span className="text-xs text-slate-600 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full ml-1">
                    Ranked by taste profile
                  </span>
                </div>
                <div className="space-y-2">
                  {shortlist.map((game, i) => (
                    <ShortlistRow
                      key={game.id}
                      game={game}
                      rank={i + 1}
                      userRating={ratings[game.id]}
                      onRate={rateGame}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All common games */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Gamepad2 size={16} className="text-slate-500" />
                <h2 className="font-display font-semibold text-white">Games Everyone Owns</h2>
                {games.length > 0 && (
                  <span className="text-xs text-slate-600 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-full">
                    {games.length}
                  </span>
                )}
              </div>

              {games.length === 0 ? (
                <div className="glass rounded-2xl p-10 border border-white/[0.07] text-center">
                  <Gamepad2 size={32} className="text-slate-700 mx-auto mb-3" />
                  <h3 className="font-display font-semibold text-white mb-2">No games in common</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Add more games to your library. A game appears here only when every member owns it.
                  </p>
                  <button onClick={() => navigate('/library')} className="btn-ghost px-5 py-2 text-sm mt-5">
                    Go to Library
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {games.map(game => (
                    <CommonGameCard
                      key={game.id}
                      game={game}
                      userRating={ratings[game.id]}
                      onRate={rateGame}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Shortlist row ─────────────────────────────────────────────── */
function ShortlistRow({ game, rank, userRating, onRate }) {
  const [imgError, setImgError] = useState(false)
  const score = Math.round((game.group_score ?? 0.5) * 100)

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]
      hover:border-white/10 transition-all">
      <span className="text-slate-600 font-mono text-xs w-5 text-center flex-shrink-0">#{rank}</span>

      <div className="w-16 h-9 rounded-lg overflow-hidden bg-white/[0.04] flex-shrink-0">
        {game.cover_url && !imgError ? (
          <img src={game.cover_url} alt={game.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={14} className="text-slate-700" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white line-clamp-1">{game.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {game.genres.slice(0, 2).map(g => (
            <span key={g} className="text-[10px] text-slate-600">{g}</span>
          ))}
        </div>
      </div>

      <div className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
        score >= 70 ? 'bg-green-500/15 text-green-400' :
        score >= 50 ? 'bg-primary/15 text-primary' :
                      'bg-white/[0.05] text-slate-500'
      }`}>
        {score}%
      </div>

      <StarRating gameId={game.id} currentRating={userRating} onRate={onRate} />
    </div>
  )
}

/* ── Common game card ──────────────────────────────────────────── */
function CommonGameCard({ game, userRating, onRate }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/[0.07] hover:border-primary/30
      transition-all duration-200 hover:shadow-[0_0_16px_rgba(124,58,237,0.12)] group">
      <div className="relative aspect-[16/9] bg-white/[0.04]">
        {game.cover_url && !imgError ? (
          <img src={game.cover_url} alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={24} className="text-slate-700" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-display font-semibold text-sm text-white line-clamp-1 mb-1">{game.title}</p>
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-2">
          <span className="flex items-center gap-1"><Users size={11} />{game.min_players}–{game.max_players}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{game.avg_playtime_minutes}m</span>
        </div>
        <StarRating gameId={game.id} currentRating={userRating} onRate={onRate} />
      </div>
    </div>
  )
}

/* ── Star rating widget ────────────────────────────────────────── */
function StarRating({ gameId, currentRating, onRate }) {
  const [hover, setHover] = useState(0)
  const locked = !!currentRating
  const active = hover || currentRating || 0

  if (locked) {
    return (
      <div className="flex items-center gap-0.5" title="Already rated this session">
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            size={12}
            className={n <= currentRating ? 'text-yellow-400' : 'text-slate-700'}
            fill={n <= currentRating ? 'currentColor' : 'none'}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onRate(gameId, n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`p-0.5 transition-colors ${
            n <= active ? 'text-yellow-400' : 'text-slate-700 hover:text-yellow-400/60'
          }`}
        >
          <Star size={12} fill={n <= active ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

/* ── Status badge ──────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const styles = {
    open:           'bg-green-500/15 border-green-500/25 text-green-400',
    voting:         'bg-primary/15 border-primary/25 text-primary',
    session_active: 'bg-secondary/15 border-secondary/25 text-secondary',
    closed:         'bg-white/[0.05] border-white/[0.1] text-slate-500',
  }
  const labels = { open: 'Open', voting: 'Voting', session_active: 'Playing', closed: 'Closed' }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${styles[status] ?? styles.closed}`}>
      {labels[status] ?? status}
    </span>
  )
}

/* ── Loading skeleton ──────────────────────────────────────────── */
function LoadingState() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="skeleton h-28 rounded-2xl mb-6" />
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
