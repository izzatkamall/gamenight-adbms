import { useState, useEffect, useRef } from 'react'
import { User, Mail, Calendar, Edit3, Check, X, TrendingUp, Clock, Gamepad2, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername]         = useState('')
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState(null)
  const [stats, setStats]                     = useState(null)
  const abortRef                              = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (user) fetchStats()
  }, [user])

  async function fetchStats() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const { data } = await supabase
        .rpc('get_user_stats', { p_user_id: user.id })
        .abortSignal(ctrl.signal)
      if (!ctrl.signal.aborted && data?.[0]) setStats(data[0])
    } catch { /* aborted */ }
  }

  function startEdit() {
    setNewUsername(profile?.username ?? '')
    setSaveError(null)
    setEditingUsername(true)
  }

  function cancelEdit() {
    setEditingUsername(false)
    setSaveError(null)
  }

  async function saveUsername() {
    if (!newUsername.trim() || newUsername === profile?.username) {
      setEditingUsername(false); return
    }
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(newUsername)) {
      setSaveError('3–24 chars, letters/numbers/_ only.'); return
    }
    setSaving(true)
    setSaveError(null)

    try {
      const { error } = await supabase.rpc('update_username', {
        p_user_id: user.id,
        p_username: newUsername.trim(),
      })

      if (error) {
        setSaveError(error.message.includes('unique') ? 'Username already taken.' : error.message)
      } else {
        await refreshProfile(user.id)
        setEditingUsername(false)
      }
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const genreWeights = profile?.preferences?.genre_weights ?? {}
  const topGenres = Object.entries(genreWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-200px', right: '-200px', opacity: 0.3 }} />

      <div className="max-w-3xl mx-auto relative z-10 animate-slide-up">
        {/* Profile header card */}
        <div className="glass rounded-2xl p-8 border border-white/[0.08] mb-6">
          <div className="flex items-start gap-6">
            <Avatar username={profile?.username} size="xl" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                {editingUsername ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="form-input py-1.5 px-3 text-lg font-display font-bold max-w-xs"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      autoFocus
                      disabled={saving}
                      onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') cancelEdit() }}
                    />
                    <button onClick={saveUsername} disabled={saving}
                      className="w-8 h-8 flex-shrink-0 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {saving
                        ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <Check size={14} />
                      }
                    </button>
                    <button onClick={cancelEdit} disabled={saving}
                      className="w-8 h-8 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display font-bold text-2xl text-white truncate">
                      {profile?.username ?? '…'}
                    </h1>
                    <button
                      onClick={startEdit}
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <Edit3 size={12} />
                    </button>
                  </>
                )}
              </div>

              {saveError && <p className="text-red-400 text-xs mb-2">{saveError}</p>}

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-600" />
                  {user?.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-600" />
                  Joined {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : '…'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Gamepad2 size={18} />} label="Sessions"    value={stats?.total_sessions ?? '–'} />
          <StatCard icon={<Clock size={18} />}    label="Hours Played" value={stats?.total_hours ?? '–'} />
          <StatCard icon={<Star size={18} />}     label="Avg Rating"   value={stats?.avg_rating_given ? `${stats.avg_rating_given} / 5` : '–'} />
          <StatCard icon={<TrendingUp size={18} />} label="Top Game"   value={stats?.most_played_game ?? '–'} small />
        </div>

        {/* Genre preferences */}
        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-lg text-white">Genre Preferences</h2>
            {topGenres.length === 0 && (
              <span className="text-xs text-slate-600 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
                Builds after sessions
              </span>
            )}
          </div>

          {topGenres.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">
                Rate your first game night to start building your taste profile.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topGenres.map(([genre, weight]) => (
                <div key={genre}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-slate-300">{genre}</span>
                    <span className="text-xs text-slate-500">{Math.round(weight * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round(weight * 100)}%`,
                        background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, small = false }) {
  return (
    <div className="glass rounded-xl p-5 border border-white/[0.07] flex flex-col gap-3">
      <div className="text-primary/70">{icon}</div>
      <div>
        <p className={`font-display font-bold text-white truncate ${small ? 'text-sm' : 'text-2xl'}`}>
          {value}
        </p>
        <p className="text-slate-600 text-xs mt-0.5">{label}</p>
      </div>
    </div>
  )
}
