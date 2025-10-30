import { useEffect, useState } from 'react'
import { auth, leagues, teams, players, seasons, announcements } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'

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
  const [upcomingGames, setUpcomingGames] = useState({}) // Games by team_id
  const [gameAttendance, setGameAttendance] = useState({}) // Attendance by game_id
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentProfile, setSelectedPaymentProfile] = useState(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_method: '',
    confirmation_number: '',
    payment_notes: ''
  })
  const [paymentMessage, setPaymentMessage] = useState('')
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editFormData, setEditFormData] = useState({
    jersey_number: '',
    position: 'player',
    sub_position: ''
  })
  const [leagueAnnouncements, setLeagueAnnouncements] = useState({})

  useEffect(() => {
    const currentUser = auth.getUser()
    setUser(currentUser)

    // All authenticated users can access dashboard
    // They'll see different content based on their role and permissions
    if (currentUser) {
      fetchDashboardData(currentUser)
    } else {
      navigate('/')
    }
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

        // Fetch upcoming games for each team the user is on
        if (userProfiles.length > 0) {
          const uniqueTeamIds = [...new Set(userProfiles.map(p => p.team_id))]
          for (const teamId of uniqueTeamIds) {
            fetchUpcomingGames(teamId)
          }
        }

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

          // Fetch active announcements for each player league
          const announcementsData = {}
          for (const league of playerLeagues) {
            try {
              const leagueAnnouncements = await announcements.getActive(league.id)
              announcementsData[league.id] = leagueAnnouncements || []
            } catch (error) {
              console.error(`Error fetching announcements for league ${league.id}:`, error)
              announcementsData[league.id] = []
            }
          }
          setLeagueAnnouncements(announcementsData)

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
          return managers.some(m => m.id === currentUser.id)
        })

        setManagedLeagues(userManagedLeagues)

        // Fetch seasons and payment stats for managed leagues (only for admins and league managers)
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

  const fetchUpcomingGames = async (teamId) => {
    try {
      const response = await fetch('http://localhost:3001/api/games', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const allGames = await response.json()

      // Filter for upcoming games for this team (next game only)
      const today = new Date().toISOString().split('T')[0]
      const teamGames = allGames
        .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.game_date >= today && !g.home_score)
        .sort((a, b) => {
          const dateA = new Date(`${a.game_date}T${a.game_time}`)
          const dateB = new Date(`${b.game_date}T${b.game_time}`)
          return dateA - dateB
        })
        .slice(0, 1) // Get only the next upcoming game

      setUpcomingGames(prev => ({ ...prev, [teamId]: teamGames }))

      // Fetch attendance for this game
      for (const game of teamGames) {
        fetchGameAttendance(game.id)
      }
    } catch (error) {
      console.error('Error fetching upcoming games:', error)
    }
  }

  const fetchGameAttendance = async (gameId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/games/${gameId}/attendance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const attendance = await response.json()
      setGameAttendance(prev => ({ ...prev, [gameId]: attendance }))
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }

  const updateAttendance = async (gameId, playerId, status) => {
    try {
      await fetch(`http://localhost:3001/api/games/${gameId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ player_id: playerId, status })
      })
      // Refresh attendance for this game
      fetchGameAttendance(gameId)
    } catch (error) {
      console.error('Error updating attendance:', error)
    }
  }

  const openPaymentModal = async (profile, league) => {
    // Fetch active season for this league
    const seasonsForLeague = await seasons.getByLeague(league.id)
    const activeSeason = seasonsForLeague.find(s => s.is_active === 1 && s.archived === 0)

    setSelectedPaymentProfile({
      ...profile,
      leagueId: league.id,
      leagueName: league.name,
      seasonName: activeSeason?.name || 'No Active Season'
    })
    setPaymentFormData({
      payment_method: '',
      confirmation_number: '',
      payment_notes: ''
    })
    setPaymentMessage('')
    setShowPaymentModal(true)
  }

  const handleSelfReportPayment = async (e) => {
    e.preventDefault()
    setPaymentMessage('')

    if (!paymentFormData.payment_method) {
      setPaymentMessage('Please select a payment method')
      return
    }

    if (!selectedPaymentProfile) {
      setPaymentMessage('No player profile selected')
      return
    }

    try {
      // Get active season for this league
      const leagueId = selectedPaymentProfile.leagueId
      const seasonsForLeague = await seasons.getByLeague(leagueId)
      const activeSeason = seasonsForLeague.find(s => s.is_active === 1 && s.archived === 0)

      if (!activeSeason) {
        setPaymentMessage('No active season found for this league')
        return
      }

      const response = await fetch(`http://localhost:3001/api/players/${selectedPaymentProfile.id}/self-report-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          season_id: activeSeason.id,
          payment_method: paymentFormData.payment_method,
          confirmation_number: paymentFormData.confirmation_number || null,
          payment_notes: paymentFormData.payment_notes || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to report payment')
      }

      const result = await response.json()
      setPaymentMessage('Payment reported successfully!')

      // Refresh dashboard data to update payment status
      setTimeout(() => {
        setShowPaymentModal(false)
        fetchDashboardData(user)
      }, 1500)
    } catch (error) {
      console.error('Error reporting payment:', error)
      setPaymentMessage('Error: ' + error.message)
    }
  }

  const startEditPlayer = (profile) => {
    setEditingPlayer(profile.id)
    setEditFormData({
      jersey_number: profile.jersey_number || '',
      position: profile.position === 'goalie' ? 'goalie' : 'player',
      sub_position: profile.sub_position || ''
    })
  }

  const cancelEditPlayer = () => {
    setEditingPlayer(null)
    setEditFormData({
      jersey_number: '',
      position: 'player',
      sub_position: ''
    })
  }

  const savePlayerEdit = async (profile) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/players/${profile.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: profile.user_id,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            jersey_number: editFormData.jersey_number,
            email_notifications: profile.email_notifications,
            position: editFormData.position,
            sub_position: editFormData.position === 'player' ? editFormData.sub_position : null
          })
        }
      )

      if (response.ok) {
        // Refresh dashboard data
        if (user) {
          await fetchDashboardData(user)
        }
        cancelEditPlayer()
      } else {
        console.error('Error updating player information')
      }
    } catch (error) {
      console.error('Error updating player:', error)
    }
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || user?.email}</p>
      </div>

      <div className="space-y-6">
        {/* Player Info Section - All Leagues */}
        {userPlayerProfiles.length > 0 && userLeagues.length > 0 && (
          <div className="card">
            <h2 className="section-header mb-6">
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
                        onClick={() => navigate('/')}
                        className="btn-primary text-sm whitespace-nowrap"
                      >
                        View Schedule & Standings
                      </button>
                    </div>

                    <div className="space-y-4">
                      {leagueProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-5 bg-gradient-to-r from-ice-50 to-white border border-ice-200 rounded-lg"
                  >
                    {editingPlayer === profile.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div className="font-bold text-lg text-gray-900">{profile.team_name}</div>
                        <div className="text-sm text-gray-600 mb-2">{profile.name}</div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">Position</label>
                            <select
                              value={editFormData.position}
                              onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value, sub_position: e.target.value === 'goalie' ? '' : editFormData.sub_position })}
                              className="input input-sm"
                            >
                              <option value="player">Player</option>
                              <option value="goalie">Goalie</option>
                            </select>
                          </div>

                          {editFormData.position === 'player' && (
                            <div>
                              <label className="label text-xs">Sub-Position</label>
                              <select
                                value={editFormData.sub_position}
                                onChange={(e) => setEditFormData({ ...editFormData, sub_position: e.target.value })}
                                className="input input-sm"
                              >
                                <option value="">None</option>
                                <option value="forward">Forward</option>
                                <option value="defense">Defense</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="label text-xs">Jersey Number</label>
                            <input
                              type="text"
                              value={editFormData.jersey_number}
                              onChange={(e) => setEditFormData({ ...editFormData, jersey_number: e.target.value })}
                              className="input input-sm"
                              placeholder="e.g., 10"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => savePlayerEdit(profile)}
                            className="btn-primary btn-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditPlayer}
                            className="btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
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
                              {profile.position === 'goalie' ? (
                                <span className="badge badge-info">
                                  Goalie
                                </span>
                              ) : profile.sub_position ? (
                                <span className="badge badge-neutral capitalize">
                                  {profile.sub_position}
                                </span>
                              ) : profile.position && profile.position !== 'player' && (
                                <span className="badge badge-neutral capitalize">
                                  {profile.position}
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

                            {/* Payment Status */}
                            <div className="mt-3 pt-3 border-t border-ice-200">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Payment Status:</span>
                                {profile.payment_status === 'paid' ? (
                                  <span className="badge badge-success">
                                    ✓ Paid
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openPaymentModal(profile, league)}
                                    className="badge badge-error hover:bg-red-200 transition-colors cursor-pointer"
                                  >
                                    ✗ Unpaid - Click to Report Payment
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => startEditPlayer(profile)}
                              className="btn-secondary text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleTeamRoster(profile.team_id)}
                              className="btn-secondary text-sm"
                            >
                              {expandedTeams[profile.team_id] ? 'Hide Roster' : 'View Roster'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Upcoming Game Display */}
                    {upcomingGames[profile.team_id] && upcomingGames[profile.team_id].length > 0 && (
                      <div className="mt-4 pt-4 border-t border-ice-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Upcoming Game</h4>
                        <div className="space-y-3">
                          {upcomingGames[profile.team_id].map((game) => {
                            const attendance = gameAttendance[game.id] || []
                            const myAttendance = attendance.find(a => a.player_id === profile.id)
                            const attendingCount = attendance.filter(a => a.status === 'attending').length
                            const maybeCount = attendance.filter(a => a.status === 'maybe').length

                            return (
                              <div key={game.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-medium text-sm">
                                      {game.home_team_name} vs {game.away_team_name}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {new Date(game.game_date).toLocaleDateString()} at {game.game_time}
                                    </div>
                                    {game.rink_name && (
                                      <div className="text-xs text-gray-500">{game.rink_name}</div>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    <div>Attending: {attendingCount}</div>
                                    {maybeCount > 0 && <div>Maybe: {maybeCount}</div>}
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => updateAttendance(game.id, profile.id, 'attending')}
                                    className={`px-3 py-1 rounded text-xs font-medium ${
                                      myAttendance?.status === 'attending'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                    }`}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    onClick={() => updateAttendance(game.id, profile.id, 'maybe')}
                                    className={`px-3 py-1 rounded text-xs font-medium ${
                                      myAttendance?.status === 'maybe'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                                    }`}
                                  >
                                    ? Maybe
                                  </button>
                                  <button
                                    onClick={() => updateAttendance(game.id, profile.id, 'not_attending')}
                                    className={`px-3 py-1 rounded text-xs font-medium ${
                                      myAttendance?.status === 'not_attending'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                    }`}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Inline Roster Display */}
                    {expandedTeams[profile.team_id] && (
                      <div className="mt-4 pt-4 border-t border-ice-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Team Roster</h4>
                          {(user?.role === 'admin' || managedLeagues.some(ml => ml.id === league.id) || profile.is_captain === 1) && (
                            <button
                              onClick={() => navigate(`/leagues/${league.id}?tab=season&subtab=teams&team=${profile.team_id}`)}
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
                                    <td className="py-2 px-2 capitalize">
                                      {player.position === 'goalie' ? 'Goalie' :
                                       player.sub_position ? player.sub_position :
                                       player.position || 'player'}
                                    </td>
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

                    {/* League Announcements */}
                    {leagueAnnouncements[league.id] && leagueAnnouncements[league.id].length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">League Announcements</h4>
                        <div className="space-y-3">
                          {leagueAnnouncements[league.id].map((announcement) => (
                            <div
                              key={announcement.id}
                              className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-semibold text-gray-900">{announcement.title}</h5>
                                <span className="text-xs text-gray-500">
                                  {new Date(announcement.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm">{announcement.message}</p>
                              {announcement.expires_at && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Captain Attendance Tracking */}
        {userPlayerProfiles.some(profile => profile.is_captain === 1) && (
          <div className="card">
            <h2 className="section-header mb-6">Team Captain - Attendance Tracking</h2>
            <div className="space-y-6">
              {userPlayerProfiles.filter(profile => profile.is_captain === 1).map((captainProfile) => {
                const teamGames = upcomingGames[captainProfile.team_id] || []
                const team = allTeams.find(t => t.id === captainProfile.team_id)

                return (
                  <div key={captainProfile.team_id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {captainProfile.team_name} - Upcoming Games
                    </h3>

                    {teamGames.length === 0 ? (
                      <p className="text-gray-500 text-sm">No upcoming games scheduled</p>
                    ) : (
                      <div className="space-y-3">
                        {teamGames.map((game) => {
                          const attendance = gameAttendance[game.id] || []
                          const attendingCount = attendance.filter(a => a.status === 'yes').length
                          const maybeCount = attendance.filter(a => a.status === 'maybe').length
                          const noCount = attendance.filter(a => a.status === 'no').length

                          return (
                            <div key={game.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-semibold text-sm">
                                    {game.home_team_name} vs {game.away_team_name}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {new Date(game.game_date).toLocaleDateString()} at {game.game_time}
                                    {game.rink_name && ` - ${game.rink_name}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-4 text-xs mt-2">
                                <span className="text-green-600">✓ {attendingCount} Attending</span>
                                <span className="text-yellow-600">? {maybeCount} Maybe</span>
                                <span className="text-red-600">✗ {noCount} Not Attending</span>
                                <span className="text-gray-500">
                                  {attendance.length > 0 ? `${attendance.length} total responses` : 'No responses yet'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* League Management Section */}
        {managedLeagues.length > 0 && (
          <div className="card">
            <h2 className="section-header mb-6">League Management</h2>
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
                <h2 className="section-header">All Leagues</h2>
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
                <h3 className="section-header mb-4">Create New League</h3>
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
                  <div className="alert alert-info">
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

        {/* Admin Section: User Management Link */}
        {isAdmin && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-header mb-2">User Management</h2>
                <p className="text-sm text-gray-600">
                  Manage user accounts, roles, and view player history
                </p>
              </div>
              <button
                onClick={() => navigate('/users')}
                className="btn-primary"
              >
                Manage Users
              </button>
            </div>
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

      {/* Payment Self-Report Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Report Payment</h3>
              <p className="text-sm text-gray-600 mt-1">
                Report payment for <span className="font-semibold">{selectedPaymentProfile?.name}</span>
                <br />
                <span className="text-xs">League: <span className="font-semibold">{selectedPaymentProfile?.leagueName}</span></span>
                {' • '}
                <span className="text-xs">Season: <span className="font-semibold">{selectedPaymentProfile?.seasonName}</span></span>
              </p>
            </div>

            {paymentMessage && (
              <div className={`alert ${
                paymentMessage.includes('Error') || paymentMessage.includes('select') || paymentMessage.includes('No ')
                  ? 'alert-error'
                  : 'alert-success'
              }`}>
                {paymentMessage}
              </div>
            )}

            <form onSubmit={handleSelfReportPayment} className="space-y-4">
              <div>
                <label className="label mb-3">Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'venmo' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'venmo'
                        ? 'border-[#008CFF] bg-gradient-to-br from-[#008CFF]/20 to-[#3D95CE]/20'
                        : 'border-gray-200 hover:border-[#008CFF] hover:bg-[#008CFF]/5'
                    }`}
                  >
                    <div className="w-10 h-10 bg-[#008CFF] rounded-lg flex items-center justify-center mb-1">
                      <span className="text-white text-lg font-bold">V</span>
                    </div>
                    <span className="font-semibold text-xs text-[#008CFF]">Venmo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'zelle' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'zelle'
                        ? 'border-[#6D1ED4] bg-gradient-to-br from-[#6D1ED4]/20 to-[#A24DFF]/20'
                        : 'border-gray-200 hover:border-[#6D1ED4] hover:bg-[#6D1ED4]/5'
                    }`}
                  >
                    <div className="w-10 h-10 bg-[#6D1ED4] rounded-lg flex items-center justify-center mb-1">
                      <span className="text-white text-lg font-bold">Z</span>
                    </div>
                    <span className="font-semibold text-xs text-[#6D1ED4]">Zelle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'cash' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'cash'
                        ? 'border-green-600 bg-gradient-to-br from-green-100 to-green-200'
                        : 'border-gray-200 hover:border-green-600 hover:bg-green-50'
                    }`}
                  >
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-1">
                      <span className="text-white text-xl font-bold">$</span>
                    </div>
                    <span className="font-semibold text-xs text-green-700">Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'check' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'check'
                        ? 'border-blue-600 bg-gradient-to-br from-blue-100 to-blue-200'
                        : 'border-gray-200 hover:border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-1">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-xs text-blue-700">Check</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'paypal' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'paypal'
                        ? 'border-[#0070BA] bg-gradient-to-br from-[#0070BA]/20 to-[#003087]/20'
                        : 'border-gray-200 hover:border-[#0070BA] hover:bg-[#0070BA]/5'
                    }`}
                  >
                    <div className="w-10 h-10 bg-[#0070BA] rounded-lg flex items-center justify-center mb-1">
                      <span className="text-white text-lg font-bold">P</span>
                    </div>
                    <span className="font-semibold text-xs text-[#0070BA]">PayPal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_method: 'other' })}
                    className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                      paymentFormData.payment_method === 'other'
                        ? 'border-gray-500 bg-gradient-to-br from-gray-100 to-gray-200'
                        : 'border-gray-200 hover:border-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center mb-1">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-xs text-gray-700">Other</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirmation Number (Optional)</label>
                <input
                  type="text"
                  value={paymentFormData.confirmation_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, confirmation_number: e.target.value })}
                  className="input w-full"
                  placeholder="Transaction ID or confirmation number"
                />
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <textarea
                  value={paymentFormData.payment_notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_notes: e.target.value })}
                  className="input w-full"
                  rows="3"
                  placeholder="Additional notes about your payment..."
                />
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Report Payment
                </button>
              </div>
            </form>

            <div className="alert alert-info text-xs">
              <strong>Note:</strong> Your payment report will be timestamped and sent to league managers for verification.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
