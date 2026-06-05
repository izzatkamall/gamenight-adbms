import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const profileAbortRef       = useRef(null)

  const fetchProfile = useCallback(async (userId) => {
    profileAbortRef.current?.abort()
    const ctrl = new AbortController()
    profileAbortRef.current = ctrl
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
        .abortSignal(ctrl.signal)
      if (!ctrl.signal.aborted && !error && data) setProfile(data)
    } catch { /* aborted or network error */ }
  }, [])

  useEffect(() => {
    // setLoading(false) fires as soon as getSession resolves (reads localStorage — near instant).
    // fetchProfile runs async in the background; pages render immediately without waiting for it.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) fetchProfile(u.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) fetchProfile(u.id)
        else { profileAbortRef.current?.abort(); setProfile(null) }
      }
    )

    return () => {
      subscription.unsubscribe()
      profileAbortRef.current?.abort()
    }
  }, [fetchProfile])

  async function signOut() {
    profileAbortRef.current?.abort()
    setUser(null)
    setProfile(null)
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k))
    supabase.auth.signOut().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
