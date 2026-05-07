'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This flat route is superseded by /admin/game/[gameId]/lobby.
// Redirect admins to the Game Hub so they pick which game's lobby to manage.
export default function AdminLobbyRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Game Hub...</p>
    </div>
  )
}
