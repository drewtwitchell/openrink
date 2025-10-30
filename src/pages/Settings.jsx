import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [message, setMessage] = useState('')
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [playerRecords, setPlayerRecords] = useState([])
  const [playerHistory, setPlayerHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editFormData, setEditFormData] = useState({
    jersey_number: '',
    position: 'player',
    sub_position: ''
  })

  useEffect(() => {
    fetchUserData()
    fetchPlayerHistory()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const freshUser = data.user

        localStorage.setItem('user', JSON.stringify(freshUser))
        setUser(freshUser)
        setFormData({
          name: freshUser.name || '',
          email: freshUser.email || '',
          phone: freshUser.phone || ''
        })

        // Fetch player records for this user
        if (freshUser.id) {
          fetchPlayerRecords(freshUser.id)
        }
      } else {
        const currentUser = auth.getUser()
        setUser(currentUser)
        if (currentUser) {
          setFormData({
            name: currentUser.name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || ''
          })
          fetchPlayerRecords(currentUser.id)
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      const currentUser = auth.getUser()
      setUser(currentUser)
      if (currentUser) {
        setFormData({
          name: currentUser.name || '',
          email: currentUser.email || '',
          phone: currentUser.phone || ''
        })
        fetchPlayerRecords(currentUser.id)
      }
    }
  }

  const fetchPlayerRecords = async (userId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/players`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Filter to only this user's player records
        const userRecords = data.filter(p => p.user_id === userId)
        setPlayerRecords(userRecords)
      }
    } catch (error) {
      console.error('Error fetching player records:', error)
    }
  }

  const fetchPlayerHistory = async () => {
    setLoadingHistory(true)
    try {
      const currentUser = auth.getUser()
      if (!currentUser?.id) return

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/players/user/${currentUser.id}/history`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setPlayerHistory(data)
      }
    } catch (error) {
      console.error('Error fetching player history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Admin', badgeClass: 'badge-primary' },
      player: { label: 'Player', badgeClass: 'badge-neutral' },
    }
    const roleInfo = roles[role] || roles.player
    return (
      <span className={`badge ${roleInfo.badgeClass}`}>
        {roleInfo.label}
      </span>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await auth.updateProfile(formData.name, formData.phone)
      const updatedUser = auth.getUser()
      setUser(updatedUser)
      setMessage('Profile updated successfully!')

      window.dispatchEvent(new Event('profileUpdated'))

      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating profile: ' + error.message)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordMessage('')

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 6) {
      setPasswordMessage('New password must be at least 6 characters')
      return
    }

    try {
      await auth.changePassword(passwordData.current_password, passwordData.new_password)
      setPasswordMessage('Password changed successfully!')
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })

      const currentUser = auth.getUser()
      if (currentUser) {
        currentUser.password_reset_required = 0
        localStorage.setItem('user', JSON.stringify(currentUser))
        setUser(currentUser)
      }

      setTimeout(() => setPasswordMessage(''), 3000)
    } catch (error) {
      setPasswordMessage('Error: ' + error.message)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Present'
    return new Date(dateString).toLocaleDateString()
  }

  const startEditPlayer = (record) => {
    setEditingPlayer(record.id)
    setEditFormData({
      jersey_number: record.jersey_number || '',
      position: record.position === 'goalie' ? 'goalie' : 'player',
      sub_position: record.sub_position || ''
    })
  }

  const cancelEditPlayer = () => {
    setEditingPlayer(null)
    setEditFormData({
      jersey_number: '',
      position: 'player',
      sub_position: ''
    })
  }

  const savePlayerEdit = async (playerId) => {
    try {
      const record = playerRecords.find(p => p.id === playerId)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/players/${playerId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: record.user_id,
            name: record.name,
            email: record.email,
            phone: record.phone,
            jersey_number: editFormData.jersey_number,
            email_notifications: record.email_notifications,
            position: editFormData.position,
            sub_position: editFormData.position === 'player' ? editFormData.sub_position : null
          })
        }
      )

      if (response.ok) {
        // Refresh player records
        if (user?.id) {
          await fetchPlayerRecords(user.id)
        }
        setMessage('Position and jersey updated successfully!')
        setTimeout(() => setMessage(''), 3000)
        cancelEditPlayer()
      } else {
        setMessage('Error updating player information')
      }
    } catch (error) {
      console.error('Error updating player:', error)
      setMessage('Error updating player information')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
      </div>

      {message && (
        <div className={`alert ${message.includes('Error') ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="card mb-6">
        <h2 className="section-header">Account Information</h2>

        <div className="mb-6">
          <div className="text-sm text-gray-600 mb-1">Your Role</div>
          {getRoleBadge(user?.role || 'player')}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              placeholder="your@email.com"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Used for team notifications and roster display</p>
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="(123) 456-7890"
            />
            <p className="text-xs text-gray-500 mt-1">Used for team notifications and roster display</p>
          </div>

          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </form>
      </div>

      {/* Current Teams Section */}
      {playerRecords.length > 0 && (
        <div className="card mb-6">
          <h2 className="section-header">Current Teams</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your position and jersey number are specific to each team. You can update them here.
          </p>
          <div className="space-y-3">
            {playerRecords.map((record) => (
              <div key={record.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                {editingPlayer === record.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="font-semibold text-gray-900">{record.team_name}</div>
                    <div className="text-xs text-gray-500 mb-2">
                      {record.league_name && <span>League: <span className="font-medium">{record.league_name}</span></span>}
                      {record.season_name && (
                        <>
                          {record.league_name && ' • '}
                          <span>Season: <span className="font-medium">{record.season_name}</span></span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Position</label>
                        <select
                          value={editFormData.position}
                          onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value, sub_position: e.target.value === 'goalie' ? '' : editFormData.sub_position })}
                          className="input"
                        >
                          <option value="player">Player</option>
                          <option value="goalie">Goalie</option>
                        </select>
                      </div>

                      {editFormData.position === 'player' && (
                        <div>
                          <label className="label text-xs">Sub-Position</label>
                          <select
                            value={editFormData.sub_position}
                            onChange={(e) => setEditFormData({ ...editFormData, sub_position: e.target.value })}
                            className="input"
                          >
                            <option value="">None</option>
                            <option value="forward">Forward</option>
                            <option value="defense">Defense</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="label text-xs">Jersey Number</label>
                        <input
                          type="text"
                          value={editFormData.jersey_number}
                          onChange={(e) => setEditFormData({ ...editFormData, jersey_number: e.target.value })}
                          className="input"
                          placeholder="e.g., 10"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => savePlayerEdit(record.id)}
                        className="btn-primary btn-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditPlayer}
                        className="btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{record.team_name}</div>
                      <div className="text-xs text-gray-500 mb-1">
                        {record.league_name && <span>League: <span className="font-medium">{record.league_name}</span></span>}
                        {record.season_name && (
                          <>
                            {record.league_name && ' • '}
                            <span>Season: <span className="font-medium">{record.season_name}</span></span>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {record.position === 'goalie' ? 'Goalie' :
                         record.sub_position ? `${record.sub_position.charAt(0).toUpperCase() + record.sub_position.slice(1)}` : 'Player'}
                        {record.jersey_number && ` • #${record.jersey_number}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.is_captain === 1 && (
                        <span className="badge badge-primary">Captain</span>
                      )}
                      <button
                        onClick={() => startEditPlayer(record)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="section-header">Change Password</h2>

        {passwordMessage && (
          <div className={`alert ${passwordMessage.includes('Error') || passwordMessage.includes('not match') ? 'alert-error' : 'alert-success'}`}>
            {passwordMessage}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="input"
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              className="input"
              required
              autoComplete="new-password"
              minLength="6"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              className="input"
              required
              autoComplete="new-password"
              minLength="6"
            />
          </div>

          <button type="submit" className="btn-primary">
            Update Password
          </button>
        </form>
      </div>

      {/* Player History Section */}
      <div className="card mb-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setHistoryExpanded(!historyExpanded)}
        >
          <h2 className="section-header">Player History</h2>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation()
              setHistoryExpanded(!historyExpanded)
            }}
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${historyExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {historyExpanded && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Your complete history across all leagues, seasons, and teams.
            </p>

            {loadingHistory ? (
              <div className="text-center py-8 text-gray-500">Loading history...</div>
            ) : playerHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No player history yet</div>
            ) : (
              <div className="space-y-3">
                {playerHistory.map((record) => (
                  <div key={record.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{record.team_name}</div>
                        <div className="text-xs text-gray-500 mb-1">
                          {record.league_name && <span>League: <span className="font-medium">{record.league_name}</span></span>}
                          {record.season_name && (
                            <>
                              {record.league_name && ' • '}
                              <span>Season: <span className="font-medium">{record.season_name}</span></span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(record.joined_date)}
                        {record.left_date && ` - ${formatDate(record.left_date)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">
                        {record.position === 'goalie' ? 'Goalie' :
                         record.sub_position ? `${record.sub_position.charAt(0).toUpperCase() + record.sub_position.slice(1)}` : 'Player'}
                      </span>
                      {record.jersey_number && (
                        <span className="text-gray-600">• #{record.jersey_number}</span>
                      )}
                      {record.is_captain === 1 && (
                        <span className="badge badge-primary ml-2">Captain</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {user?.role === 'admin' && (
        <div className="card mb-6">
          <h2 className="section-header">Administration</h2>
          <p className="text-gray-600 mb-4">
            As an admin, you have access to system-wide user management.
          </p>
          <button
            onClick={() => navigate('/users')}
            className="btn-primary"
          >
            Manage All Users
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="section-header">About Roles & Permissions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">System Roles</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">Admin:</strong> Full access to all features and settings. Can manage all leagues, teams, users, and system-wide configurations.
              </div>
              <div>
                <strong className="text-gray-900">Player:</strong> Standard user account. Can view schedules, standings, and manage their own player profile.
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Additional Permissions</h3>
            <p className="text-xs text-gray-600 mb-2">These are assigned per-league or per-team, not as system roles:</p>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">League Manager:</strong> Assigned per league. Can manage their assigned leagues, including teams, games, schedules, and payments. Assigned in the league's "Managers" section.
              </div>
              <div>
                <strong className="text-gray-900">Team Captain:</strong> Assigned per team. Can be designated as captain on their team roster. Shown with a captain badge throughout the system.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
