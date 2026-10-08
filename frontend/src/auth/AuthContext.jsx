import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import api, { setAccessToken, clearAccessToken } from '../lib/apiClient'
import { queryClient } from '../lib/queryClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then(async ({ data }) => {
        setAccessToken(data.accessToken)
        const { data: me } = await api.get('/me')
        setUser(me)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback((userData, token) => {
    setAccessToken(token)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      clearAccessToken()
      setUser(null)
      // Drop every cached query: without this the next user to log in on this
      // browser sees the previous user's transactions and balances until each
      // query refetches.
      queryClient.clear()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
