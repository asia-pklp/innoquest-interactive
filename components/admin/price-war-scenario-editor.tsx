'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Scenario {
  id: string
  round_number: number
  title: string
  description: string | null
  param_overrides: Record<string, number>
}

interface GameConfig {
  total_customers?: number
  products_per_team?: number
  fixed_cost?: number
  variable_cost?: number
  min_price?: number
  max_price?: number
}

const PARAM_LABELS: Record<string, string> = {
  total_customers: 'Total Customers',
  products_per_team: 'Units per Team',
  fixed_cost: 'Fixed Cost ($)',
  variable_cost: 'Variable Cost ($/unit)',
  min_price: 'Min Price ($)',
  max_price: 'Max Price ($)',
}

const EMPTY_FORM = {
  round_number: 2,
  title: '',
  description: '',
  param_overrides: {} as Record<string, string>,
}

interface Props {
  gameId: string
}

export default function PriceWarScenarioEditor({ gameId }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [totalRounds, setTotalRounds] = useState<number>(5)
  const [baseConfig, setBaseConfig] = useState<GameConfig>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const supabase = createClient()
    const { data: settings } = await supabase
      .from('game_settings')
      .select('total_weeks, game_config')
      .eq('game_id', gameId)
      .single()

    if (settings) {
      setTotalRounds(settings.total_weeks ?? 5)
      setBaseConfig(settings.game_config ?? {})
    }

    const { data: rows } = await supabase
      .from('price_war_scenarios')
      .select('*')
      .eq('game_id', gameId)
      .order('round_number')

    setScenarios(rows ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [gameId])

  const startNew = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, round_number: 2 })
    setError(null)
  }

  const startEdit = (s: Scenario) => {
    setEditing(s.id)
    setForm({
      round_number: s.round_number,
      title: s.title,
      description: s.description ?? '',
      param_overrides: Object.fromEntries(
        Object.entries(s.param_overrides).map(([k, v]) => [k, String(v)])
      ),
    })
    setError(null)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)

    const overrides: Record<string, number> = {}
    for (const [k, v] of Object.entries(form.param_overrides)) {
      const n = parseFloat(v)
      if (!isNaN(n)) overrides[k] = n
    }

    const supabase = createClient()
    const payload = {
      game_id: gameId,
      round_number: form.round_number,
      title: form.title.trim(),
      description: form.description.trim() || null,
      param_overrides: overrides,
      updated_at: new Date().toISOString(),
    }

    let err: any
    if (editing) {
      const res = await supabase
        .from('price_war_scenarios')
        .update(payload)
        .eq('id', editing)
      err = res.error
    } else {
      const res = await supabase
        .from('price_war_scenarios')
        .upsert(payload, { onConflict: 'game_id,round_number' })
      err = res.error
    }

    if (err) {
      setError(err.message)
    } else {
      setEditing(null)
      setForm(EMPTY_FORM)
      await load()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('price_war_scenarios').delete().eq('id', id)
    await load()
  }

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1)

  if (loading) return <p className="text-muted-foreground text-sm">Loading scenarios...</p>

  return (
    <div className="space-y-6">
      {/* Existing scenarios */}
      {scenarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scenarios queued. Add one below to surprise teams mid-game.</p>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div key={s.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Round {s.round_number}
                    </span>
                    <span className="font-semibold text-gray-900">{s.title}</span>
                  </div>
                  {s.description && (
                    <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
                  )}
                  {Object.keys(s.param_overrides).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(s.param_overrides).map(([k, v]) => (
                        <span key={k} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          {PARAM_LABELS[k] ?? k}: {typeof v === 'number' && k.includes('cost') ? `$${v.toLocaleString()}` : v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(s)}
                    className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50">
        <h4 className="font-semibold text-gray-800 mb-4">
          {editing ? 'Edit Scenario' : 'Add Scenario'}
        </h4>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Fires at Round Start</label>
              <select
                value={form.round_number}
                onChange={(e) => setForm({ ...form, round_number: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {roundOptions.map((r) => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Event Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Supply Chain Crisis!"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Narrative Description (shown to students)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened in the market..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Parameter Changes <span className="text-xs">(leave blank to keep current value)</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(PARAM_LABELS).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {label}
                    {baseConfig[key as keyof GameConfig] !== undefined && (
                      <span className="ml-1 text-gray-400">
                        (now: {key.includes('cost') ? `$${Number(baseConfig[key as keyof GameConfig]).toLocaleString()}` : baseConfig[key as keyof GameConfig]})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={form.param_overrides[key] ?? ''}
                    onChange={(e) => setForm({
                      ...form,
                      param_overrides: { ...form.param_overrides, [key]: e.target.value },
                    })}
                    placeholder="—"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : editing ? 'Update Scenario' : 'Add Scenario'}
            </button>
            {editing && (
              <button
                onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-white"
              >
                Cancel
              </button>
            )}
            {!editing && (
              <button
                onClick={startNew}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-white"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
