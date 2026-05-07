'use client'

// Game-type-aware gameplay dispatcher.
// Syncs game_type from URL into sessionStorage, then renders the correct gameplay component.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import StudentGameplay from '@/app/student/gameplay/page'
import PriceWarGameplay from '@/components/student/price-war-gameplay'

export default function StudentGameplayTyped() {
  const params = useParams()
  const gameType = params.gameType as string
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (gameType) {
      sessionStorage.setItem('game_type', gameType)
    }
    setReady(true)
  }, [gameType])

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (gameType === 'price_war') {
    return <PriceWarGameplay />
  }

  return <StudentGameplay />
}
