import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) setProfile(data)
    } catch {
      // Profile fetch failed — user still gets in, profile just shows empty
    }
  }, [])

  useEffect(() => {
    let settled = false

    // Safety net: if getSession + fetchProfile takes >6s, unblock the spinner
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setLoading(false)
      }
    }, 6000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
    }).catch(() => {
      // Network failure — unblock with no user
    }).finally(() => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  async function signOut() {
    setUser(null)
    setProfile(null)
    // Always wipe localStorage before the async call so a refresh never restores the session
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
