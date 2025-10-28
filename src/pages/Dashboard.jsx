import { useEffect, useState } from 'react'
import { auth, leagues, teams, games, players, seasons } from '../lib/api'
import { Link, useNavigate } from 'react-router-dom'

// Admin Dashboard: Shows list of leagues
function AdminDashboard({ stats }) {
  const navigate = useNavigate()
  const [leaguesList, setLeaguesList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeagues()
  }, [])

  const fetchLeagues = async () => {
    try {
      // Show all leagues including archived ones
      const data = await leagues.getAll(true)
      setLeaguesList(data)
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Leagues Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="section-header mb-0">Leagues</h2>
            <p className="text-sm text-gray-600 mt-1">{stats.leagues} total, {stats.teams} teams</p>
          </div>
          <Link to="/leagues" className="btn-primary">
            Create League
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : leaguesList.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No Leagues Yet</h3>
            <p className="empty-state-description">
              Create your first league to start managing teams and games
            </p>
            <Link to="/leagues" className="btn-primary">
              Create League
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {leaguesList.map((league) => (
              <div
                key={league.id}
                onClick={() => navigate(`/leagues/${league.id}`)}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{league.name}</h3>
                    {league.archived === 1 && (
                      <span className="badge badge-neutral">Archived</span>
                    )}
                  </div>
                  {league.description && (
                    <p className="text-sm text-gray-600 mt-1">{league.description}</p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Management */}
      <div className="card">
        <UsersManagementCard />
      </div>
    </div>
  )
}

// League Manager Dashboard: Shows assigned leagues with payment tracking
function LeagueManagerDashboard({ user }) {
  const navigate = useNavigate()
  const [assignedLeagues, setAssignedLeagues] = useState([])
  const [leagueSeasons, setLeagueSeasons] = useState({})
  const [paymentStats, setPaymentStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeagueManagerData()
  }, [user])

  const fetchLeagueManagerData = async () => {
    try {
      // Show all leagues including archived ones
      const allLeagues = await leagues.getAll(true)
      const managersData = await Promise.all(
        allLeagues.map(l => leagues.getManagers(l.id).catch(() => []))
      )

      // Filter leagues where this user is a manager
      const userManagedLeagues = allLeagues.filter((league, index) => {
        const managers = managersData[index]
        return managers.some(m => m.user_id === user?.id)
      })

      setAssignedLeagues(userManagedLeagues)

      // Fetch seasons and payment stats for each league
      const seasonsData = {}
      const statsData = {}

      for (const league of userManagedLeagues) {
        const leagueSeasons = await seasons.getByLeague(league.id)
        seasonsData[league.id] = leagueSeasons

        // Get payment stats for active season
        const activeSeason = leagueSeasons.find(s => s.is_active === 1 && s.archived === 0)
        if (activeSeason) {
          const stats = await seasons.getPaymentStats(activeSeason.id)
          statsData[league.id] = stats
        }
      }

      setLeagueSeasons(seasonsData)
      setPaymentStats(statsData)
    } catch (error) {
      console.error('Error fetching league manager data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="card"><p className="text-gray-500 text-center py-8">Loading...</p></div>
  }

  if (assignedLeagues.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3 className="empty-state-title">No Leagues Assigned</h3>
          <p className="empty-state-description">
            You haven't been assigned to any leagues yet. Contact your administrator to get started.
          </p>
          <div className="mt-8 max-w-md mx-auto">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-4">Available Capabilities:</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-ice-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Manage multiple seasons per league
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-ice-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Track player payments and dues
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-ice-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Contact all league players
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-ice-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Archive individual seasons or entire leagues
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Leagues</h1>
          <p className="page-subtitle">Manage {assignedLeagues.length} league{assignedLeagues.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {assignedLeagues.map((league) => {
          const leagueSeasonsList = leagueSeasons[league.id] || []
          const activeSeason = leagueSeasonsList.find(s => s.is_active === 1 && s.archived === 0)
          const stats = paymentStats[league.id]
          const paymentRate = stats ? (stats.players_paid / stats.total_players * 100) : 0

          return (
            <div key={league.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{league.name}</h3>
                  {activeSeason && (
                    <div className="flex items-center gap-2">
                      <span className="badge badge-info">{activeSeason.name}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/leagues/${league.id}`)}
                  className="btn-secondary text-sm"
                >
                  Manage
                </button>
              </div>

              {/* Payment Stats */}
              {stats && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Payment Collection</span>
                      <span className="font-medium text-gray-900">{stats.players_paid} / {stats.total_players} players</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${paymentRate}%` }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Paid</div>
                      <div className="text-lg font-semibold text-green-600">{stats.players_paid}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Unpaid</div>
                      <div className="text-lg font-semibold text-red-600">{stats.players_unpaid}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Collected</div>
                      <div className="text-lg font-semibold text-gray-900">${parseFloat(stats.total_collected || 0).toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 pt-4 border-t flex gap-2">
                <button
                  onClick={() => navigate(`/leagues/${league.id}`, { state: { activeTab: 'seasons' } })}
                  className="btn-secondary text-sm flex-1"
                >
                  Seasons
                </button>
                <button
                  onClick={() => navigate(`/leagues/${league.id}`, { state: { activeTab: 'payments' } })}
                  className="btn-secondary text-sm flex-1"
                >
                  Payments
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Player/Captain Dashboard: Shows their league info with roster details
function PlayerDashboard({ user, userPlayerProfiles }) {
  const navigate = useNavigate()
  const [leagueData, setLeagueData] = useState(null)
  const [teamsData, setTeamsData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayerLeagueData()
  }, [userPlayerProfiles, user])

  const fetchPlayerLeagueData = async () => {
    try {
      const [allLeagues, allTeams] = await Promise.all([
        leagues.getAll(true), // Show all leagues including archived
        teams.getAll(),
      ])

      // For players/captains, get league from their team
      if (userPlayerProfiles.length > 0) {
        const firstProfile = userPlayerProfiles[0]
        const team = allTeams.find(t => t.id === firstProfile.team_id)
        if (team) {
          const league = allLeagues.find(l => l.id === team.league_id)
          setLeagueData(league)

          // Get all teams in this league
          const leagueTeams = allTeams.filter(t => t.league_id === team.league_id)
          setTeamsData(leagueTeams)
        }
      }
    } catch (error) {
      console.error('Error fetching player league data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="card"><p className="text-gray-500 text-center py-8">Loading...</p></div>
  }

  if (!leagueData) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">
          You are not assigned to any teams yet
        </p>
        <p className="text-sm text-gray-400">
          Contact your league manager to be added to a team
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* League Info */}
      {leagueData && (
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{leagueData.name}</h2>
              {leagueData.season && (
                <p className="text-gray-600">Season: {leagueData.season}</p>
              )}
              {leagueData.description && (
                <p className="text-gray-600 mt-2">{leagueData.description}</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/leagues/${leagueData.id}`)}
              className="btn-primary"
            >
              View League Details
            </button>
          </div>

          {/* Season Dues */}
          {(leagueData.season_dues || leagueData.venmo_link) && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold mb-2">Season Dues</h3>
              {leagueData.season_dues && (
                <div className="mb-2">
                  <span className="text-xl font-bold text-green-700">${parseFloat(leagueData.season_dues).toFixed(2)}</span>
                  <span className="text-gray-600 ml-2">per player</span>
                </div>
              )}
              {leagueData.venmo_link && (
                <a
                  href={leagueData.venmo_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm inline-block"
                >
                  Pay via Venmo
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* My Teams - Only show if user has player profiles */}
      {userPlayerProfiles.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">My Teams</h2>
          <div className="space-y-3">
            {userPlayerProfiles.map((profile) => (
              <div key={profile.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-12 h-12 rounded-full mr-4 flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: profile.team_color || '#0284c7' }}
                  >
                    {profile.jersey_number || '?'}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{profile.team_name}</div>
                    <div className="text-sm text-gray-600">
                      {profile.name}
                      {profile.is_captain === 1 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                          ⭐ Captain
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/teams/${profile.team_id}/roster`)}
                  className="btn-primary"
                >
                  View Roster
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* League Teams */}
      {teamsData.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">All Teams in {leagueData?.name}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamsData.map((team) => (
              <div
                key={team.id}
                onClick={() => navigate(`/teams/${team.id}/roster?league=${leagueData?.id}`)}
                className="p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <div className="font-medium">{team.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
      setMessage('Role updated')
      fetchUsers()
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage('Error: ' + error.message)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) {
      return
    }
    try {
      await auth.deleteUser(userId)
      setMessage('User deleted')
      fetchUsers()
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage('Error: ' + error.message)
    }
  }

  const currentUser = auth.getUser()

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading...</p>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="section-header mb-0">Users</h2>
        <span className="text-sm text-gray-600">{allUsers.length} total</span>
      </div>

      {message && (
        <div className="alert alert-info mb-4">
          {message}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {allUsers.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.name || '-'}</td>
              <td className="text-gray-600">{u.email}</td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="input text-sm py-1 px-2"
                >
                  <option value="player">Player</option>
                  <option value="team_captain">Team Captain</option>
                  <option value="league_manager">League Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>
                <div className="flex items-center justify-end gap-2">
                  {u.id === currentUser?.id ? (
                    <span className="text-xs text-gray-500">Current User</span>
                  ) : (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                      className="btn-danger text-xs py-1 px-3"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    leagues: 0,
    teams: 0,
  })
  const [userPlayerProfiles, setUserPlayerProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)
    fetchStats(currentUser)
  }, [])

  const fetchStats = async (currentUser) => {
    try {
      const [leaguesData, teamsData, playersData] = await Promise.all([
        leagues.getAll(true), // Include archived leagues in stats
        teams.getAll(),
        players.getAll(),
      ])

      setStats({
        leagues: leaguesData.length,
        teams: teamsData.length,
      })

      // Find player profiles linked to this user
      if (currentUser) {
        const userProfiles = playersData.filter(p => p.user_id === currentUser.id)
        setUserPlayerProfiles(userProfiles)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  // Determine dashboard type based on role
  const isAdmin = user?.role === 'admin'
  const isLeagueManager = user?.role === 'league_manager'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || user?.email}</p>
      </div>

      {isAdmin ? (
        <AdminDashboard stats={stats} />
      ) : isLeagueManager ? (
        <LeagueManagerDashboard user={user} />
      ) : (
        <PlayerDashboard user={user} userPlayerProfiles={userPlayerProfiles} />
      )}
    </div>
  )
}
