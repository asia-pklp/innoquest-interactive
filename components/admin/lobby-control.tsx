'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PlayerStatus {
  id: string
  team_name: string
  is_online: boolean
  last_activity: string | null
}

interface GameSettings {
  game_status: string
  current_week: number
  total_weeks: number
}

interface LobbyControlProps {
  gameId?: string
}

export default function LobbyControl({ gameId = '00000000-0000-0000-0000-000000000001' }: LobbyControlProps) {
  const supabase = createClient()
  
  const [players, setPlayers] = useState<PlayerStatus[]>([])
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    loadData()
    
    // Set up real-time subscription for team changes
    const channel = supabase
      .channel('teams_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          console.log('Team update received:', payload)
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadData = async () => {
    // Load game settings
    const { data: settings } = await supabase
      .from('game_settings')
      .select('game_status, current_week, total_weeks')
      .eq('game_id', gameId)
      .single()

    if (settings) {
      setGameSettings(settings)
    }

    // Load all players
    const { data: teams } = await supabase
      .from('teams')
      .select('team_id, team_name, last_activity, is_active')
      .eq('game_id', gameId)
      .order('team_name')

    if (teams) {
      // Show as online if they have logged in (has last_activity)
      const playerStatuses: PlayerStatus[] = teams.map(team => ({
        id: team.team_id,
        team_name: team.team_name,
        is_online: team.last_activity !== null,
        last_activity: team.last_activity
      }))

      setPlayers(playerStatuses)
    }
  }

  const handleStartGame = async () => {
    const onlineCount = players.filter(p => p.is_online).length

    if (onlineCount === 0) {
      alert('❌ No players are online! At least 1 player must be in the lobby to start.')
      return
    }

    const proceed = confirm(
      `🚀 Start the game with ${onlineCount} / ${players.length} players online?\n\n` +
      `This will:\n` +
      `• Move all players from lobby to Week 1\n` +
      `• Begin gameplay immediately\n` +
      `• Cannot be undone\n\n` +
      `Continue?`
    )

    if (!proceed) return

    setStarting(true)
    try {
      console.log('Starting game with gameId:', gameId)
      
      const response = await fetch('/api/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })

      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response result:', result)

      if (response.ok) {
        alert(`✅ ${result.message}`)
        // Force reload to update UI
        window.location.reload()
      } else {
        alert(`❌ Failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error starting game:', error)
      alert('❌ Network error while starting game')
    } finally {
      setStarting(false)
    }
  }

  if (!gameSettings) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8">
        <p className="text-gray-600 text-center">Loading...</p>
      </div>
    )
  }

  // If game already started, show message
  if (gameSettings.game_status === 'active') {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Game In Progress</h2>
          <p className="text-gray-600 text-lg mb-4">
            Current Week: <span className="font-semibold text-[#E63946]">{gameSettings.current_week}</span> / {gameSettings.total_weeks}
          </p>
          <p className="text-sm text-gray-500">Use the "Week Progression" tab to advance rounds</p>
        </div>
      </div>
    )
  }

  if (gameSettings.game_status === 'completed') {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Game Completed</h2>
          <p className="text-gray-600">This game has finished. Create a new game to start again.</p>
        </div>
      </div>
    )
  }

  // Lobby state
  const onlineCount = players.filter(p => p.is_online).length

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-linear-to-br from-[#E63946] to-[#C1121F] text-white px-10 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold mb-2">Game Lobby</h2>
              <p className="text-red-100 text-lg">Waiting to start the game</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{onlineCount}</div>
              <div className="text-red-100">Players Online</div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Ready to Start</h3>
                <p className="text-gray-600">
                  {onlineCount === 0 && 'Waiting for players to join...'}
                  {onlineCount === 1 && '1 player is ready'}
                  {onlineCount > 1 && `${onlineCount} players are ready`}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartGame}
              disabled={starting || onlineCount === 0}
              className="px-8 py-4 bg-linear-to-br from-[#E63946] to-[#C1121F] text-white rounded-xl font-bold text-lg transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {starting ? 'Starting...' : '🚀 Start Game'}
            </button>
          </div>

          {onlineCount === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold text-yellow-800">No players online</p>
                  <p className="text-sm text-yellow-700">Players need to log in and join the lobby before you can start the game.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Players List */}
      <div className="bg-white rounded-3xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <svg className="w-8 h-8 text-[#E63946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Players in Lobby
            <span className="ml-auto text-lg text-gray-600">
              {onlineCount} / {players.length} Online
            </span>
          </h3>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-semibold transition-all"
            title="Refresh player list"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="grid gap-3">
          {players.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                player.is_online 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  player.is_online ? 'bg-green-500' : 'bg-gray-400'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-lg">{player.team_name}</h4>
                  <p className="text-sm text-gray-600">
                    {player.is_online ? 'Ready to play' : 'Not connected'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  player.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></span>
                <span className={`text-sm font-medium ${
                  player.is_online ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {player.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))}

          {players.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-semibold text-lg mb-1">No players yet</p>
              <p className="text-sm">Create teams in the "Teams" tab to add players</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
