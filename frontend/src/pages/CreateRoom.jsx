import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gamepad2, ArrowRight, Copy, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function CreateRoom() {
  const { user }        = useAuth()
  const navigate        = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [created, setCreated] = useState(null)
  const [copied, setCopied]   = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      // Create the room
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({ name: name.trim(), host_id: user.id })
        .select()
        .single()

      if (roomErr) throw roomErr

      // Add creator as first member
      const { error: memberErr } = await supabase
        .from('room_members')
        .insert({ room_id: room.id, user_id: user.id })

      if (memberErr) throw memberErr

      setCreated(room)
    } catch (err) {
      setError(err.message ?? 'Failed to create room.')
    } finally {
      setLoading(false)
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(created.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-24 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-160px', left: '-160px', opacity: 0.4 }} />
      <div className="glow-orb-cyan"   style={{ bottom: '-160px', right: '-160px', opacity: 0.3 }} />

      <div className="relative z-10 w-full max-w-md animate-slide-up">

        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-sm">
            <Gamepad2 size={24} className="text-white" />
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          {!created ? (
            <>
              <h1 className="font-display font-bold text-2xl text-white mb-1">Create a Room</h1>
              <p className="text-slate-500 text-sm mb-8">Give your game night a name. An invite code is generated automatically.</p>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Room Name</label>
                  <input
                    className="form-input"
                    placeholder="Friday Night Squad"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={48}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full py-3.5">
                  {loading
                    ? <Spinner />
                    : <><span>Create Room</span><ArrowRight size={16} /></>
                  }
                </button>
              </form>
            </>
          ) : (
            <RoomCreated room={created} copied={copied} onCopy={copyCode} onEnter={() => navigate(`/rooms/${created.id}`)} />
          )}
        </div>
      </div>
    </div>
  )
}

function RoomCreated({ room, copied, onCopy, onEnter }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
        <Gamepad2 size={28} className="text-primary" />
      </div>
      <h2 className="font-display font-bold text-xl text-white mb-1">{room.name}</h2>
      <p className="text-slate-500 text-sm mb-8">Your room is ready. Share the invite code with your squad.</p>

      <div className="glass rounded-xl p-4 border border-white/[0.08] mb-3">
        <p className="text-slate-500 text-xs mb-2">Invite Code</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display font-bold text-3xl text-white tracking-widest">{room.invite_code}</span>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10
              text-slate-400 hover:text-white text-xs font-medium transition-all"
          >
            {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
      </div>

      <button onClick={onEnter} className="btn-primary w-full py-3.5 mt-4">
        <span>Enter Lobby</span>
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Creating…
    </span>
  )
}
