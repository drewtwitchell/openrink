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
  const [user, setUser] = useState(null)
  const [userLeagueIds, setUserLeagueIds] = useState([]) // League IDs user has access to
  const [collapsedLeagues, setCollapsedLeagues] = useState(() => {
    const saved = localStorage.getItem('collapsedLeagues')
    return saved ? JSON.parse(saved) : {}
  })
  const [starredLeagues, setStarredLeagues] = useState(() => {
    const saved = localStorage.getItem('starredLeagues')
    return saved ? JSON.parse(saved) : {}
  })

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
    const isAuth = auth.isAuthenticated()
    setIsAuthenticated(isAuth)

    // Get user information if authenticated
    if (isAuth) {
      const currentUser = auth.getUser()
      setUser(currentUser)
      fetchUserLeagues(currentUser)
    }

    fetchPublicData()
  }, [])

  const fetchUserLeagues = async (currentUser) => {
    if (!currentUser) return

    try {
      // Admin sees all leagues (no filtering needed)
      if (currentUser.role === 'admin') {
        setUserLeagueIds([]) // Empty array means "all leagues" for admin
        return
      }

      // For league managers, fetch leagues they manage
      if (currentUser.role === 'league_manager') {
        const response = await fetch(`${API_URL}/api/league-managers/user/${currentUser.id}`)
        if (response.ok) {
          const managerData = await response.json()
          const leagueIds = managerData.map(lm => lm.league_id)
          setUserLeagueIds(leagueIds)
          return
        }
      }

      // For players, fetch teams they're on to determine which leagues they can see
      const playersResponse = await fetch(`${API_URL}/api/players`)
      if (playersResponse.ok) {
        const allPlayers = await playersResponse.json()
        const userPlayers = allPlayers.filter(p => p.user_id === currentUser.id)

        if (userPlayers.length > 0) {
          // Get teams for these players
          const teamsResponse = await fetch(`${API_URL}/api/teams`)
          if (teamsResponse.ok) {
            const allTeams = await teamsResponse.json()
            const userTeams = allTeams.filter(t => userPlayers.some(p => p.team_id === t.id))
            const leagueIds = [...new Set(userTeams.map(t => t.league_id))]
            setUserLeagueIds(leagueIds)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user leagues:', error)
    }
  }

  const fetchPublicData = async () => {
    try {
      const [leaguesData, teamsData, gamesData, playersData] = await Promise.all([
        fetch(`${API_URL}/api/leagues`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/teams`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/games`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/players`).then(r => r.json()).catch(() => []),
      ])

      // Fetch announcements for each league
      const leagueAnnouncements = {}
      for (const league of leaguesData) {
        try {
          const announcements = await fetch(`${API_URL}/api/announcements/league/${league.id}`).then(r => r.json())
          leagueAnnouncements[league.id] = announcements
        } catch (error) {
          leagueAnnouncements[league.id] = []
        }
      }

      // Fetch playoff brackets for each league
      const leagueBrackets = {}
      for (const league of leaguesData) {
        try {
          // First get active season
          const seasonResponse = await fetch(`${API_URL}/api/seasons/league/${league.id}/active`)
          if (seasonResponse.ok) {
            const activeSeason = await seasonResponse.json()
            if (activeSeason) {
              // Then get active bracket for that season
              const bracketResponse = await fetch(`${API_URL}/api/playoffs/league/${league.id}/season/${activeSeason.id}/active`)
              if (bracketResponse.ok) {
                const bracket = await bracketResponse.json()
                if (bracket) {
                  // Get full bracket details including matches
                  const detailsResponse = await fetch(`${API_URL}/api/playoffs/${bracket.id}`)
                  if (detailsResponse.ok) {
                    const bracketData = await detailsResponse.json()
                    leagueBrackets[league.id] = bracketData
                  }
                }
              }
            }
          }
        } catch (error) {
          leagueBrackets[league.id] = null
        }
      }

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

          // Get point values from active season or use defaults
          const pointsWin = activeSeason?.points_win ?? 2
          const pointsLoss = activeSeason?.points_loss ?? 0
          const pointsTie = activeSeason?.points_tie ?? 1

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
              homeTeam.points += pointsWin
              awayTeam.losses++
              awayTeam.points += pointsLoss
            } else if (game.away_score > game.home_score) {
              awayTeam.wins++
              awayTeam.points += pointsWin
              homeTeam.losses++
              homeTeam.points += pointsLoss
            } else {
              homeTeam.ties++
              awayTeam.ties++
              homeTeam.points += pointsTie
              awayTeam.points += pointsTie
            }
          })

          const standings = Object.values(teamStats).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            return b.gf - b.ga - (a.gf - a.ga)
          })

          // Get upcoming games for this league (next 7 days) - both regular season and playoff games
          const regularSeasonGames = gamesData.filter(g => {
            const gameDate = new Date(g.game_date)
            const isUpcoming = gameDate >= today && gameDate <= nextWeek && !g.home_score
            const isLeagueGame = leagueTeams.some(t => t.id === g.home_team_id || t.id === g.away_team_id)
            return isUpcoming && isLeagueGame
          })

          // Get upcoming playoff games
          const playoffGames = []
          if (leagueBrackets[league.id]?.matches) {
            leagueBrackets[league.id].matches.forEach(match => {
              if (match.game_date && !match.winner_id && match.team1_id && match.team2_id) {
                const gameDate = new Date(match.game_date)
                if (gameDate >= today && gameDate <= nextWeek) {
                  playoffGames.push({
                    id: `playoff-${match.id}`,
                    home_team_name: match.team1_name,
                    away_team_name: match.team2_name,
                    game_date: match.game_date,
                    game_time: match.game_time,
                    rink_name: match.rink_name,
                    surface_name: match.surface_name,
                    isPlayoff: true,
                    round: match.round
                  })
                }
              }
            })
          }

          const upcomingGames = [...regularSeasonGames, ...playoffGames]
            .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))
            .slice(0, 5)

          // Group players by team for this league
          const teamRosters = leagueTeams.reduce((acc, team) => {
            acc[team.id] = playersData
              .filter(p => p.team_id === team.id)
              .sort((a, b) => {
                // Sort by position (captain first), then by jersey number, then by name
                if (a.position === 'captain' && b.position !== 'captain') return -1
                if (b.position === 'captain' && a.position !== 'captain') return 1
                if (a.jersey_number && b.jersey_number) return a.jersey_number - b.jersey_number
                return (a.name || '').localeCompare(b.name || '')
              })
            return acc
          }, {})

          return {
            league,
            activeSeason,
            standings,
            upcomingGames,
            announcements: leagueAnnouncements[league.id] || [],
            bracket: leagueBrackets[league.id] || null,
            teams: leagueTeams,
            teamRosters
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
                Sign In/Register
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
              Sign In/Register
            </Link>
          )}
        </div>
      </div>
    )
  }

  const toggleLeagueCollapse = (leagueId) => {
    const newCollapsed = { ...collapsedLeagues, [leagueId]: !collapsedLeagues[leagueId] }
    setCollapsedLeagues(newCollapsed)
    localStorage.setItem('collapsedLeagues', JSON.stringify(newCollapsed))
  }

  const toggleLeagueStar = (leagueId) => {
    const newStarred = { ...starredLeagues, [leagueId]: !starredLeagues[leagueId] }
    setStarredLeagues(newStarred)
    localStorage.setItem('starredLeagues', JSON.stringify(newStarred))
  }

  // Filter leagues based on URL parameter if provided
  let displayLeagues = leagueFilter
    ? leagueData.filter(({ league }) =>
        league.name.toLowerCase() === leagueFilter.toLowerCase() ||
        league.id.toString() === leagueFilter
      )
    : leagueData

  // Apply role-based filtering for authenticated users
  if (isAuthenticated && user) {
    if (user.role === 'admin') {
      // Admin sees all leagues - no filtering needed
    } else if (user.role === 'league_manager' || user.role === 'player') {
      // League managers and players only see leagues they have access to
      if (userLeagueIds.length > 0) {
        displayLeagues = displayLeagues.filter(({ league }) =>
          userLeagueIds.includes(league.id)
        )
      } else {
        // If user has no league assignments, show no leagues
        displayLeagues = []
      }
    }
  }

  // Sort leagues: starred leagues first, then by name
  displayLeagues = displayLeagues.sort((a, b) => {
    const aStarred = starredLeagues[a.league.id] || false
    const bStarred = starredLeagues[b.league.id] || false
    if (aStarred && !bStarred) return -1
    if (!aStarred && bStarred) return 1
    return a.league.name.localeCompare(b.league.name)
  })

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
      </div>

      {displayLeagues.map(({ league, activeSeason, standings, upcomingGames, announcements, bracket, teams, teamRosters }) => {
        const isCollapsed = collapsedLeagues[league.id] || false
        const isStarred = starredLeagues[league.id] || false

        return (
          <div key={league.id} className={`mb-12 ${isMultipleLeagues ? 'border-2 border-gray-200 rounded-lg p-6 bg-white shadow-sm' : ''}`}>
            {/* League Header - always show for multiple leagues, enhanced with season info */}
            {isMultipleLeagues && (
              <div className="mb-6 pb-4 border-b-2 border-gray-200">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleLeagueCollapse(league.id)}
                      className="btn-secondary p-2 flex-shrink-0"
                      title={isCollapsed ? 'Expand league' : 'Collapse league'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isCollapsed ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleLeagueStar(league.id)}
                      className="p-2 flex-shrink-0"
                      title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg className={`w-6 h-6 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {league.name}
                      </h2>
                      {league.description && (
                        <p className="text-gray-600">{league.description}</p>
                      )}
                    </div>
                  </div>
                  {activeSeason && (
                    <div className="flex flex-col items-end gap-2">
                      <span className="badge badge-success text-sm px-3 py-1">
                        {activeSeason.name}
                      </span>
                      {activeSeason.start_date && activeSeason.end_date && (
                        <span className="text-xs text-gray-500">
                          {new Date(activeSeason.start_date).toLocaleDateString()} - {new Date(activeSeason.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* League content - hide when collapsed */}
            {(!isMultipleLeagues || !isCollapsed) && (
              <div>

          {/* Announcements - topmost element */}
          {announcements && announcements.length > 0 && (
            <div className="mb-8 space-y-3">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="card bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-amber-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                      <p className="text-gray-700 text-sm mb-2">{announcement.message}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Posted {new Date(announcement.created_at).toLocaleDateString()}</span>
                        {announcement.expires_at && (
                          <span>Expires {new Date(announcement.expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Playoff Bracket */}
          {bracket && bracket.bracket && bracket.matches && (
            <div className="card mb-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 flex-wrap">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {isMultipleLeagues ? `${league.name} - ${bracket.bracket.name}` : bracket.bracket.name}
                  {isMultipleLeagues && activeSeason && (
                    <span className="text-sm font-normal text-gray-500 ml-2">({activeSeason.name})</span>
                  )}
                </span>
              </h3>
              <div className="overflow-x-auto pb-4">
                <div className="inline-flex gap-8 min-w-full">
                  {(() => {
                    const matchesByRound = {}
                    bracket.matches.forEach(match => {
                      if (!matchesByRound[match.round]) {
                        matchesByRound[match.round] = []
                      }
                      matchesByRound[match.round].push(match)
                    })
                    const numRounds = Object.keys(matchesByRound).length

                    return Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).map(round => (
                      <div key={round} className="flex-1 min-w-[250px]">
                        <h4 className="text-md font-semibold mb-3 text-center">
                          {round === '1' ? 'Round 1' :
                           round === '2' && numRounds === 2 ? 'Finals' :
                           round === '2' && numRounds === 3 ? 'Semifinals' :
                           round === '2' && numRounds === 4 ? 'Quarterfinals' :
                           round === '3' && numRounds === 3 ? 'Finals' :
                           round === '3' && numRounds === 4 ? 'Semifinals' :
                           round === '4' ? 'Finals' :
                           `Round ${round}`}
                        </h4>
                        <div className="space-y-6">
                          {matchesByRound[round].map((match) => (
                            <div key={match.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
                              {/* Team 1 */}
                              <div className={`p-2 border-b ${
                                match.winner_id === match.team1_id
                                  ? 'bg-green-50 border-green-200'
                                  : match.winner_id
                                  ? 'bg-gray-50'
                                  : 'bg-white'
                              }`}>
                                {match.team1_id ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: match.team1_color || '#ccc' }}
                                      />
                                      <span className="text-sm font-medium">{match.team1_name}</span>
                                      {match.winner_id === match.team1_id && (
                                        <span className="text-green-600 text-xs">✓</span>
                                      )}
                                    </div>
                                    {match.team1_score !== null && (
                                      <span className="font-bold">{match.team1_score}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-sm">TBD</span>
                                )}
                              </div>

                              {/* Team 2 */}
                              <div className={`p-2 ${
                                match.winner_id === match.team2_id
                                  ? 'bg-green-50'
                                  : match.winner_id
                                  ? 'bg-gray-50'
                                  : 'bg-white'
                              }`}>
                                {match.team2_id ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: match.team2_color || '#ccc' }}
                                      />
                                      <span className="text-sm font-medium">{match.team2_name}</span>
                                      {match.winner_id === match.team2_id && (
                                        <span className="text-green-600 text-xs">✓</span>
                                      )}
                                    </div>
                                    {match.team2_score !== null && (
                                      <span className="font-bold">{match.team2_score}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-sm">TBD</span>
                                )}
                              </div>

                              {/* Match Details */}
                              {(match.game_date || match.rink_name) && (
                                <div className="px-2 py-1 bg-gray-50 border-t text-xs text-gray-600">
                                  {match.game_date && (
                                    <div>
                                      {new Date(match.game_date).toLocaleDateString()}
                                      {match.game_time && ` ${match.game_time}`}
                                    </div>
                                  )}
                                  {match.rink_name && <div>{match.rink_name}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Standings */}
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">
                {isMultipleLeagues ? `${league.name} - Standings` : 'Standings'}
                {isMultipleLeagues && activeSeason && (
                  <span className="text-sm font-normal text-gray-500 ml-2">({activeSeason.name})</span>
                )}
              </h3>
              {standings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No games played yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">#</th>
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-center py-3 px-4">W</th>
                        <th className="text-center py-3 px-4">L</th>
                        <th className="text-center py-3 px-4">T</th>
                        <th className="text-center py-3 px-4 font-bold">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.slice(0, 8).map((standing, index) => (
                        <tr key={standing.team.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-semibold">{index + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: standing.team.color }}
                              />
                              <span className="font-medium">{standing.team.name}</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">{standing.wins}</td>
                          <td className="text-center py-3 px-4">{standing.losses}</td>
                          <td className="text-center py-3 px-4">{standing.ties}</td>
                          <td className="text-center py-3 px-4 font-bold">{standing.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upcoming Games */}
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">
                {isMultipleLeagues ? `${league.name} - Upcoming Games` : 'Upcoming Games This Week'}
                {isMultipleLeagues && activeSeason && (
                  <span className="text-sm font-normal text-gray-500 ml-2">({activeSeason.name})</span>
                )}
              </h3>
              {upcomingGames.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No upcoming games this week</p>
              ) : (
                <div className="space-y-3">
                  {upcomingGames.map((game) => (
                    <div key={game.id} className={`p-3 rounded ${game.isPlayoff ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {game.home_team_name} vs {game.away_team_name}
                        </span>
                        {game.isPlayoff && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded font-medium">
                            Playoff
                          </span>
                        )}
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
                          {game.rink_name}{game.surface_name ? ` - ${game.surface_name}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Rosters */}
          {teams && teams.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">
                {isMultipleLeagues ? `${league.name} - Team Rosters` : 'Team Rosters'}
                {isMultipleLeagues && activeSeason && (
                  <span className="text-sm font-normal text-gray-500 ml-2">({activeSeason.name})</span>
                )}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map((team) => (
                  <div key={team.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: team.color }}
                      />
                      <h4 className="font-semibold text-gray-900">{team.name}</h4>
                    </div>
                    {teamRosters[team.id] && teamRosters[team.id].length > 0 ? (
                      <div className="space-y-2">
                        {teamRosters[team.id].map((player) => (
                          <div key={player.id} className="flex items-center gap-2 text-sm">
                            {player.jersey_number && (
                              <span className="text-gray-500 font-mono w-6">#{player.jersey_number}</span>
                            )}
                            <span className="flex-1">{player.name}</span>
                            {player.position === 'captain' && (
                              <span className="text-xs px-2 py-0.5 bg-ice-100 text-ice-700 rounded font-medium">
                                C
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No players on roster</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Subscription */}
          <div className="card bg-blue-50">
            <h3 className="text-xl font-semibold mb-3">
              {isMultipleLeagues ? `${league.name} - Subscribe to Game Calendar` : 'Subscribe to Game Calendar'}
            </h3>
            <p className="text-gray-600 mb-4">
              Subscribe to automatically sync games to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.). Your calendar will stay up-to-date as new games are added.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">All League Games</label>
                <a
                  href={`${API_URL}/api/calendar/league/${league.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-block"
                >
                  Subscribe to All Games
                </a>
              </div>
              {teams && teams.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Individual Team Games</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {teams.map((team) => (
                      <a
                        key={team.id}
                        href={`${API_URL}/api/calendar/team/${team.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs py-2 flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded text-xs text-gray-700">
              <p className="font-semibold mb-1">📅 How to subscribe:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Desktop:</strong> Click a link above to open in your calendar app</li>
                <li><strong>iPhone/iPad:</strong> Tap a link and choose "Subscribe" when prompted</li>
              </ul>
              <p className="mt-2 text-gray-600">Calendars refresh automatically every hour with new games and updates.</p>
            </div>
          </div>
            </div>
          )}
        </div>
      )
    })}


    </div>
  )
}
