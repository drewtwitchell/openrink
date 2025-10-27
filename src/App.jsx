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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    setIsAuthenticated(auth.isAuthenticated())
    setLoading(false)
  }, [])

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
                  <>
                    <Link to="/dashboard" className="text-gray-700 hover:text-ice-600">
                      Dashboard
                    </Link>
                    <Link to="/leagues" className="text-gray-700 hover:text-ice-600">
                      Leagues
                    </Link>
                    <Link to="/teams" className="text-gray-700 hover:text-ice-600">
                      Teams
                    </Link>
                    <Link to="/games" className="text-gray-700 hover:text-ice-600">
                      Games
                    </Link>
                    <Link to="/standings" className="text-gray-700 hover:text-ice-600">
                      Standings
                    </Link>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {isAuthenticated ? (
                  <>
                    <Link to="/settings" className="text-gray-700 hover:text-ice-600">
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="btn-secondary"
                    >
                      Sign Out
                    </button>
                  </>
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
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
