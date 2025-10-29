import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'

export default function Users() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [resetPasswordModal, setResetPasswordModal] = useState({ isOpen: false, user: null })
  const [newPassword, setNewPassword] = useState('')

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

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }

    try {
      await auth.resetUserPassword(resetPasswordModal.user.id, newPassword)
      setMessage(`Password reset successfully for ${resetPasswordModal.user.name || resetPasswordModal.user.email}`)
      setResetPasswordModal({ isOpen: false, user: null })
      setNewPassword('')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error resetting password: ' + error.message)
    }
  }

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Admin', color: 'bg-purple-100 text-purple-800' },
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
          <h2 className="text-2xl font-bold">All Users ({allUsers.length})</h2>
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
                <th className="text-left py-3 px-4">Actions</th>
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
                      <option value="admin">Admin</option>
                    </select>
                    {u.id === user?.id && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ You are changing your own role</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setResetPasswordModal({ isOpen: true, user: u })}
                      className="btn-secondary text-sm"
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">About Roles & Permissions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">System Roles</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">Admin:</strong> Full access to all features and settings. Can manage all leagues, teams, users, and system-wide configurations.
              </div>
              <div>
                <strong className="text-gray-900">Player:</strong> Standard user account. Can view schedules, standings, and manage their own player profile.
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-900 mb-2">Additional Permissions</h3>
            <p className="text-sm text-gray-600 mb-2">These are assigned per-league or per-team, not as system roles:</p>
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

      {/* Reset Password Modal */}
      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold mb-4">Reset Password</h3>
            <p className="text-gray-600 mb-4">
              Reset password for <strong>{resetPasswordModal.user?.name || resetPasswordModal.user?.email}</strong>
            </p>
            <div className="mb-4">
              <label className="label">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input w-full"
                placeholder="Enter new password (min 6 characters)"
                minLength={6}
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setResetPasswordModal({ isOpen: false, user: null })
                  setNewPassword('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="btn-primary"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
