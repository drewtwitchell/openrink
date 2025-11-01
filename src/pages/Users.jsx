import { useState, useEffect, useRef } from 'react'
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
  const [openUserMenu, setOpenUserMenu] = useState(null) // Track which user's menu is open
  const userMenuRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const [dropdownPosition, setDropdownPosition] = useState({}) // Track dropdown positions by user ID
  const [createUserModal, setCreateUserModal] = useState({ isOpen: false })
  const [newUserData, setNewUserData] = useState({ email: '', name: '', phone: '' })

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)

    // Try to fetch users (backend will handle access control)
    fetchAllUsers()
  }, [navigate])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setOpenUserMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleDeactivateUser = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Deactivate User',
      message: `Are you sure you want to deactivate ${userName}? They will not be able to log in until reactivated.`,
      onConfirm: async () => {
        try {
          await auth.deactivateUser(userId)
          setMessage(`User ${userName} has been deactivated successfully`)
          fetchAllUsers()
          setTimeout(() => setMessage(''), 3000)
        } catch (error) {
          setMessage('Error deactivating user: ' + error.message)
        }
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })
      }
    })
  }

  const handleReactivateUser = async (userId, userName) => {
    try {
      await auth.reactivateUser(userId)
      setMessage(`User ${userName} has been reactivated successfully`)
      fetchAllUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error reactivating user: ' + error.message)
    }
  }

  const handleToggleUserMenu = (userId, event) => {
    if (openUserMenu === userId) {
      setOpenUserMenu(null)
      return
    }

    // Calculate available space above and below the button
    const button = event.currentTarget
    const rect = button.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownHeight = 200 // Approximate height of dropdown

    // Determine best direction: prefer downward if enough space, otherwise check upward
    let openUpward
    if (spaceBelow >= dropdownHeight) {
      // Enough space below, open downward (preferred default)
      openUpward = false
    } else if (spaceAbove >= dropdownHeight) {
      // Not enough space below but enough above, open upward
      openUpward = true
    } else {
      // Neither has enough space, choose direction with more space
      openUpward = spaceAbove > spaceBelow
    }

    setDropdownPosition({ ...dropdownPosition, [userId]: openUpward ? 'up' : 'down' })
    setOpenUserMenu(userId)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()

    if (!newUserData.email || !newUserData.name) {
      setMessage('Email and name are required')
      return
    }

    try {
      const result = await auth.createPlaceholderUser(newUserData.email, newUserData.name, newUserData.phone)
      setMessage(result.message || 'User created successfully. They can register with this email to claim their account.')
      setCreateUserModal({ isOpen: false })
      setNewUserData({ email: '', name: '', phone: '' })
      fetchAllUsers()
      setTimeout(() => setMessage(''), 5000)
    } catch (error) {
      setMessage('Error creating user: ' + error.message)
    }
  }

  // Filter and sort users
  const filteredAndSortedUsers = allUsers
    .filter(u => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        u.email?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query) ||
        u.name?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Default admin (username: 'admin') always at top
      if (a.username === 'admin') return -1
      if (b.username === 'admin') return 1

      // Then sort alphabetically by name, email, or username
      const aName = a.name || a.email || a.username
      const bName = b.name || b.email || b.username
      return aName.toLowerCase().localeCompare(bName.toLowerCase())
    })

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="section-header mb-0">All Users ({filteredAndSortedUsers.length})</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {user?.role === 'admin' && (
              <button
                onClick={() => setCreateUserModal({ isOpen: true })}
                className="btn-primary btn-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create User
              </button>
            )}
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto" style={{ minHeight: filteredAndSortedUsers.length <= 3 ? '400px' : 'auto' }}>
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
              {filteredAndSortedUsers.map((u) => (
                <>
                  <tr key={u.id} className={`${u.is_active === 0 ? 'bg-gray-50' : ''} ${u.username === 'admin' ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                    <td className={`font-medium ${u.is_active === 0 ? 'text-gray-400' : ''}`}>
                      {u.email || u.username || '-'}
                      {u.is_active === 0 && (
                        <span className="ml-2 badge badge-neutral text-xs">Deactivated</span>
                      )}
                    </td>
                    <td className={u.is_active === 0 ? 'text-gray-400' : ''}>{u.name || '-'}</td>
                    <td className={u.is_active === 0 ? 'text-gray-400' : 'text-gray-600'}>{u.phone || '-'}</td>
                    <td className={u.is_active === 0 ? 'text-gray-400' : ''}>
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
                    <td className={u.is_active === 0 ? 'text-gray-400' : 'text-gray-600'}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      {user?.role === 'admin' && (
                        <div className="relative inline-block" ref={openUserMenu === u.id ? userMenuRef : null}>
                          <button
                            onClick={(e) => handleToggleUserMenu(u.id, e)}
                            className="btn-secondary btn-sm px-3"
                            aria-label="User actions"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                          {openUserMenu === u.id && (
                            <div className={`absolute right-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 ${
                              dropdownPosition[u.id] === 'up' ? 'bottom-full mb-1' : 'mt-1'
                            }`}>
                              <button
                                onClick={() => {
                                  toggleUserHistory(u.id)
                                  setOpenUserMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {expandedUsers[u.id] ? 'Hide History' : 'View History'}
                              </button>
                              <button
                                onClick={() => {
                                  setResetPasswordModal({ isOpen: true, user: u })
                                  setOpenUserMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Reset Password
                              </button>
                              {u.is_active === 0 ? (
                                <button
                                  onClick={() => {
                                    handleReactivateUser(u.id, u.name || u.email)
                                    setOpenUserMenu(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Reactivate User
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    handleDeactivateUser(u.id, u.name || u.email)
                                    setOpenUserMenu(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                                  disabled={u.id === user?.id}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  Deactivate User
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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

      {/* Create User Modal */}
      {createUserModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <h3 className="modal-header">Create Placeholder User</h3>
            <div className="modal-body">
              <p className="text-sm text-gray-600 mb-4">
                Create a placeholder account for a player. When they register with this email, their account will be automatically activated and merged with any existing team assignments.
              </p>
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="input w-full"
                    placeholder="player@example.com"
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    className="input w-full"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="label">Phone (optional)</label>
                  <input
                    type="tel"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="input w-full"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </form>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setCreateUserModal({ isOpen: false })
                  setNewUserData({ email: '', name: '', phone: '' })
                }}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="btn-primary btn-sm"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  )
}
