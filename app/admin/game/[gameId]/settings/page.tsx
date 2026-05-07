'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminHeader from '@/components/admin/admin-header'
import GameConfiguration from '@/components/admin/game-configuration'
import TeamsManagement from '@/components/admin/teams-management'
import CustomerDataManagement from '@/components/admin/customer-data-management'
import ExportReports from '@/components/admin/export-reports'
import PriceWarScenarioEditor from '@/components/admin/price-war-scenario-editor'
import PriceWarScenarioLibrary from '@/components/admin/price-war-scenario-library'
import PriceWarConfiguration from '@/components/admin/price-war-configuration'
import Link from 'next/link'

type TabType = 'config' | 'teams' | 'scenario_library' | 'scenarios' | 'customers' | 'reports'

export default function PerGameSettings() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.gameId as string

  const [activeTab, setActiveTab] = useState<TabType>('config')
  const [gameName, setGameName] = useState<string>('')
  const [gameType, setGameType] = useState<string>('startup_simulation')
  const [loading, setLoading] = useState(true)

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
        setGameName(data?.game_name ?? 'Game Settings')
        setGameType(data?.game_type ?? 'startup_simulation')
        setLoading(false)
      })
  }, [gameId, router])

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminUsername')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const isPriceWar = gameType === 'price_war'

  const tabs: { id: TabType; label: string; show: boolean }[] = [
    { id: 'config', label: 'Game Configuration', show: true },
    { id: 'teams', label: 'Teams & Credentials', show: true },
    { id: 'scenario_library', label: 'Scenario Library', show: isPriceWar },
    { id: 'scenarios', label: 'Scenario Queue', show: isPriceWar },
    { id: 'customers', label: 'Customer Data', show: !isPriceWar },
    { id: 'reports', label: 'Export Reports', show: true },
  ]

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Game Hub
              </Link>
            </div>
            <h1 className="text-4xl font-serif font-bold mb-1">{gameName}</h1>
            <p className="text-muted-foreground">Configure teams, settings, and game parameters</p>
          </div>
          <div className="flex gap-3">
            {!isPriceWar && (
              <button
                onClick={() => window.open(`/admin/summary?gameId=${gameId}`, '_blank')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Game Summary
              </button>
            )}
            <Link href={`/admin/game/${gameId}/lobby`}>
              <button className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Go to Gameplay Control
              </button>
            </Link>
          </div>
        </div>

        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === 'config' && (
            isPriceWar
              ? <PriceWarConfiguration gameId={gameId} />
              : <GameConfiguration gameId={gameId} />
          )}
          {activeTab === 'teams' && <TeamsManagement gameId={gameId} />}
          {activeTab === 'scenario_library' && isPriceWar && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">Scenario Library</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Pre-create reusable scenario cards. Load them into specific rounds via the Scenario Queue.
                  </p>
                </div>
              </div>
              <PriceWarScenarioLibrary gameId={gameId} />
            </div>
          )}
          {activeTab === 'scenarios' && isPriceWar && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-1 h-8 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full"></div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-gray-900">Scenario Queue</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Pre-load market events that fire at the start of each round. Changes automatically apply to game parameters.
                  </p>
                </div>
              </div>
              <PriceWarScenarioEditor gameId={gameId} />
            </div>
          )}
          {activeTab === 'customers' && !isPriceWar && <CustomerDataManagement gameId={gameId} />}
          {activeTab === 'reports' && <ExportReports gameId={gameId} gameType={gameType} />}
        </div>
      </div>
    </div>
  )
}
