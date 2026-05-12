import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, ArrowRight, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function JoinRoom() {
  const { user }          = useAuth()
  const navigate          = useNavigate()
  const [code, setCode]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleJoin(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)

    try {
      // Look up the room by invite code
      const { data: rooms, error: lookupErr } = await supabase
        .rpc('get_room_by_invite_code', { p_code: code.trim().toUpperCase() })

      if (lookupErr) throw lookupErr
      if (!rooms || rooms.length === 0) {
        setError('Invalid or expired invite code. Check the code and try again.')
        setLoading(false)
        return
      }

      const room = rooms[0]

      // Join the room
      const { error: joinErr } = await supabase
        .from('room_members')
        .insert({ room_id: room.id, user_id: user.id })

      if (joinErr) {
        // Duplicate key = already a member
        if (joinErr.code === '23505') {
          navigate(`/rooms/${room.id}`)
          return
        }
        throw joinErr
      }

      navigate(`/rooms/${room.id}`)
    } catch (err) {
      setError(err.message ?? 'Failed to join room.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-24 relative overflow-hidden">
      <div className="glow-orb-cyan"   style={{ top: '-160px', right: '-160px', opacity: 0.4 }} />
      <div className="glow-orb-violet" style={{ bottom: '-160px', left: '-160px', opacity: 0.3 }} />

      <div className="relative z-10 w-full max-w-md animate-slide-up">

        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-secondary/20 border border-secondary/30 flex items-center justify-center">
            <Hash size={24} className="text-secondary" />
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/[0.08]">
          <h1 className="font-display font-bold text-2xl text-white mb-1">Join a Room</h1>
          <p className="text-slate-500 text-sm mb-8">Enter the 6-character invite code shared by your squad.</p>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Invite Code</label>
              <input
                className="form-input text-center font-display font-bold text-xl tracking-widest uppercase"
                placeholder="ABC123"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                required
                disabled={loading}
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.trim().length < 6}
              className="btn-primary w-full py-3.5"
            >
              {loading
                ? <Spinner />
                : <><span>Join Room</span><ArrowRight size={16} /></>
              }
            </button>
          </form>
        </div>
      </div>
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
      Joining…
    </span>
  )
}
