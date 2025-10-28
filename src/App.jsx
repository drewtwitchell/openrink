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
import Announcements from './pages/Announcements'
import Playoffs from './pages/Playoffs'
import PlayoffBracketView from './pages/PlayoffBracketView'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is authenticated
    const isAuth = auth.isAuthenticated()
    setIsAuthenticated(isAuth)

    // If authenticated, refresh user data from server to ensure we have latest (including role)
    if (isAuth) {
      fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
          setUser(data.user)
        }
      })
      .catch(err => {
        console.error('Failed to refresh user data:', err)
      })
    } else {
      setUser(null)
    }

    setLoading(false)
  }, [isAuthenticated])

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
                    <Link
                      to="/dashboard"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-ice-600 hover:bg-gray-100"
                    >
                      Dashboard
                    </Link>
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
                        <div className="font-medium">{user?.name || user?.email}</div>
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
            <Route path="/leagues/:leagueId/announcements" element={isAuthenticated ? <Announcements /> : <Navigate to="/login" />} />
            <Route path="/leagues/:leagueId/playoffs" element={isAuthenticated ? <Playoffs /> : <Navigate to="/login" />} />
            <Route path="/playoffs/:bracketId/view" element={isAuthenticated ? <PlayoffBracketView /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
