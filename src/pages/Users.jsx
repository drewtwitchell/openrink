import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, players } from '../lib/api'
import ConfirmModal from '../components/ConfirmModal'

export default function Users() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [resetPasswordModal, setResetPasswordModal] = useState({ isOpen: false, user: null })
  const [newPassword, setNewPassword] = useState('')
  const [expandedUsers, setExpandedUsers] = useState({}) // Track which users are expanded
  const [userHistories, setUserHistories] = useState({}) // Store histories by user ID
  const [loadingHistories, setLoadingHistories] = useState({}) // Track loading state per user

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)

    // Try to fetch users (backend will handle access control)
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

  const toggleUserHistory = async (userId) => {
    // If already expanded, collapse it
    if (expandedUsers[userId]) {
      setExpandedUsers({ ...expandedUsers, [userId]: false })
      return
    }

    // Expand and fetch history if not already loaded
    setExpandedUsers({ ...expandedUsers, [userId]: true })

    if (!userHistories[userId]) {
      setLoadingHistories({ ...loadingHistories, [userId]: true })
      try {
        const history = await players.getHistoryByUser(userId)
        setUserHistories({ ...userHistories, [userId]: history })
      } catch (error) {
        console.error('Error fetching user history:', error)
        setUserHistories({ ...userHistories, [userId]: [] })
      } finally {
        setLoadingHistories({ ...loadingHistories, [userId]: false })
      }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Present'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return <div className="loading">Loading users...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            {user?.role === 'admin'
              ? 'Manage user roles and permissions'
              : 'View players from your managed leagues'}
          </p>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('Error') ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-header mb-0">All Users ({allUsers.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <>
                  <tr key={u.id}>
                    <td className="font-medium">{u.email}</td>
                    <td>{u.name || '-'}</td>
                    <td className="text-gray-600">{u.phone || '-'}</td>
                    <td>
                      {user?.role === 'admin' ? (
                        <>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="input py-1 px-2 text-sm"
                          >
                            <option value="player">Player</option>
                            <option value="admin">Admin</option>
                          </select>
                          {u.id === user?.id && (
                            <p className="text-xs text-amber-600 mt-1">⚠️ You are changing your own role</p>
                          )}
                        </>
                      ) : (
                        getRoleBadge(u.role)
                      )}
                    </td>
                    <td className="text-gray-600">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => toggleUserHistory(u.id)}
                        className="btn-secondary btn-sm"
                      >
                        {expandedUsers[u.id] ? 'Hide History' : 'View History'}
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setResetPasswordModal({ isOpen: true, user: u })}
                          className="btn-secondary btn-sm"
                        >
                          Reset Password
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedUsers[u.id] && (
                    <tr key={`${u.id}-history`}>
                      <td colSpan="6" className="bg-gray-50 p-4">
                        <div className="max-w-4xl">
                          <h3 className="font-semibold text-gray-900 mb-3">Player History for {u.name || u.email}</h3>
                          {loadingHistories[u.id] ? (
                            <div className="text-center py-4 text-gray-500">Loading history...</div>
                          ) : !userHistories[u.id] || userHistories[u.id].length === 0 ? (
                            <div className="text-center py-4 text-gray-500">No player history yet</div>
                          ) : (
                            <div className="space-y-2">
                              {userHistories[u.id].map((record) => (
                                <div key={record.id} className="p-3 bg-white rounded-lg border border-gray-200">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <div className="font-semibold text-gray-900">{record.league_name}</div>
                                      <div className="text-sm text-gray-600">{record.season_name}</div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {formatDate(record.joined_date)}
                                      {record.left_date && ` - ${formatDate(record.left_date)}`}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span
                                      className="px-2 py-1 rounded text-white"
                                      style={{ backgroundColor: record.team_color || '#6B7280' }}
                                    >
                                      {record.team_name}
                                    </span>
                                    <span className="text-gray-600">
                                      {record.position === 'goalie' ? 'Goalie' :
                                       record.sub_position ? `${record.sub_position.charAt(0).toUpperCase() + record.sub_position.slice(1)}` : 'Player'}
                                    </span>
                                    {record.jersey_number && (
                                      <span className="text-gray-600">#{record.jersey_number}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="section-header mb-4">About Roles & Permissions</h2>
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
        <div className="modal-overlay">
          <div className="modal-container">
            <h3 className="modal-header">Reset Password</h3>
            <div className="modal-body">
              <p className="mb-4">
                Reset password for <strong>{resetPasswordModal.user?.name || resetPasswordModal.user?.email}</strong>
              </p>
              <div>
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
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setResetPasswordModal({ isOpen: false, user: null })
                  setNewPassword('')
                }}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="btn-primary btn-sm"
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
