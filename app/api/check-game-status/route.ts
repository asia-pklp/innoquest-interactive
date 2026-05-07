import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const gameId =
      request.nextUrl.searchParams.get('gameId') ??
      '00000000-0000-0000-0000-000000000001'

    const { data: settings } = await supabase
      .from('game_settings')
      .select('*')
      .eq('game_id', gameId)
      .single()

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
