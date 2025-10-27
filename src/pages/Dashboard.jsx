import { useEffect, useState } from 'react'
import { auth, leagues, teams, games } from '../lib/api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    leagues: 0,
    teams: 0,
    upcomingGames: 0,
  })
  const [upcomingGames, setUpcomingGames] = useState([])

  useEffect(() => {
    setUser(auth.getUser())
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [leaguesData, teamsData, gamesData] = await Promise.all([
        leagues.getAll(),
        teams.getAll(),
        games.getAll(),
      ])

      const today = new Date().toISOString().split('T')[0]
      const upcoming = gamesData.filter(g => g.game_date >= today && !g.home_score).slice(0, 5)

      setStats({
        leagues: leaguesData.length,
        teams: teamsData.length,
        upcomingGames: upcoming.length,
      })
      setUpcomingGames(upcoming)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.email}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-3xl mb-2">🏒</div>
          <div className="text-3xl font-bold text-ice-600">{stats.leagues}</div>
          <div className="text-gray-600">Active Leagues</div>
        </div>

        <div className="card">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-3xl font-bold text-ice-600">{stats.teams}</div>
          <div className="text-gray-600">Total Teams</div>
        </div>

        <div className="card">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-3xl font-bold text-ice-600">{stats.upcomingGames}</div>
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
          {upcomingGames.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No upcoming games scheduled
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game) => (
                <div key={game.id} className="p-3 bg-gray-50 rounded">
                  <div className="font-semibold text-sm">
                    {game.home_team_name} vs {game.away_team_name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {new Date(game.game_date).toLocaleDateString()} at {game.game_time}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
