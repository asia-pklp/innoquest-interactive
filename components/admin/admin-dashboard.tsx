'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import GameConfiguration from './game-configuration'
import TeamsMonitoring from './teams-monitoring'
import TeamsManagement from './teams-management'
import CustomerDataManagement from './customer-data-management'
import LeaderboardView from './leaderboard-view'
import DashboardMetrics from './dashboard-metrics'
import PerformanceAnalytics from './performance-analytics'
import WeekProgression from './week-progression'
import ExportReports from './export-reports'
import LobbyControl from './lobby-control'

interface AdminDashboardProps {
  onBack: () => void
  gameId?: string
}

export default function AdminDashboard({ onBack, gameId = '00000000-0000-0000-0000-000000000001' }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  // Add refresh trigger for teams management
  const [refreshTeams, setRefreshTeams] = useState(0)

  const handleSettingsUpdated = () => {
    // Trigger teams management to reload
    setRefreshTeams(prev => prev + 1)
  }

  const handleSwitchToTeams = () => {
    setActiveTab('teams')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 text-sm">Manage game sessions and monitor teams</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => window.open('/admin/gameoverview', '_blank')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Game Summary
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-8">
            <TabsTrigger value="lobby">Lobby</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="configuration">Config</TabsTrigger>
            <TabsTrigger value="monitoring">Monitor</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="lobby" className="space-y-6">
            <LobbyControl />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <DashboardMetrics />
            <div className="grid grid-cols-2 gap-6">
              <WeekProgression />
              <LeaderboardView />
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamsManagement key={refreshTeams} gameId={gameId} />
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            <GameConfiguration 
              gameId={gameId} 
              onSettingsUpdated={handleSettingsUpdated}
              onSwitchToTeams={handleSwitchToTeams}
            />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <TeamsMonitoring />
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <CustomerDataManagement gameId={gameId} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ExportReports gameId={gameId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
