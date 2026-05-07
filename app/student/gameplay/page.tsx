'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NextImage from 'next/image'
import StudentHeader from '@/components/student/student-header'
import WeeklyDecisions from '@/components/student/weekly-decisions'
import StudentReports from '@/components/student/student-reports'
import AnalyticsToolsView from '@/components/student/analytics-tools-view'

type TabType = 'decisions' | 'reports' | 'tools'

interface TeamData {
  team_id: string
  team_name: string
  game_id: string
  selected_product_id?: string
  assigned_product_id?: string
  assigned_product_name?: string | null
  total_balance: number
  successful_rnd_tests: number
  funding_stage: string
}

interface GameSettings {
  game_id: string
  current_week: number
  total_weeks: number
  game_status: string
  cost_per_analytics?: number
  rnd_tier_config?: any
  initial_capital?: number
  week_duration_minutes?: number
  week_start_time?: string
  is_paused?: boolean
  pause_timestamp?: string
}

export default function StudentGameplay() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('decisions')
  const [team, setTeam] = useState<TeamData | null>(null)
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [displayRevenue, setDisplayRevenue] = useState<number>(0)
  const [displayDemand, setDisplayDemand] = useState<number>(0)
  const [lastSeenWeek, setLastSeenWeek] = useState<number>(0)
  const [lostRound, setLostRound] = useState<boolean>(false)
  const [announcements, setAnnouncements] = useState<Array<{
    id: string
    title: string
    message: string
    balance_award: number | null
    old_stage: string | null
    new_stage: string | null
    week_number: number
    is_read: boolean
    announcement_type?: string
  }>>([])

  // Load initial data once
  useEffect(() => {
    const loadData = async () => {
      console.log('🔍 Loading gameplay data...')
      
      // Get team ID from session
      const teamId = sessionStorage.getItem('team_id')
      const teamName = sessionStorage.getItem('team_name')
      const gameId = sessionStorage.getItem('game_id')

      console.log('📝 Session data:', { teamId, teamName, gameId })

      if (!teamId) {
        console.log('❌ No team_id in session, redirecting to login')
        sessionStorage.clear()
        window.location.href = '/student/login'
        return
      }

      // Load team data from database
      console.log('🔍 Querying teams table for team_id:', teamId)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('team_id, team_name, game_id, assigned_product_id, total_balance, successful_rnd_tests, funding_stage')
        .eq('team_id', teamId)
        .single()

      console.log('📊 Team query result:', { teamData, teamError })

      if (teamError || !teamData) {
        console.error('❌ Team query error or team not found:', teamError)
        console.log('❌ Team not found in database - likely game was reset')
        sessionStorage.clear()
        window.location.href = '/student/login'
        return
      }

      if (teamData) {
        console.log('✅ Team found:', teamData.team_name)
        
        // If there's an assigned product, fetch its name
        let productName = null
        if (teamData.assigned_product_id) {
          console.log('🔍 Fetching product name for:', teamData.assigned_product_id)
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('id', teamData.assigned_product_id)
            .single()
          productName = productData?.name
          console.log('📦 Product name:', productName)
        }

        setTeam({
          team_id: teamData.team_id,
          team_name: teamData.team_name,
          game_id: teamData.game_id,
          assigned_product_id: teamData.assigned_product_id,
          assigned_product_name: productName,
          total_balance: teamData.total_balance,
          successful_rnd_tests: teamData.successful_rnd_tests,
          funding_stage: teamData.funding_stage
        })

        // Load game settings
        console.log('🔍 Querying game_settings for game_id:', teamData.game_id)
        const { data: settingsData, error: settingsError } = await supabase
          .from('game_settings')
          .select('*')
          .eq('game_id', teamData.game_id)
          .single()

        // Get revenue and demand from the previous week (current_week - 1)
        // Round 1 (week 1) shows 0, Round 2 (week 2) shows week 1 results, etc.
        let revenue = 0
        let demand = 0
        
        if (settingsData && settingsData.current_week > 1) {
          // Get results from previous week
          const previousWeek = settingsData.current_week - 1
          const { data: previousWeekResult } = await supabase
            .from('weekly_results')
            .select('revenue, demand')
            .eq('team_id', teamData.team_id)
            .eq('week_number', previousWeek)
            .single()
          
          revenue = previousWeekResult?.revenue || 0
          demand = previousWeekResult?.demand || 0
        }
        // If current_week = 1, revenue and demand remain 0
        
        setDisplayRevenue(revenue)
        setDisplayDemand(demand)

        console.log('📊 Game settings query result:', { settingsData, settingsError })

        console.log('📊 Game settings query result:', { settingsData, settingsError })

        if (settingsData) {
          console.log('📊 Game Settings loaded:', settingsData)
          console.log('📊 Game Status:', settingsData.game_status)
          console.log('📊 Current Week:', settingsData.current_week)
          
          // Check if game hasn't started yet
          if (settingsData.game_status !== 'active' && settingsData.game_status !== 'completed') {
            console.log('⚠️ Game not active/completed, redirecting to lobby. Status:', settingsData.game_status)
            const gt = sessionStorage.getItem('game_type') ?? 'startup_simulation'
            window.location.href = `/student/${gt}/lobby`
            return
          }
          
          console.log('✅ Game is active/completed, loading gameplay page')
          
          setGameSettings({
            game_id: settingsData.game_id,
            current_week: settingsData.current_week,
            total_weeks: settingsData.total_weeks,
            game_status: settingsData.game_status,
            cost_per_analytics: settingsData.analytics_cost || 5000,
            rnd_tier_config: settingsData.rnd_tier_config,
            initial_capital: settingsData.initial_capital || 0,
            week_duration_minutes: settingsData.week_duration_minutes || 5,
            week_start_time: settingsData.week_start_time,
            is_paused: settingsData.is_paused || false,
            pause_timestamp: settingsData.pause_timestamp
          })
        } else {
          console.log('❌ No game settings found for game_id:', teamData.game_id)
        }
      }

      console.log('✅ Finished loading data')
      setLoading(false)
    }

    loadData()
  }, []) // Run only once on mount

  // Countdown timer effect with proper pause/resume
  useEffect(() => {
    if (!gameSettings?.week_start_time || gameSettings.game_status !== 'active') return

    // If paused, stop the interval
    if (gameSettings.is_paused) {
      return
    }

    // Active timer countdown
    const interval = setInterval(() => {
      const startTime = new Date(gameSettings.week_start_time!).getTime()
      const durationMs = (gameSettings.week_duration_minutes || 5) * 60 * 1000
      const endTime = startTime + durationMs
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)

      if (remaining <= 0) {
        setTimeRemaining(0)
        // Timer expired - wait for admin to manually advance the week
        console.log('⏰ Week time expired - waiting for admin to advance')
      } else {
        setTimeRemaining(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gameSettings?.week_start_time, gameSettings?.week_duration_minutes, gameSettings?.game_status, gameSettings?.is_paused])

  // Refresh revenue and demand when current_week changes
  useEffect(() => {
    if (!team || !gameSettings) return

    const refreshRevenueAndDemand = async () => {
      try {
        // Get revenue and demand from the previous week (current_week - 1)
        // Round 1 (week 1) shows 0, Round 2 (week 2) shows week 1 results, etc.
        let revenue = 0
        let demand = 0
        
        if (gameSettings.current_week > 1) {
          const previousWeek = gameSettings.current_week - 1
          const { data: previousWeekResult, error } = await supabase
            .from('weekly_results')
            .select('revenue, demand')
            .eq('team_id', team.team_id)
            .eq('week_number', previousWeek)
            .maybeSingle()
          
          if (error) {
            // Only log if it's not a "no rows" error (PGRST116)
            if (error.code !== 'PGRST116') {
              console.error('Error fetching weekly results:', error)
            }
            // Set to 0 on error or if no record found
            revenue = 0
            demand = 0
          } else if (previousWeekResult) {
            revenue = previousWeekResult.revenue ?? 0
            demand = previousWeekResult.demand ?? 0
            console.log('📊 Revenue and Demand loaded:', { revenue, demand, previousWeek, team_id: team.team_id })
          } else {
            // No record found (normal for first time)
            revenue = 0
            demand = 0
            console.log('📊 No weekly results found for week', previousWeek, '- setting to 0')
          }
        } else {
          console.log('📊 Week 1 - Revenue and Demand set to 0')
        }
        // If current_week = 1, revenue and demand remain 0
        
        setDisplayRevenue(revenue)
        setDisplayDemand(demand)
      } catch (error) {
        console.error('Error in refreshRevenueAndDemand:', error)
        // Ensure we set values even on error
        setDisplayRevenue(0)
        setDisplayDemand(0)
      }
    }

    // Check if team lost the previous round and show appropriate alerts
    const checkAndShowAlerts = async () => {
      let didLoseRound = false
      
      if (gameSettings.current_week > 1) {
        const previousWeek = gameSettings.current_week - 1
        
        console.log(`🔍 Checking if team lost round. Team ID: ${team.team_id}, Previous week: ${previousWeek}, Current week: ${gameSettings.current_week}`)
        
        const { data: previousWeekResult, error } = await supabase
          .from('weekly_results')
          .select('revenue, demand, pass_fail_status, week_number')
          .eq('team_id', team.team_id)
          .eq('week_number', previousWeek)
          .maybeSingle()
        
        // Only log actual errors (empty object means no data found, which is normal for first time)
        if (error && Object.keys(error).length > 0) {
          console.error('Error fetching previous week result:', error)
        }
        
        console.log('📋 Previous week result:', previousWeekResult, 'Error:', error)
        
        // Check if lost round: revenue = 0, demand = 0, and pass_fail_status = 'fail'
        const lostThisRound = previousWeekResult && 
          previousWeekResult.revenue === 0 && 
          previousWeekResult.demand === 0 && 
          previousWeekResult.pass_fail_status === 'fail'
        
        console.log('❓ Lost this round?', lostThisRound, {
          hasResult: !!previousWeekResult,
          revenue: previousWeekResult?.revenue,
          demand: previousWeekResult?.demand,
          status: previousWeekResult?.pass_fail_status
        })
        
        if (lostThisRound) {
          didLoseRound = true
          setLostRound(true)
          
          // Show alert when transitioning to a new week OR on first load of this week
          const isNewWeek = gameSettings.current_week > lastSeenWeek && lastSeenWeek > 0
          const isFirstLoadOfThisWeek = lastSeenWeek === 0 || lastSeenWeek < gameSettings.current_week
          
          if (isNewWeek || isFirstLoadOfThisWeek) {
            console.log('🚨 Showing lost round alert! (isNewWeek:', isNewWeek, ', isFirstLoadOfThisWeek:', isFirstLoadOfThisWeek, ')')
            alert(
              `❌ YOU LOST THE PREVIOUS ROUND! ❌\n\n` +
              `Your team had insufficient balance to cover costs.\n\n` +
              `CONSEQUENCES:\n` +
              `• Revenue and Demand set to 0\n` +
              `• All R&D tests failed\n` +
              `• Reset to Pre-Seed stage\n` +
              `• Balance reset to initial capital\n\n` +
              `Plan your budget carefully this round to avoid losing again!`
            )
          }
        } else {
          setLostRound(false)
        }
      } else {
        setLostRound(false)
      }
      
      // Then check if new round started (but only show "new round" alert if they didn't lose)
      if (gameSettings.current_week > lastSeenWeek && lastSeenWeek > 0) {
        if (!didLoseRound) {
          console.log('🎯 Showing new round started alert')
          alert(`🎯 NEW ROUND STARTED!\n\nWeek ${gameSettings.current_week} has begun. Make your decisions for this round!`)
        }
      }
    }

    // Load unread announcements (milestone advancements, etc.)
    const loadAnnouncements = async () => {
      if (!team) return
      
      try {
        const { data: announcementsData, error } = await supabase
          .from('team_announcements')
          .select('id, title, message, balance_award, old_stage, new_stage, week_number, is_read, announcement_type')
          .eq('team_id', team.team_id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10) // Show up to 10 unread announcements
        
        // Handle errors gracefully - table exists, so any error is likely permission-related
        if (error) {
          const errorMessage = error.message || String(error) || JSON.stringify(error)
          const errorCode = (error as any)?.code || (error as any)?.hint || (error as any)?.details
          
          // Log error for debugging but don't break the app
          console.warn('⚠️ Could not load announcements (non-critical):', {
            message: errorMessage,
            code: errorCode,
            note: 'Announcements feature will be disabled until this is resolved'
          })
          setAnnouncements([])
          return
        }
        
        if (announcementsData && announcementsData.length > 0) {
          console.log('📢 Loaded announcements:', announcementsData.length)
          setAnnouncements(announcementsData)
          
          // Show alert for the most recent announcement
          const mostRecent = announcementsData[0]
          if (mostRecent.announcement_type === 'milestone_advancement') {
            const alertMessage = mostRecent.title + '\n\n' +
              (mostRecent.old_stage && mostRecent.new_stage 
                ? `Your team has advanced from ${mostRecent.old_stage} to ${mostRecent.new_stage} stage!\n\n`
                : `Your team has advanced to a new funding stage!\n\n`) +
              (mostRecent.balance_award 
                ? `💰 Balance Award: ฿${mostRecent.balance_award.toLocaleString()}\n\n`
                : '') +
              mostRecent.message
            alert(alertMessage)
          }
        } else {
          setAnnouncements([])
        }
      } catch (error: any) {
        // Catch any unexpected errors gracefully
        console.warn('Warning in loadAnnouncements:', error?.message || error)
        setAnnouncements([])
      }
    }
    
    // Run the check and show alerts
    checkAndShowAlerts()
    
    // Load announcements
    if (team) {
      loadAnnouncements()
    }
    
    setLastSeenWeek(gameSettings.current_week)
    refreshRevenueAndDemand()
  }, [team?.team_id, gameSettings?.current_week, supabase])

  // Set up realtime subscriptions separately, only after team and gameSettings are loaded
  useEffect(() => {
    if (!team || !gameSettings) return

    console.log('Setting up realtime for team:', team.team_name)

    // Subscribe to game_settings changes
    const channel = supabase
      .channel('gameplay_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_settings',
          filter: `game_id=eq.${team.game_id}`
        },
        (payload) => {
          const newSettings = payload.new as GameSettings
          
          if (newSettings.game_status === 'completed') {
            console.log('🏁 Game completed, redirecting to results')
            const gt = sessionStorage.getItem('game_type') ?? 'startup_simulation'
            window.location.href = `/student/${gt}/result`
          } else if (newSettings.current_week !== gameSettings.current_week || newSettings.week_start_time !== gameSettings.week_start_time) {
            console.log(`Week changed from ${gameSettings.current_week} to ${newSettings.current_week} or timer reset`)
            
            // Show alert when new round starts
            if (newSettings.current_week > gameSettings.current_week) {
              alert(`🎯 NEW ROUND STARTED!\n\nWeek ${newSettings.current_week} has begun. Make your decisions for this round!`)
            }
            
            window.location.reload()
          } else if (newSettings.is_paused !== gameSettings.is_paused) {
            // Update pause state in real-time
            console.log(`Game ${newSettings.is_paused ? 'paused' : 'resumed'}`)
            setGameSettings(prev => prev ? { 
              ...prev, 
              is_paused: newSettings.is_paused,
              week_start_time: newSettings.week_start_time,
              pause_timestamp: newSettings.pause_timestamp
            } : null)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `team_id=eq.${team.team_id}`
        },
        (payload) => {
          const updatedTeam = payload.new as any
          console.log('💰 Team balance updated:', updatedTeam.total_balance)
          setTeam(prev => prev ? {
            ...prev,
            total_balance: updatedTeam.total_balance,
            successful_rnd_tests: updatedTeam.successful_rnd_tests,
            funding_stage: updatedTeam.funding_stage
          } : null)
          
          // Update revenue and demand if weekly results changed
          const updateRevenueAndDemand = async () => {
            try {
              if (!gameSettings) return
              
              let revenue = 0
              let demand = 0
              
              if (gameSettings.current_week > 1) {
                const previousWeek = gameSettings.current_week - 1
                const { data: previousWeekResult, error } = await supabase
                  .from('weekly_results')
                  .select('revenue, demand')
                  .eq('team_id', updatedTeam.team_id)
                  .eq('week_number', previousWeek)
                  .single()
                
                if (error) {
                  console.error('Error updating revenue/demand:', error)
                  revenue = 0
                  demand = 0
                } else {
                  revenue = previousWeekResult?.revenue ?? 0
                  demand = previousWeekResult?.demand ?? 0
                  console.log('📊 Revenue and Demand updated:', { revenue, demand })
                }
              }
              
              setDisplayRevenue(revenue)
              setDisplayDemand(demand)
            } catch (error) {
              console.error('Error in updateRevenueAndDemand:', error)
              setDisplayRevenue(0)
              setDisplayDemand(0)
            }
          }
          updateRevenueAndDemand()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up realtime for team:', team.team_name)
      supabase.removeChannel(channel)
    }
  }, [team?.team_id, gameSettings?.current_week]) // Only re-run if team ID or current week changes

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleLogout = async () => {
    // Clear session storage
    sessionStorage.removeItem('team_id')
    sessionStorage.removeItem('team_name')
    sessionStorage.removeItem('game_id')
    
    // Redirect to home page
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading gameplay...</p>
        </div>
      </div>
    )
  }

  if (!team || !gameSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error loading game data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0]">
      <div className="p-5">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/15 max-w-[1200px] w-full mx-auto overflow-hidden">
          <div className="bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-10 py-8 rounded-t-3xl">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="h-[42px] w-[144px] overflow-hidden flex items-center">
                <NextImage src="/logo_white.PNG" alt="InnoQuest" width={592} height={188} className="w-[144px] h-auto" priority />
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 px-4 py-2 rounded-xl font-semibold text-sm text-center">
                  {team.team_name}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-white/20 border border-white/30 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all hover:bg-white/30 hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <span>🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
            <div>
              <h1 className="font-['Poppins'] font-bold text-[32px] mb-0">
                📊 Week {gameSettings.current_week} of {gameSettings.total_weeks}
              </h1>
            </div>
          </div>

          <div className="px-10 py-8">
            {/* Countdown Timer */}
            {gameSettings.game_status === 'active' && gameSettings.week_start_time && (
              <div className={`mb-6 ${gameSettings.is_paused ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-orange-200'} border-2 rounded-xl p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{gameSettings.is_paused ? '⏸' : '⏰'}</span>
                    <div>
                      <p className={`text-sm font-medium ${gameSettings.is_paused ? 'text-yellow-900' : 'text-orange-900'}`}>
                        {gameSettings.is_paused ? 'Game Paused' : 'Time Remaining This Week'}
                      </p>
                      {gameSettings.is_paused ? (
                        <p className="text-2xl font-bold text-yellow-600">⏸ PAUSED</p>
                      ) : (
                        <p className={`text-2xl font-bold ${timeRemaining <= 60000 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
                          {formatTime(timeRemaining)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={`text-right text-xs ${gameSettings.is_paused ? 'text-yellow-700' : 'text-orange-700'}`}>
                    {gameSettings.is_paused 
                      ? 'You can still submit decisions while paused' 
                      : timeRemaining <= 0 ? 'Waiting for admin....' : 'Make you decision wisely~!'
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Milestone Advancement Announcements */}
            {announcements.map((announcement) => (
              <div key={announcement.id} className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-green-500 rounded-xl p-6 shadow-2xl animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="text-5xl animate-bounce">🎉</div>
                  <div className="flex-1">
                    <h3 className="font-['Poppins'] text-2xl font-bold text-green-900 mb-3 uppercase">{announcement.title}</h3>
                    <p className="text-green-800 font-semibold mb-3 text-lg">
                      {announcement.old_stage && announcement.new_stage ? (
                        <>Your team has successfully advanced from <strong>{announcement.old_stage}</strong> to <strong>{announcement.new_stage}</strong> stage!</>
                      ) : (
                        <>Your team has successfully advanced to a new funding stage!</>
                      )}
                    </p>
                    {announcement.balance_award && (
                      <div className="bg-green-100 border-2 border-green-600 rounded-lg p-4 mt-4 mb-4">
                        <p className="text-green-900 font-bold text-2xl mb-2">
                          💰 Balance Award: ฿{announcement.balance_award.toLocaleString()}
                        </p>
                        <p className="text-green-800 text-sm">
                          Your balance has been updated with this award amount.
                        </p>
                      </div>
                    )}
                    {announcement.message && (
                      <div className="text-green-800 space-y-2">
                        <p className="font-semibold text-base whitespace-pre-line">{announcement.message}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      // Mark as read
                      await supabase
                        .from('team_announcements')
                        .update({ is_read: true })
                        .eq('id', announcement.id)
                      // Remove from local state
                      setAnnouncements(announcements.filter(a => a.id !== announcement.id))
                    }}
                    className="text-green-500 hover:text-green-700 text-2xl font-bold"
                    title="Dismiss announcement"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {/* Lost Round Alert */}
            {lostRound && (
              <div className="mb-6 bg-red-50 border-4 border-red-500 rounded-xl p-6 shadow-2xl animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="text-5xl animate-bounce">❌</div>
                  <div className="flex-1">
                    <h3 className="font-['Poppins'] text-2xl font-bold text-red-900 mb-3 uppercase">⚠️ You Lost the Previous Round! ⚠️</h3>
                    <p className="text-red-800 font-semibold mb-3 text-lg">
                      Your team had insufficient balance to cover the costs. As a result:
                    </p>
                    <ul className="list-disc list-inside text-red-800 space-y-2 mb-4 text-base">
                      <li><strong>Revenue and Demand were set to 0</strong> for that round</li>
                      <li><strong>All R&D tests were automatically failed</strong></li>
                      <li><strong>Your team has been reset to the initial stage (Pre-Seed)</strong></li>
                      <li><strong>Balance has been reset to initial capital</strong></li>
                    </ul>
                    <div className="bg-red-100 border-2 border-red-600 rounded-lg p-4 mt-4">
                      <p className="text-red-900 font-bold text-lg">
                        💡 Important: Plan your budget carefully this round! Make sure you have enough balance to cover all costs (R&D, Analytics, Operating Costs) to avoid losing again.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLostRound(false)}
                    className="text-red-500 hover:text-red-700 text-2xl font-bold"
                    title="Dismiss alert"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-gray-600 mb-1">Demand</p>
                <p className="text-3xl font-bold text-green-600">{(displayDemand ?? 0).toLocaleString()} pcs</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-gray-600 mb-1">Revenue</p>
                <p className="text-3xl font-bold text-blue-600">฿{(displayRevenue ?? 0).toLocaleString()}</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-gray-600 mb-1">Balance</p>
                <p className="text-3xl font-bold text-[#E63946]">฿{team.total_balance.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">From milestone achievements</p>
              </div>
              <div className="flex-1 min-w-[200px] text-right">
                <p className="text-sm text-gray-600 mb-1">Funding Stage</p>
                <div className="bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-4 py-2 rounded-lg font-semibold text-sm inline-flex items-center gap-2">
                  <span>📍</span>
                  <span>{team.funding_stage}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-0 bg-white/20 rounded-xl p-1 mb-0">
              <button
                onClick={() => setActiveTab('decisions')}
                className={`flex-1 px-6 py-3 rounded-lg font-['Poppins'] font-semibold text-[15px] transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'decisions'
                    ? 'bg-white text-[#E63946] shadow-md'
                    : 'bg-transparent text-gray-600 hover:bg-white/15'
                }`}
              >
                <span>📋</span>
                <span>Weekly Decisions</span>
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex-1 px-6 py-3 rounded-lg font-['Poppins'] font-semibold text-[15px] transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'reports'
                    ? 'bg-white text-[#E63946] shadow-md'
                    : 'bg-transparent text-gray-600 hover:bg-white/15'
                }`}
              >
                <span>📊</span>
                <span>Reports & Analytics</span>
              </button>
              <button
                onClick={() => setActiveTab('tools')}
                className={`flex-1 px-6 py-3 rounded-lg font-['Poppins'] font-semibold text-[15px] transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'tools'
                    ? 'bg-white text-[#E63946] shadow-md'
                    : 'bg-transparent text-gray-600 hover:bg-white/15'
                }`}
              >
                <span>🔧</span>
                <span>Tools</span>
              </button>
            </div>
          </div>

          <div className="px-10 py-8">
            {activeTab === 'decisions' && (
              <WeeklyDecisions team={team} gameSettings={gameSettings} />
            )}
            {activeTab === 'reports' && (
              <div className="space-y-8">
                {/* Decision History Section */}
                <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                    <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-purple-700 rounded-full"></div>
                    <h2 className="text-2xl font-serif font-bold text-gray-900">Decision History</h2>
                  </div>
                  <DecisionHistory team={team} />
                </section>

                {/* Reports & Analytics Section */}
                <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                    <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-full"></div>
                    <h2 className="text-2xl font-serif font-bold text-gray-900">Reports & Analytics</h2>
                  </div>
                  <StudentReports team={team} gameSettings={gameSettings} />
                </section>
              </div>
            )}
            {activeTab === 'tools' && (
              <AnalyticsToolsView team={team} gameSettings={gameSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DecisionHistory({ team }: { team: TeamData }) {
  const supabase = createClient()
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadResults = async () => {
      try {
        console.log('🔍 Loading decision history for team.team_id:', team.team_id, 'Type:', typeof team.team_id)
        // Use team_id directly as the UUID for weekly_results query
        const { data, error } = await supabase
          .from('weekly_results')
          .select('*')
          .eq('team_id', team.team_id)
          .order('week_number', { ascending: true })

        console.log('📊 Query error:', error)
        console.log('📊 Query data:', data)
        console.log('📊 Data length:', data?.length)

        if (error) {
          console.error('❌ Error loading decision history:', error)
          setResults([])
        } else if (data && data.length > 0) {
          console.log('✅ Decision history loaded:', data.length, 'records')
          setResults(data)
        } else {
          console.log('⚠️ No decision history found for team_id:', team.team_id)
          setResults([])
        }
      } catch (err) {
        console.error('Exception loading decision history:', err)
        setResults([])
      }
      setLoading(false)
    }

    loadResults()
  }, [team.team_id, supabase])

  if (loading) {
    return <div className="p-4">Loading history...</div>
  }

  return (
    <div>
      {results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No decisions submitted yet. Submit decisions to see your history here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-muted-foreground">
                <th className="text-center py-3">Week</th>
                <th className="text-center py-3">Price Set</th>
                <th className="text-center py-3">Revenue</th>
                <th className="text-center py-3">R&D Tier</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id} className="border-b border-border hover:bg-secondary/50">
                  <td className="text-center py-3">Week {result.week_number}</td>
                  <td className="text-center">฿{result.set_price || 0}</td>
                  <td className="text-center">฿{(result.revenue || 0).toLocaleString()}</td>
                  <td className="text-center">{result.rnd_tier || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
// test comment