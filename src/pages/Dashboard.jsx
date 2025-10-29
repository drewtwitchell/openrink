import { useEffect, useState } from 'react'
import { auth, leagues, teams, players, seasons } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'

// Admin-only: User Management Card
function UsersManagementCard() {
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const users = await auth.getAllUsers()
      setAllUsers(users)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await auth.updateUserRole(userId, newRole)
      setMessage('Role updated successfully')
      fetchUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating role: ' + error.message)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading users...</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">User Management</h2>
      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Phone</th>
              <th className="text-left py-3 px-4">Role</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{user.name || '-'}</td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">{user.phone || '-'}</td>
                <td className="py-3 px-4">
                  <select
                    value={user.role || 'player'}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="input text-sm py-1"
                  >
                    <option value="player">Player</option>
                    <option value="league_manager">League Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [userPlayerProfiles, setUserPlayerProfiles] = useState([])
  const [userLeagues, setUserLeagues] = useState([]) // All leagues user is a player in
  const [leagueData, setLeagueData] = useState(null) // Deprecated: keeping for backwards compatibility
  const [teamsData, setTeamsData] = useState([])
  const [allTeams, setAllTeams] = useState([]) // All teams across all leagues
  const [managedLeagues, setManagedLeagues] = useState([])
  const [leagueSeasons, setLeagueSeasons] = useState({})
  const [paymentStats, setPaymentStats] = useState({})
  const [allLeagues, setAllLeagues] = useState([])
  const [leagueDetails, setLeagueDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [showLeagueForm, setShowLeagueForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [expandedTeams, setExpandedTeams] = useState({})
  const [expandedLeagues, setExpandedLeagues] = useState({})
  const [teamRosters, setTeamRosters] = useState({})
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, league: null })

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)
    fetchDashboardData(currentUser)
  }, [])

  const fetchDashboardData = async (currentUser) => {
    try {
      const [leaguesData, teamsDataAll, playersData] = await Promise.all([
        leagues.getAll(true),
        teams.getAll(),
        players.getAll(),
      ])

      // Store all teams for reference
      setAllTeams(teamsDataAll)

      // Find player profiles linked to this user
      if (currentUser) {
        const userProfiles = playersData.filter(p => p.user_id === currentUser.id)
        console.log('DEBUG: userProfiles =', userProfiles)
        if (userProfiles.length > 0) {
          console.log('DEBUG: First profile team_name =', userProfiles[0].team_name)
          console.log('DEBUG: First profile team_color =', userProfiles[0].team_color)
          console.log('DEBUG: First profile is_captain =', userProfiles[0].is_captain)
        }
        setUserPlayerProfiles(userProfiles)

        // Get ALL leagues the player is a member of
        if (userProfiles.length > 0) {
          const playerLeagueIds = [...new Set(
            userProfiles.map(profile => {
              const team = teamsDataAll.find(t => t.id === profile.team_id)
              return team?.league_id
            }).filter(Boolean)
          )]

          const playerLeagues = leaguesData.filter(l => playerLeagueIds.includes(l.id))
          setUserLeagues(playerLeagues)

          // For backwards compatibility, set first league as leagueData
          if (playerLeagues.length > 0) {
            setLeagueData(playerLeagues[0])
            const leagueTeams = teamsDataAll.filter(t => t.league_id === playerLeagues[0].id)
            setTeamsData(leagueTeams)
          }
        }

        // Get managed leagues (check league_managers table)
        const managersData = await Promise.all(
          leaguesData.map(l => leagues.getManagers(l.id).catch(() => []))
        )

        const userManagedLeagues = leaguesData.filter((league, index) => {
          const managers = managersData[index]
          return managers.some(m => m.user_id === currentUser.id)
        })

        setManagedLeagues(userManagedLeagues)

        // Fetch seasons and payment stats for managed leagues
        const seasonsData = {}
        const statsData = {}

        for (const league of userManagedLeagues) {
          const leagueSeasons = await seasons.getByLeague(league.id)
          seasonsData[league.id] = leagueSeasons

          const activeSeason = leagueSeasons.find(s => s.is_active === 1 && s.archived === 0)
          if (activeSeason) {
            try {
              const stats = await seasons.getPaymentStats(activeSeason.id)
              // Ensure we always have a stats object, even if API returns null
              statsData[league.id] = stats || {
                total_players: 0,
                players_paid: 0,
                players_unpaid: 0,
                total_collected: 0
              }
            } catch (error) {
              console.error(`Error fetching payment stats for league ${league.id}:`, error)
              // Provide default stats on error
              statsData[league.id] = {
                total_players: 0,
                players_paid: 0,
                players_unpaid: 0,
                total_collected: 0
              }
            }
          }
        }

        setLeagueSeasons(seasonsData)
        setPaymentStats(statsData)

        // For admin: Get all leagues with details
        if (currentUser.role === 'admin') {
          setAllLeagues(leaguesData)

          const details = {}
          for (const league of leaguesData) {
            const leagueTeams = teamsDataAll.filter(t => t.league_id === league.id)

            let activeSeason = null
            let paymentStatsForLeague = null
            try {
              activeSeason = await seasons.getActive(league.id)
              if (activeSeason) {
                paymentStatsForLeague = await seasons.getPaymentStats(activeSeason.id)
                // Ensure we always have a stats object
                if (!paymentStatsForLeague) {
                  paymentStatsForLeague = {
                    total_players: 0,
                    players_paid: 0,
                    players_unpaid: 0,
                    total_collected: 0
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching season/stats for league ${league.id}:`, error)
              // If there was an active season but stats failed, provide defaults
              if (activeSeason) {
                paymentStatsForLeague = {
                  total_players: 0,
                  players_paid: 0,
                  players_unpaid: 0,
                  total_collected: 0
                }
              }
            }

            details[league.id] = {
              teams: leagueTeams,
              activeSeason,
              paymentStats: paymentStatsForLeague
            }
          }

          setLeagueDetails(details)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLeague = async (e) => {
    e.preventDefault()
    try {
      const response = await leagues.create(formData)
      setFormData({ name: '', description: '' })
      setShowLeagueForm(false)
      navigate(`/leagues/${response.id}?tab=seasons`)
    } catch (error) {
      alert('Error creating league: ' + error.message)
    }
  }

  const handleDeleteLeague = (e, league) => {
    e.stopPropagation() // Prevent navigation
    setDeleteModal({ isOpen: true, league })
  }

  const confirmDeleteLeague = async () => {
    const league = deleteModal.league
    if (!league) return

    try {
      await leagues.delete(league.id)
      // Refresh dashboard data
      await fetchDashboardData(user)
    } catch (error) {
      alert('Error deleting league: ' + error.message)
    }
  }

  const handleToggleArchiveLeague = async (e, league) => {
    e.stopPropagation() // Prevent navigation

    const action = league.archived === 1 ? 'unarchive' : 'archive'

    try {
      // Archive API takes (id, archived) where archived is a boolean
      await leagues.archive(league.id, league.archived === 0)
      // Refresh dashboard data
      await fetchDashboardData(user)
    } catch (error) {
      alert(`Error ${action}ing league: ` + error.message)
    }
  }

  const toggleTeamRoster = async (teamId) => {
    // Toggle expanded state
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }))

    // Fetch roster if not already loaded
    if (!teamRosters[teamId]) {
      try {
        const roster = await players.getByTeam(teamId)
        setTeamRosters(prev => ({
          ...prev,
          [teamId]: roster
        }))
      } catch (error) {
        console.error('Error fetching roster:', error)
      }
    }
  }

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || user?.email}</p>
      </div>

      <div className="space-y-6">
        {/* Player Info Section - All Leagues */}
        {userPlayerProfiles.length > 0 && userLeagues.length > 0 && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-6">
              My Teams {userLeagues.length > 1 && <span className="text-sm font-normal text-gray-500">({userLeagues.length} leagues)</span>}
            </h2>

            {/* Display teams grouped by league */}
            <div className="space-y-6">
              {userLeagues.map((league) => {
                const leagueProfiles = userPlayerProfiles.filter(profile => {
                  const team = allTeams.find(t => t.id === profile.team_id)
                  return team && team.league_id === league.id
                })

                return (
                  <div key={league.id} className={`border-2 rounded-lg p-5 ${userLeagues.length > 1 ? 'border-ice-200 bg-gradient-to-r from-ice-50/30 to-white' : 'border-transparent'}`}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{league.name}</h3>
                        {league.description && (
                          <p className="text-sm text-gray-600 mt-1">{league.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/leagues/${league.id}`)}
                        className="btn-primary text-sm whitespace-nowrap"
                      >
                        View League
                      </button>
                    </div>

                    <div className="space-y-4">
                      {leagueProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-5 bg-gradient-to-r from-ice-50 to-white border border-ice-200 rounded-lg"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      {profile.jersey_number && (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0"
                          style={{ backgroundColor: profile.team_color || '#0284c7' }}
                        >
                          {profile.jersey_number}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-bold text-lg text-gray-900 mb-1">{profile.team_name}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-2 mb-3">
                          <span>{profile.name}</span>
                          {profile.is_captain === 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                              ⭐ Captain
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-sm">
                          {profile.email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <a href={`mailto:${profile.email}`} className="hover:text-ice-600">
                                {profile.email}
                              </a>
                            </div>
                          )}
                          {profile.phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <a href={`tel:${profile.phone}`} className="hover:text-ice-600">
                                {profile.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleTeamRoster(profile.team_id)}
                        className="btn-secondary text-sm flex-shrink-0"
                      >
                        {expandedTeams[profile.team_id] ? 'Hide Roster' : 'View Roster'}
                      </button>
                    </div>

                    {/* Inline Roster Display */}
                    {expandedTeams[profile.team_id] && (
                      <div className="mt-4 pt-4 border-t border-ice-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Team Roster</h4>
                          {(user?.role === 'admin' || managedLeagues.some(ml => ml.id === leagueData?.id)) && (
                            <button
                              onClick={() => navigate(`/teams/${profile.team_id}/roster`)}
                              className="btn-primary text-xs"
                            >
                              Manage Roster
                            </button>
                          )}
                        </div>
                        {teamRosters[profile.team_id] ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2">#</th>
                                  <th className="text-left py-2 px-2">Name</th>
                                  <th className="text-left py-2 px-2">Position</th>
                                  <th className="text-left py-2 px-2">Email</th>
                                  <th className="text-left py-2 px-2">Phone</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamRosters[profile.team_id].map((player) => (
                                  <tr key={player.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-2">
                                      {player.jersey_number ? (
                                        <div
                                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                          style={{ backgroundColor: profile.team_color || '#0284c7' }}
                                        >
                                          {player.jersey_number}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-2">
                                        {player.name}
                                        {player.is_captain === 1 && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                                            ⭐ C
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 capitalize">{player.position || 'player'}</td>
                                    <td className="py-2 px-2">
                                      {player.email ? (
                                        <a href={`mailto:${player.email}`} className="text-ice-600 hover:underline">
                                          {player.email}
                                        </a>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2">
                                      {player.phone ? (
                                        <a href={`tel:${player.phone}`} className="text-ice-600 hover:underline">
                                          {player.phone}
                                        </a>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Loading roster...</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}


        {/* League Management Section */}
        {managedLeagues.length > 0 && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-6">Leagues I Manage</h2>
            <div className="space-y-4">
              {managedLeagues.map((league) => {
                const seasons = leagueSeasons[league.id] || []
                const stats = paymentStats[league.id]
                const activeSeason = seasons.find(s => s.is_active === 1 && s.archived === 0)

                return (
                  <div key={league.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold">{league.name}</h3>
                          {league.archived === 1 && (
                            <span className="badge badge-neutral">Archived</span>
                          )}
                        </div>
                        {league.description && (
                          <p className="text-sm text-gray-600">{league.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/leagues/${league.id}`)}
                        className="btn-primary text-sm whitespace-nowrap ml-4"
                      >
                        Manage League
                      </button>
                    </div>

                    {activeSeason && stats && (
                      <div className="p-3 bg-ice-50 rounded-lg border border-ice-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                          Active Season: {activeSeason.name}
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center text-sm">
                          <div>
                            <div className="text-xs text-gray-600">Total</div>
                            <div className="font-semibold text-gray-900">{stats.total_players}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Paid</div>
                            <div className="font-semibold text-green-600">{stats.players_paid}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Unpaid</div>
                            <div className="font-semibold text-red-600">{stats.players_unpaid}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Collected</div>
                            <div className="font-semibold text-gray-900">${parseFloat(stats.total_collected || 0).toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Create League Button */}
            <div className="mt-6 pt-6 border-t">
              <button
                onClick={() => setShowLeagueForm(!showLeagueForm)}
                className="btn-secondary w-full"
              >
                {showLeagueForm ? 'Cancel' : 'Create New League'}
              </button>

              {showLeagueForm && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Create New League</h3>
                  <form onSubmit={handleCreateLeague} className="space-y-4">
                    <div>
                      <label className="label">League Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input"
                        placeholder="e.g., Monday Night Hockey League"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input"
                        rows="3"
                        placeholder="Brief description of your league..."
                      />
                    </div>
                    <button type="submit" className="btn-primary w-full">
                      Create League
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Section: All Leagues */}
        {isAdmin && (
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">All Leagues</h2>
                <p className="text-sm text-gray-600 mt-1">{allLeagues.length} total leagues</p>
              </div>
              {!showLeagueForm && managedLeagues.length === 0 && (
                <button
                  onClick={() => setShowLeagueForm(!showLeagueForm)}
                  className="btn-primary"
                >
                  Create League
                </button>
              )}
            </div>

            {showLeagueForm && managedLeagues.length === 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">Create New League</h3>
                <form onSubmit={handleCreateLeague} className="space-y-4">
                  <div>
                    <label className="label">League Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      placeholder="e.g., Monday Night Hockey League"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input"
                      rows="3"
                      placeholder="Brief description of your league..."
                    />
                  </div>
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    After creating the league, you'll be able to add seasons with payment details, teams, and schedules.
                  </div>
                  <button type="submit" className="btn-primary">
                    Create League
                  </button>
                </form>
              </div>
            )}

            {allLeagues.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No leagues yet. Click "Create League" above to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allLeagues.map((league) => {
                  const details = leagueDetails[league.id] || {}
                  const { teams: leagueTeams = [], activeSeason, paymentStats } = details

                  return (
                    <div
                      key={league.id}
                      className="border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition-all overflow-hidden"
                    >
                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => navigate(`/leagues/${league.id}`)}
                          >
                            <h3 className="text-lg font-semibold text-gray-900">{league.name}</h3>
                            {league.archived === 1 && (
                              <span className="badge badge-neutral">Archived</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleToggleArchiveLeague(e, league)}
                              className={`btn-secondary text-sm px-3 py-1 ${league.archived === 1 ? '' : 'text-amber-600'}`}
                            >
                              {league.archived === 1 ? 'Unarchive' : 'Archive'}
                            </button>
                            <button
                              onClick={(e) => handleDeleteLeague(e, league)}
                              className="btn-danger text-sm px-3 py-1"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {league.description && (
                          <p
                            className="text-sm text-gray-600 mt-1 cursor-pointer"
                            onClick={() => navigate(`/leagues/${league.id}`)}
                          >
                            {league.description}
                          </p>
                        )}
                      </div>

                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => navigate(`/leagues/${league.id}`)}
                      >
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Active Season</div>
                            <div className="font-semibold">
                              {activeSeason ? (
                                <span className="text-green-700">{activeSeason.name}</span>
                              ) : (
                                <span className="text-gray-400">None</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 mb-1">Teams</div>
                            <div className="font-semibold text-gray-900">
                              {leagueTeams.length} {leagueTeams.length === 1 ? 'team' : 'teams'}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 mb-1">Unpaid Players</div>
                            <div className="font-semibold">
                              {paymentStats ? (
                                <span className={paymentStats.players_unpaid > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {paymentStats.players_unpaid} / {paymentStats.total_players}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {activeSeason && paymentStats && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Payment Progress</span>
                              <span>
                                {paymentStats.total_players > 0
                                  ? `${Math.round((paymentStats.players_paid / paymentStats.total_players) * 100)}%`
                                  : '0%'
                                }
                              </span>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: paymentStats.total_players > 0
                                    ? `${(paymentStats.players_paid / paymentStats.total_players) * 100}%`
                                    : '0%'
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin Section: User Management */}
        {isAdmin && (
          <div className="card">
            <UsersManagementCard />
          </div>
        )}

        {/* Empty State */}
        {userPlayerProfiles.length === 0 && managedLeagues.length === 0 && !isAdmin && (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-4">
              You are not assigned to any teams or leagues yet
            </p>
            <p className="text-sm text-gray-400">
              Contact your league manager or administrator to get started
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, league: null })}
        onConfirm={confirmDeleteLeague}
        title="Delete League"
        message={`Are you sure you want to delete "${deleteModal.league?.name}"?\n\nThis will permanently delete all associated seasons, teams, games, and players. This action cannot be undone.`}
        confirmText="Delete League"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
