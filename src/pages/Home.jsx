import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth } from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Home() {
  const [hasLeagues, setHasLeagues] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [standings, setStandings] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    setIsAuthenticated(auth.isAuthenticated())
    fetchPublicData()
  }, [])

  useEffect(() => {
    if (selectedLeague) {
      calculateStandings(selectedLeague)
    }
  }, [selectedLeague])

  const fetchPublicData = async () => {
    try {
      const [leaguesData, gamesData] = await Promise.all([
        fetch(`${API_URL}/api/leagues`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/games`).then(r => r.json()).catch(() => []),
      ])

      if (leaguesData.length > 0) {
        setHasLeagues(true)
        setLeagues(leaguesData)
        setSelectedLeague(leaguesData[0].id)

        // Get upcoming games (next 7 days)
        const today = new Date()
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        const upcoming = gamesData.filter(g => {
          const gameDate = new Date(g.game_date)
          return gameDate >= today && gameDate <= nextWeek && !g.home_score
        }).slice(0, 5)
        setUpcomingGames(upcoming)
      }
    } catch (error) {
      console.error('Error fetching public data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStandings = async (leagueId) => {
    try {
      const [teamsData, gamesData] = await Promise.all([
        fetch(`${API_URL}/api/teams`).then(r => r.json()),
        fetch(`${API_URL}/api/games`).then(r => r.json()),
      ])

      const leagueTeams = teamsData.filter(t => t.league_id === parseInt(leagueId))
      const completedGames = gamesData.filter(g => g.home_score != null && g.away_score != null)

      const teamStats = {}
      leagueTeams.forEach(team => {
        teamStats[team.id] = {
          team,
          wins: 0,
          losses: 0,
          ties: 0,
          gf: 0,
          ga: 0,
          points: 0,
        }
      })

      completedGames.forEach((game) => {
        const homeTeam = teamStats[game.home_team_id]
        const awayTeam = teamStats[game.away_team_id]

        if (!homeTeam || !awayTeam) return

        homeTeam.gf += game.home_score
        homeTeam.ga += game.away_score
        awayTeam.gf += game.away_score
        awayTeam.ga += game.home_score

        if (game.home_score > game.away_score) {
          homeTeam.wins++
          homeTeam.points += 2
          awayTeam.losses++
        } else if (game.away_score > game.home_score) {
          awayTeam.wins++
          awayTeam.points += 2
          homeTeam.losses++
        } else {
          homeTeam.ties++
          awayTeam.ties++
          homeTeam.points += 1
          awayTeam.points += 1
        }
      })

      const sortedStandings = Object.values(teamStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.gf - b.ga - (a.gf - a.ga)
      })

      setStandings(sortedStandings)
    } catch (error) {
      console.error('Error calculating standings:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!hasLeagues) {
    return (
      <div className="text-center">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to OpenRink
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Free, lightweight hockey league management system. Track teams, games, standings, and more.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="card text-left">
            <div className="text-3xl mb-3">🏒</div>
            <h3 className="text-xl font-semibold mb-2">League Management</h3>
            <p className="text-gray-600">
              Create and manage multiple leagues with teams, rosters, and schedules.
            </p>
          </div>

          <div className="card text-left">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-xl font-semibold mb-2">Live Standings</h3>
            <p className="text-gray-600">
              Automatic standings calculation based on game results and scores.
            </p>
          </div>

          <div className="card text-left">
            <div className="text-3xl mb-3">📧</div>
            <h3 className="text-xl font-semibold mb-2">Notifications</h3>
            <p className="text-gray-600">
              Email reminders for upcoming games and league announcements.
            </p>
          </div>

          <div className="card text-left">
            <div className="text-3xl mb-3">🏟️</div>
            <h3 className="text-xl font-semibold mb-2">Rink Management</h3>
            <p className="text-gray-600">
              Track games across multiple rinks and ice surfaces.
            </p>
          </div>

          <div className="card text-left">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-xl font-semibold mb-2">Dues Collection</h3>
            <p className="text-gray-600">
              Easy payment tracking with Venmo integration.
            </p>
          </div>

          <div className="card text-left">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="text-xl font-semibold mb-2">Sub Requests</h3>
            <p className="text-gray-600">
              Request substitutes with automatic notifications to players.
            </p>
          </div>
        </div>

        <div className="space-x-4">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary inline-block">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn-primary inline-block">
              Get Started
            </Link>
          )}
          <a
            href="https://github.com/drewtwitchell/openrink"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-block"
          >
            View on GitHub
          </a>
        </div>
      </div>
    )
  }

  // Public league view
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">League Standings & Schedule</h1>
        <p className="text-gray-600">View current standings and upcoming games</p>
      </div>

      {leagues.length > 1 && (
        <div className="mb-6">
          <label className="label">Select League</label>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="input max-w-md"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} {league.season && `(${league.season})`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Standings */}
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Standings</h2>
          {standings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No games played yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Team</th>
                    <th className="text-center py-2 px-2">W</th>
                    <th className="text-center py-2 px-2">L</th>
                    <th className="text-center py-2 px-2">T</th>
                    <th className="text-center py-2 px-2 font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 8).map((standing, index) => (
                    <tr key={standing.team.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-semibold">{index + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: standing.team.color }}
                          />
                          <span className="font-medium">{standing.team.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2">{standing.wins}</td>
                      <td className="text-center py-2 px-2">{standing.losses}</td>
                      <td className="text-center py-2 px-2">{standing.ties}</td>
                      <td className="text-center py-2 px-2 font-bold">{standing.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Games */}
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Upcoming Games This Week</h2>
          {upcomingGames.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming games this week</p>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game) => (
                <div key={game.id} className="p-3 bg-gray-50 rounded">
                  <div className="font-semibold text-sm mb-1">
                    {game.home_team_name} vs {game.away_team_name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(game.game_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })} at {game.game_time}
                  </div>
                  {game.rink_name && (
                    <div className="text-xs text-gray-500 mt-1">
                      {game.rink_name} - {game.surface_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Call to Action */}
      <div className="card text-center bg-ice-50">
        {isAuthenticated ? (
          <>
            <h3 className="text-xl font-semibold mb-3">Manage Your League</h3>
            <p className="text-gray-600 mb-4">
              Access your dashboard to manage teams, games, and rosters.
            </p>
            <Link to="/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
          </>
        ) : (
          <>
            <h3 className="text-xl font-semibold mb-3">Need a Sub?</h3>
            <p className="text-gray-600 mb-4">
              Log in to request a substitute for an upcoming game and notify your team.
            </p>
            <Link to="/login" className="btn-primary">
              Sign In to Request Sub
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
