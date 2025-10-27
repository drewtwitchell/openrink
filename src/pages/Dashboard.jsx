import { useEffect, useState } from 'react'
import { auth } from '../lib/api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(auth.getUser())
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.email}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-3xl mb-2">🏒</div>
          <div className="text-3xl font-bold text-ice-600">-</div>
          <div className="text-gray-600">Active Leagues</div>
        </div>

        <div className="card">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-3xl font-bold text-ice-600">-</div>
          <div className="text-gray-600">Your Teams</div>
        </div>

        <div className="card">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-3xl font-bold text-ice-600">-</div>
          <div className="text-gray-600">Upcoming Games</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/leagues" className="block p-3 bg-gray-50 rounded hover:bg-gray-100">
              📋 View Leagues
            </Link>
            <Link to="/teams" className="block p-3 bg-gray-50 rounded hover:bg-gray-100">
              👥 Manage Teams
            </Link>
            <Link to="/games" className="block p-3 bg-gray-50 rounded hover:bg-gray-100">
              🏒 Schedule Game
            </Link>
            <Link to="/standings" className="block p-3 bg-gray-50 rounded hover:bg-gray-100">
              📊 View Standings
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Upcoming Games</h2>
          <p className="text-gray-500 text-center py-8">
            No upcoming games scheduled
          </p>
        </div>
      </div>
    </div>
  )
}
