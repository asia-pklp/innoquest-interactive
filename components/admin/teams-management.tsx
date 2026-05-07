'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamSlot {
  id: string | null
  slotNumber: number
  username: string
  password: string
  isEditing: boolean
  exists: boolean
  lastActivity: string | null
  isActive: boolean
  assignedProduct: string | null
}

interface TeamsManagementProps {
  gameId: string
}

export default function TeamsManagement({ gameId }: TeamsManagementProps) {
  const supabase = createClient()
  const [maxTeams, setMaxTeams] = useState(10)
  const [initialCapital, setInitialCapital] = useState(500000)
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [gameType, setGameType] = useState<string>('startup_simulation')

  useEffect(() => {
    loadProducts()
    loadTeamsAndSettings()
  }, [gameId])

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .order('name')
    
    if (data && !error) {
      setProducts(data)
    }
  }

  const loadTeamsAndSettings = async () => {
    const { data: settings } = await supabase
      .from('game_settings')
      .select('max_teams, initial_capital, game_type')
      .eq('game_id', gameId)
      .single()

    const maxTeamsCount = settings?.max_teams || 10
    const initialCapitalValue = settings?.initial_capital || 500000
    setGameType(settings?.game_type ?? 'startup_simulation')
    
    // Validate max teams is between 1 and 10
    if (maxTeamsCount > 10) {
      alert('Error: Maximum teams cannot exceed 10. Please update game configuration.')
      setLoading(false)
      return
    }
    
    setMaxTeams(maxTeamsCount)
    setInitialCapital(initialCapitalValue)

    // Load existing teams with last_activity to check online status
    const { data: teams } = await supabase
      .from('teams')
      .select('team_id, username, password_hash, last_activity, is_active, assigned_product_id')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })

    // Create slots array
    const slots: TeamSlot[] = []
    for (let i = 0; i < maxTeamsCount; i++) {
      if (teams && teams[i]) {
        slots.push({
          id: teams[i].team_id,
          slotNumber: i + 1,
          username: teams[i].username,
          password: teams[i].password_hash,
          isEditing: false,
          exists: true,
          lastActivity: teams[i].last_activity,
          isActive: teams[i].is_active,
          assignedProduct: teams[i].assigned_product_id,
        })
      } else {
        slots.push({
          id: null,
          slotNumber: i + 1,
          username: '',
          password: '',
          isEditing: false,
          exists: false,
          lastActivity: null,
          isActive: false,
          assignedProduct: null,
        })
      }
    }

    setTeamSlots(slots)
    setLoading(false)
  }

  const handleEdit = (index: number) => {
    const newSlots = [...teamSlots]
    newSlots[index].isEditing = true
    setTeamSlots(newSlots)
  }

  const handleSave = async (index: number) => {
    const slot = teamSlots[index]

    if (!slot.username.trim() || !slot.password.trim()) {
      alert('Username and password are required')
      return
    }

    if (slot.exists && slot.id) {
      // Update existing team
      const { error } = await supabase
        .from('teams')
        .update({
          username: slot.username,
          password_hash: slot.password,
        })
        .eq('team_id', slot.id)

      if (error) {
        alert('Error updating team: ' + error.message)
        return
      }
    } else {
      // Create new team
      const { data, error } = await supabase
        .from('teams')
        .insert({
          game_id: gameId,
          team_name: `Team ${slot.slotNumber}`,
          username: slot.username,
          password_hash: slot.password,
          total_balance: initialCapital,
          successful_rnd_tests: 0,
          funding_stage: 'Pre-Seed',
          is_active: true,
          last_activity: null, // Set to null so team shows as "Not Joined" until they log in
          assigned_product_id: slot.assignedProduct, // Include assigned product
        })
        .select('team_id')
        .single()

      if (error) {
        console.error('Full error details:', error)
        alert(`Error creating team: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`)
        return
      }

      slot.id = data.team_id
      slot.exists = true
    }

    slot.isEditing = false
    setTeamSlots([...teamSlots])
    alert('Team saved successfully!')
  }

  const handleCancel = (index: number) => {
    if (!teamSlots[index].exists) {
      // Reset empty slot
      const newSlots = [...teamSlots]
      newSlots[index] = {
        id: null,
        slotNumber: index + 1,
        username: '',
        password: '',
        isEditing: false,
        exists: false,
        lastActivity: null,
        isActive: false,
        assignedProduct: null,
      }
      setTeamSlots(newSlots)
    } else {
      // Cancel edit on existing
      const newSlots = [...teamSlots]
      newSlots[index].isEditing = false
      setTeamSlots(newSlots)
      loadTeamsAndSettings() // Reload to reset changes
    }
  }

  const handleInputChange = (index: number, field: 'username' | 'password', value: string) => {
    const newSlots = [...teamSlots]
    newSlots[index][field] = value
    setTeamSlots(newSlots)
  }

  const handleProductChange = async (index: number, productId: string | null) => {
    const slot = teamSlots[index]
    
    // If in edit mode (creating new team), just update the local state
    if (slot.isEditing || !slot.exists || !slot.id) {
      const newSlots = [...teamSlots]
      newSlots[index].assignedProduct = productId
      setTeamSlots(newSlots)
      return
    }

    // If team exists, update the database
    const { error } = await supabase
      .from('teams')
      .update({ assigned_product_id: productId })
      .eq('team_id', slot.id)

    if (error) {
      alert('Error assigning product: ' + error.message)
      return
    }

    const newSlots = [...teamSlots]
    newSlots[index].assignedProduct = productId
    setTeamSlots(newSlots)
  }

  if (loading) {
    return <div className="p-4">Loading teams...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold">Team Management</h2>
        <p className="text-gray-600 mt-1">Configure up to {maxTeams} teams for the game</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Username</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900">Password</th>
              {gameType !== 'price_war' && (
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Assigned Product</th>
              )}
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900">Edit/Confirm</th>
            </tr>
          </thead>
          <tbody>
            {teamSlots.map((slot, index) => (
              <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="font-semibold text-gray-700">Team {slot.slotNumber}</span>
                </td>
                <td className="py-3 px-4">
                  {slot.isEditing ? (
                    <input
                      type="text"
                      value={slot.username}
                      onChange={(e) => handleInputChange(index, 'username', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E63946]"
                      placeholder="Enter username"
                    />
                  ) : (
                    <span className="font-mono text-gray-900">
                      {slot.username || <span className="text-gray-400">Not set</span>}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {slot.isEditing ? (
                    <input
                      type="text"
                      value={slot.password}
                      onChange={(e) => handleInputChange(index, 'password', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E63946]"
                      placeholder="Enter password"
                    />
                  ) : (
                    <span className="font-mono text-gray-900">
                      {slot.password || <span className="text-gray-400">Not set</span>}
                    </span>
                  )}
                </td>
                {gameType !== 'price_war' && (
                  <td className="py-3 px-4">
                    <select
                      value={slot.assignedProduct || ''}
                      onChange={(e) => handleProductChange(index, e.target.value || null)}
                      disabled={!slot.isEditing && !slot.exists}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E63946] bg-white disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Not Assigned</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="py-3 px-4 text-center">
                  {slot.exists ? (
                    (() => {
                      // Check if team has logged in (has last_activity)
                      const hasLoggedIn = slot.lastActivity !== null
                      
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          hasLoggedIn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            hasLoggedIn ? 'bg-green-500' : 'bg-gray-400'
                          }`}></span>
                          {hasLoggedIn ? 'Joined' : 'Not Joined'}
                        </span>
                      )
                    })()
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {slot.isEditing ? (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleSave(index)}
                        className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleCancel(index)}
                        className="px-4 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(index)}
                      className="px-4 py-1.5 bg-[#E63946] text-white rounded-lg hover:bg-[#C1121F] text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Click "Edit" to set or modify team credentials. Click "Confirm" to save changes.
          Teams will be created automatically when you save their credentials.
        </p>
      </div>
    </div>
  )
}
