'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PriceWarSettings {
  total_weeks: number
  week_duration_minutes: number
  max_teams: number
  game_status: string
  current_week: number
  game_config: {
    total_customers: number
    products_per_team: number
    fixed_cost: number
    variable_cost: number
    min_price: number
    max_price: number
  }
}

interface Props {
  gameId: string
}

const DEFAULT_CONFIG = {
  total_customers: 10,
  products_per_team: 5,
  fixed_cost: 1000,
  variable_cost: 0,
  min_price: 1,
  max_price: 9999,
}

export default function PriceWarConfiguration({ gameId }: Props) {
  const [settings, setSettings] = useState<PriceWarSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state — top-level
  const [totalRounds, setTotalRounds] = useState(5)
  const [roundDuration, setRoundDuration] = useState(5)
  const [maxTeams, setMaxTeams] = useState(8)

  // Game config state
  const [totalCustomers, setTotalCustomers] = useState(10)
  const [productsPerTeam, setProductsPerTeam] = useState(5)
  const [fixedCost, setFixedCost] = useState(1000)
  const [variableCost, setVariableCost] = useState(0)
  const [minPrice, setMinPrice] = useState(1)
  const [maxPrice, setMaxPrice] = useState(9999)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('game_settings')
      .select('total_weeks, week_duration_minutes, max_teams, game_status, current_week, game_config')
      .eq('game_id', gameId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setLoading(false); return }
        setSettings(data as PriceWarSettings)

        setTotalRounds(data.total_weeks ?? 5)
        setRoundDuration(data.week_duration_minutes ?? 5)
        setMaxTeams(data.max_teams ?? 8)

        const cfg = data.game_config ?? DEFAULT_CONFIG
        setTotalCustomers(cfg.total_customers ?? 10)
        setProductsPerTeam(cfg.products_per_team ?? 5)
        setFixedCost(cfg.fixed_cost ?? 1000)
        setVariableCost(cfg.variable_cost ?? 0)
        setMinPrice(cfg.min_price ?? 1)
        setMaxPrice(cfg.max_price ?? 9999)

        setLoading(false)
      })
  }, [gameId])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('game_settings')
      .update({
        total_weeks: totalRounds,
        week_duration_minutes: roundDuration,
        max_teams: maxTeams,
        game_config: {
          total_customers: totalCustomers,
          products_per_team: productsPerTeam,
          fixed_cost: fixedCost,
          variable_cost: variableCost,
          min_price: minPrice,
          max_price: maxPrice,
        },
      })
      .eq('game_id', gameId)

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>
  if (!settings) return <p className="text-red-500">Failed to load game settings.</p>

  const isActive = settings.game_status === 'active'
  const breakEven = productsPerTeam > 0
    ? ((fixedCost + variableCost * productsPerTeam) / productsPerTeam).toFixed(2)
    : '—'
  const totalUnits = productsPerTeam * maxTeams

  return (
    <div className="space-y-8">

      {isActive && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Game is currently active. Changes will take effect from the next round.
        </div>
      )}

      {/* Game structure */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
          Game Structure
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Rounds</label>
            <input
              type="number"
              min={1}
              max={20}
              value={totalRounds}
              onChange={(e) => setTotalRounds(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">How many rounds teams will play</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Round Duration (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={roundDuration}
              onChange={(e) => setRoundDuration(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">Time limit per round for teams to submit</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Teams</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxTeams}
              onChange={(e) => setMaxTeams(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Market parameters */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-green-500 rounded-full inline-block"></span>
          Market Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customers in Market</label>
            <input
              type="number"
              min={1}
              value={totalCustomers}
              onChange={(e) => setTotalCustomers(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total customers that shop each round. They buy from the cheapest store first.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Units per Team</label>
            <input
              type="number"
              min={1}
              value={productsPerTeam}
              onChange={(e) => setProductsPerTeam(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Units each team gets to sell per round. Total supply: {totalUnits} units across {maxTeams} teams.
            </p>
          </div>
        </div>
      </section>

      {/* Costs */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-red-500 rounded-full inline-block"></span>
          Costs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Cost per Round ($)</label>
            <input
              type="number"
              min={0}
              value={fixedCost}
              onChange={(e) => setFixedCost(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Applied every round regardless of sales (rent, salaries, etc.)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variable Cost per Unit ($)</label>
            <input
              type="number"
              min={0}
              value={variableCost}
              onChange={(e) => setVariableCost(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cost to produce each unit upfront. Set to 0 to disable. Total variable cost: ${(variableCost * productsPerTeam).toLocaleString()} per team.
            </p>
          </div>
        </div>
      </section>

      {/* Price range */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-purple-500 rounded-full inline-block"></span>
          Price Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Price ($)</label>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Price ($)</label>
            <input
              type="number"
              min={1}
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Live summary card */}
      <section className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Round Economics Preview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Total Cost / Team</p>
            <p className="font-bold text-gray-900">${(fixedCost + variableCost * productsPerTeam).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Break-Even Price</p>
            <p className="font-bold text-gray-900">${breakEven} / unit</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Max Possible Revenue</p>
            <p className="font-bold text-gray-900">${(maxPrice * productsPerTeam).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Supply vs Demand</p>
            <p className={`font-bold ${totalUnits > totalCustomers ? 'text-amber-600' : 'text-green-600'}`}>
              {totalUnits} units / {totalCustomers} customers
              {totalUnits > totalCustomers
                ? ` — ${totalUnits - totalCustomers} surplus`
                : ` — undersupplied`}
            </p>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </div>
  )
}
