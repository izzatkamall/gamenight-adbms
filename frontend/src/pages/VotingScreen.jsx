import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Wifi, WifiOff, Trophy, Gamepad2, Users, Zap, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useVotingWS } from '../hooks/useVotingWS'

export default function VotingScreen() {
  const { id }   = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom]       = useState(null)
  const [session, setSession] = useState(null)
  const [shortlist, setShortlist] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const abortRef              = useRef(null)

  const { connected, tallies, winner, hasVoted, voteCancelled, castVote, cancelVote } =
    useVotingWS(id, user?.id)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [id, user])

  async function loadData() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const sig = ctrl.signal

    try {
      const [r0, r1, r2, r3] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', id).single().abortSignal(sig),
        supabase
          .from('voting_sessions').select('*').eq('room_id', id).is('ended_at', null)
          .order('started_at', { ascending: false }).limit(1).single().abortSignal(sig),
        supabase.rpc('get_shortlist',     { p_room_id: id }).abortSignal(sig),
        supabase.rpc('get_room_members',  { p_room_id: id }).abortSignal(sig),
      ])

      if (sig.aborted) return

      if (!r0.data || !r1.data) { navigate(`/rooms/${id}`); return }

      setRoom(r0.data)
      setSession(r1.data)
      setShortlist(r2.data ?? [])
      setMembers(r3.data ?? [])
      setLoading(false)
    } catch (err) {
      if (sig.aborted || err?.name === 'AbortError') return
      navigate(`/rooms/${id}`)
    }
  }

  const isHost = room?.host_id === user?.id

  // Navigate everyone back to lobby when host cancels the vote
  useEffect(() => {
    if (voteCancelled) navigate(`/rooms/${id}`)
  }, [voteCancelled])

  const majority   = Math.ceil(members.length / 2)
  const totalVotes = tallies.reduce((sum, t) => sum + t.votes, 0)
  const votesMap   = Object.fromEntries(tallies.map(t => [t.game_id, t.votes]))
  const maxVotes   = Math.max(...Object.values(votesMap), 0)
  const winnerGame = winner != null ? shortlist.find(g => g.id === winner) ?? null : null

  if (loading) return <LoadingState />

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-120px', right: '-150px', opacity: 0.15 }} />
      <div className="glow-orb-cyan"   style={{ bottom: '-80px', left: '-100px', opacity: 0.1  }} />

      <div className="max-w-2xl mx-auto relative z-10 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/rooms/${id}`)}
              className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-slate-400
                hover:text-white hover:bg-white/10 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-display font-bold text-xl text-white">{room?.name}</h1>
              <p className="text-xs text-slate-500">Live Vote in Progress</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isHost && winner == null && (
              <button
                onClick={cancelVote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <XCircle size={12} /> Cancel Vote
              </button>
            )}
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
              connected
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-white/[0.05] border-white/[0.08] text-slate-500'
            }`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'Live' : 'Connecting…'}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="glass rounded-2xl p-4 border border-primary/20 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Zap size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                First to {majority} vote{majority !== 1 ? 's' : ''} wins
              </p>
              <p className="text-xs text-slate-500">
                {members.length} member{members.length !== 1 ? 's' : ''} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
              </p>
            </div>
          </div>
          {hasVoted && !winner && (
            <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
              Vote cast ✓
            </span>
          )}
        </div>

        {/* Shortlist */}
        {shortlist.length === 0 ? (
          <div className="glass rounded-2xl p-10 border border-white/[0.07] text-center">
            <Gamepad2 size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No games in shortlist for this room.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shortlist.map(game => {
              const votes     = votesMap[game.id] ?? 0
              const pct       = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
              const isLeading = votes > 0 && votes === maxVotes
              const isWinner  = winner === game.id

              return (
                <VoteCard
                  key={game.id}
                  game={game}
                  votes={votes}
                  pct={pct}
                  isLeading={isLeading}
                  isWinner={isWinner}
                  hasVoted={hasVoted}
                  connected={connected}
                  voteEnded={winner != null}
                  onVote={() => castVote(session.id, game.id)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Winner overlay */}
      {winnerGame && (
        <WinnerModal
          game={winnerGame}
          onContinue={() => navigate(`/rooms/${id}/session`)}
        />
      )}
    </div>
  )
}

/* ── Vote card ─────────────────────────────────────────────────── */
function VoteCard({ game, votes, pct, isLeading, isWinner, hasVoted, connected, voteEnded, onVote }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`glass rounded-2xl p-4 border transition-all duration-200 ${
      isWinner
        ? 'border-yellow-400/40 shadow-[0_0_24px_rgba(250,204,21,0.15)]'
        : isLeading
          ? 'border-primary/40 shadow-[0_0_20px_rgba(124,58,237,0.12)]'
          : 'border-white/[0.08] hover:border-white/15'
    }`}>
      <div className="flex items-center gap-4">
        <div className="w-20 h-12 rounded-xl overflow-hidden bg-white/[0.04] flex-shrink-0">
          {game.cover_url && !imgError ? (
            <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover"
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gamepad2 size={16} className="text-slate-700" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white line-clamp-1 mb-1">{game.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(game.genres ?? []).slice(0, 2).map(g => (
              <span key={g} className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{g}</span>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 text-right min-w-[40px]">
          <p className={`font-display font-bold text-xl leading-none ${
            isWinner ? 'text-yellow-400' : isLeading ? 'text-primary' : 'text-white'
          }`}>{votes}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">vote{votes !== 1 ? 's' : ''}</p>
        </div>

        {!voteEnded && (
          <button
            onClick={onVote}
            disabled={hasVoted || !connected}
            className={`flex-shrink-0 w-20 py-2 rounded-xl text-sm font-semibold transition-all text-center ${
              hasVoted
                ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed border border-white/[0.06]'
                : !connected
                  ? 'bg-white/[0.04] text-slate-700 cursor-not-allowed border border-white/[0.06]'
                  : 'btn-primary'
            }`}
          >
            {hasVoted ? 'Voted' : !connected ? '…' : 'Vote'}
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isWinner ? 'bg-gradient-to-r from-yellow-400 to-amber-400'
                : isLeading ? 'bg-gradient-to-r from-primary to-secondary'
                : 'bg-white/20'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Winner modal ──────────────────────────────────────────────── */
function WinnerModal({ game, onContinue }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6
      bg-background/80 backdrop-blur-md">
      <div className="glass rounded-3xl p-8 border border-yellow-400/30 max-w-sm w-full text-center
        shadow-[0_0_80px_rgba(250,204,21,0.2)] animate-slide-up">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy size={22} className="text-yellow-400" />
          <span className="font-display font-bold text-xl text-white">Winner!</span>
        </div>
        <p className="text-slate-500 text-xs mb-6">The group has decided</p>

        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-white/[0.04] mb-5">
          {game.cover_url && !imgError ? (
            <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover"
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gamepad2 size={32} className="text-slate-700" />
            </div>
          )}
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-2">{game.title}</h2>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          {(game.genres ?? []).slice(0, 3).map(g => (
            <span key={g} className="text-[11px] text-slate-500 bg-white/[0.05] border border-white/[0.08] px-2.5 py-0.5 rounded-full">
              {g}
            </span>
          ))}
        </div>

        <button onClick={onContinue} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Users size={16} /> Let's Play!
        </button>
        <p className="text-slate-600 text-xs mt-3">Taking you to the session…</p>
      </div>
    </div>
  )
}

/* ── Loading skeleton ──────────────────────────────────────────── */
function LoadingState() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-16 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    </div>
  )
}
