import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePriceWarRound } from '@/lib/price-war-calculations'

export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: settings, error: settingsError } = await supabase
      .from('game_settings')
      .select('current_week, total_weeks, game_status, game_config')
      .eq('game_id', gameId)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (settings.game_status === 'completed') {
      return NextResponse.json({ error: 'Game already completed' }, { status: 400 })
    }

    if (settings.game_status !== 'active') {
      return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
    }

    const cfg = settings.game_config ?? {}
    const totalCustomers: number = cfg.total_customers ?? 10
    const fixedCost: number = cfg.fixed_cost ?? 1000
    const variableCost: number = cfg.variable_cost ?? 0
    const productsPerTeam: number = cfg.products_per_team ?? 5
    const currentRound: number = settings.current_week

    // Fetch all submissions for the current round
    const { data: submissions, error: subError } = await supabase
      .from('price_war_results')
      .select('team_id, price_set, units_available')
      .eq('game_id', gameId)
      .eq('round_number', currentRound)
      .is('units_sold', null) // only not-yet-calculated rows

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 })
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found for this round' }, { status: 400 })
    }

    // Run price war calculation
    const calcInputs = submissions.map((s) => ({
      team_id: s.team_id,
      price: Number(s.price_set),
      units_available: s.units_available ?? productsPerTeam,
    }))

    const results = calculatePriceWarRound(calcInputs, totalCustomers, fixedCost, variableCost)

    // Fetch previous cumulative profits for each team
    const teamIds = results.map((r) => r.team_id)
    const { data: prevRows } = await supabase
      .from('price_war_results')
      .select('team_id, cumulative_profit')
      .eq('game_id', gameId)
      .eq('round_number', currentRound - 1)
      .in('team_id', teamIds)

    const prevCumulative: Record<string, number> = {}
    for (const row of prevRows ?? []) {
      prevCumulative[row.team_id] = Number(row.cumulative_profit ?? 0)
    }

    const now = new Date().toISOString()

    // Write results back to price_war_results
    for (const r of results) {
      const prev = prevCumulative[r.team_id] ?? 0
      const cumulative = prev + r.profit

      await supabase
        .from('price_war_results')
        .update({
          units_sold: r.units_sold,
          revenue: r.revenue,
          profit: r.profit,
          cumulative_profit: cumulative,
          calculated_at: now,
        })
        .eq('game_id', gameId)
        .eq('team_id', r.team_id)
        .eq('round_number', currentRound)
    }

    // Advance week / complete game
    const isLastRound = currentRound >= settings.total_weeks
    const nextWeek = isLastRound ? currentRound : currentRound + 1
    const newStatus = isLastRound ? 'completed' : 'active'

    // Apply scenario overrides for the next round (if any)
    let newGameConfig = settings.game_config ?? {}
    let activeScenario: { title: string; description: string | null } | null = null

    if (!isLastRound) {
      const { data: scenario } = await supabase
        .from('price_war_scenarios')
        .select('title, description, param_overrides')
        .eq('game_id', gameId)
        .eq('round_number', nextWeek)
        .maybeSingle()

      if (scenario && scenario.param_overrides) {
        newGameConfig = { ...newGameConfig, ...scenario.param_overrides }
        activeScenario = { title: scenario.title, description: scenario.description }
      }
    }

    await supabase
      .from('game_settings')
      .update({
        current_week: nextWeek,
        game_status: newStatus,
        game_config: newGameConfig,
        week_start_time: new Date().toISOString(),
      })
      .eq('game_id', gameId)

    const message = isLastRound
      ? `Game completed! Round ${currentRound} results calculated.`
      : `Round ${currentRound} results calculated. Round ${nextWeek} started.`

    return NextResponse.json({
      success: true,
      roundCalculated: currentRound,
      currentRound: nextWeek,
      gameCompleted: isLastRound,
      results,
      activeScenario,
      message,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
