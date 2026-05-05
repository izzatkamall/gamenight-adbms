import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Gamepad2, LayoutDashboard, User, LogOut, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.06]">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm transition-shadow group-hover:shadow-glow-primary">
            <Gamepad2 size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Game<span className="gradient-text">Night</span>
          </span>
        </Link>

        {/* Right-side nav */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NavLink to="/dashboard" active={isActive('/dashboard')}>
                <LayoutDashboard size={15} />
                Dashboard
              </NavLink>
              <NavLink to="/profile" active={isActive('/profile')}>
                <User size={15} />
                {profile?.username ?? 'Profile'}
              </NavLink>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all duration-200"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" active={isActive('/login')}>
                <LogIn size={15} />
                Sign In
              </NavLink>
              <Link to="/register">
                <button className="btn-primary py-2 px-4 text-sm">
                  <UserPlus size={14} />
                  Get Started
                </button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${active
          ? 'text-white bg-white/[0.08] border border-white/[0.1]'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
        }`}
    >
      {children}
    </Link>
  )
}
