'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamFinal {
  team_id: string
  team_name: string
  cumulative_profit: number
  rounds_played: number
}

interface RoundRow {
  round_number: number
  price_set: number
  units_sold: number | null
  revenue: number | null
  profit: number | null
  cumulative_profit: number | null
}

export default function PriceWarResult() {
  const [loading, setLoading] = useState(true)
  const [myTeamName, setMyTeamName] = useState('')
  const [myHistory, setMyHistory] = useState<RoundRow[]>([])
  const [leaderboard, setLeaderboard] = useState<TeamFinal[]>([])
  const [totalRounds, setTotalRounds] = useState(0)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const teamId = sessionStorage.getItem('team_id')
      const gameId = sessionStorage.getItem('game_id')

      if (!teamId || !gameId) {
        window.location.href = '/student/login'
        return
      }

      const { data: teamRow } = await supabase
        .from('teams')
        .select('team_name')
        .eq('team_id', teamId)
        .single()

      setMyTeamName(teamRow?.team_name ?? '')

      const { data: settings } = await supabase
        .from('game_settings')
        .select('total_weeks')
        .eq('game_id', gameId)
        .single()

      setTotalRounds(settings?.total_weeks ?? 0)

      // My round-by-round history
      const { data: myRows } = await supabase
        .from('price_war_results')
        .select('round_number, price_set, units_sold, revenue, profit, cumulative_profit')
        .eq('game_id', gameId)
        .eq('team_id', teamId)
        .order('round_number')

      setMyHistory(myRows ?? [])

      // All teams: get their last calculated round = final cumulative profit
      const { data: allResults } = await supabase
        .from('price_war_results')
        .select('team_id, round_number, cumulative_profit')
        .eq('game_id', gameId)
        .not('cumulative_profit', 'is', null)

      const { data: teamRows } = await supabase
        .from('teams')
        .select('team_id, team_name')
        .eq('game_id', gameId)

      const nameMap: Record<string, string> = {}
      for (const t of teamRows ?? []) nameMap[t.team_id] = t.team_name

      // Per team: pick the row with the highest round_number (= final state)
      const finalByTeam: Record<string, TeamFinal> = {}
      for (const r of allResults ?? []) {
        const existing = finalByTeam[r.team_id]
        if (!existing || r.round_number > existing.rounds_played) {
          finalByTeam[r.team_id] = {
            team_id: r.team_id,
            team_name: nameMap[r.team_id] ?? 'Unknown',
            cumulative_profit: Number(r.cumulative_profit ?? 0),
            rounds_played: r.round_number,
          }
        }
      }

      const sorted = Object.values(finalByTeam).sort(
        (a, b) => b.cumulative_profit - a.cumulative_profit
      )
      setLeaderboard(sorted)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0] flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading results...</p>
      </div>
    )
  }

  const myFinal = leaderboard.find((t) => t.team_name === myTeamName)
  const myRank = leaderboard.findIndex((t) => t.team_name === myTeamName) + 1
  const finalProfit = myFinal?.cumulative_profit ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-10 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-serif font-bold mb-2">⚔️ Price War Over!</h1>
          <p className="text-xl opacity-90">Final Results — {totalRounds} Rounds</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* My result card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-3">{myTeamName}</h2>
            <div className="inline-block bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-6 py-2 rounded-full font-semibold text-lg">
              Rank #{myRank} of {leaderboard.length}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Cumulative Profit</p>
              <p className={`text-3xl font-bold ${finalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${finalProfit.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Rounds Played</p>
              <p className="text-3xl font-bold text-gray-800">{myHistory.length} / {totalRounds}</p>
            </div>
          </div>
        </div>

        {/* My round-by-round history */}
        {myHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Round History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 pr-4 font-medium">Round</th>
                    <th className="text-right py-2 pr-4 font-medium">Price Set</th>
                    <th className="text-right py-2 pr-4 font-medium">Units Sold</th>
                    <th className="text-right py-2 pr-4 font-medium">Revenue</th>
                    <th className="text-right py-2 pr-4 font-medium">Round Profit</th>
                    <th className="text-right py-2 font-medium">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {myHistory.map((r) => (
                    <tr key={r.round_number} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium">Round {r.round_number}</td>
                      <td className="py-2 pr-4 text-right font-mono">${Number(r.price_set).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">{r.units_sold ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{r.revenue != null ? `$${Number(r.revenue).toLocaleString()}` : '—'}</td>
                      <td className={`py-2 pr-4 text-right font-mono ${r.profit != null ? (r.profit >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                        {r.profit != null ? `$${Number(r.profit).toLocaleString()}` : '—'}
                      </td>
                      <td className={`py-2 text-right font-mono font-semibold ${r.cumulative_profit != null ? (r.cumulative_profit >= 0 ? 'text-green-700' : 'text-red-700') : ''}`}>
                        {r.cumulative_profit != null ? `$${Number(r.cumulative_profit).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6 text-center">Final Leaderboard</h3>
          <div className="space-y-3">
            {leaderboard.map((team, idx) => (
              <div
                key={team.team_id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  team.team_name === myTeamName
                    ? 'bg-gradient-to-br from-[#FFF5F5] to-[#FFE5E7] border-[#E63946]'
                    : 'bg-gray-50 border-transparent'
                }`}
              >
                <div className={`text-3xl font-bold font-serif w-10 text-center ${
                  idx === 0 ? 'text-yellow-500' :
                  idx === 1 ? 'text-gray-400' :
                  idx === 2 ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  #{idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">{team.team_name}</p>
                  <p className="text-xs text-gray-500">{team.rounds_played} rounds</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${team.cumulative_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${team.cumulative_profit.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">cumulative profit</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => { window.location.href = '/student/login' }}
            className="px-8 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
