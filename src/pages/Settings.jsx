import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: 'player',
  })
  const [message, setMessage] = useState('')
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        position: currentUser.position || 'player',
      })
    }
  }, [])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await auth.updateProfile(formData.name, formData.phone, formData.position)
      const updatedUser = auth.getUser()
      setUser(updatedUser)
      setMessage('Profile updated successfully!')

      // Notify App.jsx to refresh user display
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

      // Update user in localStorage to clear password_reset_required flag
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

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

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

          <div>
            <label className="label">Position</label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="input"
            >
              <option value="player">Player</option>
              <option value="goalie">Goalie</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Your preferred position on the team</p>
          </div>

          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Change Password</h2>

        {passwordMessage && (
          <div className={`mb-4 p-3 rounded ${passwordMessage.includes('Error') || passwordMessage.includes('not match') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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

      {user?.role === 'admin' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Administration</h2>
          <p className="text-sm text-gray-600 mb-4">
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
        <h2 className="text-xl font-semibold mb-4">About Roles & Permissions</h2>
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
