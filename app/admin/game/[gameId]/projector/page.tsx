'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TeamRow {
  team_id: string
  team_name: string
  submitted: boolean
  price_set: number | null
  round_profit: number | null
  cumulative_profit: number | null
  units_sold: number | null
  calculated: boolean
}

interface Scenario {
  title: string
  description: string | null
  param_overrides: Record<string, number>
}

const PARAM_LABELS: Record<string, string> = {
  total_customers: 'Customers',
  products_per_team: 'Units/team',
  fixed_cost: 'Fixed cost',
  variable_cost: 'Variable cost',
  min_price: 'Min price',
  max_price: 'Max price',
}

export default function ProjectorPage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [gameName, setGameName] = useState('')
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(5)
  const [gameStatus, setGameStatus] = useState('setup')
  const [gameConfig, setGameConfig] = useState<Record<string, number>>({})
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const prevCalculatedRef = useRef<Set<string>>(new Set())
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()

    const { data: settings } = await supabase
      .from('game_settings')
      .select('game_name, current_week, total_weeks, game_status, game_config')
      .eq('game_id', gameId)
      .single()

    if (!settings) return

    const round: number = settings.current_week

    setGameName(settings.game_name ?? '')
    setCurrentRound(round)
    setTotalRounds(settings.total_weeks ?? 5)
    setGameStatus(settings.game_status ?? 'setup')
    setGameConfig(settings.game_config ?? {})

    const { data: scenarioRow } = await supabase
      .from('price_war_scenarios')
      .select('title, description, param_overrides')
      .eq('game_id', gameId)
      .eq('round_number', round)
      .maybeSingle()
    setScenario(scenarioRow ?? null)

    const { data: teamRows } = await supabase
      .from('teams')
      .select('team_id, team_name')
      .eq('game_id', gameId)
      .order('team_name')

    const teamList = teamRows ?? []

    const { data: currentSubs } = await supabase
      .from('price_war_results')
      .select('team_id, price_set, units_sold, profit, cumulative_profit')
      .eq('game_id', gameId)
      .eq('round_number', round)

    const subMap: Record<string, any> = {}
    for (const s of currentSubs ?? []) subMap[s.team_id] = s

    // Also pull cumulative from last completed round for standing
    const { data: prevSubs } = round > 1 ? await supabase
      .from('price_war_results')
      .select('team_id, cumulative_profit')
      .eq('game_id', gameId)
      .eq('round_number', round - 1)
      .not('cumulative_profit', 'is', null) : { data: [] }

    const prevCumMap: Record<string, number> = {}
    for (const r of prevSubs ?? []) prevCumMap[r.team_id] = Number(r.cumulative_profit)

    const merged: TeamRow[] = teamList.map((t) => {
      const s = subMap[t.team_id]
      const hasCurrent = !!s
      const calculated = hasCurrent && s.units_sold != null
      return {
        team_id: t.team_id,
        team_name: t.team_name,
        submitted: hasCurrent,
        price_set: hasCurrent ? Number(s.price_set) : null,
        round_profit: calculated ? Number(s.profit) : null,
        cumulative_profit: calculated
          ? Number(s.cumulative_profit)
          : (prevCumMap[t.team_id] ?? null),
        units_sold: calculated ? s.units_sold : null,
        calculated,
      }
    })

    // Reveal newly calculated teams with a stagger
    const newCalcIds = new Set(merged.filter((t) => t.calculated).map((t) => t.team_id))
    const freshIds = [...newCalcIds].filter((id) => !prevCalculatedRef.current.has(id))
    prevCalculatedRef.current = newCalcIds

    if (freshIds.length > 0) {
      // Sort fresh ones by price ascending for reveal order
      const freshTeams = merged
        .filter((t) => freshIds.includes(t.team_id))
        .sort((a, b) => (a.price_set ?? 0) - (b.price_set ?? 0))

      let i = 0
      const reveal = () => {
        if (i >= freshTeams.length) return
        const id = freshTeams[i].team_id
        setRevealedIds((prev) => {
          const next = new Set(prev)
          next.add(id)
          return next
        })
        i++
        revealTimerRef.current = setTimeout(reveal, 700)
      }
      revealTimerRef.current = setTimeout(reveal, 300)
    }

    setTeams(merged)
  }, [gameId])

  useEffect(() => {
    loadData()

    const supabase = createClient()
    const channel = supabase
      .channel(`projector_${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings', filter: `game_id=eq.${gameId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_war_results', filter: `game_id=eq.${gameId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_war_scenarios', filter: `game_id=eq.${gameId}` }, loadData)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [gameId, loadData])

  const submittedCount = teams.filter((t) => t.submitted).length
  const calculatedCount = teams.filter((t) => t.calculated).length
  const totalTeams = teams.length
  const allCalculated = calculatedCount > 0 && calculatedCount === submittedCount && submittedCount === totalTeams

  // Sort by cumulative profit desc for leaderboard
  const leaderboard = [...teams].sort(
    (a, b) => (b.cumulative_profit ?? -Infinity) - (a.cumulative_profit ?? -Infinity)
  )

  const fmt = (n: number | null, prefix = '$') => {
    if (n == null) return '—'
    const abs = Math.abs(n)
    const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toLocaleString()
    return `${n >= 0 ? '' : '-'}${prefix}${s}`
  }

  const fmtProfit = (n: number | null) => {
    if (n == null) return '—'
    const abs = Math.abs(n)
    const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toLocaleString()
    return `${n >= 0 ? '+' : '-'}$${s}`
  }

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-5">
          <Image src="/logo-black-bg.png" alt="InnoQuest" width={56} height={56} className="rounded-xl shrink-0" />
          <div>
            <h1 className="text-3xl font-black tracking-wide leading-tight">{gameName || 'Price War'}</h1>
            {gameStatus === 'completed' && (
              <span className="text-sm text-green-400 font-bold uppercase tracking-widest">Game Complete</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-7xl font-black tabular-nums leading-none">
            {currentRound}<span className="text-gray-600 text-5xl font-light"> / {totalRounds}</span>
          </p>
          <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Round</p>
        </div>
      </div>

      {/* Scenario banner */}
      {scenario && (
        <div className="px-10 py-4 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">📢</span>
            <div className="flex-1">
              <span className="font-black text-amber-300 text-xl">{scenario.title}</span>
              {scenario.description && (
                <span className="text-amber-200/80 text-base ml-3">{scenario.description}</span>
              )}
            </div>
            {Object.keys(scenario.param_overrides ?? {}).length > 0 && (
              <div className="flex gap-3 shrink-0 flex-wrap">
                {Object.entries(scenario.param_overrides).map(([k, v]) => (
                  <span key={k} className="text-sm bg-amber-500/20 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/30 font-semibold">
                    {PARAM_LABELS[k] ?? k}: {k.includes('cost') || k.includes('price') ? `$${Number(v).toLocaleString()}` : v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: submission tracker */}
        <div className="w-[38%] border-r border-gray-800 flex flex-col p-8 gap-5 overflow-y-auto">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Submissions</p>
            <div className="flex items-end gap-3">
              <p className="text-7xl font-black tabular-nums leading-none">{submittedCount}</p>
              <p className="text-4xl font-light text-gray-600 mb-1">/ {totalTeams}</p>
            </div>
            <div className="h-3 bg-gray-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: totalTeams > 0 ? `${(submittedCount / totalTeams) * 100}%` : '0%' }}
              />
            </div>
            {calculatedCount > 0 && (
              <p className="text-xs text-blue-400 mt-1">{calculatedCount} results calculated</p>
            )}
          </div>

          <div className="flex-1 space-y-3">
            {teams.map((t) => (
              <div
                key={t.team_id}
                className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 ${
                  t.calculated
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : t.submitted
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-gray-700 bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {t.calculated ? '✅' : t.submitted ? '🟢' : '⏳'}
                  </span>
                  <span className={`text-xl font-bold ${t.submitted ? 'text-white' : 'text-gray-500'}`}>
                    {t.team_name}
                  </span>
                </div>
                <div className="text-right">
                  {t.calculated && t.price_set != null ? (
                    <span className="text-lg font-mono font-black text-blue-300">${Number(t.price_set).toLocaleString()}</span>
                  ) : t.submitted ? (
                    <span className="text-sm text-green-400 font-bold uppercase tracking-wide">Ready</span>
                  ) : (
                    <span className="text-sm text-gray-600">Waiting</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: leaderboard */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-5">
            {calculatedCount > 0 ? `Round ${currentRound} Standings` : 'Standings'}
          </p>

          {/* Header */}
          <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr] gap-3 px-4 mb-3 text-xs uppercase tracking-widest text-gray-600">
            <span></span>
            <span>Team</span>
            <span className="text-right">Price</span>
            <span className="text-right">Round</span>
            <span className="text-right">Total</span>
          </div>

          <div className="flex-1 space-y-3">
            {leaderboard.map((t, i) => {
              const isRevealed = revealedIds.has(t.team_id)
              const hasResult = t.calculated

              return (
                <div
                  key={t.team_id}
                  className={`grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr] gap-3 items-center px-4 py-5 rounded-2xl border transition-all duration-500 ${
                    hasResult && isRevealed
                      ? i === 0
                        ? 'border-yellow-500/40 bg-yellow-500/8'
                        : 'border-gray-700 bg-gray-900'
                      : 'border-gray-800 bg-gray-900/50'
                  }`}
                  style={{
                    opacity: !hasResult ? 0.6 : 1,
                    transform: hasResult && isRevealed ? 'scale(1)' : hasResult ? 'scale(0.98)' : 'scale(1)',
                  }}
                >
                  <span className="text-2xl font-black text-center">{medal(i)}</span>

                  <span className="text-xl font-bold truncate">{t.team_name}</span>

                  <span className={`text-right text-lg font-mono tabular-nums ${hasResult ? 'text-gray-300' : 'text-gray-600'}`}>
                    {hasResult && isRevealed ? fmt(t.price_set) : '—'}
                  </span>

                  <span className={`text-right text-2xl font-black tabular-nums transition-all duration-300 ${
                    !hasResult || !isRevealed ? 'text-gray-700' :
                    (t.round_profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {hasResult && isRevealed ? fmtProfit(t.round_profit) : '—'}
                  </span>

                  <span className={`text-right text-2xl font-black tabular-nums transition-all duration-300 ${
                    t.cumulative_profit == null ? 'text-gray-600' :
                    t.cumulative_profit >= 0 ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {t.cumulative_profit != null ? fmtProfit(t.cumulative_profit) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Game over banner */}
          {gameStatus === 'completed' && allCalculated && (
            <div className="mt-6 p-8 rounded-2xl border-2 border-yellow-500/50 bg-yellow-500/10 text-center">
              <p className="text-5xl font-black text-yellow-300 mb-3">🏆 Game Complete!</p>
              <p className="text-2xl text-yellow-200/80">
                Winner: <span className="font-black">{leaderboard[0]?.team_name}</span>
                {' — '}{fmtProfit(leaderboard[0]?.cumulative_profit ?? null)} total profit
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 py-3 border-t border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex gap-6 text-sm text-gray-500">
          {gameConfig.total_customers != null && <span>Customers: <strong className="text-gray-400">{gameConfig.total_customers}</strong></span>}
          {gameConfig.products_per_team != null && <span>Units/team: <strong className="text-gray-400">{gameConfig.products_per_team}</strong></span>}
          {gameConfig.fixed_cost != null && <span>Fixed cost: <strong className="text-gray-400">${Number(gameConfig.fixed_cost).toLocaleString()}</strong></span>}
          {gameConfig.variable_cost != null && gameConfig.variable_cost > 0 && (
            <span>Variable: <strong className="text-gray-400">${Number(gameConfig.variable_cost).toLocaleString()}/unit</strong></span>
          )}
        </div>
        <span className="text-xs text-gray-700 uppercase tracking-widest">Live</span>
      </div>
    </div>
  )
}
