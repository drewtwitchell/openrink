import { useEffect, useState } from 'react'
import { auth, leagues, teams, games, players } from '../lib/api'
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
      const data = await leagues.getAll()
      setLeaguesList(data)
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Leagues</h2>
          <span className="text-sm text-gray-600">{stats.leagues} total</span>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : leaguesList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No leagues yet</p>
            <Link to="/leagues" className="btn-primary">
              Create Your First League
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaguesList.map((league) => (
              <div
                key={league.id}
                onClick={() => navigate(`/leagues/${league.id}`)}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200"
              >
                <div className="font-semibold text-lg mb-1">{league.name}</div>
                {league.season && (
                  <div className="text-sm text-gray-600 mb-2">{league.season}</div>
                )}
                {league.description && (
                  <div className="text-sm text-gray-500 line-clamp-2">{league.description}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <Link to="/leagues" className="text-sm text-ice-600 hover:text-ice-700 hover:underline">
            Manage all leagues →
          </Link>
        </div>
      </div>

      <div className="mt-6 card">
        <UsersManagementCard />
      </div>
    </div>
  )
}

// Player/Captain/Manager Dashboard: Shows their league info with roster details
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
        leagues.getAll(),
        teams.getAll(),
      ])

      // For league managers, find their first league
      if (user?.role === 'league_manager') {
        // League managers see the first available league
        if (allLeagues.length > 0) {
          const firstLeague = allLeagues[0]
          setLeagueData(firstLeague)

          // Get all teams in this league
          const leagueTeams = allTeams.filter(t => t.league_id === firstLeague.id)
          setTeamsData(leagueTeams)
        }
      } else if (userPlayerProfiles.length > 0) {
        // For players/captains, get league from their team
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
          {user?.role === 'league_manager'
            ? 'No leagues available. Contact an admin to create leagues.'
            : 'You are not assigned to any teams yet'}
        </p>
        <p className="text-sm text-gray-400">
          {user?.role === 'league_manager'
            ? ''
            : 'Contact your league manager to be added to a team'}
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
                  💰 Pay via Venmo
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
      setMessage('Role updated successfully!')
      fetchUsers()
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Error updating role: ' + error.message)
    }
  }

  const currentUser = auth.getUser()

  if (loading) {
    return <p className="text-gray-500 text-center py-8">Loading users...</p>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">User Management</h2>
        <span className="text-sm text-gray-600">{allUsers.length} users</span>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded text-sm">
          {message}
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {allUsers.map((u) => (
          <div key={u.id} className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{u.name || 'No name'}</div>
                <div className="text-xs text-gray-600 truncate">{u.email}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="input text-xs py-1 px-2"
                >
                  <option value="player">Player</option>
                  <option value="team_captain">Team Captain</option>
                  <option value="league_manager">League Manager</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id === currentUser?.id && (
                  <span className="text-xs text-amber-600">⚠️ You</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <Link to="/users" className="text-sm text-ice-600 hover:text-ice-700 hover:underline">
          View full user management →
        </Link>
      </div>
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
        leagues.getAll(),
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

  // Admin view (or admin + player shows admin view)
  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || user?.email}</p>
      </div>

      {isAdmin ? (
        <AdminDashboard stats={stats} />
      ) : (
        <PlayerDashboard user={user} userPlayerProfiles={userPlayerProfiles} />
      )}
    </div>
  )
}
