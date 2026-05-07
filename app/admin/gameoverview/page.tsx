'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from '@/components/admin/admin-header'

interface InvestmentConfig {
  seed: { expected_revenue?: number; demand?: number; rd_count?: number }
  series_a: { expected_revenue?: number; demand?: number; rd_count?: number }
  series_b: { expected_revenue?: number; demand?: number; rd_count?: number }
  series_c: { expected_revenue?: number; demand?: number; rd_count?: number }
}

interface RndTier {
  min_cost: number
  max_cost: number
  success_min: number
  success_max: number
  multiplier_min: number
  multiplier_max: number
}

interface RndTierConfig {
  basic: RndTier
  standard: RndTier
  advanced: RndTier
  premium: RndTier
}

interface TeamSummary {
  team_id: string
  team_name: string
  product_name: string | null
  current_stage: string
  current_demand: number
  current_revenue: number
  remaining_demand: number
  expected_revenue: number
  expected_demand: number
  total_balance: number
}

function GameOverviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const gameId = searchParams.get('gameId') ?? '00000000-0000-0000-0000-000000000001'
  const [loading, setLoading] = useState(true)
  const [investmentConfig, setInvestmentConfig] = useState<InvestmentConfig | null>(null)
  const [rndTierConfig, setRndTierConfig] = useState<RndTierConfig | null>(null)
  const [teamsSummary, setTeamsSummary] = useState<TeamSummary[]>([])
  const [populationSize, setPopulationSize] = useState(10000)
  const [blurredStages, setBlurredStages] = useState<Set<string>>(new Set(['seed', 'series_a', 'series_b', 'series_c']))

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn')
    if (!adminLoggedIn || adminLoggedIn !== 'true') {
      router.push('/admin/login')
      return
    }

    loadSummaryData()

    // Subscribe to real-time changes in game_settings, teams, and weekly_results
    const settingsChannel = supabase
      .channel('game_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_settings',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          console.log('Game settings updated:', payload)
          if (payload.new.investment_config) {
            setInvestmentConfig(payload.new.investment_config as InvestmentConfig)
          }
          if (payload.new.rnd_tier_config) {
            setRndTierConfig(payload.new.rnd_tier_config as RndTierConfig)
          }
          if (payload.new.population_size) {
            setPopulationSize(payload.new.population_size)
          }
        }
      )
      .subscribe()

    // Subscribe to teams changes (balance updates)
    const teamsChannel = supabase
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
          console.log('Teams updated:', payload)
          loadSummaryData()
        }
      )
      .subscribe()

    // Subscribe to weekly_results changes (new results added)
    const resultsChannel = supabase
      .channel('weekly_results_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_results',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          console.log('Weekly results updated:', payload)
          loadSummaryData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(settingsChannel)
      supabase.removeChannel(teamsChannel)
      supabase.removeChannel(resultsChannel)
    }
  }, [router])

  const loadSummaryData = async () => {
    try {
      // Load game settings
      const { data: settings } = await supabase
        .from('game_settings')
        .select('investment_config, rnd_tier_config, population_size')
        .eq('game_id', gameId)
        .single()

      if (settings) {
        if (settings.investment_config) {
          setInvestmentConfig(settings.investment_config as InvestmentConfig)
        }
        if (settings.rnd_tier_config) {
          setRndTierConfig(settings.rnd_tier_config as RndTierConfig)
        }
        if (settings.population_size) {
          setPopulationSize(settings.population_size)
        }
      }

      // Load teams with their products and latest results
      const { data: teams } = await supabase
        .from('teams')
        .select(`
          team_id,
          team_name,
          funding_stage,
          assigned_product_id,
          total_balance,
          products:assigned_product_id(name)
        `)
        .eq('game_id', gameId)
        .eq('is_active', true)

      if (teams) {
        // Get latest weekly results for each team
        const teamSummaries: TeamSummary[] = []

        for (const team of teams) {
          // Get latest weekly result
          const { data: latestResult } = await supabase
            .from('weekly_results')
            .select('demand, revenue, set_price, week_number')
            .eq('team_id', team.team_id)
            .order('week_number', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Get average probability for expected calculations
          let avgProbability = 0.5 // default
          if (team.assigned_product_id && latestResult?.set_price) {
            const { data: probabilities } = await supabase
              .from('customer_purchase_probabilities')
              .select('purchase_probability')
              .eq('game_id', gameId)
              .eq('team_id', team.team_id)
              .eq('product_id', team.assigned_product_id)

            if (probabilities && probabilities.length > 0) {
              const sum = probabilities.reduce((acc, p) => acc + (p.purchase_probability || 0), 0)
              avgProbability = sum / probabilities.length
            }
          }

          const currentDemand = latestResult?.demand || 0
          const currentRevenue = latestResult?.revenue || 0
          const currentPrice = latestResult?.set_price || 0

          // Calculate expected demand and revenue based on current price
          const expectedDemand = Math.round((avgProbability * populationSize) / 100)
          const expectedRevenue = expectedDemand * currentPrice

          // Calculate remaining demand (demand needed to reach next stage)
          const currentStage = team.funding_stage || 'Pre-Seed'
          let remainingDemand = 0
          
          if (investmentConfig) {
            let nextStageDemand = 0
            if (currentStage === 'Pre-Seed' && investmentConfig.seed.demand) {
              nextStageDemand = investmentConfig.seed.demand
            } else if (currentStage === 'Seed' && investmentConfig.series_a.demand) {
              nextStageDemand = investmentConfig.series_a.demand
            } else if (currentStage === 'Series A' && investmentConfig.series_b.demand) {
              nextStageDemand = investmentConfig.series_b.demand
            } else if (currentStage === 'Series B' && investmentConfig.series_c.demand) {
              nextStageDemand = investmentConfig.series_c.demand
            }
            
            remainingDemand = Math.max(0, nextStageDemand - currentDemand)
          }

          teamSummaries.push({
            team_id: team.team_id,
            team_name: team.team_name,
            product_name: (team.products as any)?.name || 'No Product',
            current_stage: currentStage,
            current_demand: currentDemand,
            current_revenue: currentRevenue,
            remaining_demand: remainingDemand,
            expected_revenue: expectedRevenue,
            expected_demand: expectedDemand,
            total_balance: team.total_balance || 0,
          })
        }

        // Sort teams by total_balance in descending order (highest balance first)
        teamSummaries.sort((a, b) => b.total_balance - a.total_balance)
        
        setTeamsSummary(teamSummaries)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading summary data:', error)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminUsername')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    )
  }

  // Calculate max values for chart scaling
  const maxRemaining = Math.max(...teamsSummary.map(t => t.remaining_demand), 1)
  const maxExpectedRevenue = Math.max(...teamsSummary.map(t => t.expected_revenue), 1)
  const maxExpectedDemand = Math.max(...teamsSummary.map(t => t.expected_demand), 1)

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminHeader onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold mb-2">InnoQuest Start-Up Odyssey</h1>
          <p className="text-gray-400">Game Summary & Overview</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Investment Requirements Table */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Investment Requirements</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="border border-gray-700 px-4 py-2 text-left">Stage</th>
                    <th className="border border-gray-700 px-4 py-2 text-left">Expected Revenue (฿)</th>
                    <th className="border border-gray-700 px-4 py-2 text-left">Demand</th>
                    <th className="border border-gray-700 px-4 py-2 text-left">R&D Count</th>
                  </tr>
                </thead>
                <tbody>
                  {investmentConfig && (['seed', 'series_a', 'series_b', 'series_c'] as const).map((stage) => {
                    const stageNames = { seed: 'Seed', series_a: 'Series A', series_b: 'Series B', series_c: 'Series C' }
                    const stageName = stageNames[stage]
                    const isBlurred = blurredStages.has(stage)
                    
                    return (
                      <tr 
                        key={stage} 
                        className={`hover:bg-gray-800 cursor-pointer transition-all ${isBlurred ? 'opacity-30 blur-sm' : ''}`}
                        onClick={() => {
                          setBlurredStages(prev => {
                            const newSet = new Set(prev)
                            if (newSet.has(stage)) {
                              newSet.delete(stage)
                            } else {
                              newSet.add(stage)
                            }
                            return newSet
                          })
                        }}
                      >
                        <td className="border border-gray-700 px-4 py-2 font-medium">
                          {stageName}
                        </td>
                        <td className="border border-gray-700 px-4 py-2">
                          {(investmentConfig[stage].expected_revenue || 0).toLocaleString()}
                        </td>
                        <td className="border border-gray-700 px-4 py-2">
                          {(investmentConfig[stage].demand || 0).toLocaleString()}
                        </td>
                        <td className="border border-gray-700 px-4 py-2">
                          {investmentConfig[stage].rd_count || 0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tier Information Table */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Tier Information</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="border border-gray-700 px-3 py-2 text-left">Tier</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Min Cost</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Max Cost</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Success Min (%)</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Success Max (%)</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Multiplier Min (%)</th>
                    <th className="border border-gray-700 px-3 py-2 text-left">Multiplier Max (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rndTierConfig && (['basic', 'standard', 'advanced', 'premium'] as const).map((tier) => (
                    <tr key={tier} className="hover:bg-gray-800">
                      <td className="border border-gray-700 px-3 py-2 font-medium capitalize">{tier}</td>
                      <td className="border border-gray-700 px-3 py-2">
                        {(rndTierConfig[tier].min_cost || 0).toLocaleString()}
                      </td>
                      <td className="border border-gray-700 px-3 py-2">
                        {(rndTierConfig[tier].max_cost || 0).toLocaleString()}
                      </td>
                      <td className="border border-gray-700 px-3 py-2">
                        {rndTierConfig[tier].success_min || 0}
                      </td>
                      <td className="border border-gray-700 px-3 py-2">
                        {rndTierConfig[tier].success_max || 0}
                      </td>
                      <td className="border border-gray-700 px-3 py-2">
                        {rndTierConfig[tier].multiplier_min || 0}
                      </td>
                      <td className="border border-gray-700 px-3 py-2">
                        {rndTierConfig[tier].multiplier_max || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Team Overview with Charts */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Team & Product Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 px-4 py-2 text-left">Team</th>
                  <th className="border border-gray-700 px-4 py-2 text-left">Product</th>
                  <th className="border border-gray-700 px-4 py-2 text-left">Current Demand</th>
                  <th className="border border-gray-700 px-4 py-2 text-left">Current Revenue</th>
                  <th className="border border-gray-700 px-4 py-2 text-left">Balance</th>
                </tr>
              </thead>
              <tbody>
                {teamsSummary.map((team) => (
                  <tr key={team.team_id} className="hover:bg-gray-800">
                    <td className="border border-gray-700 px-4 py-3 font-medium">{team.team_name}</td>
                    <td className="border border-gray-700 px-4 py-3">{team.product_name}</td>
                    <td className="border border-gray-700 px-4 py-3">
                      <span className="font-semibold text-green-400">{team.current_demand.toLocaleString()} pcs</span>
                    </td>
                    <td className="border border-gray-700 px-4 py-3">
                      <span className="font-semibold text-blue-400">฿{team.current_revenue.toLocaleString()}</span>
                    </td>
                    <td className="border border-gray-700 px-4 py-3">
                      <span className="font-semibold text-yellow-400">฿{team.total_balance.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GameOverviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <GameOverviewContent />
    </Suspense>
  )
}

