import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Gamepad2, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const [form, setForm]               = useState({ username: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [success, setSuccess]         = useState(false)
  const navigate                      = useNavigate()
  const { user }                      = useAuth()

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  function validate() {
    if (form.username.length < 3)  return 'Username must be at least 3 characters.'
    if (form.username.length > 24) return 'Username must be 24 characters or fewer.'
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username))
      return 'Username can only contain letters, numbers, underscores, and hyphens.'
    if (form.password.length < 8)  return 'Password must be at least 8 characters.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: { username: form.username.trim() },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-24 relative overflow-hidden">
      <div className="glow-orb-violet" style={{ top: '-160px', right: '-160px', opacity: 0.45 }} />
      <div className="glow-orb-cyan"   style={{ bottom: '-160px', left: '-160px', opacity: 0.35 }} />

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
          {success ? (
            <SuccessState email={form.email} />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-display font-bold text-2xl text-white mb-1">Create your account</h1>
                <p className="text-slate-500 text-sm">Join your squad on GameNight</p>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    <input
                      type="text"
                      className="form-input pl-10"
                      placeholder="your_tag"
                      value={form.username}
                      onChange={update('username')}
                      required
                      disabled={loading}
                      autoComplete="username"
                      maxLength={24}
                    />
                  </div>
                  <p className="text-slate-600 text-xs mt-1.5">Letters, numbers, _ and - only.</p>
                </div>

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
                      placeholder="8+ characters"
                      value={form.password}
                      onChange={update('password')}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      minLength={8}
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
                    : <><span>Create Account</span><ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <p className="mt-6 text-center text-slate-500 text-sm">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:text-primary-light font-semibold transition-colors">
                  Sign in →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SuccessState({ email }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={32} className="text-green-400" />
      </div>
      <h2 className="font-display font-bold text-xl text-white mb-2">Check your email</h2>
      <p className="text-slate-400 text-sm leading-relaxed mb-6">
        We've sent a confirmation link to <span className="text-white font-medium">{email}</span>.
        Click it to activate your account.
      </p>
      <Link to="/login">
        <button className="btn-ghost w-full">Back to Sign In</button>
      </Link>
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
      Creating account…
    </span>
  )
}
