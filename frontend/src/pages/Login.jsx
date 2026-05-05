import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Gamepad2, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [form, setForm]               = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const navigate                      = useNavigate()
  const location                      = useLocation()
  const { user }                      = useAuth()

  const from = location.state?.from?.pathname ?? '/dashboard'

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, navigate, from])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email:    form.email,
      password: form.password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, onAuthStateChange in useAuth fires → user state updates → useEffect above navigates
  }

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-24 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-180px', left: '-180px', opacity: 0.55 }} />
      <div className="glow-orb-cyan"   style={{ bottom: '-160px', right: '-160px', opacity: 0.4 }} />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-sm transition-shadow group-hover:shadow-glow-primary">
              <Gamepad2 size={20} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">
              Game<span className="gradient-text">Night</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 border border-white/[0.08] shadow-glass">
          <div className="mb-8">
            <h1 className="font-display font-bold text-2xl text-white mb-1">Welcome back</h1>
            <p className="text-slate-500 text-sm">Sign in to your squad</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type="email"
                  className="form-input pl-10"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update('email')}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update('password')}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                  onClick={() => setShowPassword(s => !s)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full text-base py-3.5" disabled={loading}>
              {loading
                ? <Spinner />
                : <><span>Sign In</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <p className="mt-6 text-center text-slate-500 text-sm">
            No account?{' '}
            <Link to="/register" className="text-primary hover:text-primary-light font-semibold transition-colors">
              Create one →
            </Link>
          </p>
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
      Signing in…
    </span>
  )
}
