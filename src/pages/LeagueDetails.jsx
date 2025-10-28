import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { leagues, teams as teamsApi, games as gamesApi, seasons, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function LeagueDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview')
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    color: '#0284c7',
  })

  useEffect(() => {
    fetchLeagueData()
  }, [id])

  const fetchLeagueData = async () => {
    try {
      const [leaguesData, teamsData, gamesData, managersData] = await Promise.all([
        leagues.getAll(),
        teamsApi.getAll(),
        gamesApi.getAll(),
        leagues.getManagers(id).catch(() => []),
      ])

      const leagueData = leaguesData.find(l => l.id === parseInt(id))
      setLeague(leagueData)

      // Filter teams for this league
      setTeams(teamsData.filter(t => t.league_id === parseInt(id)))

      // Filter games for teams in this league
      const leagueTeamIds = teamsData.filter(t => t.league_id === parseInt(id)).map(t => t.id)
      setGames(gamesData.filter(g => leagueTeamIds.includes(g.home_team_id)))

      // Set managers/owners
      setManagers(managersData)
    } catch (error) {
      console.error('Error fetching league data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    const isArchived = league.archived === 1
    const action = isArchived ? 'unarchive' : 'archive'

    const message = isArchived
      ? `Are you sure you want to unarchive this league?\n\nThis will restore "${league.name}" and make all its teams, games, and schedules visible again.`
      : `Are you sure you want to archive this league?\n\nArchiving "${league.name}" will:\n• Hide this league and its season data from active views\n• Preserve all teams, games, and player data\n• Allow you to unarchive it later if needed\n\nThis is useful for completed seasons you want to keep but not display.`

    if (!confirm(message)) {
      return
    }

    try {
      await leagues.archive(id, !isArchived)
      // Refresh the league data
      fetchLeagueData()
    } catch (error) {
      alert(`Error ${action}ing league: ` + error.message)
    }
  }

  const handleTeamSubmit = async (e) => {
    e.preventDefault()
    try {
      await teamsApi.create({
        ...teamFormData,
        league_id: id,
      })
      setTeamFormData({ name: '', color: '#0284c7' })
      setShowTeamForm(false)
      fetchLeagueData()
    } catch (error) {
      alert('Error creating team: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading league details...</div>
  }

  if (!league) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">League not found</p>
        <button onClick={() => navigate('/leagues')} className="btn-primary">
          Back to Leagues
        </button>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leagues', href: '/leagues' },
          { label: league?.name || 'Loading...' }
        ]}
      />

      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {league.name}
              {league.archived === 1 && (
                <span className="ml-3 text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                  Archived
                </span>
              )}
            </h1>
            {league.season && <p className="text-gray-600">Season: {league.season}</p>}
            {league.description && <p className="text-gray-600 mt-2">{league.description}</p>}
          </div>
          <button
            onClick={handleArchive}
            className={league.archived === 1 ? "btn-primary" : "btn-secondary text-amber-600"}
          >
            {league.archived === 1 ? 'Unarchive League' : 'Archive League'}
          </button>
        </div>
      </div>

      {/* League Contacts */}
      {managers.length > 0 && (
        <div className="card mb-6 bg-ice-50 border-ice-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <span className="text-2xl mr-2">👥</span>
              League Contact{managers.length > 1 ? 's' : ''}
            </h3>
            <button className="btn-primary text-sm">
              📧 Contact All
            </button>
          </div>
          <div className="space-y-2">
            {managers.map((manager) => (
              <div key={manager.id} className="flex items-center justify-between p-3 bg-white rounded">
                <div>
                  <div className="font-medium">{manager.name || 'No name'}</div>
                  <div className="text-sm text-gray-600">
                    {manager.email}
                    {manager.phone && <span className="ml-2">• {manager.phone}</span>}
                  </div>
                </div>
                <a href={`mailto:${manager.email}`} className="btn-secondary text-xs">
                  Email
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teams'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'schedule'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Schedule ({games.length})
          </button>
          <button
            onClick={() => setActiveTab('seasons')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'seasons'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Seasons
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'payments'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payments
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Upcoming Games Banner */}
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">Upcoming Games This Week</h3>
            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const oneWeekFromNow = new Date(today)
              oneWeekFromNow.setDate(today.getDate() + 7)

              const upcomingGames = games
                .filter(g => {
                  const gameDate = new Date(g.game_date)
                  return gameDate >= today && gameDate <= oneWeekFromNow && !g.home_score
                })
                .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))

              return upcomingGames.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No games scheduled this week</p>
              ) : (
                <div className="space-y-3">
                  {upcomingGames.map((game) => (
                    <div key={game.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: game.home_team_color || '#0284c7' }}
                            />
                            <span className="font-medium text-sm">{game.home_team_name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: game.away_team_color || '#0284c7' }}
                            />
                            <span className="font-medium text-sm">{game.away_team_name}</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-xs text-gray-600">
                            {new Date(game.game_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-xs text-gray-600">{game.game_time}</div>
                          <div className="text-xs text-gray-500">{game.rink_name}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Standings Banner */}
          <div className="card mb-8">
            <h3 className="text-xl font-semibold mb-4">Standings</h3>
            {(() => {
              const completedGames = games.filter(g => g.home_score != null && g.away_score != null)

              if (completedGames.length === 0) {
                return <p className="text-gray-500 text-center py-8">No completed games yet</p>
              }

              const teamStats = {}
              teams.forEach(team => {
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

              const sortedStandings = Object.values(teamStats)
                .sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points
                  return (b.gf - b.ga) - (a.gf - a.ga)
                })

              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Team</th>
                        <th className="text-center py-2 px-2">W</th>
                        <th className="text-center py-2 px-2">L</th>
                        <th className="text-center py-2 px-2">T</th>
                        <th className="text-center py-2 px-2">GF</th>
                        <th className="text-center py-2 px-2">GA</th>
                        <th className="text-center py-2 px-2">DIFF</th>
                        <th className="text-center py-2 px-2 font-bold">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStandings.map((standing, index) => (
                        <tr key={standing.team.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-semibold">{index + 1}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: standing.team.color }}
                              />
                              <span className="font-medium">{standing.team.name}</span>
                            </div>
                          </td>
                          <td className="text-center py-2 px-2">{standing.wins}</td>
                          <td className="text-center py-2 px-2">{standing.losses}</td>
                          <td className="text-center py-2 px-2">{standing.ties}</td>
                          <td className="text-center py-2 px-2">{standing.gf}</td>
                          <td className="text-center py-2 px-2">{standing.ga}</td>
                          <td className="text-center py-2 px-2">
                            {standing.gf - standing.ga > 0 ? '+' : ''}
                            {standing.gf - standing.ga}
                          </td>
                          <td className="text-center py-2 px-2 font-bold">{standing.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-3xl font-bold text-ice-600">{teams.length}</div>
              <div className="text-gray-600">Teams</div>
            </div>
            <div className="card">
              <div className="text-3xl mb-2">🏒</div>
              <div className="text-3xl font-bold text-ice-600">{games.length}</div>
              <div className="text-gray-600">Games Scheduled</div>
            </div>
            <div className="card">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-3xl font-bold text-ice-600">
                {games.filter(g => g.home_score != null).length}
              </div>
              <div className="text-gray-600">Games Completed</div>
            </div>
          </div>

          {/* Season Dues Information */}
          {(league.season_dues || league.venmo_link) && (
            <div className="card mb-8 bg-green-50 border-green-200">
              <h3 className="text-xl font-semibold mb-4">Season Dues</h3>
              {league.season_dues && (
                <div className="mb-3">
                  <span className="text-2xl font-bold text-green-700">${parseFloat(league.season_dues).toFixed(2)}</span>
                  <span className="text-gray-600 ml-2">per player</span>
                </div>
              )}
              {league.venmo_link && (
                <a
                  href={league.venmo_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-block"
                >
                  💰 Pay via Venmo
                </a>
              )}
            </div>
          )}

          {/* League Owners/Managers */}
          {managers.length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">League Owners & Managers</h3>
              <div className="space-y-3">
                {managers.map((manager) => (
                  <div key={manager.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{manager.name}</div>
                      {manager.email && (
                        <div className="text-sm text-gray-600">{manager.email}</div>
                      )}
                    </div>
                    {manager.email && (
                      <a
                        href={`mailto:${manager.email}`}
                        className="btn-secondary text-sm"
                      >
                        📧 Contact
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div>
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowTeamForm(!showTeamForm)}
              className="btn-primary"
            >
              {showTeamForm ? 'Cancel' : '+ Add Team'}
            </button>
          </div>

          {showTeamForm && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold mb-4">Add Team to {league.name}</h2>
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div>
                  <label className="label">Team Name</label>
                  <input
                    type="text"
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Ice Hawks"
                    required
                  />
                </div>

                <div>
                  <label className="label">Team Color</label>
                  <input
                    type="color"
                    value={teamFormData.color}
                    onChange={(e) => setTeamFormData({ ...teamFormData, color: e.target.value })}
                    className="input h-12"
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Create Team
                </button>
              </form>
            </div>
          )}

          {teams.length === 0 && !showTeamForm ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No teams in this league yet</p>
              <p className="text-sm text-gray-400">Click "Add Team" to create your first team</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {teams.map((team) => (
                <div key={team.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-3">
                    <div
                      className="w-8 h-8 rounded-full mr-3"
                      style={{ backgroundColor: team.color }}
                    />
                    <h3 className="text-xl font-semibold">{team.name}</h3>
                  </div>
                  {team.captains && team.captains.length > 0 && (
                    <div className="mb-3 p-2 bg-ice-50 rounded">
                      <div className="text-xs text-gray-600 font-medium mb-1">
                        Captain{team.captains.length > 1 ? 's' : ''}:
                      </div>
                      {team.captains.map((captain, idx) => (
                        <div key={idx} className="text-sm font-medium text-ice-700">
                          ⭐ {captain.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/teams/${team.id}/roster?league=${id}`)}
                    className="btn-primary text-sm w-full"
                  >
                    View Roster
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          {games.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No games scheduled yet</p>
              <button onClick={() => navigate('/games')} className="btn-primary">
                Schedule Games
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => (
                <div key={game.id} className="card">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{game.home_team_name} vs {game.away_team_name}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(game.game_date).toLocaleDateString()} at {game.game_time}
                      </div>
                    </div>
                    <div className="text-right">
                      {game.home_score != null ? (
                        <div className="font-bold text-lg">
                          {game.home_score} - {game.away_score}
                        </div>
                      ) : (
                        <div className="text-gray-500">Scheduled</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seasons Tab */}
      {activeTab === 'seasons' && (
        <div>
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Seasons</h2>
              <button className="btn-primary">+ Create New Season</button>
            </div>
            <div className="text-gray-500 text-center py-12">
              Seasons management coming soon...
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div>
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Payment Tracking</h2>
              <button className="btn-primary">📧 Send Payment Reminder</button>
            </div>
            <div className="text-gray-500 text-center py-12">
              Payment tracking coming soon...
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
