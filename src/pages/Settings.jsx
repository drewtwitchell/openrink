import { useState, useEffect } from 'react'
import { auth } from '../lib/api'

export default function Settings() {
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })
  const [message, setMessage] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [showUserManagement, setShowUserManagement] = useState(false)

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
      })
      if (currentUser.role === 'admin') {
        fetchAllUsers()
      }
    }
  }, [])

  const fetchAllUsers = async () => {
    try {
      const users = await auth.getAllUsers()
      setAllUsers(users)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Admin', color: 'bg-purple-100 text-purple-800' },
      league_manager: { label: 'League Manager', color: 'bg-blue-100 text-blue-800' },
      team_captain: { label: 'Team Captain', color: 'bg-green-100 text-green-800' },
      player: { label: 'Player', color: 'bg-gray-100 text-gray-800' },
    }
    const roleInfo = roles[role] || roles.player
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color}`}>
        {roleInfo.label}
      </span>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await auth.updateProfile(formData.name)
      const updatedUser = auth.getUser()
      setUser(updatedUser)
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating profile: ' + error.message)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await auth.updateUserRole(userId, newRole)
      setMessage('Role updated successfully!')
      fetchAllUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating role: ' + error.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>

        <div className="mb-6">
          <div className="text-sm text-gray-600 mb-1">Your Role</div>
          {getRoleBadge(user?.role || 'player')}
        </div>

        {message && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded">
            {message}
          </div>
        )}

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
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </form>
      </div>

      {user?.role === 'admin' && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">User Management</h2>
            <button
              onClick={() => setShowUserManagement(!showUserManagement)}
              className="btn-secondary text-sm"
            >
              {showUserManagement ? 'Hide' : 'Show'} Users ({allUsers.length})
            </button>
          </div>

          {showUserManagement && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">{u.name || '-'}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="input text-sm py-1"
                          disabled={u.id === user.id}
                        >
                          <option value="player">Player</option>
                          <option value="team_captain">Team Captain</option>
                          <option value="league_manager">League Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">About Roles</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong className="text-gray-900">Admin:</strong> Full access to all features and settings. Can manage all leagues, teams, and users.
          </div>
          <div>
            <strong className="text-gray-900">League Manager:</strong> Can manage their assigned leagues, including teams, games, and schedules.
          </div>
          <div>
            <strong className="text-gray-900">Team Captain:</strong> Can manage their team roster, request subs, and update team information.
          </div>
          <div>
            <strong className="text-gray-900">Player:</strong> Can view schedules, standings, and manage their own player profile.
          </div>
        </div>
      </div>
    </div>
  )
}
