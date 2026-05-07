'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface GameSettings {
  current_week: number
  total_weeks: number
  game_status: string
  week_duration_minutes: number
  week_start_time?: string
  is_paused?: boolean
  pause_timestamp?: string
}

interface WeekProgressionProps {
  gameId?: string
}

export default function WeekProgression({ gameId = '00000000-0000-0000-0000-000000000001' }: WeekProgressionProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [pauseToggling, setPauseToggling] = useState(false)
  const [teamsStatus, setTeamsStatus] = useState({ total: 0, joined: 0 })
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    current_week: 0,
    total_weeks: 0,
    game_status: 'setup',
    week_duration_minutes: 5,
    is_paused: false,
    pause_timestamp: undefined
  })

  useEffect(() => {
    loadGameSettings()
    loadTeamsStatus()
  }, [])

  const handleAutoAdvance = useCallback(async () => {
    if (advancing) return
    setAdvancing(true)
    
    try {
      const response = await fetch('/api/advance-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, auto: true })
      })

      const result = await response.json()

      if (response.ok) {
        window.location.reload()
      } else {
        console.error('Auto-advance failed:', result.error)
        alert(`❌ Auto-advance failed: ${result.error}`)
        setAdvancing(false)
      }
    } catch (error) {
      console.error('Auto-advance error:', error)
      alert('❌ Auto-advance failed. Please manually advance the week.')
      setAdvancing(false)
    }
  }, [advancing, gameId])

  // Countdown timer with proper pause/resume
  useEffect(() => {
    if (!gameSettings.week_start_time || gameSettings.game_status !== 'active') return

    // If paused, stop the interval
    if (gameSettings.is_paused) {
      return
    }

    // Active timer countdown
    const interval = setInterval(() => {
      const startTime = new Date(gameSettings.week_start_time!).getTime()
      const durationMs = gameSettings.week_duration_minutes * 60 * 1000
      const now = Date.now()
      
      // Calculate elapsed time, accounting for pause duration
      let pauseDuration = 0
      if (gameSettings.pause_timestamp) {
        // Game was paused at some point, calculate how long it was paused
        // This is handled by the resume logic that updates week_start_time
        // So we can just use the adjusted week_start_time
      }
      
      const endTime = startTime + durationMs
      const remaining = Math.max(0, endTime - now)

      if (remaining <= 0) {
        setTimeRemaining(0)
        // Timer expired - admin must manually advance the week
        console.log('⏰ Week time expired - waiting for admin to manually advance')
      } else {
        setTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gameSettings.week_start_time, gameSettings.week_duration_minutes, gameSettings.game_status, gameSettings.is_paused, handleAutoAdvance])

  const loadGameSettings = async () => {
    try {
      console.log('Loading game settings for gameId:', gameId)
      const { data: settings, error } = await supabase
        .from('game_settings')
        .select('current_week, total_weeks, game_status, week_duration_minutes, week_start_time, is_paused, pause_timestamp')
        .eq('game_id', gameId)
        .single()

      if (error) {
        console.error('Error loading game settings:', error)
        return
      }

      if (settings) {
        console.log('Loaded game settings:', settings)
        setGameSettings(settings)
      } else {
        console.warn('No game settings found for gameId:', gameId)
      }
    } catch (error) {
      console.error('Exception loading game settings:', error)
    }
  }

  const loadTeamsStatus = async () => {
    try {
      const { data: settings } = await supabase
        .from('game_settings')
        .select('max_teams')
        .eq('game_id', gameId)
        .single()

      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, is_active, last_activity')
        .eq('game_id', gameId)

      const maxTeams = settings?.max_teams || 0
      
      // Count teams that have logged in (have last_activity)
      const joinedTeams = teams?.filter(t => t.last_activity !== null).length || 0

      setTeamsStatus({ total: maxTeams, joined: joinedTeams })
    } catch (error) {
      console.error('Error loading teams status:', error)
    }
  }

  const handleTogglePause = async () => {
    setPauseToggling(true)
    try {
      const response = await fetch('/api/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })

      const result = await response.json()

      if (response.ok) {
        // Reload settings to get updated pause state and adjusted week_start_time
        await loadGameSettings()
      } else {
        alert(`❌ Failed to toggle pause: ${result.error}`)
      }
    } catch (error) {
      console.error('Error toggling pause:', error)
      alert('❌ Failed to toggle pause state')
    } finally {
      setPauseToggling(false)
    }
  }

  const progressPercentage = gameSettings.total_weeks > 0 
    ? (gameSettings.current_week / gameSettings.total_weeks) * 100 
    : 0

  const weeksRemaining = Math.max(0, gameSettings.total_weeks - gameSettings.current_week)

  const handleAdvanceWeek = async () => {
    // Check if we're on the last week (should summarize game instead of advancing)
    const isLastWeek = gameSettings.current_week === gameSettings.total_weeks
    
    if (gameSettings.current_week > gameSettings.total_weeks) {
      alert('Game has ended!')
      return
    }

    // Check if all teams have joined
    if (teamsStatus.joined < teamsStatus.total) {
      const disconnected = teamsStatus.total - teamsStatus.joined
      const proceed = confirm(
        `⚠️ WARNING: ${disconnected} player${disconnected > 1 ? 's are' : ' is'} disconnected!\n\n` +
        `Only ${teamsStatus.joined} out of ${teamsStatus.total} teams are currently active in the game.\n\n` +
        `❌ Disconnected players will NOT be processed this round\n` +
        `✅ Only active players will advance to the next week\n\n` +
        `This may cause players to fall behind. Do you want to proceed anyway?`
      )
      if (!proceed) {
        return
      }
    }

    const confirmMessage = isLastWeek
      ? `🏁 Finish the game and show results?\n\nThis will:\n• Process final week decisions\n• Calculate final results\n• End the game and redirect students to results\n\nContinue?`
      : `🚀 Advance from Week ${gameSettings.current_week} to Week ${gameSettings.current_week + 1}?\n\nThis will:\n• Process ALL active team decisions\n• Calculate results for everyone simultaneously\n• Move everyone to the next week together\n\nContinue?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setAdvancing(true)
    try {
      // Call API to advance week and process all team results with longer timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch('/api/advance-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const result = await response.json()

      if (response.ok) {
        // Check if values were actually saved by querying the database
        const { data: checkData } = await supabase
          .from('weekly_results')
          .select('rnd_success_probability, rnd_multiplier, revenue, demand')
          .eq('week_number', result.currentWeek - 1)
          .single()
        
        if (checkData && (checkData.rnd_success_probability === null || checkData.revenue === null)) {
          alert(`⚠️ WARNING: Week advanced but calculated values are NULL!\n\nThis means the calculation failed on the server.\n\nCheck the terminal where 'npm run dev' is running for error messages.\n\nWeek ${result.currentWeek} / ${result.totalWeeks}`)
        } else {
          alert(`✅ ${result.message}\n\nWeek ${result.currentWeek} / ${result.totalWeeks}`)
        }
        // Reload game settings and teams status instead of full page reload to stay on this page
        loadGameSettings()
        loadTeamsStatus()
      } else {
        alert(`❌ Failed: ${result.error || 'Unknown error'}\n\nActive teams: ${result.activeCount || 0}`)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        alert('❌ Request timed out. The week advancement is taking too long. Please try again.')
      } else {
        alert('❌ Network error while advancing week. Please check your connection and try again.')
      }
    } finally {
      setAdvancing(false)
    }
  }

  // Can advance if we're on a valid week (not beyond total weeks)
  const canAdvance = gameSettings.current_week > 0 && gameSettings.current_week <= gameSettings.total_weeks

  // Debug logging
  console.log('Week Progression Debug:', {
    current_week: gameSettings.current_week,
    total_weeks: gameSettings.total_weeks,
    canAdvance,
    game_status: gameSettings.game_status
  })

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <Card className="card-base">
        <h2 className="text-lg font-serif font-bold text-gray-900 mb-4">
          Game Week Progression
        </h2>

        <div className="space-y-4">
          {/* Timer Countdown */}
          {gameSettings.game_status === 'active' && gameSettings.week_start_time && (
            <div className={`${gameSettings.is_paused ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
              <div className="text-center">
                <p className={`text-sm font-medium ${gameSettings.is_paused ? 'text-yellow-900' : 'text-orange-900'} mb-2`}>
                  {gameSettings.is_paused ? 'Game Paused' : 'Time Remaining'}
                </p>
                {gameSettings.is_paused ? (
                  <p className="text-4xl font-bold text-yellow-600">⏸ PAUSED</p>
                ) : (
                  <p className={`text-4xl font-bold ${timeRemaining <= 60000 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
                    {formatTime(timeRemaining)}
                  </p>
                )}
                <p className={`text-xs ${gameSettings.is_paused ? 'text-yellow-700' : 'text-orange-700'} mt-2`}>
                  {gameSettings.is_paused 
                    ? 'Students can still submit decisions during pause' 
                    : timeRemaining <= 0 ? 'Advancing to next week...' : 'Ready to advance the week?'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Teams Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">Teams Status:</span>
                <span className={`text-sm font-bold ${
                  teamsStatus.joined === teamsStatus.total ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {teamsStatus.joined} / {teamsStatus.total} Joined
                </span>
              </div>
              {teamsStatus.joined === teamsStatus.total && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                  ✓ All Ready
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Week {gameSettings.current_week} / {gameSettings.total_weeks}</span>
              <span className="text-sm font-semibold text-gray-900">{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{weeksRemaining} weeks remaining</p>
          </div>

          {/* Week Controls */}
          <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
            <div className="flex gap-3 items-stretch">
              <button
                onClick={handleAdvanceWeek}
                disabled={!canAdvance || advancing}
                className="flex-1 py-3 px-6 bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white rounded-xl font-semibold text-base transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {advancing ? 'Processing...' : canAdvance ? (gameSettings.current_week === gameSettings.total_weeks ? '🏁 Summarize Game' : '⏭ Next Week') : 'Game Completed'}
              </button>
              
              {gameSettings.game_status === 'active' && gameSettings.week_start_time && (
                <button
                  onClick={handleTogglePause}
                  disabled={pauseToggling}
                  className={`flex-shrink-0 py-3 px-6 rounded-xl font-semibold text-base transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                    gameSettings.is_paused 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                  title={gameSettings.is_paused ? 'Resume game timer' : 'Pause game timer'}
                >
                  {pauseToggling ? '...' : gameSettings.is_paused ? '▶' : '⏸'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center">
              {canAdvance ? (gameSettings.current_week === gameSettings.total_weeks ? 'This will end the game and show final results to all students' : 'Admin can manually advance before timer ends') : 'All weeks completed'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
