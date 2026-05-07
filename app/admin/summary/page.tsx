'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from '@/components/admin/admin-header'

interface TeamResult {
  team_id: string
  team_name: string
  round_number: number
  price_set: number | null
  units_sold: number | null
  revenue: number | null
  profit: number | null
  cumulative_profit: number | null
}

interface TeamSummary {
  team_id: string
  team_name: string
  totalRevenue: number
  totalProfit: number
  cumulativeProfit: number
  roundsPlayed: number
  bestRoundProfit: number
  avgPrice: number
  totalUnitsSold: number
  roundHistory: TeamResult[]
}

interface GameConfig {
  total_customers: number
  fixed_cost: number
  variable_cost: number
  products_per_team: number
}

function PriceWarSummaryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const gameId = searchParams.get('gameId') ?? ''
  const [loading, setLoading] = useState(true)
  const [gameName, setGameName] = useState('')
  const [totalRounds, setTotalRounds] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [gameStatus, setGameStatus] = useState('')
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
  const [teamSummaries, setTeamSummaries] = useState<TeamSummary[]>([])
  const [allRounds, setAllRounds] = useState<number[]>([])

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn')
    if (!adminLoggedIn || adminLoggedIn !== 'true') {
      router.push('/admin/login')
      return
    }
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      // Load game settings
      const { data: settings } = await supabase
        .from('game_settings')
        .select('game_name, total_weeks, current_week, game_status, game_config')
        .eq('game_id', gameId)
        .single()

      if (settings) {
        setGameName(settings.game_name ?? 'Price War')
        setTotalRounds(settings.total_weeks ?? 0)
        setCurrentRound(settings.current_week ?? 0)
        setGameStatus(settings.game_status ?? '')
        setGameConfig(settings.game_config ?? null)
      }

      // Load all price_war_results for this game
      const { data: results } = await supabase
        .from('price_war_results')
        .select('team_id, round_number, price_set, units_sold, revenue, profit, cumulative_profit')
        .eq('game_id', gameId)
        .order('round_number', { ascending: true })

      // Load team names
      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name')
        .eq('game_id', gameId)
        .order('team_name')

      if (!teams || !results) { setLoading(false); return }

      const teamNameMap: Record<string, string> = {}
      for (const t of teams) teamNameMap[t.team_id] = t.team_name

      // Group results by team
      const teamMap: Record<string, TeamResult[]> = {}
      const roundSet = new Set<number>()
      for (const r of results) {
        if (!teamMap[r.team_id]) teamMap[r.team_id] = []
        teamMap[r.team_id].push({ ...r, team_name: teamNameMap[r.team_id] ?? r.team_id })
        roundSet.add(r.round_number)
      }

      setAllRounds(Array.from(roundSet).sort((a, b) => a - b))

      // Build summaries
      const summaries: TeamSummary[] = teams.map((t) => {
        const rounds = teamMap[t.team_id] ?? []
        const calculatedRounds = rounds.filter((r) => r.units_sold != null)
        const totalRevenue = calculatedRounds.reduce((s, r) => s + (r.revenue ?? 0), 0)
        const totalProfit = calculatedRounds.reduce((s, r) => s + (r.profit ?? 0), 0)
        const totalUnitsSold = calculatedRounds.reduce((s, r) => s + (r.units_sold ?? 0), 0)
        const avgPrice = calculatedRounds.length > 0
          ? calculatedRounds.reduce((s, r) => s + (r.price_set ?? 0), 0) / calculatedRounds.length
          : 0
        const bestRoundProfit = calculatedRounds.length > 0
          ? Math.max(...calculatedRounds.map((r) => r.profit ?? -Infinity))
          : 0
        const latestResult = rounds[rounds.length - 1]
        const cumulativeProfit = latestResult?.cumulative_profit ?? totalProfit

        return {
          team_id: t.team_id,
          team_name: t.team_name,
          totalRevenue,
          totalProfit,
          cumulativeProfit,
          roundsPlayed: calculatedRounds.length,
          bestRoundProfit,
          avgPrice,
          totalUnitsSold,
          roundHistory: rounds,
        }
      })

      // Sort by cumulative profit descending
      summaries.sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
      setTeamSummaries(summaries)
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminUsername')
    router.push('/')
  }

  const fmt = (n: number) => `$${Number(n).toLocaleString()}`
  const rankEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  const getRoundResult = (team: TeamSummary, round: number) => {
    return team.roundHistory.find((r) => r.round_number === round)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400">Loading summary...</p>
      </div>
    )
  }

  const winner = teamSummaries[0]

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminHeader onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">⚔️ Price War</span>
              {gameStatus === 'completed' && (
                <span className="text-xs font-semibold uppercase tracking-widest text-green-400 border border-green-700 px-2 py-0.5 rounded-full">Completed</span>
              )}
            </div>
            <h1 className="text-4xl font-serif font-bold mb-1">{gameName}</h1>
            <p className="text-gray-400">Game Summary — Round {currentRound} / {totalRounds}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Winner banner */}
        {gameStatus === 'completed' && winner && (
          <div className="mb-8 bg-gradient-to-r from-yellow-900/60 to-yellow-700/30 border border-yellow-600 rounded-2xl p-6 flex items-center gap-6">
            <div className="text-6xl">🏆</div>
            <div>
              <p className="text-yellow-400 text-sm font-semibold uppercase tracking-widest mb-1">Winner</p>
              <p className="text-3xl font-bold text-white">{winner.team_name}</p>
              <p className="text-yellow-300 text-lg mt-1">{fmt(winner.cumulativeProfit)} cumulative profit</p>
            </div>
          </div>
        )}

        {/* Game config pills */}
        {gameConfig && (
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { label: 'Customers', value: gameConfig.total_customers },
              { label: 'Units/Team', value: gameConfig.products_per_team },
              { label: 'Fixed Cost', value: fmt(gameConfig.fixed_cost) },
              ...(gameConfig.variable_cost > 0 ? [{ label: 'Variable Cost', value: fmt(gameConfig.variable_cost) }] : []),
              { label: 'Total Rounds', value: totalRounds },
            ].map((pill) => (
              <div key={pill.label} className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm">
                <span className="text-gray-400">{pill.label}: </span>
                <span className="font-semibold text-white">{pill.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">🏅 Final Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 pr-4">Rank</th>
                  <th className="text-left py-3 pr-4">Team</th>
                  <th className="text-right py-3 pr-4">Cumulative Profit</th>
                  <th className="text-right py-3 pr-4">Total Revenue</th>
                  <th className="text-right py-3 pr-4">Units Sold</th>
                  <th className="text-right py-3 pr-4">Avg Price</th>
                  <th className="text-right py-3 pr-4">Best Round</th>
                  <th className="text-right py-3">Rounds Played</th>
                </tr>
              </thead>
              <tbody>
                {teamSummaries.map((team, i) => (
                  <tr
                    key={team.team_id}
                    className={`border-b border-gray-800 transition-colors hover:bg-gray-800/50 ${i === 0 ? 'bg-yellow-900/10' : ''}`}
                  >
                    <td className="py-3 pr-4 text-xl">{rankEmoji(i)}</td>
                    <td className="py-3 pr-4 font-semibold text-white">{team.team_name}</td>
                    <td className={`py-3 pr-4 text-right font-bold font-mono text-lg ${team.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(team.cumulativeProfit)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-blue-300">{fmt(team.totalRevenue)}</td>
                    <td className="py-3 pr-4 text-right font-mono">{team.totalUnitsSold.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono">{fmt(Math.round(team.avgPrice))}</td>
                    <td className={`py-3 pr-4 text-right font-mono ${team.bestRoundProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {fmt(team.bestRoundProfit)}
                    </td>
                    <td className="py-3 text-right text-gray-400">{team.roundsPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Round-by-round breakdown */}
        {allRounds.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
            <h2 className="text-2xl font-bold mb-6">📊 Round-by-Round Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 pr-6 sticky left-0 bg-gray-900">Team</th>
                    {allRounds.map((r) => (
                      <th key={r} className="text-center py-3 px-3 min-w-[100px]" colSpan={2}>
                        Round {r}
                      </th>
                    ))}
                    <th className="text-right py-3 pl-4">Total</th>
                  </tr>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="sticky left-0 bg-gray-900"></th>
                    {allRounds.map((r) => (
                      <>
                        <th key={`${r}-price`} className="text-center py-2 px-2 text-gray-500">Price</th>
                        <th key={`${r}-profit`} className="text-center py-2 px-2 text-gray-500">Profit</th>
                      </>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teamSummaries.map((team, i) => (
                    <tr key={team.team_id} className={`border-b border-gray-800 hover:bg-gray-800/40 ${i === 0 ? 'bg-yellow-900/5' : ''}`}>
                      <td className="py-3 pr-6 font-semibold sticky left-0 bg-gray-900">
                        <span className="mr-2">{rankEmoji(i)}</span>{team.team_name}
                      </td>
                      {allRounds.map((r) => {
                        const result = getRoundResult(team, r)
                        return (
                          <>
                            <td key={`${team.team_id}-${r}-price`} className="py-3 px-2 text-center font-mono text-gray-300">
                              {result?.price_set != null ? fmt(result.price_set) : <span className="text-gray-600">—</span>}
                            </td>
                            <td key={`${team.team_id}-${r}-profit`} className={`py-3 px-2 text-center font-mono ${result?.profit != null ? (result.profit >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
                              {result?.profit != null ? fmt(result.profit) : '—'}
                            </td>
                          </>
                        )
                      })}
                      <td className={`py-3 pl-4 text-right font-bold font-mono ${team.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(team.cumulativeProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GameSummaryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <PriceWarSummaryContent />
    </Suspense>
  )
}
