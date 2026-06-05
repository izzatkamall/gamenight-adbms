import { useState, useEffect, useRef } from 'react'
import { Heart, Gamepad2, Users, Clock, Plus, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Wishlist() {
  const { user } = useAuth()
  const [items, setItems]       = useState([])   // { game, owned }
  const [loading, setLoading]   = useState(true)
  const abortRef                = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (user) fetchWishlist()
  }, [user])

  async function fetchWishlist() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const [{ data: wished }, { data: owned }] = await Promise.all([
        supabase
          .from('game_wishlists')
          .select('game_id, games(*)')
          .eq('user_id', user.id)
          .abortSignal(ctrl.signal),
        supabase
          .from('user_libraries')
          .select('game_id')
          .eq('user_id', user.id)
          .abortSignal(ctrl.signal),
      ])

      if (ctrl.signal.aborted) return

      const ownedSet = new Set((owned ?? []).map(r => r.game_id))
      setItems((wished ?? []).map(r => ({ game: r.games, owned: ownedSet.has(r.game_id) })))
    } catch { /* aborted */ }
    finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }

  async function removeFromWishlist(gameId) {
    await supabase.from('game_wishlists').delete().eq('user_id', user.id).eq('game_id', gameId)
    setItems(prev => prev.filter(i => i.game.id !== gameId))
  }

  async function addToLibrary(gameId) {
    await supabase.from('user_libraries').insert({ user_id: user.id, game_id: gameId })
    setItems(prev => prev.map(i => i.game.id === gameId ? { ...i, owned: true } : i))
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-100px', left: '-150px', opacity: 0.2 }} />

      <div className="max-w-4xl mx-auto relative z-10 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-white flex items-center gap-3">
              <Heart size={28} className="text-rose-400" fill="currentColor" />
              My Wishlist
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {items.length} game{items.length !== 1 ? 's' : ''} you want to play
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl p-16 border border-white/[0.07] text-center">
            <Heart size={40} className="text-slate-700 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-white mb-2">No games wishlisted yet</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Hover over any game in the Library and click the heart icon to add it to your wishlist.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(({ game, owned }) => (
              <WishlistCard
                key={game.id}
                game={game}
                owned={owned}
                onRemove={() => removeFromWishlist(game.id)}
                onAddToLibrary={() => addToLibrary(game.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WishlistCard({ game, owned, onRemove, onAddToLibrary }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="glass rounded-xl p-4 border border-white/[0.07] hover:border-rose-500/20
      transition-all flex items-center gap-4">

      {/* Cover */}
      <div className="w-20 h-12 rounded-lg overflow-hidden bg-white/[0.04] flex-shrink-0">
        {game.cover_url && !imgError ? (
          <img src={game.cover_url} alt={game.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={20} className="text-slate-700" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-white line-clamp-1">{game.title}</p>
        <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-600">
          <span className="flex items-center gap-1">
            <Users size={10} /> {game.min_players}–{game.max_players}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} /> {game.avg_playtime_minutes}m
          </span>
          {(game.genres ?? []).slice(0, 2).map(g => (
            <span key={g} className="bg-white/[0.05] px-1.5 py-0.5 rounded">{g}</span>
          ))}
        </div>
      </div>

      {/* Owned badge */}
      {owned && (
        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
          bg-green-500/15 border border-green-500/25 text-green-400 font-medium">
          <Check size={10} /> In Library
        </span>
      )}

      {/* Add to library */}
      {!owned && (
        <button
          onClick={onAddToLibrary}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
            font-semibold bg-primary/15 border border-primary/25 text-primary
            hover:bg-primary/25 transition-all"
        >
          <Plus size={11} /> Add to Library
        </button>
      )}

      {/* Remove from wishlist */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          bg-rose-500/10 border border-rose-500/20 text-rose-400
          hover:bg-rose-500/20 transition-all"
        title="Remove from wishlist"
      >
        <Heart size={13} fill="currentColor" />
      </button>
    </div>
  )
}
