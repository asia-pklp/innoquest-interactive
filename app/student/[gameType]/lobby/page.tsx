'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NextImage from 'next/image'

interface PlayerStatus {
  id: string
  team_name: string
  is_online: boolean
  last_activity: string | null
}

export default function StudentLobby() {
  const supabase = createClient()
  const params = useParams()
  const gameType = params.gameType as string

  const [players, setPlayers] = useState<PlayerStatus[]>([])
  const [teamName, setTeamName] = useState('')
  const [currentRound, setCurrentRound] = useState<number | null>(null)
  const [totalRounds, setTotalRounds] = useState<number | null>(null)

  useEffect(() => {
    const storedTeamName = sessionStorage.getItem('team_name')
    const storedTeamId = sessionStorage.getItem('team_id')
    const storedGameId = sessionStorage.getItem('game_id')

    if (!storedTeamId || !storedGameId) {
      window.location.href = '/student/login'
      return
    }

    setTeamName(storedTeamName || 'Player')

    // Subscribe to game_settings changes to detect game start and round updates
    const gameSettingsChannel = supabase
      .channel(`lobby_game_settings_${storedGameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: `game_id=eq.${storedGameId}` },
        (payload) => {
          if (payload.new.game_status === 'active') {
            window.location.href = `/student/${gameType}/gameplay`
          }
          if (payload.new.current_week != null) setCurrentRound(payload.new.current_week)
          if (payload.new.total_weeks != null) setTotalRounds(payload.new.total_weeks)
        }
      )
      .subscribe()

    // Subscribe to teams changes
    const teamsChannel = supabase
      .channel(`lobby_teams_${storedGameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `game_id=eq.${storedGameId}` },
        async () => {
          const { data: teams } = await supabase
            .from('teams')
            .select('team_id, team_name, last_activity, is_active')
            .eq('game_id', storedGameId)
            .order('team_name')

          if (teams) {
            const myTeamExists = teams.some((t) => t.team_id === storedTeamId)
            if (!myTeamExists) {
              sessionStorage.clear()
              window.location.href = '/student/login'
              return
            }
            setPlayers(
              teams.map((team) => ({
                id: team.team_id,
                team_name: team.team_name,
                is_online: team.last_activity !== null,
                last_activity: team.last_activity,
              }))
            )
          }
        }
      )
      .subscribe()

    // Initial load
    const init = async () => {
      const { data: settings } = await supabase
        .from('game_settings')
        .select('game_status, current_week')
        .eq('game_id', storedGameId)
        .single()

      const { data: currentTeam } = await supabase
        .from('teams')
        .select('team_id')
        .eq('team_id', storedTeamId)
        .single()

      if (!currentTeam) {
        sessionStorage.clear()
        window.location.href = '/student/login'
        return
      }

      if (settings?.game_status === 'active') {
        window.location.href = `/student/${gameType}/gameplay`
        return
      }
      setCurrentRound(settings?.current_week ?? null)
      setTotalRounds(settings?.total_weeks ?? null)

      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name, last_activity, is_active')
        .eq('game_id', storedGameId)
        .order('team_name')

      if (teams) {
        setPlayers(
          teams.map((team) => ({
            id: team.team_id,
            team_name: team.team_name,
            is_online: team.last_activity !== null,
            last_activity: team.last_activity,
          }))
        )
      }
    }
    init()

    return () => {
      supabase.removeChannel(gameSettingsChannel)
      supabase.removeChannel(teamsChannel)
    }
  }, [gameType])

  const handleLogout = () => {
    sessionStorage.clear()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#F5F5F5] to-[#E8D5D0]">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl mb-8">
          <div className="bg-linear-to-br from-[#E63946] to-[#C1121F] text-white px-10 py-8 rounded-t-3xl">
            <div className="flex justify-between items-center">
              <div>
                <div className="mb-2 h-[54px] w-[180px] overflow-hidden flex items-center">
                  <NextImage src="/logo_white.PNG" alt="InnoQuest" width={592} height={188} className="w-[180px] h-auto" priority />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
                <p className="text-red-100 text-lg">
                  Logged in as: <span className="font-semibold">{teamName}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="p-12 text-center">
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Waiting for Admin to Start Game</h2>
            <p className="text-gray-600 text-lg">Please wait while the admin prepares the game...</p>
            {currentRound != null && totalRounds != null && (
              <p className="mt-4 text-sm font-semibold text-gray-500 uppercase tracking-widest">
                Round {currentRound} / {totalRounds}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <svg className="w-8 h-8 text-[#E63946]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Players in Lobby
            <span className="ml-auto text-lg text-gray-600">
              {players.filter((p) => p.is_online).length} / {players.length} Online
            </span>
          </h3>

          <div className="grid gap-3">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  player.is_online ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      player.is_online ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-lg">{player.team_name}</h4>
                    <p className="text-sm text-gray-600">{player.is_online ? 'Connected' : 'Waiting...'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${player.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  <span className={`text-sm font-medium ${player.is_online ? 'text-green-700' : 'text-gray-500'}`}>
                    {player.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
            {players.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No players yet. Waiting for others to join...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
