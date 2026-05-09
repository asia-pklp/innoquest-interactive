'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from '@/components/admin/admin-header'
import Link from 'next/link'
import { listGameTypes, getGameDefinition } from '@/lib/game-registry'

interface GameInstance {
  game_id: string
  game_name: string
  game_type: string
  game_status: string
  current_week: number
  total_weeks: number
  team_count: number
}

const STATUS_STYLES: Record<string, string> = {
  setup:     'bg-gray-100 text-gray-700',
  lobby:     'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  completed: 'bg-purple-100 text-purple-700',
}

export default function AdminDashboard() {
  const router = useRouter()
  const [games, setGames] = useState<GameInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showArchive, setShowArchive] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn')
    if (!adminLoggedIn || adminLoggedIn !== 'true') {
      router.push('/admin/login')
      return
    }
    loadGames()
  }, [router])

  const loadGames = async () => {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('game_settings')
      .select('game_id, game_name, game_type, game_status, current_week, total_weeks')
      .order('game_id')

    if (rows) {
      const withCounts = await Promise.all(
        rows.map(async (row) => {
          const { count } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', row.game_id)
          return {
            ...row,
            game_name: row.game_name ?? 'InnoQuest Game',
            game_type: row.game_type ?? 'startup_simulation',
            team_count: count ?? 0,
          }
        })
      )
      setGames(withCounts)
    }
    setLoading(false)
  }

  const handleKillGame = async (gameId: string, gameName: string) => {
    if (!window.confirm(`Force-end "${gameName}"? This will set the game to completed.`)) return
    const supabase = createClient()
    await supabase.from('game_settings').update({ game_status: 'completed' }).eq('game_id', gameId)
    setGames((prev) => prev.map((g) => g.game_id === gameId ? { ...g, game_status: 'completed' } : g))
  }

  const handleDeleteGame = async (gameId: string, gameName: string, gameType: string) => {
    if (!window.confirm(`Delete "${gameName}" permanently? This cannot be undone.`)) return
    setDeletingId(gameId)
    const supabase = createClient()
    if (gameType === 'price_war') {
      await supabase.from('price_war_results').delete().eq('game_id', gameId)
      await supabase.from('price_war_scenarios').delete().eq('game_id', gameId)
    } else {
      await supabase.from('weekly_results').delete().eq('game_id', gameId)
      await supabase.from('customer_purchase_probabilities').delete().eq('game_id', gameId)
    }
    await supabase.from('teams').delete().eq('game_id', gameId)
    await supabase.from('game_settings').delete().eq('game_id', gameId)
    setGames((prev) => prev.filter((g) => g.game_id !== gameId))
    setDeletingId(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminUsername')
    sessionStorage.removeItem('current_game_id')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">Game Hub</h1>
            <p className="text-muted-foreground">Create and manage all game sessions across all game types</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all"
          >
            + Create New Game
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading games...</div>
        ) : (() => {
          const activeGames = games.filter((g) => g.game_status !== 'completed')
          const archivedGames = games.filter((g) => g.game_status === 'completed')

          const GameCard = ({ game, dimmed = false }: { game: GameInstance; dimmed?: boolean }) => {
            const def = getGameDefinition(game.game_type)
            const statusStyle = STATUS_STYLES[game.game_status] ?? STATUS_STYLES.setup
            const isCompleted = game.game_status === 'completed'
            const isDeleting = deletingId === game.game_id
            return (
              <div key={game.game_id} className={`bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col gap-4 ${dimmed ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-2xl mb-1">{def?.icon ?? '🎮'}</div>
                    <h3 className="text-xl font-bold text-gray-900 truncate">{game.game_name}</h3>
                    <p className="text-sm text-gray-500">{def?.name ?? game.game_type}</p>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusStyle}`}>
                    {game.game_status}
                  </span>
                </div>

                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-gray-500">Round</p>
                    <p className="font-semibold">{game.current_week} / {game.total_weeks}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Teams</p>
                    <p className="font-semibold">{game.team_count}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                  <Link href={`/admin/game/${game.game_id}/settings`} className="flex-1">
                    <button className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all">
                      ⚙ Settings
                    </button>
                  </Link>
                  {!isCompleted && (
                    <Link href={`/admin/game/${game.game_id}/lobby`} className="flex-1">
                      <button className="w-full py-2 px-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all">
                        🎮 Lobby
                      </button>
                    </Link>
                  )}
                  <button
                    onClick={() => window.open(`/admin/summary?gameId=${game.game_id}`, '_blank')}
                    title="Open game summary"
                    className="py-2 px-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold transition-all"
                  >
                    📊
                  </button>
                  {!isCompleted && (
                    <button
                      onClick={() => handleKillGame(game.game_id, game.game_name)}
                      title="Force-end this game"
                      className="py-2 px-3 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-semibold transition-all"
                    >
                      ⏹
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGame(game.game_id, game.game_name, game.game_type)}
                    disabled={isDeleting}
                    title="Delete this game permanently"
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {isDeleting ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            )
          }

          return (
            <>
              {/* Active games */}
              {activeGames.length === 0 && archivedGames.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4">🎮</div>
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">No games yet</h2>
                  <p className="text-gray-500 mb-6">Create your first game session to get started</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-primary text-white rounded-lg font-semibold"
                  >
                    + Create New Game
                  </button>
                </div>
              ) : activeGames.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg">No active games. Create a new one!</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activeGames.map((game) => <GameCard key={game.game_id} game={game} />)}
                </div>
              )}

              {/* Archive */}
              {archivedGames.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">🗄️ Archive — {archivedGames.length} Completed Game{archivedGames.length !== 1 ? 's' : ''}</h2>
                      <button
                        onClick={() => setShowArchive((v) => !v)}
                        className="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 font-medium transition-all"
                      >
                        {showArchive ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  {showArchive && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {archivedGames.map((game) => <GameCard key={game.game_id} game={game} dimmed />)}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}
      </div>

      {showCreateModal && (
        <CreateGameModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(gameId) => {
            setShowCreateModal(false)
            loadGames()
            router.push(`/admin/game/${gameId}/settings`)
          }}
        />
      )}
    </div>
  )
}

function CreateGameModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (gameId: string) => void
}) {
  const [gameType, setGameType] = useState('startup_simulation')
  const [gameName, setGameName] = useState('')
  const [creating, setCreating] = useState(false)
  const gameTypes = listGameTypes()

  const handleCreate = async () => {
    if (!gameName.trim()) {
      alert('Please enter a game name')
      return
    }
    setCreating(true)

    const supabase = createClient()
    const def = getGameDefinition(gameType)
    if (!def) {
      alert('Unknown game type')
      setCreating(false)
      return
    }

    const newGameId = crypto.randomUUID()
    const s = def.defaultSettings

    // Build insert payload — only include fields that exist for this game type
    const payload: Record<string, unknown> = {
      game_id: newGameId,
      game_type: gameType,
      game_name: gameName.trim(),
      game_status: 'setup',
      current_week: 1,
      total_weeks: s.total_weeks,
      week_duration_minutes: s.week_duration_minutes,
      max_teams: s.max_teams,
    }

    if (s.game_config !== undefined) payload.game_config = s.game_config
    if (s.population_size !== undefined) payload.population_size = s.population_size
    if (s.initial_capital !== undefined) payload.initial_capital = s.initial_capital
    if (s.analytics_cost !== undefined) payload.analytics_cost = s.analytics_cost
    if (s.rnd_tier_config !== undefined) payload.rnd_tier_config = s.rnd_tier_config
    if (s.investment_config !== undefined) payload.investment_config = s.investment_config

    const { error } = await supabase.from('game_settings').insert(payload)

    if (error) {
      alert('Failed to create game: ' + error.message)
      setCreating(false)
      return
    }

    onCreated(newGameId)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-6">Create New Game</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Game Type</label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {gameTypes.map((gt) => (
                <option key={gt.id} value={gt.id}>
                  {gt.icon} {gt.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {getGameDefinition(gameType)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Game Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Class A – Spring 2025"
              className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-border rounded-lg font-medium hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {creating ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  )
}
