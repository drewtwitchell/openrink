import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { leagues, teams as teamsApi, games as gamesApi, seasons, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function LeagueDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [managers, setManagers] = useState([])
  const [leagueSeasons, setLeagueSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || location.state?.activeTab || 'overview')
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [editingSeasonId, setEditingSeasonId] = useState(null)
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    color: '#0284c7',
  })
  const [seasonFormData, setSeasonFormData] = useState({
    name: '',
    description: '',
    season_dues: '',
    venmo_link: '',
    start_date: '',
    end_date: '',
    is_active: false,
  })
  const [paymentData, setPaymentData] = useState([])
  const [paymentStats, setPaymentStats] = useState(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactMessage, setContactMessage] = useState('')

  useEffect(() => {
    fetchLeagueData()
    // Auto-open season form if coming from league creation
    if (searchParams.get('tab') === 'seasons') {
      setShowSeasonForm(true)
    }
  }, [id])

  const fetchLeagueData = async () => {
    try {
      const [leaguesData, teamsData, gamesData, managersData, seasonsData] = await Promise.all([
        leagues.getAll(true), // Include archived leagues
        teamsApi.getAll(),
        gamesApi.getAll(),
        leagues.getManagers(id).catch(() => []),
        seasons.getByLeague(id).catch(() => []),
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

      // Set seasons data
      setLeagueSeasons(seasonsData)
      const active = seasonsData.find(s => s.is_active === 1 && s.archived === 0)
      setActiveSeason(active)

      // Fetch payment data if there's an active season
      if (active) {
        fetchPaymentData(active.id)
      }
    } catch (error) {
      console.error('Error fetching league data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentData = async (seasonId) => {
    try {
      const [stats, players] = await Promise.all([
        seasons.getPaymentStats(seasonId),
        seasons.getPlayersPayments(seasonId),
      ])
      setPaymentStats(stats)
      setPaymentData(players)
    } catch (error) {
      console.error('Error fetching payment data:', error)
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

  const handleDeleteLeague = async () => {
    if (!confirm(`Delete league "${league.name}"? This will permanently delete all associated seasons, teams, games, and players. This cannot be undone.`)) {
      return
    }
    try {
      await leagues.delete(id)
      navigate('/leagues')
    } catch (error) {
      alert('Error deleting league: ' + error.message)
    }
  }

  const handleTeamSubmit = async (e) => {
    e.preventDefault()
    try {
      await teamsApi.create({
        ...teamFormData,
        league_id: id,
        season_id: activeSeason?.id || null,
      })
      setTeamFormData({ name: '', color: '#0284c7' })
      setShowTeamForm(false)
      fetchLeagueData()
    } catch (error) {
      alert('Error creating team: ' + error.message)
    }
  }

  const handleSeasonSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...seasonFormData,
        league_id: id,
      }

      if (editingSeasonId) {
        await seasons.update(editingSeasonId, data)
      } else {
        await seasons.create(data)
      }

      setSeasonFormData({
        name: '',
        description: '',
        season_dues: '',
        venmo_link: '',
        start_date: '',
        end_date: '',
        is_active: false,
      })
      setEditingSeasonId(null)
      setShowSeasonForm(false)
      fetchLeagueData()
    } catch (error) {
      alert('Error saving season: ' + error.message)
    }
  }

  const handleEditSeason = (season) => {
    setSeasonFormData({
      name: season.name,
      description: season.description || '',
      season_dues: season.season_dues || '',
      venmo_link: season.venmo_link || '',
      start_date: season.start_date || '',
      end_date: season.end_date || '',
      is_active: season.is_active === 1,
    })
    setEditingSeasonId(season.id)
    setShowSeasonForm(true)
  }

  const handleArchiveSeason = async (seasonId, archived) => {
    try {
      await seasons.archive(seasonId, archived)
      fetchLeagueData()
    } catch (error) {
      alert('Error archiving season: ' + error.message)
    }
  }

  const handleSetActiveSeason = async (seasonId) => {
    try {
      await seasons.setActive(seasonId)
      fetchLeagueData()
    } catch (error) {
      alert('Error setting active season: ' + error.message)
    }
  }

  const handleDeleteSeason = async (seasonId) => {
    if (!confirm('Are you sure you want to delete this season? This will also delete all associated teams, games, and payment records.')) {
      return
    }
    try {
      await seasons.delete(seasonId)
      fetchLeagueData()
    } catch (error) {
      alert('Error deleting season: ' + error.message)
    }
  }

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`Delete team "${teamName}"? This will also delete all players on this team.`)) {
      return
    }
    try {
      await teamsApi.delete(teamId)
      fetchLeagueData()
    } catch (error) {
      alert('Error deleting team: ' + error.message)
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

      <div className="page-header mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="page-title">{league.name}</h1>
            {league.archived === 1 && (
              <span className="badge badge-warning">Archived</span>
            )}
          </div>
          {league.description && <p className="page-subtitle">{league.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleArchive}
            className={league.archived === 1 ? "btn-primary" : "btn-secondary"}
          >
            {league.archived === 1 ? 'Unarchive League' : 'Archive League'}
          </button>
          <button
            onClick={handleDeleteLeague}
            className="btn-danger"
          >
            Delete League
          </button>
        </div>
      </div>

      {/* League Contacts */}
      {managers.length > 0 && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="section-header mb-0">
              League Contact{managers.length > 1 ? 's' : ''}
            </h3>
            <button
              onClick={() => setShowContactModal(true)}
              className="btn-primary"
            >
              Contact All Players
            </button>
          </div>
          <div className="space-y-2">
            {managers.map((manager) => (
              <div key={manager.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">{manager.name || 'No name'}</div>
                  <div className="text-sm text-gray-600">
                    {manager.email}
                    {manager.phone && <span className="ml-2">• {manager.phone}</span>}
                  </div>
                </div>
                <a href={`mailto:${manager.email}`} className="btn-secondary text-sm">
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
            Seasons ({leagueSeasons.length})
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
          {canManage && (
            <button
              onClick={() => navigate(`/leagues/${id}/announcements`)}
              className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Announcements
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Active Season Info */}
          {activeSeason ? (
            <div className="card mb-6 bg-green-50 border-green-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-green-900 mb-2">
                    Current Season: {activeSeason.name}
                  </h3>
                  {activeSeason.description && (
                    <p className="text-gray-700 mb-3">{activeSeason.description}</p>
                  )}
                  <div className="flex gap-4 text-sm text-gray-600">
                    {activeSeason.start_date && (
                      <div>
                        <span className="font-medium">Start:</span>{' '}
                        {new Date(activeSeason.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {activeSeason.end_date && (
                      <div>
                        <span className="font-medium">End:</span>{' '}
                        {new Date(activeSeason.end_date).toLocaleDateString()}
                      </div>
                    )}
                    {activeSeason.season_dues && (
                      <div>
                        <span className="font-medium">Dues:</span> ${parseFloat(activeSeason.season_dues).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          ) : leagueSeasons.length > 0 ? (
            <div className="card mb-6 bg-amber-50 border-amber-200">
              <p className="text-amber-900">
                No active season. <button onClick={() => setActiveTab('seasons')} className="text-amber-700 underline font-medium">Set one as active</button> to enable full league features.
              </p>
            </div>
          ) : null}

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
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No games scheduled this week</p>
                  <button onClick={() => setActiveTab('schedule')} className="btn-secondary">
                    View Full Schedule
                  </button>
                </div>
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
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Standings will appear once games are completed</p>
                    <button onClick={() => setActiveTab('schedule')} className="btn-secondary">
                      View Schedule
                    </button>
                  </div>
                )
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
                          {captain.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/teams/${team.id}/roster?league=${id}`)}
                      className="btn-primary text-sm flex-1"
                    >
                      View Roster
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="btn-danger text-sm px-3"
                    >
                      Delete
                    </button>
                  </div>
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
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Seasons</h2>
              <button
                onClick={() => {
                  setShowSeasonForm(!showSeasonForm)
                  setEditingSeasonId(null)
                  setSeasonFormData({
                    name: '',
                    description: '',
                    season_dues: '',
                    venmo_link: '',
                    start_date: '',
                    end_date: '',
                    is_active: false,
                  })
                }}
                className="btn-primary"
              >
                {showSeasonForm ? 'Cancel' : '+ Create New Season'}
              </button>
            </div>

            {showSeasonForm && (
              <form onSubmit={handleSeasonSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">{editingSeasonId ? 'Edit Season' : 'Create New Season'}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Season Name *</label>
                    <input
                      type="text"
                      value={seasonFormData.name}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
                      className="input"
                      placeholder="e.g., Winter 2024"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Season Dues (per player)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={seasonFormData.season_dues}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, season_dues: e.target.value })}
                      className="input"
                      placeholder="150.00"
                    />
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input
                      type="date"
                      value={seasonFormData.start_date}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, start_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input
                      type="date"
                      value={seasonFormData.end_date}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, end_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      value={seasonFormData.description}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, description: e.target.value })}
                      className="input"
                      rows="2"
                      placeholder="Season details..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Venmo Link for Payment</label>
                    <input
                      type="url"
                      value={seasonFormData.venmo_link}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, venmo_link: e.target.value })}
                      className="input"
                      placeholder="https://venmo.com/u/username"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={seasonFormData.is_active}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="is_active" className="text-sm">
                      Set as active season (will deactivate other seasons)
                    </label>
                  </div>
                </div>
                <button type="submit" className="btn-primary mt-4">
                  {editingSeasonId ? 'Update Season' : 'Create Season'}
                </button>
              </form>
            )}

            {leagueSeasons.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No seasons yet. Click "Create Season" above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leagueSeasons.map((season) => (
                  <div key={season.id} className={`p-4 border rounded-lg ${season.is_active === 1 ? 'bg-green-50 border-green-200' : season.archived === 1 ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{season.name}</h3>
                          {season.is_active === 1 && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                          {season.archived === 1 && (
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">
                              Archived
                            </span>
                          )}
                        </div>
                        {season.description && (
                          <p className="text-sm text-gray-600 mt-1">{season.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          {season.start_date && <span>Start: {new Date(season.start_date).toLocaleDateString()}</span>}
                          {season.end_date && <span>End: {new Date(season.end_date).toLocaleDateString()}</span>}
                          {season.season_dues && <span>Dues: ${parseFloat(season.season_dues).toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {season.is_active !== 1 && season.archived !== 1 && (
                          <button
                            onClick={() => handleSetActiveSeason(season.id)}
                            className="btn-secondary text-xs"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => handleEditSeason(season)}
                          className="btn-secondary text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchiveSeason(season.id, season.archived !== 1)}
                          className={`btn-secondary text-xs ${season.archived === 1 ? '' : 'text-amber-600'}`}
                        >
                          {season.archived === 1 ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          onClick={() => handleDeleteSeason(season.id)}
                          className="btn-secondary text-xs text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div>
          {!activeSeason ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No active season</p>
              <p className="text-sm text-gray-400 mb-4">Create a season first to track payments</p>
              <button onClick={() => setActiveTab('seasons')} className="btn-primary">
                Go to Seasons
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Payment Tracking</h2>
                  <p className="text-sm text-gray-600">Active Season: {activeSeason.name}</p>
                </div>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="btn-primary"
                >
                  Send Payment Reminder
                </button>
              </div>

              {/* Payment Stats */}
              {paymentStats && (
                <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Total Players</div>
                    <div className="text-2xl font-bold">{paymentStats.total_players}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Paid</div>
                    <div className="text-2xl font-bold text-green-600">{paymentStats.players_paid}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Unpaid</div>
                    <div className="text-2xl font-bold text-red-600">{paymentStats.players_unpaid}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Collected</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${parseFloat(paymentStats.total_collected || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment List */}
              {paymentData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No players in this season yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Player</th>
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-center py-3 px-4">Amount</th>
                        <th className="text-center py-3 px-4">Status</th>
                        <th className="text-center py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentData.map((player) => (
                        <tr key={player.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{player.name}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: player.team_color }}
                              />
                              {player.team_name}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{player.email || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            ${parseFloat(activeSeason.season_dues || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {player.payment_status === 'paid' ? (
                              <span className="badge badge-success">Paid</span>
                            ) : (
                              <span className="badge badge-error">Unpaid</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {player.payment_status === 'paid' ? (
                              <span className="text-xs text-gray-500">
                                {new Date(player.paid_date).toLocaleDateString()}
                              </span>
                            ) : (
                              <button className="text-xs text-ice-600 hover:text-ice-700 hover:underline">
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeSeason.venmo_link && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold mb-2">Payment Link</h3>
                  <a
                    href={activeSeason.venmo_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ice-600 hover:text-ice-700 hover:underline"
                  >
                    {activeSeason.venmo_link}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mass Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Contact All Players</h2>
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setContactMessage('')
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-gray-700">
                  This will open your default email client with all player emails in the BCC field.
                  You can then compose and send your message.
                </p>
              </div>

              <div className="mb-4">
                <label className="label">Recipients</label>
                <div className="text-sm text-gray-600">
                  {paymentData.length} player(s) will receive this message
                </div>
              </div>

              <div className="mb-4">
                <label className="label">Quick Message Template</label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="input"
                  rows="6"
                  placeholder="Type your message here (optional)..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const emails = paymentData
                      .filter(p => p.email)
                      .map(p => p.email)
                      .join(',')

                    const subject = `${league.name} - League Update`
                    const body = contactMessage || ''

                    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

                    setShowContactModal(false)
                    setContactMessage('')
                  }}
                  className="btn-primary flex-1"
                >
                  Open Email Client
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setContactMessage('')
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Note: Players without email addresses will not be included.
                {paymentData.filter(p => !p.email).length > 0 && (
                  <span className="block mt-1 text-amber-600">
                    {paymentData.filter(p => !p.email).length} player(s) do not have email addresses.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
