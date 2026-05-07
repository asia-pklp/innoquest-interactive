'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GameConfig {
  total_customers: number
  products_per_team: number
  fixed_cost: number
  variable_cost: number
  min_price: number
  max_price: number
}

interface RoundHistory {
  round_number: number
  price_set: number
  units_available: number
  units_sold: number | null
  revenue: number | null
  profit: number | null
  cumulative_profit: number | null
}

interface CompetitorPrice {
  team_name: string
  price_set: number
  units_sold: number | null
}

interface CompetitorRound {
  round_number: number
  competitors: CompetitorPrice[]
}

export default function PriceWarGameplay() {
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)

  const [gameSettings, setGameSettings] = useState<any>(null)
  const [config, setConfig] = useState<GameConfig | null>(null)

  const [priceInput, setPriceInput] = useState<string>('')
  const [revenueInput, setRevenueInput] = useState<string>('')
  const [profitInput, setProfitInput] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [history, setHistory] = useState<RoundHistory[]>([])
  const [competitorRounds, setCompetitorRounds] = useState<CompetitorRound[]>([])
  const [lastRoundSurplus, setLastRoundSurplus] = useState<number | null>(null)
  const [activeScenario, setActiveScenario] = useState<{ title: string; description: string | null } | null>(null)

  const loadData = useCallback(async (tid: string, gid: string) => {
    const supabase = createClient()

    const { data: settings } = await supabase
      .from('game_settings')
      .select('current_week, total_weeks, game_status, game_config')
      .eq('game_id', gid)
      .single()

    if (settings?.game_status === 'summary') {
      window.location.href = `/student/price_war/result`
      return
    }

    setGameSettings(settings)
    const cfg: GameConfig = {
      total_customers: settings?.game_config?.total_customers ?? 10,
      products_per_team: settings?.game_config?.products_per_team ?? 5,
      fixed_cost: settings?.game_config?.fixed_cost ?? 1000,
      variable_cost: settings?.game_config?.variable_cost ?? 0,
      min_price: settings?.game_config?.min_price ?? 1,
      max_price: settings?.game_config?.max_price ?? 9999,
    }
    setConfig(cfg)

    const currentRound = settings?.current_week ?? 1

    const { data: myRows } = await supabase
      .from('price_war_results')
      .select('round_number, price_set, units_available, units_sold, revenue, profit, cumulative_profit')
      .eq('game_id', gid)
      .eq('team_id', tid)
      .order('round_number')

    setHistory(myRows ?? [])

    const currentRow = (myRows ?? []).find((r) => r.round_number === currentRound)
    setSubmitted(!!currentRow)

    if (currentRound > 1) {
      const lastRound = (myRows ?? []).find((r) => r.round_number === currentRound - 1)
      if (lastRound && lastRound.units_sold != null) {
        setLastRoundSurplus(lastRound.units_available - lastRound.units_sold)
      }
    }

    const { data: scenario } = await supabase
      .from('price_war_scenarios')
      .select('title, description')
      .eq('game_id', gid)
      .eq('round_number', currentRound)
      .maybeSingle()
    setActiveScenario(scenario ? { title: scenario.title, description: scenario.description } : null)

    // Load competitor prices for ALL completed rounds
    if (currentRound > 1) {
      const completedRounds = Array.from({ length: currentRound - 1 }, (_, i) => i + 1)

      const { data: allPrevResults } = await supabase
        .from('price_war_results')
        .select('team_id, round_number, price_set, units_sold')
        .eq('game_id', gid)
        .in('round_number', completedRounds)
        .not('price_set', 'is', null)

      if (allPrevResults && allPrevResults.length > 0) {
        const teamIds = [...new Set(allPrevResults.map((r) => r.team_id))]
        const { data: teamRows } = await supabase
          .from('teams')
          .select('team_id, team_name')
          .in('team_id', teamIds)

        const nameMap: Record<string, string> = {}
        for (const t of teamRows ?? []) nameMap[t.team_id] = t.team_name

        const rounds: CompetitorRound[] = completedRounds
          .map((rn) => {
            const roundResults = allPrevResults.filter((r) => r.round_number === rn)
            const competitors = roundResults
              .filter((r) => r.team_id !== tid)
              .map((r) => ({
                team_name: nameMap[r.team_id] ?? 'Unknown',
                price_set: Number(r.price_set),
                units_sold: r.units_sold,
              }))
              .sort((a, b) => a.price_set - b.price_set)
            return { round_number: rn, competitors }
          })
          .filter((r) => r.competitors.length > 0)
          .reverse() // most recent first

        setCompetitorRounds(rounds)
      }
    }
  }, [])

  useEffect(() => {
    const tid = sessionStorage.getItem('team_id')
    const gid = sessionStorage.getItem('game_id')
    const name = sessionStorage.getItem('team_name')
    setTeamId(tid)
    setTeamName(name)
    setGameId(gid)
    if (tid && gid) loadData(tid, gid)
  }, [loadData])

  useEffect(() => {
    if (!gameId || !teamId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`pw_student_${gameId}_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings', filter: `game_id=eq.${gameId}` }, () => loadData(teamId, gameId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_war_results', filter: `game_id=eq.${gameId}` }, () => loadData(teamId, gameId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_war_scenarios', filter: `game_id=eq.${gameId}` }, () => loadData(teamId, gameId))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId, teamId, loadData])

  const handleSubmit = async () => {
    if (!teamId || !gameId || !config) return
    const price = parseFloat(priceInput)
    if (isNaN(price) || price < config.min_price || price > config.max_price) {
      setSubmitError(`Price must be between $${config.min_price} and $${config.max_price}`)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/price-war/submit-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, teamId, price }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed')
      } else {
        setSubmitted(true)
        setPriceInput('')
        setRevenueInput('')
        setProfitInput('')
        await loadData(teamId, gameId)
      }
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!gameSettings || !config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    )
  }

  const currentRound = gameSettings.current_week as number
  const totalRounds = gameSettings.total_weeks as number
  const isCompleted = gameSettings.game_status === 'completed'
  const currentRoundData = history.find((r) => r.round_number === currentRound)
  const latestCumulative = history.filter((r) => r.cumulative_profit != null).slice(-1)[0]?.cumulative_profit ?? 0

  const totalVariableCost = config.variable_cost * config.products_per_team
  const totalCostPerRound = config.fixed_cost + totalVariableCost

  // Validate student calculations
  const priceVal = parseFloat(priceInput)
  const revenueVal = parseFloat(revenueInput)
  const profitVal = parseFloat(profitInput)

  const allFilled = priceInput !== '' && revenueInput !== '' && profitInput !== ''
  const priceOk = !isNaN(priceVal) && priceVal >= config.min_price && priceVal <= config.max_price
  const expectedRevenue = priceOk ? Math.round(priceVal * config.products_per_team) : null
  const expectedProfit = expectedRevenue != null ? expectedRevenue - totalCostPerRound : null
  const revenueOk = expectedRevenue != null && !isNaN(revenueVal) && Math.abs(revenueVal - expectedRevenue) < 1
  const profitOk = expectedProfit != null && !isNaN(profitVal) && Math.abs(profitVal - expectedProfit) < 1
  const canSubmit = allFilled && priceOk && revenueOk && profitOk

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">Price War</h1>
            <p className="text-muted-foreground">{teamName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Round</p>
            <p className="text-2xl font-bold">{currentRound} / {totalRounds}</p>
          </div>
        </div>

        {/* Context cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{config.total_customers}</p>
            <p className="text-xs text-muted-foreground mt-1">Customers in Market</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">{config.products_per_team}</p>
            <p className="text-xs text-muted-foreground mt-1">Units in Hand</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-600">
              {lastRoundSurplus != null ? lastRoundSurplus : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Surplus Last Round</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${latestCumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Number(latestCumulative).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Cumulative Profit</p>
          </div>
        </div>

        {/* Cost card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">Your Costs This Round</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Fixed Cost: </span>
              <span className="font-semibold">${config.fixed_cost.toLocaleString()}</span>
            </div>
            {config.variable_cost > 0 && (
              <div>
                <span className="text-muted-foreground">Variable Cost: </span>
                <span className="font-semibold">${config.variable_cost.toLocaleString()} × {config.products_per_team} units = ${totalVariableCost.toLocaleString()}</span>
              </div>
            )}
            <div className="font-semibold text-red-600">
              <span className="text-muted-foreground font-normal">Total Cost: </span>
              ${totalCostPerRound.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Active scenario */}
        {activeScenario && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📢</span>
              <div>
                <h3 className="font-bold text-amber-900 text-lg">{activeScenario.title}</h3>
                {activeScenario.description && (
                  <p className="text-amber-800 text-sm mt-1">{activeScenario.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Competitor prices — all rounds */}
        {competitorRounds.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Competitor Prices</h3>
            <div className="space-y-4">
              {competitorRounds.map((cr) => (
                <div key={cr.round_number}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Round {cr.round_number}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {cr.competitors.map((c) => (
                      <div key={c.team_name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <div>
                          <p className="text-xs text-muted-foreground">{c.team_name}</p>
                          <p className="font-mono font-semibold">${Number(c.price_set).toLocaleString()}</p>
                        </div>
                        {c.units_sold != null && (
                          <span className="text-xs text-muted-foreground">({c.units_sold} sold)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game completed state */}
        {isCompleted && (
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-6 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-800 mb-1">🏁 Game Complete!</p>
            <p className="text-green-700">Final cumulative profit: <span className="font-bold">${Number(latestCumulative).toLocaleString()}</span></p>
          </div>
        )}

        {/* Price submission */}
        {!isCompleted && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Set Your Price — Round {currentRound}</h3>

            {!submitted ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Calculate all values yourself, then fill them in. Your answers must be correct to submit.
                </p>

                {/* Price input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price per unit (${config.min_price} – ${config.max_price})
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={config.min_price}
                      max={config.max_price}
                      step="1"
                      value={priceInput}
                      onChange={(e) => { setPriceInput(e.target.value); setSubmitError(null) }}
                      placeholder="Enter price"
                      className={`w-full pl-7 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        priceInput && !priceOk ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {priceInput && !priceOk && (
                    <p className="text-xs text-red-500 mt-1">Price must be between ${config.min_price} and ${config.max_price}</p>
                  )}
                </div>

                {/* Revenue input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Revenue (if you sell all {config.products_per_team} units)
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="1"
                      value={revenueInput}
                      onChange={(e) => { setRevenueInput(e.target.value); setSubmitError(null) }}
                      placeholder="Calculate and enter"
                      className={`w-full pl-7 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        revenueInput && priceOk && !revenueOk ? 'border-red-400' : revenueOk ? 'border-green-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {revenueInput && priceOk && !revenueOk && (
                    <p className="text-xs text-red-500 mt-1">Check your calculation</p>
                  )}
                  {revenueOk && (
                    <p className="text-xs text-green-600 mt-1">✓ Correct</p>
                  )}
                </div>

                {/* Profit input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Profit (Revenue − Total Cost)
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="1"
                      value={profitInput}
                      onChange={(e) => { setProfitInput(e.target.value); setSubmitError(null) }}
                      placeholder="Calculate and enter"
                      className={`w-full pl-7 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        profitInput && revenueOk && !profitOk ? 'border-red-400' : profitOk ? 'border-green-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {profitInput && revenueOk && !profitOk && (
                    <p className="text-xs text-red-500 mt-1">Check your calculation</p>
                  )}
                  {profitOk && (
                    <p className="text-xs text-green-600 mt-1">✓ Correct</p>
                  )}
                </div>

                {!canSubmit && allFilled && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Fix your calculations before submitting.
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Price'}
                </button>

                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
              </div>
            ) : currentRoundData?.units_sold != null ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono">${Number(currentRoundData.price_set).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Your Price</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">{currentRoundData.units_sold} / {currentRoundData.units_available}</p>
                    <p className="text-xs text-muted-foreground">Units Sold</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono">${Number(currentRoundData.revenue).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div className={`text-center ${Number(currentRoundData.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <p className="text-xl font-bold font-mono">${Number(currentRoundData.profit).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Round Profit</p>
                  </div>
                  <div className={`text-center ${Number(currentRoundData.cumulative_profit) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <p className="text-xl font-bold font-mono">${Number(currentRoundData.cumulative_profit).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Cumulative Profit</p>
                  </div>
                </div>
                {currentRound < totalRounds && (
                  <p className="text-sm text-muted-foreground text-center">
                    Waiting for admin to start Round {currentRound + 1}...
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
                <p className="text-amber-700">
                  Price submitted (${Number(currentRoundData?.price_set ?? 0).toLocaleString()}). Waiting for admin to calculate round results...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Round history */}
        {history.filter((r) => r.units_sold != null).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-3">Round History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1 pr-4 text-muted-foreground font-medium">Round</th>
                    <th className="text-right py-1 pr-4 text-muted-foreground font-medium">Price</th>
                    <th className="text-right py-1 pr-4 text-muted-foreground font-medium">Sold</th>
                    <th className="text-right py-1 pr-4 text-muted-foreground font-medium">Revenue</th>
                    <th className="text-right py-1 pr-4 text-muted-foreground font-medium">Profit</th>
                    <th className="text-right py-1 text-muted-foreground font-medium">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .filter((r) => r.units_sold != null)
                    .map((r) => (
                      <tr key={r.round_number} className="border-b border-gray-100">
                        <td className="py-1 pr-4">{r.round_number}</td>
                        <td className="py-1 pr-4 text-right font-mono">${Number(r.price_set).toLocaleString()}</td>
                        <td className="py-1 pr-4 text-right">{r.units_sold} / {r.units_available}</td>
                        <td className="py-1 pr-4 text-right font-mono">${Number(r.revenue).toLocaleString()}</td>
                        <td className={`py-1 pr-4 text-right font-mono ${Number(r.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${Number(r.profit).toLocaleString()}
                        </td>
                        <td className={`py-1 text-right font-mono font-semibold ${Number(r.cumulative_profit) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ${Number(r.cumulative_profit).toLocaleString()}
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
