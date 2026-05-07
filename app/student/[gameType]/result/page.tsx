'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ResultPage from '@/app/student/result/page'

export default function StudentResultTyped() {
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
      <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8D5D0] flex items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    )
  }

  return <ResultPage />
}
