import { Plus, Hash, ChevronRight, Gamepad2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'

export default function Dashboard() {
  const { profile } = useAuth()

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
        <div className="grid sm:grid-cols-2 gap-5 mb-10">
          <ActionCard
            icon={<Plus size={24} />}
            title="Create a Room"
            desc="Start a new game night. Invite your squad and find your common library."
            gradient="from-primary/20 to-primary/5"
            border="border-primary/25"
            iconColor="text-primary"
            disabled
            comingSoon
          />
          <ActionCard
            icon={<Hash size={24} />}
            title="Join a Room"
            desc="Have an invite code? Enter it to jump straight into your squad's room."
            gradient="from-secondary/20 to-secondary/5"
            border="border-secondary/25"
            iconColor="text-secondary"
            disabled
            comingSoon
          />
        </div>

        {/* Recent activity placeholder */}
        <div className="glass rounded-2xl p-8 border border-white/[0.07]">
          <h2 className="font-display font-semibold text-lg text-white mb-6">Your Rooms</h2>
          <EmptyState />
        </div>
      </div>
    </div>
  )
}

function ActionCard({ icon, title, desc, gradient, border, iconColor, disabled, comingSoon }) {
  return (
    <div
      className={`glass rounded-2xl p-7 border ${border} flex flex-col gap-4 relative overflow-hidden
        ${disabled ? 'opacity-70' : 'glass-hover cursor-pointer'}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className={`w-12 h-12 rounded-xl bg-white/[0.06] border ${border} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        {comingSoon && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 bg-white/[0.04] border border-white/[0.07] px-2.5 py-1 rounded-full">
            Phase 3
          </span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="font-display font-semibold text-white text-lg mb-1.5">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
      {!disabled && (
        <div className="relative z-10 flex items-center gap-1 text-sm font-semibold text-slate-400">
          Let's go <ChevronRight size={16} />
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4">
        <Gamepad2 size={28} className="text-slate-600" />
      </div>
      <h3 className="font-display font-semibold text-white mb-2">No rooms yet</h3>
      <p className="text-slate-600 text-sm max-w-xs">
        Create a room or join one using an invite code. Rooms will appear here.
      </p>
    </div>
  )
}
