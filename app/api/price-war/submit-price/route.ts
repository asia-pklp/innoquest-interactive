import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { gameId, teamId, price } = await request.json()

    if (!gameId || !teamId || price == null) {
      return NextResponse.json({ error: 'Missing gameId, teamId, or price' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: settings, error: settingsError } = await supabase
      .from('game_settings')
      .select('current_week, game_status, game_config')
      .eq('game_id', gameId)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (settings.game_status !== 'active') {
      return NextResponse.json({ error: 'Game is not active' }, { status: 400 })
    }

    const cfg = settings.game_config ?? {}
    const minPrice: number = cfg.min_price ?? 1
    const maxPrice: number = cfg.max_price ?? 9999
    const productsPerTeam: number = cfg.products_per_team ?? 5

    if (price < minPrice || price > maxPrice) {
      return NextResponse.json(
        { error: `Price must be between ${minPrice} and ${maxPrice}` },
        { status: 400 }
      )
    }

    const { error: upsertError } = await supabase
      .from('price_war_results')
      .upsert(
        {
          game_id: gameId,
          team_id: teamId,
          round_number: settings.current_week,
          price_set: price,
          units_available: productsPerTeam,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'game_id,team_id,round_number' }
      )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, round: settings.current_week })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
