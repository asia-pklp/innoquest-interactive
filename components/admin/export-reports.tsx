'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateGameReport, formatReportForPDF } from '@/lib/utils/report-generator'

interface ExportReportsProps {
  gameId: string
  gameType?: string
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ExportReports({ gameId, gameType = 'startup_simulation' }: ExportReportsProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // ── Price War CSV ────────────────────────────────────────────────────────────
  const handlePriceWarCSV = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const supabase = createClient()

      const { data: settings } = await supabase
        .from('game_settings')
        .select('game_name, total_weeks')
        .eq('game_id', gameId)
        .single()

      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name')
        .eq('game_id', gameId)
        .order('team_name')

      const { data: results } = await supabase
        .from('price_war_results')
        .select('team_id, round_number, price_set, units_available, units_sold, revenue, profit, cumulative_profit, submitted_at, calculated_at')
        .eq('game_id', gameId)
        .order('round_number')
        .order('team_id')

      const nameMap: Record<string, string> = {}
      for (const t of teams ?? []) nameMap[t.team_id] = t.team_name

      // Sheet 1: Round-by-round detail
      const header = ['Team', 'Round', 'Price Set', 'Units Available', 'Units Sold', 'Revenue', 'Round Profit', 'Cumulative Profit', 'Submitted At', 'Calculated At']
      const rows = (results ?? []).map((r) => [
        nameMap[r.team_id] ?? r.team_id,
        r.round_number,
        r.price_set,
        r.units_available,
        r.units_sold ?? '',
        r.revenue ?? '',
        r.profit ?? '',
        r.cumulative_profit ?? '',
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '',
        r.calculated_at ? new Date(r.calculated_at).toLocaleString() : '',
      ])

      // Sheet 2: Final leaderboard (last calculated round per team)
      const finalMap: Record<string, { team_name: string; cumulative_profit: number; rounds: number }> = {}
      for (const r of results ?? []) {
        if (r.cumulative_profit != null) {
          finalMap[r.team_id] = {
            team_name: nameMap[r.team_id] ?? r.team_id,
            cumulative_profit: Number(r.cumulative_profit),
            rounds: r.round_number,
          }
        }
      }
      const leaderboard = Object.values(finalMap).sort((a, b) => b.cumulative_profit - a.cumulative_profit)

      let csv = '=== ROUND BY ROUND DETAIL ===\n'
      csv += header.map(escapeCsv).join(',') + '\n'
      csv += rows.map((r) => r.map(escapeCsv).join(',')).join('\n')
      csv += '\n\n=== FINAL LEADERBOARD ===\n'
      csv += 'Rank,Team,Rounds Played,Final Cumulative Profit\n'
      csv += leaderboard.map((t, i) => [i + 1, t.team_name, t.rounds, t.cumulative_profit].map(escapeCsv).join(',')).join('\n')

      const gameName = settings?.game_name ?? 'price-war'
      downloadBlob(csv, `${gameName.replace(/\s+/g, '-')}-results-${Date.now()}.csv`, 'text/csv')
      setMessage('CSV exported successfully.')
    } catch {
      setMessage('Export failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Startup Simulation CSV ───────────────────────────────────────────────────
  const handleStartupCSV = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const supabase = createClient()

      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name, total_balance, funding_stage, successful_rnd_tests')
        .eq('game_id', gameId)
        .order('total_balance', { ascending: false })

      const { data: weeklyResults } = await supabase
        .from('weekly_results')
        .select('team_id, week_number, revenue, expenses, net_profit, balance, funding_stage, rnd_success')
        .eq('game_id', gameId)
        .order('week_number')

      const { data: settings } = await supabase
        .from('game_settings')
        .select('game_name')
        .eq('game_id', gameId)
        .single()

      const nameMap: Record<string, string> = {}
      for (const t of teams ?? []) nameMap[t.team_id] = t.team_name

      let csv = '=== FINAL STANDINGS ===\n'
      csv += 'Rank,Team,Final Balance,Funding Stage,R&D Tests Passed\n'
      csv += (teams ?? []).map((t, i) =>
        [i + 1, t.team_name, t.total_balance, t.funding_stage, t.successful_rnd_tests].map(escapeCsv).join(',')
      ).join('\n')

      csv += '\n\n=== WEEKLY RESULTS ===\n'
      csv += 'Team,Week,Revenue,Expenses,Net Profit,Balance,Funding Stage,R&D Success\n'
      csv += (weeklyResults ?? []).map((r) =>
        [nameMap[r.team_id] ?? r.team_id, r.week_number, r.revenue, r.expenses, r.net_profit, r.balance, r.funding_stage, r.rnd_success ? 'Yes' : 'No'].map(escapeCsv).join(',')
      ).join('\n')

      const gameName = settings?.game_name ?? 'startup-sim'
      downloadBlob(csv, `${gameName.replace(/\s+/g, '-')}-results-${Date.now()}.csv`, 'text/csv')
      setMessage('CSV exported successfully.')
    } catch {
      setMessage('Export failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportText = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const report = await generateGameReport(gameId)
      const content = formatReportForPDF(report)
      downloadBlob(content, `game-report-${gameId}-${Date.now()}.txt`, 'text/plain')
      setMessage('Text report exported successfully.')
    } catch {
      setMessage('Export failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-serif font-bold mb-2">Export Records</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Download game data for analysis. CSV files open in Excel or Google Sheets.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={gameType === 'price_war' ? handlePriceWarCSV : handleStartupCSV}
          disabled={loading}
          className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>📊</span>
          {loading ? 'Exporting...' : 'Export CSV'}
        </button>

        {gameType !== 'price_war' && (
          <button
            onClick={handleExportText}
            disabled={loading}
            className="px-5 py-2.5 bg-secondary text-foreground font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>📄</span>
            {loading ? 'Exporting...' : 'Export Text Report'}
          </button>
        )}
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      <div className="mt-5 text-xs text-muted-foreground space-y-1">
        {gameType === 'price_war' ? (
          <>
            <p>• <strong>Round-by-round detail</strong>: price set, units sold, revenue, profit per team per round</p>
            <p>• <strong>Final leaderboard</strong>: teams ranked by cumulative profit</p>
          </>
        ) : (
          <>
            <p>• <strong>Final standings</strong>: balance, funding stage, R&D tests per team</p>
            <p>• <strong>Weekly results</strong>: full week-by-week breakdown for all teams</p>
          </>
        )}
      </div>
    </div>
  )
}
