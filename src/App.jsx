import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leagues from './pages/Leagues'
import Teams from './pages/Teams'
import Games from './pages/Games'
import Standings from './pages/Standings'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

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
                {session && (
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
              <div className="flex items-center">
                {session ? (
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="btn-secondary"
                  >
                    Sign Out
                  </button>
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
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={session ? <Dashboard /> : <Login />} />
            <Route path="/leagues" element={session ? <Leagues /> : <Login />} />
            <Route path="/teams" element={session ? <Teams /> : <Login />} />
            <Route path="/games" element={session ? <Games /> : <Login />} />
            <Route path="/standings" element={session ? <Standings /> : <Login />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
