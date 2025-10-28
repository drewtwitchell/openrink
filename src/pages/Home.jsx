import { Link, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth } from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Home() {
  const [searchParams] = useSearchParams()
  const [hasLeagues, setHasLeagues] = useState(false)
  const [leagueData, setLeagueData] = useState([]) // Array of {league, standings, upcomingGames}
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Get league from subdomain (e.g., mhl.openrink.app -> "mhl")
  const getLeagueFromSubdomain = () => {
    const hostname = window.location.hostname
    const parts = hostname.split('.')

    // If we have more than 2 parts and the first part is not 'www' or 'localhost'
    // then it's likely a subdomain (e.g., "mhl" from "mhl.openrink.app")
    if (parts.length > 2 && parts[0] !== 'www') {
      return parts[0]
    }

    // For localhost testing (e.g., mhl.localhost)
    if (parts.length === 2 && parts[1] === 'localhost') {
      return parts[0]
    }

    return null
  }

  // Get league filter from subdomain first, then fall back to URL parameter
  const subdomainLeague = getLeagueFromSubdomain()
  const leagueFilter = subdomainLeague || searchParams.get('league')

  useEffect(() => {
    setIsAuthenticated(auth.isAuthenticated())
    fetchPublicData()
  }, [])

  const fetchPublicData = async () => {
    try {
      const [leaguesData, teamsData, gamesData] = await Promise.all([
        fetch(`${API_URL}/api/leagues`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/teams`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/games`).then(r => r.json()).catch(() => []),
      ])

      if (leaguesData.length > 0) {
        setHasLeagues(true)

        // Calculate standings and upcoming games for each league
        const today = new Date()
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

        const allLeagueData = await Promise.all(leaguesData.map(async (league) => {
          const leagueTeams = teamsData.filter(t => t.league_id === league.id)
          const completedGames = gamesData.filter(g =>
            g.home_score != null && g.away_score != null &&
            leagueTeams.some(t => t.id === g.home_team_id || t.id === g.away_team_id)
          )

          // Fetch active season
          let activeSeason = null
          try {
            const seasonResponse = await fetch(`${API_URL}/api/seasons/league/${league.id}/active`)
            if (seasonResponse.ok) {
              activeSeason = await seasonResponse.json()
            }
          } catch (error) {
            // No active season
          }

          // Calculate standings
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

          const standings = Object.values(teamStats).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            return b.gf - b.ga - (a.gf - a.ga)
          })

          // Get upcoming games for this league (next 7 days)
          const upcomingGames = gamesData.filter(g => {
            const gameDate = new Date(g.game_date)
            const isUpcoming = gameDate >= today && gameDate <= nextWeek && !g.home_score
            const isLeagueGame = leagueTeams.some(t => t.id === g.home_team_id || t.id === g.away_team_id)
            return isUpcoming && isLeagueGame
          }).slice(0, 5)

          return {
            league,
            activeSeason,
            standings,
            upcomingGames
          }
        }))

        setLeagueData(allLeagueData)
      }
    } catch (error) {
      console.error('Error fetching public data:', error)
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!hasLeagues) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome to OpenRink
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Free, lightweight hockey league management system. Track teams, games, standings, and player payments all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn-primary">
                Get Started
              </Link>
            )}
            <a
              href="https://github.com/drewtwitchell/openrink"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="card mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Everything You Need to Manage Your League</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">League & Season Management</h3>
                <p className="text-gray-600 text-sm">
                  Create multiple leagues with distinct seasons. Track payment periods, dues, and manage team rosters independently for each season.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Standings</h3>
                <p className="text-gray-600 text-sm">
                  Automatic standings calculation based on game results. Track wins, losses, ties, goals for, goals against, and points.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Tracking</h3>
                <p className="text-gray-600 text-sm">
                  Track player dues by season with Venmo integration. See who's paid and who hasn't at a glance with visual progress indicators.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Team & Player Management</h3>
                <p className="text-gray-600 text-sm">
                  Manage team rosters, assign jersey numbers, link players to user accounts, and transfer players between teams seamlessly.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Schedule & Rink Management</h3>
                <p className="text-gray-600 text-sm">
                  Schedule games across multiple rinks and ice surfaces. Track game times, locations, and results all in one place.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Substitute Requests</h3>
                <p className="text-gray-600 text-sm">
                  Request substitutes for upcoming games with optional payment handling. Notify team members automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="card bg-ice-50 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            {isAuthenticated
              ? "Head to your dashboard to create your first league and start managing your hockey season."
              : "Sign in to create your first league and start managing your hockey season in minutes."
            }
          </p>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary">
              Create Your First League
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">
              Sign In to Get Started
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Filter leagues based on URL parameter if provided
  const displayLeagues = leagueFilter
    ? leagueData.filter(({ league }) =>
        league.name.toLowerCase() === leagueFilter.toLowerCase() ||
        league.id.toString() === leagueFilter
      )
    : leagueData

  const isSingleLeague = displayLeagues.length === 1
  const isMultipleLeagues = displayLeagues.length > 1

  // Public league view
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {isSingleLeague && displayLeagues[0]?.league.name
            ? displayLeagues[0].league.name
            : 'League Standings & Schedule'}
        </h1>
        {isSingleLeague && displayLeagues[0]?.activeSeason && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="badge badge-success text-sm">
              {displayLeagues[0].activeSeason.name}
            </span>
            {displayLeagues[0].activeSeason.start_date && displayLeagues[0].activeSeason.end_date && (
              <span className="text-sm text-gray-500">
                {new Date(displayLeagues[0].activeSeason.start_date).toLocaleDateString()} - {new Date(displayLeagues[0].activeSeason.end_date).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        <p className="text-gray-600">
          {isSingleLeague && displayLeagues[0]?.league.description
            ? displayLeagues[0].league.description
            : 'View current standings and upcoming games'}
        </p>
        {isMultipleLeagues && !leagueFilter && (
          <p className="text-sm text-gray-500 mt-2">
            Tip: Access individual leagues via subdomain (e.g., mhl.yourdomain.com)
          </p>
        )}
      </div>

      {displayLeagues.map(({ league, activeSeason, standings, upcomingGames }) => (
        <div key={league.id} className="mb-12">
          {/* League Header - only show for multiple leagues */}
          {isMultipleLeagues && (
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900">
                {league.name}
                {league.season && <span className="text-2xl text-gray-600 ml-2">({league.season})</span>}
              </h2>
              {league.description && (
                <p className="text-gray-600 mt-1">{league.description}</p>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Standings */}
            <div className="card">
              <h3 className="text-2xl font-semibold mb-4">Standings</h3>
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
              <h3 className="text-2xl font-semibold mb-4">Upcoming Games This Week</h3>
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
        </div>
      ))}

      {/* Calendar Subscription */}
      <div className="card mb-6 bg-blue-50">
        <h3 className="text-xl font-semibold mb-3">Subscribe to Game Calendar</h3>
        <p className="text-gray-600 mb-4">
          Add all league games to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.)
        </p>
        <div className="flex gap-3">
          <a
            href={`${API_URL}/api/calendar/league/${displayLeagues[0]?.league.id}`}
            download
            className="btn-primary"
          >
            Subscribe to All Games
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Downloads an .ics file that automatically updates when new games are added
        </p>
      </div>

      {/* Sub Requests & Management */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card bg-ice-50">
          <h3 className="text-xl font-semibold mb-3">
            {isAuthenticated ? 'Quick Actions' : 'Need a Sub?'}
          </h3>
          {isAuthenticated ? (
            <div className="space-y-3">
              <Link to="/dashboard" className="btn-primary w-full block text-center">
                Go to Dashboard
              </Link>
              <Link to="/games" className="btn-secondary w-full block text-center">
                View All Games
              </Link>
              <Link to="/teams" className="btn-secondary w-full block text-center">
                Manage Teams
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                Log in to request a substitute for an upcoming game and notify your team.
              </p>
              <Link to="/login" className="btn-primary w-full block text-center">
                Sign In to Request Sub
              </Link>
            </>
          )}
        </div>

        {isAuthenticated && (
          <div className="card">
            <h3 className="text-xl font-semibold mb-3">Request a Sub</h3>
            <p className="text-gray-600 mb-4">
              Can't make it to a game? Request a substitute through your team dashboard.
            </p>
            <Link to="/dashboard" className="btn-primary w-full block text-center">
              Request Substitute
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
