import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth } from './lib/api'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leagues from './pages/Leagues'
import LeagueDetails from './pages/LeagueDetails'
import Teams from './pages/Teams'
import TeamRoster from './pages/TeamRoster'
import Games from './pages/Games'
import Standings from './pages/Standings'
import Settings from './pages/Settings'
import Users from './pages/Users'
import PlayoffBracketView from './pages/PlayoffBracketView'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState(null)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => {
    // Check if user is authenticated
    const isAuth = auth.isAuthenticated()

    const refreshUserData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        if (!response.ok) {
          // If auth fails, clear everything and log out
          throw new Error('Authentication failed')
        }

        const data = await response.json()

        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setUser(data.user)
          setIsAuthenticated(true)

          // Check if password reset is required
          if (data.user.password_reset_required === 1) {
            setShowPasswordResetModal(true)
          }
        }
      } catch (err) {
        console.error('Failed to refresh user data:', err)
        // Clear invalid auth state
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    // If authenticated, refresh user data from server to ensure we have latest (including role)
    if (isAuth) {
      refreshUserData()

      // Listen for profile updates
      const handleProfileUpdate = () => {
        refreshUserData()
      }
      window.addEventListener('profileUpdated', handleProfileUpdate)

      return () => {
        window.removeEventListener('profileUpdated', handleProfileUpdate)
      }
    } else {
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
    }
  }, [isAuthenticated])

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

      setTimeout(() => {
        setPasswordMessage('')
        setShowPasswordResetModal(false)
      }, 1500)
    } catch (error) {
      setPasswordMessage('Error: ' + error.message)
    }
  }

  const handleSignOut = () => {
    auth.signOut()
    setIsAuthenticated(false)
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ice-600 text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link to="/" className="text-2xl font-bold text-ice-600">
                  🏒 OpenRink
                </Link>
                {isAuthenticated && (
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-ice-600 hover:bg-gray-100"
                    >
                      Home
                    </Link>
                    {/* Only show Dashboard for admins and league_managers */}
                    {user && (user.role === 'admin' || user.role === 'league_manager') && (
                      <Link
                        to="/dashboard"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-ice-600 hover:bg-gray-100"
                      >
                        Dashboard
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-ice-600 focus:outline-none"
                    >
                      <div className="text-right">
                        <div className="font-medium">{user?.name || user?.username || user?.email}</div>
                        <div className="text-xs text-gray-500">{user?.role?.replace('_', ' ')}</div>
                      </div>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                          <Link
                            to="/settings"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setShowUserMenu(false)}
                          >
                            Profile Settings
                          </Link>
                          {user?.role === 'admin' && (
                            <Link
                              to="/users"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setShowUserMenu(false)}
                            >
                              User Management
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              setShowUserMenu(false)
                              handleSignOut()
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                          >
                            Sign Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <Link to="/login" className="btn-primary">
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Password Reset Modal (Required for new admin accounts) */}
        {showPasswordResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Password Change Required</h3>
                <p className="text-sm text-yellow-700">
                  For security reasons, you must change your password before continuing.
                </p>
              </div>

              {passwordMessage && (
                <div className={`mb-4 p-3 rounded ${
                  passwordMessage.includes('Error') || passwordMessage.includes('not match') || passwordMessage.includes('incorrect')
                    ? 'bg-red-100 text-red-700 border border-red-400'
                    : 'bg-green-100 text-green-700 border border-green-400'
                }`}>
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
                    className="input w-full"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your current password"
                  />
                </div>

                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    className="input w-full"
                    required
                    autoComplete="new-password"
                    minLength="6"
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    className="input w-full"
                    required
                    autoComplete="new-password"
                    minLength="6"
                    placeholder="Re-enter new password"
                  />
                </div>

                <button type="submit" className="btn-primary w-full">
                  Change Password
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/leagues" element={isAuthenticated ? <Leagues /> : <Navigate to="/login" />} />
            <Route path="/leagues/:id" element={isAuthenticated ? <LeagueDetails /> : <Navigate to="/login" />} />
            <Route path="/teams" element={isAuthenticated ? <Teams /> : <Navigate to="/login" />} />
            <Route path="/teams/:id/roster" element={isAuthenticated ? <TeamRoster /> : <Navigate to="/login" />} />
            <Route path="/games" element={isAuthenticated ? <Games /> : <Navigate to="/login" />} />
            <Route path="/standings" element={isAuthenticated ? <Standings /> : <Navigate to="/login" />} />
            <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
            <Route path="/users" element={isAuthenticated ? <Users /> : <Navigate to="/login" />} />
            <Route path="/playoffs/:bracketId/view" element={isAuthenticated ? <PlayoffBracketView /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
