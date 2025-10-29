import { useState } from 'react'

export default function PasswordChangeModal({ isOpen, onPasswordChanged }) {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    // Validate password length
    if (formData.new_password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: formData.current_password,
          new_password: formData.new_password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      // Fetch updated user info
      const userResponse = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        localStorage.setItem('user', JSON.stringify(userData.user))
        onPasswordChanged(userData.user)
      } else {
        onPasswordChanged(null)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 animate-scaleIn">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Change Password Required</h2>
          <p className="text-sm text-gray-600">
            For security reasons, you must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              value={formData.current_password}
              onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
              className="input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={formData.new_password}
              onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
              className="input"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              className="input"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <strong>Note:</strong> You cannot access the application until you change your password.
        </div>
      </div>
    </div>
  )
}
