import { useState, useEffect } from 'react'
import { auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Settings() {
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      })
    }
  }, [])

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
      await auth.updateProfile(formData.name, formData.phone)
      const updatedUser = auth.getUser()
      setUser(updatedUser)
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating profile: ' + error.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Profile Settings' }
        ]}
      />

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
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
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
