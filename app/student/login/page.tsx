'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function StudentLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('team_id, team_name, game_id, username, password_hash')
        .eq('username', username)
        .eq('password_hash', password)

      if (teamError || !teams || teams.length === 0) {
        setError('Invalid username or password. Please check your credentials.')
        setLoading(false)
        return
      }

      // If multiple matches (same username across games), pick the one whose game still exists
      let team = teams[0]
      if (teams.length > 1) {
        const { data: activeGames } = await supabase
          .from('game_settings')
          .select('game_id')
          .in('game_id', teams.map((t) => t.game_id))
        const activeIds = new Set((activeGames ?? []).map((g) => g.game_id))
        const active = teams.find((t) => activeIds.has(t.game_id))
        if (!active) {
          setError('Invalid username or password. Please check your credentials.')
          setLoading(false)
          return
        }
        team = active
      }

      await supabase
        .from('teams')
        .update({ last_activity: new Date().toISOString(), is_active: true })
        .eq('team_id', team.team_id)

      alert(`Hello ${team.team_name}! Welcome to InnoQuest.`)

      // Fetch game settings including game_type
      const { data: gameSettings } = await supabase
        .from('game_settings')
        .select('game_status, game_type')
        .eq('game_id', team.game_id)
        .single()

      const gameType = gameSettings?.game_type ?? 'startup_simulation'
      const gameStatus = gameSettings?.game_status ?? 'setup'

      // Persist session
      sessionStorage.setItem('team_id', team.team_id)
      sessionStorage.setItem('team_name', team.team_name)
      sessionStorage.setItem('game_id', team.game_id)
      sessionStorage.setItem('game_type', gameType)

      // Route to the correct game-type-specific path
      if (gameStatus === 'active') {
        window.location.href = `/student/${gameType}/gameplay`
      } else {
        window.location.href = `/student/${gameType}/lobby`
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">Student Login</h1>
          <p className="text-gray-600">Enter your team credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your team username"
              className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-primary hover:underline">
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
