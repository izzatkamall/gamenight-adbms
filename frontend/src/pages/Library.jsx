import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, Minus, Gamepad2, Users, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Library() {
  const { user } = useAuth()
  const [games, setGames]               = useState([])
  const [ownedIds, setOwnedIds]         = useState(new Set())
  const [search, setSearch]             = useState('')
  const [loadingGames, setLoadingGames] = useState(true)
  const [fetchError, setFetchError]     = useState(null)
  const [toggling, setToggling]         = useState(new Set())
  const abortRef                        = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!user) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    Promise.all([fetchGames(ctrl.signal), fetchLibrary(ctrl.signal)])
  }, [user])

  async function fetchGames(signal) {
    try {
      const { data, error } = await supabase
        .from('games').select('*').order('title')
        .abortSignal(signal)
      if (signal?.aborted) return
      if (error) { setFetchError(error.message); return }
      if (data) setGames(data)
    } catch (err) {
      if (err?.name !== 'AbortError') setFetchError(err.message ?? 'Failed to load games.')
    } finally {
      if (!signal?.aborted) setLoadingGames(false)
    }
  }

  async function fetchLibrary(signal) {
    try {
      const { data } = await supabase
        .from('user_libraries').select('game_id').eq('user_id', user.id)
        .abortSignal(signal)
      if (!signal?.aborted && data) setOwnedIds(new Set(data.map(r => r.game_id)))
    } catch { /* aborted or network error */ }
  }

  async function toggleGame(gameId) {
    if (toggling.has(gameId)) return
    setToggling(prev => new Set(prev).add(gameId))

    const owned = ownedIds.has(gameId)
    try {
      if (owned) {
        await supabase.from('user_libraries')
          .delete().eq('user_id', user.id).eq('game_id', gameId)
        setOwnedIds(prev => { const s = new Set(prev); s.delete(gameId); return s })
      } else {
        await supabase.from('user_libraries')
          .insert({ user_id: user.id, game_id: gameId })
        setOwnedIds(prev => new Set(prev).add(gameId))
      }
    } catch { /* ignore toggle errors */ }

    setToggling(prev => { const s = new Set(prev); s.delete(gameId); return s })
  }

  const filtered = useMemo(() =>
    games.filter(g => g.title.toLowerCase().includes(search.toLowerCase())),
    [games, search]
  )

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-100px', right: '-200px', opacity: 0.2 }} />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-white">Game Library</h1>
            <p className="text-slate-500 text-sm mt-1">
              {ownedIds.size} game{ownedIds.size !== 1 ? 's' : ''} in your library
            </p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              className="form-input pl-10 py-2.5 text-sm"
              placeholder="Search games…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        {fetchError ? (
          <div className="text-center py-24">
            <p className="text-red-400 text-sm mb-2">Failed to load games</p>
            <p className="text-slate-600 text-xs font-mono">{fetchError}</p>
          </div>
        ) : loadingGames ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[16/9] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Gamepad2 size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">No games match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(game => (
              <GameCard
                key={game.id}
                game={game}
                owned={ownedIds.has(game.id)}
                toggling={toggling.has(game.id)}
                onToggle={() => toggleGame(game.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GameCard({ game, owned, toggling, onToggle }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`group relative glass rounded-xl overflow-hidden border transition-all duration-200
      ${owned
        ? 'border-primary/40 shadow-[0_0_16px_rgba(124,58,237,0.15)]'
        : 'border-white/[0.07] hover:border-white/20'
      }`}
    >
      <div className="relative aspect-[16/9] bg-white/[0.04] overflow-hidden">
        {game.cover_url && !imgError ? (
          <img
            src={game.cover_url}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={28} className="text-slate-700" />
          </div>
        )}
        {owned && <div className="absolute inset-0 bg-primary/10 pointer-events-none" />}
        {game.is_free && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider
            bg-green-500/20 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded">
            Free
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-display font-semibold text-sm text-white leading-tight mb-2 line-clamp-1">
          {game.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {game.genres.slice(0, 2).map(g => (
            <span key={g} className="text-[10px] text-slate-500 bg-white/[0.05] px-1.5 py-0.5 rounded">
              {g}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-3">
          <span className="flex items-center gap-1"><Users size={11} />{game.min_players}–{game.max_players}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{game.avg_playtime_minutes}m</span>
        </div>
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold
            transition-all duration-200 disabled:opacity-50
            ${owned
              ? 'bg-primary/20 border border-primary/30 text-primary hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400'
              : 'bg-white/[0.05] border border-white/10 text-slate-400 hover:bg-primary/20 hover:border-primary/30 hover:text-primary'
            }`}
        >
          {owned ? <><Minus size={11} /> Remove</> : <><Plus size={11} /> Add</>}
        </button>
      </div>
    </div>
  )
}
