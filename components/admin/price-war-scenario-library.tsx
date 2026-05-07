'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  title: string
  description: string | null
  param_overrides: Record<string, number>
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
  title: '',
  description: '',
  param_overrides: {} as Record<string, string>,
}

interface Props {
  gameId: string
}

export default function PriceWarScenarioLibrary({ gameId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [totalRounds, setTotalRounds] = useState(5)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Preload modal state
  const [preloadTarget, setPreloadTarget] = useState<Template | null>(null)
  const [assignRound, setAssignRound] = useState(1)
  const [preloading, setPreloading] = useState(false)
  const [preloadMsg, setPreloadMsg] = useState<string | null>(null)

  const load = async () => {
    const supabase = createClient()
    const [{ data: settings }, { data: rows }] = await Promise.all([
      supabase.from('game_settings').select('total_weeks').eq('game_id', gameId).single(),
      supabase.from('scenario_templates').select('*').order('created_at'),
    ])
    setTotalRounds(settings?.total_weeks ?? 5)
    setTemplates(rows ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [gameId])

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
      title: form.title.trim(),
      description: form.description.trim() || null,
      param_overrides: overrides,
      updated_at: new Date().toISOString(),
    }

    const { error: err } = editing
      ? await supabase.from('scenario_templates').update(payload).eq('id', editing)
      : await supabase.from('scenario_templates').insert(payload)

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
    await supabase.from('scenario_templates').delete().eq('id', id)
    await load()
  }

  const handlePreload = async () => {
    if (!preloadTarget) return
    setPreloading(true)
    setPreloadMsg(null)

    const supabase = createClient()
    const payload = {
      game_id: gameId,
      round_number: assignRound,
      title: preloadTarget.title,
      description: preloadTarget.description,
      param_overrides: preloadTarget.param_overrides,
      updated_at: new Date().toISOString(),
    }

    const { error: err } = await supabase
      .from('price_war_scenarios')
      .upsert(payload, { onConflict: 'game_id,round_number' })

    if (err) {
      setPreloadMsg(`Error: ${err.message}`)
    } else {
      setPreloadMsg(`✓ "${preloadTarget.title}" loaded into Round ${assignRound}`)
      setTimeout(() => {
        setPreloadTarget(null)
        setPreloadMsg(null)
      }, 2000)
    }
    setPreloading(false)
  }

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1)

  if (loading) return <p className="text-muted-foreground text-sm">Loading library...</p>

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create reusable scenario cards here. Once ready, assign them to specific rounds in the <strong>Scenario Queue</strong> tab — or use the <strong>Load to Game</strong> button below.
      </p>

      {/* Template list */}
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No templates yet. Add one below.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  {t.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                  )}
                  {Object.keys(t.param_overrides).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(t.param_overrides).map(([k, v]) => (
                        <span key={k} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          {PARAM_LABELS[k] ?? k}: {k.includes('cost') || k.includes('price') ? `$${Number(v).toLocaleString()}` : v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 items-start">
                  <button
                    onClick={() => { setPreloadTarget(t); setAssignRound(1); setPreloadMsg(null) }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Load to Game
                  </button>
                  <button
                    onClick={() => {
                      setEditing(t.id)
                      setForm({
                        title: t.title,
                        description: t.description ?? '',
                        param_overrides: Object.fromEntries(
                          Object.entries(t.param_overrides).map(([k, v]) => [k, String(v)])
                        ),
                      })
                      setError(null)
                    }}
                    className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preload modal */}
      {preloadTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Load to Scenario Queue</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assign <strong>"{preloadTarget.title}"</strong> to a round in this game.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Round</label>
              <select
                value={assignRound}
                onChange={(e) => setAssignRound(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {roundOptions.map((r) => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This will overwrite any existing scenario for that round.
              </p>
            </div>
            {preloadMsg && (
              <p className={`text-sm mb-3 ${preloadMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {preloadMsg}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setPreloadTarget(null); setPreloadMsg(null) }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePreload}
                disabled={preloading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {preloading ? 'Loading...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit form */}
      <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50">
        <h4 className="font-semibold text-gray-800 mb-4">
          {editing ? 'Edit Template' : 'New Scenario Template'}
        </h4>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Supply Chain Crisis!"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Description (shown to students)</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the market event..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Parameter Changes <span className="text-xs">(leave blank to keep game defaults)</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(PARAM_LABELS).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
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
              {saving ? 'Saving...' : editing ? 'Update Template' : 'Add Template'}
            </button>
            {editing ? (
              <button
                onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-white"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setForm(EMPTY_FORM)}
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
