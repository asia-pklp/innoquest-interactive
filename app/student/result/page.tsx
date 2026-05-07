'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface TeamResult {
  team_name: string
  total_balance: number
  funding_stage: string
  successful_rnd_tests: number
  actual_rnd_success_count?: number // Calculated from rnd_tests table
}

export default function ResultPage() {
  const router = useRouter()
  const supabase = createClient()
  const [teamData, setTeamData] = useState<TeamResult | null>(null)
  const [allTeams, setAllTeams] = useState<TeamResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadResults = async () => {
      const teamId = sessionStorage.getItem('team_id')
      const gameId = sessionStorage.getItem('game_id') ?? '00000000-0000-0000-0000-000000000001'
      
      if (!teamId) {
        router.push('/student/login')
        return
      }

      // Load current team data using team_id column
      const { data: team } = await supabase
        .from('teams')
        .select('team_id, team_name, total_balance, funding_stage, successful_rnd_tests')
        .eq('team_id', teamId)
        .single()

      if (!team) {
        console.log('❌ Team not found in database - likely game was reset')
        sessionStorage.clear()
        router.push('/student/login')
        return
      }

      // Calculate actual R&D success count from rnd_tests table
      const { data: rndTests } = await supabase
        .from('rnd_tests')
        .select('success')
        .eq('team_id', teamId)

      const actualRndSuccessCount = rndTests?.filter(test => test.success === true).length || 0

      if (team) {
        setTeamData({
          ...team,
          actual_rnd_success_count: actualRndSuccessCount
        })
      }

      // Load all teams for leaderboard
      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name, total_balance, funding_stage, successful_rnd_tests')
        .eq('game_id', gameId)
        .order('total_balance', { ascending: false })

      if (teams) {
        // Calculate actual R&D success count for each team
        const teamsWithRndCount = await Promise.all(
          teams.map(async (t) => {
            const { data: teamRndTests } = await supabase
              .from('rnd_tests')
              .select('success')
              .eq('team_id', t.team_id)
            
            const actualCount = teamRndTests?.filter(test => test.success === true).length || 0
            return {
              ...t,
              actual_rnd_success_count: actualCount
            }
          })
        )
        setAllTeams(teamsWithRndCount)
      }

      setLoading(false)
    }

    loadResults()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-serif font-bold text-gray-900 mb-4">Loading Results...</div>
        </div>
      </div>
    )
  }

  const teamRank = allTeams.findIndex(t => t.team_name === teamData?.team_name) + 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-10 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl font-serif font-bold mb-3">🏁 Game Complete!</h1>
            <p className="text-xl opacity-90">Final Results</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Team Performance Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-2 border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">{teamData?.team_name}</h2>
            <div className="inline-block bg-gradient-to-br from-[#E63946] to-[#C1121F] text-white px-6 py-2 rounded-full font-semibold text-lg">
              Rank #{teamRank} of {allTeams.length}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-2">Final Balance</div>
              <div className="text-3xl font-bold text-[#E63946]">฿{(teamData?.total_balance || 0).toLocaleString()}</div>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-2">Funding Stage</div>
              <div className="text-3xl font-bold text-gray-900">{teamData?.funding_stage}</div>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-2">R&D Success</div>
              <div className="text-3xl font-bold text-green-600">{teamData?.actual_rnd_success_count ?? teamData?.successful_rnd_tests ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6 text-center">Final Leaderboard</h3>
          <div className="space-y-3">
            {allTeams.map((team, idx) => (
              <div
                key={team.team_name}
                className={`flex items-center gap-6 p-4 rounded-xl transition-all ${
                  team.team_name === teamData?.team_name
                    ? 'bg-gradient-to-br from-[#FFF5F5] to-[#FFE5E7] border-2 border-[#E63946]'
                    : 'bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="min-w-16">
                  <div className={`text-3xl font-bold font-serif ${
                    idx === 0 ? 'text-yellow-500' :
                    idx === 1 ? 'text-gray-400' :
                    idx === 2 ? 'text-orange-600' :
                    'text-gray-600'
                  }`}>
                    #{idx + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">{team.team_name}</p>
                  <p className="text-sm text-gray-600">{team.funding_stage}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#E63946]">฿{(team.total_balance || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Final Balance</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/student/login')}
            className="px-8 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
