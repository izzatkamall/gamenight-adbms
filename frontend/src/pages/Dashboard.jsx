import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Hash, ChevronRight, Gamepad2, Library } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms]     = useState([])
  const [loading, setLoading] = useState(true)
  const abortRef              = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (user) fetchRooms()
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('dashboard-rooms')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' },
        () => fetchRooms()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchRooms() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const { data } = await supabase
        .from('rooms').select('*').order('created_at', { ascending: false })
        .abortSignal(ctrl.signal)
      if (!ctrl.signal.aborted) {
        setRooms(data ?? [])
        setLoading(false)
      }
    } catch { /* aborted */ }
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-150px', left: '-150px', opacity: 0.25 }} />

      <div className="max-w-5xl mx-auto relative z-10 animate-slide-up">

        {/* Welcome banner */}
        <div className="glass rounded-2xl p-8 border border-white/[0.08] mb-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar username={profile?.username} size="lg" />
            <div>
              <p className="text-slate-500 text-sm mb-0.5">Good to see you,</p>
              <h1 className="font-display font-bold text-3xl text-white">
                {profile?.username ?? '…'}
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-600 text-sm">
            <Gamepad2 size={16} className="text-primary/60" />
            <span>Ready to play?</span>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          <ActionCard
            icon={<Plus size={24} />}
            title="Create a Room"
            desc="Start a new game night and invite your squad."
            gradient="from-primary/20 to-primary/5"
            border="border-primary/25"
            iconColor="text-primary"
            onClick={() => navigate('/rooms/create')}
          />
          <ActionCard
            icon={<Hash size={24} />}
            title="Join a Room"
            desc="Have an invite code? Jump into your squad's room."
            gradient="from-secondary/20 to-secondary/5"
            border="border-secondary/25"
            iconColor="text-secondary"
            onClick={() => navigate('/rooms/join')}
          />
          <ActionCard
            icon={<Library size={24} />}
            title="My Library"
            desc="Add or remove games from your personal library."
            gradient="from-white/5 to-white/[0.02]"
            border="border-white/10"
            iconColor="text-slate-400"
            onClick={() => navigate('/library')}
          />
        </div>

        {/* Rooms list */}
        <div className="glass rounded-2xl p-8 border border-white/[0.07]">
          <h2 className="font-display font-semibold text-lg text-white mb-6">Your Rooms</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState onAction={() => navigate('/rooms/create')} />
          ) : (
            <div className="space-y-3">
              {rooms.map(room => (
                <RoomRow
                  key={room.id}
                  room={room}
                  isHost={room.host_id === user?.id}
                  onClick={() => navigate(`/rooms/${room.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionCard({ icon, title, desc, gradient, border, iconColor, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass rounded-2xl p-7 border ${border} flex flex-col gap-4 relative overflow-hidden
        glass-hover cursor-pointer`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-white/[0.06] border ${border} flex items-center justify-center ${iconColor} mb-4`}>
          {icon}
        </div>
        <h3 className="font-display font-semibold text-white text-lg mb-1.5">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
      <div className="relative z-10 flex items-center gap-1 text-sm font-semibold text-slate-400 mt-auto">
        Let's go <ChevronRight size={16} />
      </div>
    </div>
  )
}

function RoomRow({ room, isHost, onClick }) {
  const statusStyles = {
    open:           'bg-green-500/15 border-green-500/25 text-green-400',
    voting:         'bg-primary/15 border-primary/25 text-primary',
    session_active: 'bg-secondary/15 border-secondary/25 text-secondary',
    closed:         'bg-white/[0.05] border-white/10 text-slate-500',
  }
  const statusLabels = { open: 'Open', voting: 'Voting', session_active: 'Playing', closed: 'Closed' }

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-5 py-4 rounded-xl bg-white/[0.03] border
        border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
          <Gamepad2 size={16} className="text-primary" />
        </div>
        <div>
          <p className="font-medium text-white text-sm">{room.name}</p>
          <p className="text-xs text-slate-600">{isHost ? 'Host' : 'Member'} · {new Date(room.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border
          ${statusStyles[room.status] ?? statusStyles.closed}`}>
          {statusLabels[room.status] ?? room.status}
        </span>
        <ChevronRight size={16} className="text-slate-600" />
      </div>
    </div>
  )
}

function EmptyState({ onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4">
        <Gamepad2 size={28} className="text-slate-600" />
      </div>
      <h3 className="font-display font-semibold text-white mb-2">No rooms yet</h3>
      <p className="text-slate-600 text-sm max-w-xs mb-6">
        Create a room or join one using an invite code.
      </p>
      <button onClick={onAction} className="btn-primary px-6 py-2.5 text-sm">
        Create your first room
      </button>
    </div>
  )
}
