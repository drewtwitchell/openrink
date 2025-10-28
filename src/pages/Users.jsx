import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Users() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)

    // Only admins can access this page
    if (currentUser?.role !== 'admin') {
      navigate('/dashboard')
      return
    }

    fetchAllUsers()
  }, [navigate])

  const fetchAllUsers = async () => {
    try {
      const users = await auth.getAllUsers()
      setAllUsers(users)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
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

  if (loading) {
    return <div>Loading users...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'User Management' }
        ]}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-gray-600">Manage user roles and permissions</p>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded">
          {message}
        </div>
      )}

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">All Users ({allUsers.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Phone</th>
                <th className="text-left py-3 px-4">Role</th>
                <th className="text-left py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{u.email}</td>
                  <td className="py-3 px-4">{u.name || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{u.phone || '-'}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="input text-sm py-1 px-2"
                    >
                      <option value="player">Player</option>
                      <option value="team_captain">Team Captain</option>
                      <option value="league_manager">League Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    {u.id === user?.id && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ You are changing your own role</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
