'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from '@/components/admin/admin-header'
import LobbyControl from '@/components/admin/lobby-control'
import WeekProgression from '@/components/admin/week-progression'
import GameMonitoring from '@/components/admin/game-monitoring'
import PriceWarRoundControl from '@/components/admin/price-war-round-control'
import Link from 'next/link'

export default function PerGameLobby() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.gameId as string

  const [gameName, setGameName] = useState<string>('')
  const [gameType, setGameType] = useState<string>('startup_simulation')
  const [killing, setKilling] = useState(false)
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [killMessage, setKillMessage] = useState<string | null>(null)

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn')
    if (!adminLoggedIn || adminLoggedIn !== 'true') {
      router.push('/admin/login')
      return
    }

    const supabase = createClient()
    supabase
      .from('game_settings')
      .select('game_name, game_type')
      .eq('game_id', gameId)
      .single()
      .then(({ data }) => {
        setGameName(data?.game_name ?? 'Gameplay Control')
        setGameType(data?.game_type ?? 'startup_simulation')
      })
  }, [gameId, router])

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminUsername')
    router.push('/')
  }

  const handleKillGame = async () => {
    setKilling(true)
    setKillMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('game_settings')
        .update({ game_status: 'completed' })
        .eq('game_id', gameId)

      if (error) {
        setKillMessage(`Error: ${error.message}`)
      } else {
        setKillMessage('Game has been ended.')
      }
    } catch {
      setKillMessage('Failed to end game.')
    } finally {
      setKilling(false)
      setShowKillConfirm(false)
    }
  }

  const isPriceWar = gameType === 'price_war'

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onLogout={handleLogout} />

      {/* Kill Game Confirmation Modal */}
      {showKillConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-200">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">☠️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Kill Game?</h2>
              <p className="text-gray-600 text-sm">
                This will immediately end the game and mark it as <strong>completed</strong>.
                This action <strong>cannot be undone</strong>.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKillConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKillGame}
                disabled={killing}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {killing ? 'Ending...' : 'Yes, Kill Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Game Hub
              </Link>
              <span className="text-muted-foreground">/</span>
              <Link href={`/admin/game/${gameId}/settings`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {gameName}
              </Link>
            </div>
            <h1 className="text-4xl font-serif font-bold mb-2">Gameplay Control</h1>
            <p className="text-muted-foreground">
              {isPriceWar ? 'Manage lobby and round progression' : 'Manage lobby, week progression, and live monitoring'}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {isPriceWar && (
              <button
                onClick={() => window.open(`/admin/game/${gameId}/projector`, '_blank')}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 border border-gray-700"
              >
                🖥 Projector
              </button>
            )}
            {!isPriceWar && (
              <button
                onClick={() => window.open(`/admin/summary?gameId=${gameId}`, '_blank')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Game Summary
              </button>
            )}
            {isPriceWar && (
              <button
                onClick={() => window.open(`/admin/summary?gameId=${gameId}`, '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                📊 Summary
              </button>
            )}
            <Link href={`/admin/game/${gameId}/settings`}>
              <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Go to Game Settings
              </button>
            </Link>
            <button
              onClick={() => setShowKillConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold border border-red-700 shadow-sm"
            >
              ☠️ Kill Game
            </button>
          </div>
        </div>

        {killMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${killMessage.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {killMessage}
          </div>
        )}

        <div className="space-y-8">
          {/* Lobby control — shared across all game types */}
          <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="w-1 h-8 bg-gradient-to-b from-[#E63946] to-[#C1121F] rounded-full"></div>
              <h2 className="text-2xl font-serif font-bold text-gray-900">Game Lobby</h2>
            </div>
            <LobbyControl gameId={gameId} />
          </section>

          {isPriceWar ? (
            <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-full"></div>
                <h2 className="text-2xl font-serif font-bold text-gray-900">Round Control ⚔️</h2>
              </div>
              <PriceWarRoundControl gameId={gameId} />
            </section>
          ) : (
            <>
              <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-full"></div>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">Week Progression</h2>
                </div>
                <WeekProgression gameId={gameId} />
              </section>

              <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-700 rounded-full"></div>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">Live Monitoring</h2>
                </div>
                <GameMonitoring gameId={gameId} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

