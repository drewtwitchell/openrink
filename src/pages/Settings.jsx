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
    sub_position: '',
    jersey_number: '',
  })
  const [message, setMessage] = useState('')
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => {
    // Fetch fresh user data from API instead of using stale localStorage
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

          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(freshUser))

          setUser(freshUser)
          setFormData({
            name: freshUser.name || '',
            email: freshUser.email || '',
            phone: freshUser.phone || '',
            position: freshUser.position || 'player',
            sub_position: freshUser.sub_position || '',
            jersey_number: freshUser.jersey_number || '',
          })
        } else {
          // Fallback to localStorage if API fails
          const currentUser = auth.getUser()
          setUser(currentUser)
          if (currentUser) {
            setFormData({
              name: currentUser.name || '',
              email: currentUser.email || '',
              phone: currentUser.phone || '',
              position: currentUser.position || 'player',
              sub_position: currentUser.sub_position || '',
              jersey_number: currentUser.jersey_number || '',
            })
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Fallback to localStorage if API fails
        const currentUser = auth.getUser()
        setUser(currentUser)
        if (currentUser) {
          setFormData({
            name: currentUser.name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            position: currentUser.position || 'player',
            sub_position: currentUser.sub_position || '',
            jersey_number: currentUser.jersey_number || '',
          })
        }
      }
    }

    fetchUserData()
  }, [])

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
      await auth.updateProfile(formData.name, formData.phone, formData.position, formData.sub_position, formData.jersey_number)
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

          <div>
            <label className="label">Position</label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value, sub_position: '' })}
              className="input"
            >
              <option value="player">Player</option>
              <option value="goalie">Goalie</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Your preferred position on the team</p>
          </div>

          {formData.position === 'player' && (
            <div>
              <label className="label">Player Position</label>
              <select
                value={formData.sub_position}
                onChange={(e) => setFormData({ ...formData, sub_position: e.target.value })}
                className="input"
              >
                <option value="">Select position...</option>
                <option value="forward">Forward</option>
                <option value="defense">Defense</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Forward or Defense</p>
            </div>
          )}

          <div>
            <label className="label">Jersey Number</label>
            <input
              type="number"
              value={formData.jersey_number}
              onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
              className="input"
              placeholder="Your jersey number"
              min="0"
              max="99"
            />
            <p className="text-xs text-gray-500 mt-1">Will be displayed on team rosters</p>
          </div>

          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </form>
      </div>

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
