'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamSubmission {
  team_id: string
  team_name: string
  price_set: number | null
  units_available: number | null
  units_sold: number | null
  revenue: number | null
  profit: number | null
  cumulative_profit: number | null
  submitted: boolean
  calculated: boolean
}

interface ActiveScenario {
  title: string
  description: string | null
}

interface RoundControlProps {
  gameId: string
}

export default function PriceWarRoundControl({ gameId }: RoundControlProps) {
  const [gameSettings, setGameSettings] = useState<any>(null)
  const [teams, setTeams] = useState<{ team_id: string; team_name: string }[]>([])
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null)
  const [upcomingScenario, setUpcomingScenario] = useState<(ActiveScenario & { round_number: number }) | null>(null)

  const load = async () => {
    const supabase = createClient()

    const { data: settings } = await supabase
      .from('game_settings')
      .select('current_week, total_weeks, game_status, game_config')
      .eq('game_id', gameId)
      .single()

    const { data: teamRows } = await supabase
      .from('teams')
      .select('team_id, team_name')
      .eq('game_id', gameId)
      .order('team_name')

    setGameSettings(settings)
    const teamList = teamRows ?? []
    setTeams(teamList)

    if (!settings) { setLoading(false); return }

    const { data: results } = await supabase
      .from('price_war_results')
      .select('team_id, price_set, units_available, units_sold, revenue, profit, cumulative_profit, calculated_at')
      .eq('game_id', gameId)
      .eq('round_number', settings.current_week)

    const resultMap: Record<string, any> = {}
    for (const r of results ?? []) resultMap[r.team_id] = r

    const merged: TeamSubmission[] = teamList.map((t) => {
      const r = resultMap[t.team_id]
      return {
        team_id: t.team_id,
        team_name: t.team_name,
        price_set: r?.price_set ?? null,
        units_available: r?.units_available ?? null,
        units_sold: r?.units_sold ?? null,
        revenue: r?.revenue ?? null,
        profit: r?.profit ?? null,
        cumulative_profit: r?.cumulative_profit ?? null,
        submitted: !!r,
        calculated: r?.units_sold != null,
      }
    })

    setSubmissions(merged)

    // Load active scenario for current round and upcoming scenario for next round
    const currentRound = settings?.current_week ?? 1
    const { data: scenarioRows } = await supabase
      .from('price_war_scenarios')
      .select('round_number, title, description')
      .eq('game_id', gameId)
      .in('round_number', [currentRound, currentRound + 1])

    const curScenario = scenarioRows?.find((s: any) => s.round_number === currentRound) ?? null
    const nextScenario = scenarioRows?.find((s: any) => s.round_number === currentRound + 1) ?? null
    setActiveScenario(curScenario ? { title: curScenario.title, description: curScenario.description } : null)
    setUpcomingScenario(nextScenario ? { round_number: nextScenario.round_number, title: nextScenario.title, description: nextScenario.description } : null)

    setLoading(false)
  }

  useEffect(() => {
    load()

    const supabase = createClient()
    const channel = supabase
      .channel(`pw_admin_${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_war_results', filter: `game_id=eq.${gameId}` }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  const handleAdvanceRound = async () => {
    setAdvancing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/price-war/advance-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(`Error: ${data.error}`)
      } else {
        setMessage(data.message)
        await load()
      }
    } catch {
      setMessage('Failed to advance round')
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading round data...</p>
  if (!gameSettings) return <p className="text-muted-foreground">Game not found.</p>

  const cfg = gameSettings.game_config ?? {}
  const totalCustomers: number = cfg.total_customers ?? 10
  const fixedCost: number = cfg.fixed_cost ?? 1000
  const variableCost: number = cfg.variable_cost ?? 0
  const productsPerTeam: number = cfg.products_per_team ?? 5
  const currentRound: number = gameSettings.current_week
  const totalRounds: number = gameSettings.total_weeks
  const gameStatus: string = gameSettings.game_status

  const submittedCount = submissions.filter((s) => s.submitted).length
  const calculatedCount = submissions.filter((s) => s.calculated).length
  const roundCalculated = calculatedCount > 0 && calculatedCount === submittedCount

  const sortedByProfit = [...submissions].sort(
    (a, b) => (b.cumulative_profit ?? -Infinity) - (a.cumulative_profit ?? -Infinity)
  )

  return (
    <div className="space-y-6">
      {/* Round status header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{currentRound} / {totalRounds}</p>
            <p className="text-xs text-muted-foreground">Round</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{submittedCount} / {teams.length}</p>
            <p className="text-xs text-muted-foreground">Submitted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalCustomers}</p>
            <p className="text-xs text-muted-foreground">Customers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{productsPerTeam}</p>
            <p className="text-xs text-muted-foreground">Units/Team</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">${fixedCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Fixed Cost</p>
          </div>
          {variableCost > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold">${variableCost.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Variable/Unit</p>
            </div>
          )}
        </div>

        {gameStatus !== 'completed' && (
          <button
            onClick={handleAdvanceRound}
            disabled={advancing || submittedCount === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {advancing ? 'Calculating...' : roundCalculated ? `Start Round ${currentRound + 1}` : `Calculate Round ${currentRound} & Advance`}
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {message}
        </div>
      )}

      {/* Active scenario announcement (projector-friendly) */}
      {activeScenario && (
        <div className="border-2 border-amber-400 rounded-xl p-4 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Active Event — Round {currentRound}</p>
              <p className="font-bold text-amber-900 text-lg">{activeScenario.title}</p>
              {activeScenario.description && (
                <p className="text-amber-800 text-sm mt-1">{activeScenario.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming scenario preview (admin only) */}
      {upcomingScenario && gameStatus !== 'completed' && (
        <div className="border border-dashed border-blue-300 rounded-xl p-3 bg-blue-50/50 text-sm">
          <span className="text-blue-600 font-medium">Queued for Round {upcomingScenario.round_number}: </span>
          <span className="text-blue-800">{upcomingScenario.title}</span>
          {upcomingScenario.description && (
            <span className="text-blue-700"> — {upcomingScenario.description}</span>
          )}
        </div>
      )}

      {/* Submissions table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-medium text-gray-500">Team</th>
              <th className="text-right py-2 pr-4 font-medium text-gray-500">Price Set</th>
              <th className="text-right py-2 pr-4 font-medium text-gray-500">Units Sold</th>
              <th className="text-right py-2 pr-4 font-medium text-gray-500">Revenue</th>
              <th className="text-right py-2 pr-4 font-medium text-gray-500">Round Profit</th>
              <th className="text-right py-2 font-medium text-gray-500">Cumulative Profit</th>
            </tr>
          </thead>
          <tbody>
            {sortedByProfit.map((s, i) => (
              <tr key={s.team_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4 font-medium">
                  {i === 0 && s.cumulative_profit != null && (
                    <span className="mr-1 text-yellow-500">★</span>
                  )}
                  {s.team_name}
                </td>
                <td className="py-2 pr-4 text-right">
                  {s.price_set != null
                    ? <span className="font-mono">${Number(s.price_set).toLocaleString()}</span>
                    : <span className="text-muted-foreground italic">—</span>}
                </td>
                <td className="py-2 pr-4 text-right">
                  {s.units_sold != null ? s.units_sold : (
                    s.submitted
                      ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Pending</span>
                      : <span className="text-muted-foreground italic">No submission</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {s.revenue != null ? `$${Number(s.revenue).toLocaleString()}` : '—'}
                </td>
                <td className={`py-2 pr-4 text-right font-mono ${s.profit != null ? (s.profit >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                  {s.profit != null ? `$${Number(s.profit).toLocaleString()}` : '—'}
                </td>
                <td className={`py-2 text-right font-mono font-semibold ${s.cumulative_profit != null ? (s.cumulative_profit >= 0 ? 'text-green-700' : 'text-red-700') : ''}`}>
                  {s.cumulative_profit != null ? `$${Number(s.cumulative_profit).toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gameStatus === 'completed' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="font-semibold text-green-800">Game Completed!</p>
          <p className="text-sm text-green-700 mt-1">
            Winner: {sortedByProfit[0]?.team_name ?? 'N/A'} with ${Number(sortedByProfit[0]?.cumulative_profit ?? 0).toLocaleString()} cumulative profit
          </p>
        </div>
      )}
    </div>
  )
}
