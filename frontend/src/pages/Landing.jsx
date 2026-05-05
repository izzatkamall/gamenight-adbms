import { Link } from 'react-router-dom'
import { Gamepad2, Users, Zap, Brain, ArrowRight, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const FEATURES = [
  {
    icon: <Users size={22} />,
    title: 'Common Library',
    desc: "We cross-reference every member's library and surface only the titles your whole squad actually owns. No more \"I don't have that.\"",
    borderColor: 'border-violet-500/25',
    iconGrad: 'from-violet-500/20 to-violet-600/5',
  },
  {
    icon: <Zap size={22} />,
    title: 'Live Voting',
    desc: 'The group votes in real time — powered by Redis. Every tap updates instantly for everyone. First to majority wins in under 60 seconds.',
    borderColor: 'border-cyan-500/25',
    iconGrad: 'from-cyan-500/20 to-cyan-600/5',
  },
  {
    icon: <Brain size={22} />,
    title: 'Gets Smarter',
    desc: 'Preference profiles build in the background after every session. The shortlist starts matching what your group genuinely enjoys.',
    borderColor: 'border-purple-500/25',
    iconGrad: 'from-purple-500/20 to-purple-600/5',
  },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-20">
        {/* Atmospheric glow orbs */}
        <div className="glow-orb-violet" style={{ top: '-160px', left: '-160px' }} />
        <div className="glow-orb-cyan"   style={{ bottom: '-120px', right: '-120px' }} />

        {/* Subtle dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
              Free · No Install · Instant Rooms
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-display font-bold text-6xl md:text-8xl leading-[1.0] tracking-tight text-white mb-6 animate-slide-up"
            style={{ animationDelay: '0.05s' }}
          >
            Stop Arguing.
            <br />
            <span className="gradient-text">Start Playing.</span>
          </h1>

          {/* Sub-headline */}
          <p
            className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up"
            style={{ animationDelay: '0.15s' }}
          >
            GameNight finds the games your whole squad actually owns,
            lets everyone vote in real time, and gets smarter every session.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up"
            style={{ animationDelay: '0.25s' }}
          >
            {user ? (
              <Link to="/dashboard">
                <button className="btn-primary text-base px-8 py-4">
                  Go to Dashboard <ArrowRight size={18} />
                </button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <button className="btn-primary text-base px-8 py-4">
                    Create a Room <ArrowRight size={18} />
                  </button>
                </Link>
                <Link to="/login">
                  <button className="btn-ghost text-base px-8 py-4">
                    Sign In
                  </button>
                </Link>
              </>
            )}
          </div>

          <p className="mt-5 text-xs text-slate-700 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            No credit card required · Works with Steam, Epic, and any platform
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section className="relative px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-3">
              How It Works
            </p>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white">
              Game night in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`glass glass-hover rounded-2xl p-8 border ${f.borderColor} flex flex-col gap-5`}
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.iconGrad} border ${f.borderColor} flex items-center justify-center text-white`}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-xl text-white mb-2">{f.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-[0.9rem]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────── */}
      <section className="px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <div className="relative glass rounded-3xl p-12 text-center border border-primary/25 overflow-hidden">
            <div
              className="glow-orb-violet opacity-60"
              style={{ top: '-180px', left: '50%', transform: 'translateX(-50%)' }}
            />
            <div className="relative z-10">
              <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4">
                Ready for tonight?
              </h2>
              <p className="text-slate-400 mb-8 text-lg">
                Create a room, send the code, and you're voting in under 30 seconds.
              </p>
              <Link to={user ? '/dashboard' : '/register'}>
                <button className="btn-primary text-base px-10 py-4">
                  {user ? 'Go to Dashboard' : "Get Started — It's Free"}
                  <ChevronRight size={18} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gamepad2 size={16} className="text-primary" />
            <span className="font-display font-semibold text-white text-sm">GameNight</span>
          </div>
          <p className="text-slate-700 text-xs">
            BSAI24078 · Advanced DBMS Semester Project · 2025
          </p>
        </div>
      </footer>
    </div>
  )
}
