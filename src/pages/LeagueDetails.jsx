import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { leagues, teams as teamsApi, games as gamesApi, seasons, auth, announcements, players, teamCaptains, payments } from '../lib/api'
import ConfirmModal from '../components/ConfirmModal'

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
  const [mainTab, setMainTab] = useState('overview') // 'overview' or 'season'
  const [overviewSubTab, setOverviewSubTab] = useState('managers') // 'managers', 'announcements', or 'payments'
  const [seasonSubTab, setSeasonSubTab] = useState(null) // null shows seasons, or 'teams', 'schedule', 'playoffs'
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
  const [currentUser, setCurrentUser] = useState(null)
  const [announcementsList, setAnnouncementsList] = useState([])
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null)
  const [announcementFormData, setAnnouncementFormData] = useState({
    title: '',
    message: '',
    expires_at: '',
  })
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [teamPlayers, setTeamPlayers] = useState({})
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [playerToTransfer, setPlayerToTransfer] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedSeasonId, setSelectedSeasonId] = useState(null) // Track which season is selected in Season tab
  const [showGameForm, setShowGameForm] = useState(false)
  const [gameFormData, setGameFormData] = useState({
    home_team_id: '',
    away_team_id: '',
    game_date: '',
    game_time: '',
    rink_name: '',
  })
  const [showPlayerForm, setShowPlayerForm] = useState(null) // Track which team's form is showing
  const [showManagerForm, setShowManagerForm] = useState(false)
  const [managerEmail, setManagerEmail] = useState('')
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)
  const [playerToMarkPaid, setPlayerToMarkPaid] = useState(null)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editingPaymentAmount, setEditingPaymentAmount] = useState('')
  const [editingSeasonDues, setEditingSeasonDues] = useState(false)
  const [tempSeasonDues, setTempSeasonDues] = useState('')
  const [editingPaymentLink, setEditingPaymentLink] = useState(false)
  const [tempPaymentLink, setTempPaymentLink] = useState('')

  // ConfirmModal states
  const [deleteAnnouncementModal, setDeleteAnnouncementModal] = useState({ isOpen: false, announcementId: null, title: '' })
  const [removePlayerModal, setRemovePlayerModal] = useState({ isOpen: false, playerId: null, playerName: '', teamId: null })
  const [archiveSeasonModal, setArchiveSeasonModal] = useState({ isOpen: false, isArchived: false, leagueName: '' })
  const [deleteLeagueModal, setDeleteLeagueModal] = useState({ isOpen: false })
  const [deleteSeasonModal, setDeleteSeasonModal] = useState({ isOpen: false, seasonId: null })
  const [deleteTeamModal, setDeleteTeamModal] = useState({ isOpen: false, teamId: null, teamName: '' })
  const [markUnpaidModal, setMarkUnpaidModal] = useState({ isOpen: false, player: null })
  const [removeManagerModal, setRemoveManagerModal] = useState({ isOpen: false, manager: null })

  // Check if current user can manage this league
  // User can manage if they're an admin OR if they're in the league_managers table for this league
  const canManage = useMemo(() => {
    return currentUser?.role === 'admin' ||
      managers.some(m => m.id === currentUser.id)
  }, [currentUser, managers])

  // Check if current user is a captain of a specific team
  const isTeamCaptain = (teamId) => {
    if (!currentUser) return false
    const team = teams.find(t => t.id === teamId)
    if (!team || !team.captains) return false
    return team.captains.some(captain => captain.user_id === currentUser.id)
  }

  // Check if current user can manage a specific team's roster
  // Can manage if they're a league manager/admin OR a captain of that team
  const canManageTeam = (teamId) => {
    return canManage || isTeamCaptain(teamId)
  }

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchLeagueData()

    // Handle URL parameters for navigation
    const tabParam = searchParams.get('tab')
    const subtabParam = searchParams.get('subtab')
    const teamParam = searchParams.get('team')

    // Auto-open season form if coming from league creation
    if (tabParam === 'seasons') {
      setMainTab('season')
      setSeasonSubTab(null)
      setShowSeasonForm(true)
    }
    // Auto-open to teams roster if navigating from dashboard
    else if (tabParam === 'season' && subtabParam === 'teams') {
      setMainTab('season')
      setSeasonSubTab('teams')
      if (teamParam) {
        const teamId = parseInt(teamParam)
        setExpandedTeamId(teamId)
        // Fetch roster for this team (will be called after fetchLeagueData completes)
        setTimeout(() => {
          fetchTeamPlayers(teamId)
        }, 500)
      }
    }
  }, [id])

  // Set default season sub tab when season is selected
  useEffect(() => {
    if (selectedSeasonId && !seasonSubTab) {
      setSeasonSubTab('teams')
    }
  }, [selectedSeasonId, seasonSubTab])

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

      // Set selected season to active season by default
      if (active) {
        setSelectedSeasonId(active.id)
        fetchPaymentData(active.id)
      } else if (seasonsData.length > 0) {
        // If no active season, select the most recent one
        setSelectedSeasonId(seasonsData[0].id)
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

  // Fetch announcements when announcements tab is selected
  useEffect(() => {
    if (mainTab === 'overview' && overviewSubTab === 'announcements') {
      fetchAnnouncements()
    }
  }, [mainTab, overviewSubTab, id])

  // Fetch payment data when payments tab is selected
  useEffect(() => {
    if (mainTab === 'overview' && overviewSubTab === 'payments' && activeSeason) {
      fetchPaymentData(activeSeason.id)
    }
  }, [mainTab, overviewSubTab, activeSeason])

  const fetchAnnouncements = async () => {
    try {
      const data = await announcements.getAll(id)
      setAnnouncementsList(data)
    } catch (error) {
      console.error('Error fetching announcements:', error)
    }
  }

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingAnnouncementId) {
        await announcements.update(editingAnnouncementId, announcementFormData)
      } else {
        await announcements.create({
          ...announcementFormData,
          league_id: id,
        })
      }
      setAnnouncementFormData({ title: '', message: '', expires_at: '' })
      setShowAnnouncementForm(false)
      setEditingAnnouncementId(null)
      fetchAnnouncements()
    } catch (error) {
      alert('Error saving announcement: ' + error.message)
    }
  }

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncementId(announcement.id)
    setAnnouncementFormData({
      title: announcement.title,
      message: announcement.message,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
    })
    setShowAnnouncementForm(true)
  }

  const handleDeleteAnnouncement = async (announcementId, title) => {
    setDeleteAnnouncementModal({ isOpen: true, announcementId, title })
  }

  const confirmDeleteAnnouncement = async () => {
    try {
      await announcements.delete(deleteAnnouncementModal.announcementId)
      fetchAnnouncements()
    } catch (error) {
      alert('Error deleting announcement: ' + error.message)
    }
  }

  const handleToggleAnnouncementActive = async (announcement) => {
    try {
      await announcements.update(announcement.id, {
        ...announcement,
        is_active: announcement.is_active === 1 ? 0 : 1,
      })
      fetchAnnouncements()
    } catch (error) {
      alert('Error updating announcement: ' + error.message)
    }
  }

  const toggleTeamRoster = async (teamId) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null)
    } else {
      setExpandedTeamId(teamId)
      if (!teamPlayers[teamId]) {
        await fetchTeamPlayers(teamId)
      }
    }
  }

  const fetchTeamPlayers = async (teamId) => {
    try {
      const playersData = await players.getByTeam(teamId)
      setTeamPlayers(prev => ({ ...prev, [teamId]: playersData }))
    } catch (error) {
      console.error('Error fetching team players:', error)
    }
  }

  const handlePlayerDelete = async (playerId, playerName, teamId) => {
    setRemovePlayerModal({ isOpen: true, playerId, playerName, teamId })
  }

  const confirmRemovePlayer = async () => {
    try {
      await players.delete(removePlayerModal.playerId)
      await fetchTeamPlayers(removePlayerModal.teamId)
    } catch (error) {
      alert('Error removing player: ' + error.message)
    }
  }

  const openTransferModal = (player) => {
    setPlayerToTransfer(player)
    setSelectedTeamId('')
    setShowTransferModal(true)
  }

  const closeTransferModal = () => {
    setShowTransferModal(false)
    setPlayerToTransfer(null)
    setSelectedTeamId('')
  }

  const handlePlayerTransfer = async () => {
    if (!selectedTeamId) {
      alert('Please select a destination team')
      return
    }

    try {
      await players.transfer(playerToTransfer.id, selectedTeamId)
      closeTransferModal()
      // Refresh league data to update team captain labels and counts
      await fetchLeagueData()
      // Refresh both teams' rosters if they are expanded
      if (teamPlayers[playerToTransfer.team_id]) {
        await fetchTeamPlayers(playerToTransfer.team_id)
      }
      if (teamPlayers[selectedTeamId]) {
        await fetchTeamPlayers(selectedTeamId)
      }
      // Refresh payment data if active season exists
      if (activeSeason) {
        await fetchPaymentData(activeSeason.id)
      }
    } catch (error) {
      alert('Error transferring player: ' + error.message)
    }
  }

  const handleArchive = async () => {
    const isArchived = league.archived === 1
    setArchiveSeasonModal({ isOpen: true, isArchived, leagueName: league.name })
  }

  const confirmArchiveLeague = async () => {
    const isArchived = archiveSeasonModal.isArchived
    const action = isArchived ? 'unarchive' : 'archive'

    try {
      await leagues.archive(id, !isArchived)
      // Refresh the league data
      fetchLeagueData()
    } catch (error) {
      alert(`Error ${action}ing league: ` + error.message)
    }
  }

  const handleDeleteLeague = async () => {
    setDeleteLeagueModal({ isOpen: true })
  }

  const confirmDeleteLeague = async () => {
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
    setDeleteSeasonModal({ isOpen: true, seasonId })
  }

  const confirmDeleteSeason = async () => {
    try {
      await seasons.delete(deleteSeasonModal.seasonId)
      fetchLeagueData()
    } catch (error) {
      alert('Error deleting season: ' + error.message)
    }
  }

  const handleDeleteTeam = async (teamId, teamName) => {
    setDeleteTeamModal({ isOpen: true, teamId, teamName })
  }

  const confirmDeleteTeam = async () => {
    try {
      await teamsApi.delete(deleteTeamModal.teamId)
      fetchLeagueData()
    } catch (error) {
      alert('Error deleting team: ' + error.message)
    }
  }

  const handleGameSubmit = async (e) => {
    e.preventDefault()
    try {
      await gamesApi.create({
        ...gameFormData,
        season_id: selectedSeasonId,
      })
      setGameFormData({
        home_team_id: '',
        away_team_id: '',
        game_date: '',
        game_time: '',
        rink_name: '',
      })
      setShowGameForm(false)
      fetchLeagueData()
    } catch (error) {
      alert('Error creating game: ' + error.message)
    }
  }

  const handlePlayerSubmit = async (e, teamId) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    try {
      await players.create({
        team_id: teamId,
        name: formData.get('name'),
        jersey_number: formData.get('jersey_number'),
        position: formData.get('position'),
        email: formData.get('email'),
      })
      setShowPlayerForm(null)
      await fetchTeamPlayers(teamId)
    } catch (error) {
      alert('Error adding player: ' + error.message)
    }
  }

  const handleMarkPaid = (player) => {
    setPlayerToMarkPaid(player)
    setShowPaymentMethodModal(true)
  }

  const handlePaymentMethodSelect = async (paymentMethod) => {
    if (!playerToMarkPaid) return

    try {
      // If no payment record exists, create one first
      if (!playerToMarkPaid.payment_id) {
        const paymentRecord = await payments.create({
          player_id: playerToMarkPaid.id,
          team_id: playerToMarkPaid.team_id,
          amount: activeSeason.season_dues || 0,
          season_id: activeSeason.id,
          payment_method: paymentMethod
        })
        // Mark the newly created payment as paid
        await payments.markPaid(paymentRecord.id, null, null, paymentMethod)
      } else {
        // Mark existing payment as paid
        await payments.markPaid(playerToMarkPaid.payment_id, null, null, paymentMethod)
      }
      // Refresh payment data
      await fetchPaymentData(activeSeason.id)
      // Close modal
      setShowPaymentMethodModal(false)
      setPlayerToMarkPaid(null)
    } catch (error) {
      alert('Error marking payment as paid: ' + error.message)
    }
  }

  const handleMarkUnpaid = async (player) => {
    setMarkUnpaidModal({ isOpen: true, player })
  }

  const confirmMarkUnpaid = async () => {
    try {
      await payments.markUnpaid(markUnpaidModal.player.payment_id)
      // Refresh payment data
      await fetchPaymentData(activeSeason.id)
    } catch (error) {
      alert('Error marking payment as unpaid: ' + error.message)
    }
  }

  const handleEditPaymentAmount = (player) => {
    setEditingPaymentId(player.payment_id || `new-${player.id}`)
    setEditingPaymentAmount(player.payment_amount || activeSeason.season_dues || '0')
  }

  const handleSavePaymentAmount = async (player) => {
    try {
      const amount = parseFloat(editingPaymentAmount)
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid amount')
        return
      }

      if (player.payment_id) {
        // Update existing payment amount
        await payments.updateAmount(player.payment_id, amount)
      } else {
        // Create new payment record with custom amount
        await payments.create({
          player_id: player.id,
          team_id: player.team_id,
          amount: amount,
          season_id: activeSeason.id,
          status: 'pending'
        })
      }

      setEditingPaymentId(null)
      setEditingPaymentAmount('')
      await fetchPaymentData(activeSeason.id)
    } catch (error) {
      alert('Error updating payment amount: ' + error.message)
    }
  }

  const handleEditSeasonDues = () => {
    setEditingSeasonDues(true)
    setTempSeasonDues(activeSeason.season_dues || '0')
  }

  const handleSaveSeasonDues = async () => {
    try {
      const amount = parseFloat(tempSeasonDues)
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid amount')
        return
      }

      await seasons.update(activeSeason.id, {
        ...activeSeason,
        season_dues: amount
      })

      setEditingSeasonDues(false)
      setTempSeasonDues('')
      await fetchLeagueData()
      await fetchPaymentData(activeSeason.id)
    } catch (error) {
      alert('Error updating season dues: ' + error.message)
    }
  }

  const handleEditPaymentLink = () => {
    setEditingPaymentLink(true)
    setTempPaymentLink(activeSeason.venmo_link || '')
  }

  const handleSavePaymentLink = async () => {
    try {
      await seasons.update(activeSeason.id, {
        ...activeSeason,
        venmo_link: tempPaymentLink.trim()
      })

      setEditingPaymentLink(false)
      setTempPaymentLink('')
      await fetchLeagueData()
    } catch (error) {
      alert('Error updating payment link: ' + error.message)
    }
  }

  const handleToggleCaptain = async (player, teamId) => {
    // Only players with user_id can be captains
    if (!player.user_id) {
      alert('Only players with linked user accounts can be made captains')
      return
    }

    try {
      if (player.is_captain === 1) {
        // Remove captain status
        await teamCaptains.remove(player.user_id, teamId)
      } else {
        // Add captain status
        await teamCaptains.add(player.user_id, teamId)
      }
      // Refresh league data to update captain labels
      await fetchLeagueData()
      // Refresh team roster
      await fetchTeamPlayers(teamId)
    } catch (error) {
      alert('Error toggling captain status: ' + error.message)
    }
  }

  const handleAddManager = async (e) => {
    e.preventDefault()
    if (!managerEmail.trim()) {
      alert('Please enter an email address')
      return
    }

    try {
      await leagues.addManager(id, managerEmail)
      setManagerEmail('')
      setShowManagerForm(false)
      await fetchLeagueData()
    } catch (error) {
      alert('Error adding manager: ' + error.message)
    }
  }

  const handleRemoveManager = async (manager) => {
    // Don't allow removing the league owner
    if (manager.is_owner) {
      alert('Cannot remove the league owner')
      return
    }

    setRemoveManagerModal({ isOpen: true, manager })
  }

  const confirmRemoveManager = async () => {
    try {
      await leagues.removeManager(id, removeManagerModal.manager.id)
      await fetchLeagueData()
    } catch (error) {
      alert('Error removing manager: ' + error.message)
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

      {/* Main Tabs - Primary Navigation */}
      <div className="bg-gray-50 border-b-2 border-gray-300 mb-1">
        <nav className="flex space-x-2 px-4">
          <button
            onClick={() => setMainTab('overview')}
            className={`py-4 px-6 font-bold text-lg transition-all ${
              mainTab === 'overview'
                ? 'bg-white text-ice-700 border-b-4 border-ice-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setMainTab('season')}
            className={`py-4 px-6 font-bold text-lg transition-all ${
              mainTab === 'season'
                ? 'bg-white text-ice-700 border-b-4 border-ice-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Season
          </button>
        </nav>
      </div>

      {/* Sub Tabs - Secondary Navigation */}
      {mainTab === 'overview' && (
        <div className="bg-gray-100 border-b border-gray-300 mb-6">
          <nav className="flex space-x-1 px-4">
            <button
              onClick={() => setOverviewSubTab('managers')}
              className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                overviewSubTab === 'managers'
                  ? 'bg-white text-ice-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Managers
            </button>
            <button
              onClick={() => setOverviewSubTab('announcements')}
              className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                overviewSubTab === 'announcements'
                  ? 'bg-white text-ice-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Announcements
            </button>
            <button
              onClick={() => setOverviewSubTab('payments')}
              className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                overviewSubTab === 'payments'
                  ? 'bg-white text-ice-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Payments
            </button>
          </nav>
        </div>
      )}

      {mainTab === 'season' && (
        <>
          {/* Season Selector Card */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Select Season</h3>
                {activeSeason && (
                  <p className="text-sm text-gray-600 mt-1">
                    Active Season: <span className="font-semibold text-ice-600">{activeSeason.name}</span>
                    {activeSeason.season_dues && (
                      <span className="ml-2">• Dues: ${parseFloat(activeSeason.season_dues).toFixed(2)}</span>
                    )}
                  </p>
                )}
              </div>
              {canManage && (
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
                  {showSeasonForm ? 'Cancel' : '+ Add Season'}
                </button>
              )}
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
              <p className="text-gray-500 text-center py-4">No seasons yet. Create one to get started.</p>
            ) : (
              <div className="grid gap-2">
                {leagueSeasons.filter(season => season.id !== editingSeasonId).map((season) => (
                  <div
                    key={season.id}
                    onClick={() => setSelectedSeasonId(season.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedSeasonId === season.id
                        ? 'bg-ice-100 border-2 border-ice-600'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-lg">{season.name}</div>
                          {season.is_active === 1 && (
                            <span className="badge badge-success">Active</span>
                          )}
                          {season.archived === 1 && (
                            <span className="badge badge-neutral">Archived</span>
                          )}
                        </div>
                        {season.description && (
                          <div className="text-sm text-gray-600 mb-2">{season.description}</div>
                        )}
                        <div className="flex gap-4 text-xs text-gray-600">
                          {season.start_date && <span>Start: {new Date(season.start_date).toLocaleDateString()}</span>}
                          {season.end_date && <span>End: {new Date(season.end_date).toLocaleDateString()}</span>}
                          {season.season_dues && <span>Dues: ${parseFloat(season.season_dues).toFixed(2)}</span>}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Season Context Tabs - Only show if a season is selected */}
          {selectedSeasonId && (
            <div className="bg-gray-100 border-b border-gray-300 mb-6">
              <nav className="flex space-x-1 px-4">
                <button
                  onClick={() => setSeasonSubTab('teams')}
                  className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                    seasonSubTab === 'teams'
                      ? 'bg-white text-ice-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Teams
                </button>
                <button
                  onClick={() => setSeasonSubTab('schedule')}
                  className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                    seasonSubTab === 'schedule'
                      ? 'bg-white text-ice-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Schedule
                </button>
                {canManage && (
                  <button
                    onClick={() => setSeasonSubTab('playoffs')}
                    className={`py-3 px-5 font-semibold text-sm rounded-t transition-all ${
                      seasonSubTab === 'playoffs'
                        ? 'bg-white text-ice-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Playoffs
                  </button>
                )}
              </nav>
            </div>
          )}
        </>
      )}

      {/* Content */}
      {mainTab === 'overview' && overviewSubTab === 'managers' && (
        <div>
          {/* League Managers Section */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                League Manager{managers.length !== 1 ? 's' : ''}
              </h3>
              <div className="flex gap-2">
                {canManage && (
                  <>
                    <button
                      onClick={() => setShowManagerForm(!showManagerForm)}
                      className="btn-primary"
                    >
                      {showManagerForm ? 'Cancel' : '+ Add Manager'}
                    </button>
                    <button
                      onClick={() => setShowContactModal(true)}
                      className="btn-secondary"
                    >
                      Contact All Players
                    </button>
                  </>
                )}
              </div>
            </div>

            {showManagerForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-3">Add Manager</h4>
                <form onSubmit={handleAddManager} className="flex gap-2">
                  <input
                    type="email"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    className="input flex-1"
                    placeholder="manager@example.com"
                    required
                  />
                  <button type="submit" className="btn-primary">
                    Add
                  </button>
                </form>
                <p className="text-sm text-gray-600 mt-2">
                  Enter the email address of a registered user to add them as a league manager
                </p>
              </div>
            )}

            {managers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No managers assigned yet</p>
                {canManage && (
                  <button
                    onClick={() => setShowManagerForm(true)}
                    className="btn-primary"
                  >
                    Add First Manager
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {managers.map((manager) => (
                  <div key={manager.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{manager.name || 'No name'}</span>
                        {manager.is_owner && (
                          <span className="badge badge-info text-xs">Owner</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {manager.email}
                        {manager.phone && <span className="ml-2">• {manager.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={`mailto:${manager.email}`} className="btn-secondary text-sm">
                        Email
                      </a>
                      {canManage && !manager.is_owner && (
                        <button
                          onClick={() => handleRemoveManager(manager)}
                          className="btn-danger text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Games Section */}
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
                  <button onClick={() => { setMainTab('season'); setSeasonSubTab('schedule'); }} className="btn-secondary">
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
                    <button onClick={() => { setMainTab('season'); setSeasonSubTab('schedule'); }} className="btn-secondary">
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

      {mainTab === 'season' && seasonSubTab === 'teams' && (
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
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center flex-1">
                      <div
                        className="w-8 h-8 rounded-full mr-3"
                        style={{ backgroundColor: team.color }}
                      />
                      <h3 className="text-xl font-semibold">{team.name}</h3>
                      {team.captains && team.captains.length > 0 && (
                        <div className="ml-4 flex gap-2">
                          {team.captains.map((captain, idx) => (
                            <span key={idx} className="badge badge-info text-xs">
                              Captain: {captain.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleTeamRoster(team.id)}
                        className="btn-secondary text-sm"
                      >
                        {expandedTeamId === team.id ? 'Hide' : 'Show'} Roster
                        {teamPlayers[team.id] && ` (${teamPlayers[team.id].length})`}
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          className="btn-danger text-sm px-3"
                        >
                          Delete Team
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedTeamId === team.id && (
                    <div className="mt-4 border-t pt-4">
                      {canManageTeam(team.id) && (
                        <div className="mb-4">
                          <button
                            onClick={() => setShowPlayerForm(showPlayerForm === team.id ? null : team.id)}
                            className="btn-primary text-sm"
                          >
                            {showPlayerForm === team.id ? 'Cancel' : '+ Add Player'}
                          </button>
                        </div>
                      )}

                      {showPlayerForm === team.id && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold mb-3">Add Player to {team.name}</h4>
                          <form onSubmit={(e) => handlePlayerSubmit(e, team.id)} className="space-y-3">
                            <div className="grid md:grid-cols-2 gap-3">
                              <div>
                                <label className="label">Player Name *</label>
                                <input
                                  type="text"
                                  name="name"
                                  className="input"
                                  placeholder="John Doe"
                                  required
                                />
                              </div>
                              <div>
                                <label className="label">Email</label>
                                <input
                                  type="email"
                                  name="email"
                                  className="input"
                                  placeholder="player@example.com"
                                />
                              </div>
                              <div>
                                <label className="label">Jersey Number</label>
                                <input
                                  type="number"
                                  name="jersey_number"
                                  className="input"
                                  placeholder="99"
                                />
                              </div>
                              <div>
                                <label className="label">Position</label>
                                <select name="position" className="input">
                                  <option value="player">Player</option>
                                  <option value="forward">Forward</option>
                                  <option value="defense">Defense</option>
                                  <option value="goalie">Goalie</option>
                                </select>
                              </div>
                            </div>
                            <button type="submit" className="btn-primary text-sm">
                              Add Player
                            </button>
                          </form>
                        </div>
                      )}

                      {!teamPlayers[team.id] ? (
                        <div className="text-center py-4 text-gray-500">Loading roster...</div>
                      ) : teamPlayers[team.id].length === 0 && showPlayerForm !== team.id ? (
                        <div className="text-center py-4 text-gray-500">
                          <p className="mb-2">No players on this team</p>
                          {canManageTeam(team.id) && (
                            <button
                              onClick={() => setShowPlayerForm(team.id)}
                              className="btn-primary text-sm"
                            >
                              Add First Player
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {teamPlayers[team.id].map((player) => (
                            <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="font-medium">{player.name}</div>
                                {player.jersey_number && (
                                  <span className="badge badge-neutral text-xs">#{player.jersey_number}</span>
                                )}
                                {player.position && player.position !== 'player' && (
                                  <span className="badge badge-info text-xs capitalize">{player.position}</span>
                                )}
                                {player.is_captain === 1 && (
                                  <span className="badge badge-warning text-xs">Captain</span>
                                )}
                              </div>
                              {canManageTeam(team.id) && (
                                <div className="flex gap-2">
                                  {player.user_id && (
                                    <button
                                      onClick={() => handleToggleCaptain(player, team.id)}
                                      className={player.is_captain === 1 ? "btn-warning text-xs py-1 px-3" : "btn-secondary text-xs py-1 px-3"}
                                    >
                                      {player.is_captain === 1 ? 'Remove Captain' : 'Make Captain'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openTransferModal(player)}
                                    className="btn-secondary text-xs py-1 px-3"
                                  >
                                    Transfer
                                  </button>
                                  <button
                                    onClick={() => handlePlayerDelete(player.id, player.name, team.id)}
                                    className="btn-danger text-xs py-1 px-3"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mainTab === 'season' && seasonSubTab === 'schedule' && (
        <div>
          <div className="mb-6 flex justify-end">
            {canManage && (
              <button
                onClick={() => setShowGameForm(!showGameForm)}
                className="btn-primary"
              >
                {showGameForm ? 'Cancel' : '+ Add Game'}
              </button>
            )}
          </div>

          {showGameForm && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold mb-4">Schedule New Game</h2>
              <form onSubmit={handleGameSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Home Team *</label>
                    <select
                      value={gameFormData.home_team_id}
                      onChange={(e) => setGameFormData({ ...gameFormData, home_team_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Select home team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Away Team *</label>
                    <select
                      value={gameFormData.away_team_id}
                      onChange={(e) => setGameFormData({ ...gameFormData, away_team_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Select away team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Game Date *</label>
                    <input
                      type="date"
                      value={gameFormData.game_date}
                      onChange={(e) => setGameFormData({ ...gameFormData, game_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Game Time *</label>
                    <input
                      type="time"
                      value={gameFormData.game_time}
                      onChange={(e) => setGameFormData({ ...gameFormData, game_time: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Rink Name</label>
                    <input
                      type="text"
                      value={gameFormData.rink_name}
                      onChange={(e) => setGameFormData({ ...gameFormData, rink_name: e.target.value })}
                      className="input"
                      placeholder="e.g., Main Arena"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  Schedule Game
                </button>
              </form>
            </div>
          )}

          {games.length === 0 && !showGameForm ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No games scheduled yet</p>
              {canManage && (
                <button onClick={() => setShowGameForm(true)} className="btn-primary">
                  Schedule Your First Game
                </button>
              )}
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
                      {game.rink_name && (
                        <div className="text-xs text-gray-500">{game.rink_name}</div>
                      )}
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

      {mainTab === 'season' && seasonSubTab === 'playoffs' && (
        <div>
          <div className="card text-center py-12">
            <h3 className="text-xl font-semibold mb-4">Playoffs Management</h3>
            <p className="text-gray-500 mb-4">Playoff bracket and management features coming soon</p>
            <button onClick={() => setSeasonSubTab('schedule')} className="btn-secondary">
              Back to Schedule
            </button>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {mainTab === 'overview' && overviewSubTab === 'announcements' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">League Announcements</h2>
              <p className="text-sm text-gray-500 mt-1">{announcementsList.length} total</p>
            </div>
            {canManage && (
              <button
                onClick={() => {
                  setShowAnnouncementForm(!showAnnouncementForm)
                  setEditingAnnouncementId(null)
                  setAnnouncementFormData({ title: '', message: '', expires_at: '' })
                }}
                className="btn-primary"
              >
                {showAnnouncementForm ? 'Cancel' : 'New Announcement'}
              </button>
            )}
          </div>

          {showAnnouncementForm && canManage && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingAnnouncementId ? 'Edit Announcement' : 'Create New Announcement'}
              </h3>
              <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                <div>
                  <label className="label">Title *</label>
                  <input
                    type="text"
                    value={announcementFormData.title}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, title: e.target.value })}
                    className="input"
                    placeholder="Important Update"
                    required
                  />
                </div>

                <div>
                  <label className="label">Message *</label>
                  <textarea
                    value={announcementFormData.message}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, message: e.target.value })}
                    className="input"
                    rows="4"
                    placeholder="Enter your announcement message..."
                    required
                  />
                </div>

                <div>
                  <label className="label">Expiration Date (optional)</label>
                  <input
                    type="date"
                    value={announcementFormData.expires_at}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, expires_at: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank for no expiration
                  </p>
                </div>

                <button type="submit" className="btn-primary">
                  {editingAnnouncementId ? 'Update Announcement' : 'Create Announcement'}
                </button>
              </form>
            </div>
          )}

          {announcementsList.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No announcements yet</p>
              {canManage && (
                <button onClick={() => setShowAnnouncementForm(true)} className="btn-primary">
                  Create Your First Announcement
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {announcementsList.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`card ${announcement.is_active === 1 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{announcement.title}</h3>
                        <span
                          className={`badge ${
                            announcement.is_active === 1 ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {announcement.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{announcement.message}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Posted {new Date(announcement.created_at).toLocaleDateString()}</span>
                        {announcement.expires_at && (
                          <span>
                            Expires {new Date(announcement.expires_at).toLocaleDateString()}
                          </span>
                        )}
                        {announcement.author_name && <span>By {announcement.author_name}</span>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleAnnouncementActive(announcement)}
                          className="btn-secondary text-xs py-1 px-3"
                        >
                          {announcement.is_active === 1 ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEditAnnouncement(announcement)}
                          className="btn-secondary text-xs py-1 px-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
                          className="btn-danger text-xs py-1 px-3"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {mainTab === 'overview' && overviewSubTab === 'payments' && (
        <div>
          {!activeSeason ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No active season</p>
              <p className="text-sm text-gray-400 mb-4">Create a season first to track payments</p>
              <button onClick={() => { setMainTab('season'); setSeasonSubTab(null); }} className="btn-primary">
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

              {/* Season Dues and Payment Link Editor */}
              {activeSeason && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Season Dues */}
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Season Dues</div>
                      {editingSeasonDues ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">$</span>
                          <input
                            type="number"
                            value={tempSeasonDues}
                            onChange={(e) => setTempSeasonDues(e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded"
                            step="0.01"
                            min="0"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveSeasonDues}
                            className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSeasonDues(false)}
                            className="text-sm px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold text-ice-600">
                            ${parseFloat(activeSeason.season_dues || 0).toFixed(2)}
                          </div>
                          {canManage && (
                            <button
                              onClick={handleEditSeasonDues}
                              className="text-sm text-ice-600 hover:text-ice-700 underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Default amount for all players
                      </div>
                    </div>

                    {/* Payment Link */}
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Payment Link (Venmo, etc.)</div>
                      {editingPaymentLink ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tempPaymentLink}
                            onChange={(e) => setTempPaymentLink(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded"
                            placeholder="https://venmo.com/..."
                            autoFocus
                          />
                          <button
                            onClick={handleSavePaymentLink}
                            className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPaymentLink(false)}
                            className="text-sm px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {activeSeason.venmo_link ? (
                            <>
                              <a
                                href={activeSeason.venmo_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-ice-600 hover:text-ice-700 underline text-sm truncate max-w-xs"
                              >
                                {activeSeason.venmo_link}
                              </a>
                              {canManage && (
                                <button
                                  onClick={handleEditPaymentLink}
                                  className="text-sm text-ice-600 hover:text-ice-700 underline"
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-gray-400 text-sm">No payment link set</span>
                              {canManage && (
                                <button
                                  onClick={handleEditPaymentLink}
                                  className="text-sm text-ice-600 hover:text-ice-700 underline"
                                >
                                  Add
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Link for players to make payments
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Overall Progress Bar */}
              {paymentStats && paymentStats.total_players > 0 && (
                <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Overall Payment Progress</h3>
                    <span className="text-sm text-gray-600">
                      {paymentStats.players_paid} of {paymentStats.total_players} players paid ({Math.round((paymentStats.players_paid / paymentStats.total_players) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-6">
                    <div
                      className="bg-green-600 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                      style={{ width: `${(paymentStats.players_paid / paymentStats.total_players) * 100}%` }}
                    >
                      {Math.round((paymentStats.players_paid / paymentStats.total_players) * 100)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Progress by Team */}
              {paymentData.length > 0 && (
                <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
                  <h3 className="font-semibold mb-4">Payment Progress by Team</h3>
                  <div className="space-y-4">
                    {(() => {
                      // Group players by team
                      const teamPayments = {}
                      paymentData.forEach(row => {
                        if (!teamPayments[row.team_id]) {
                          teamPayments[row.team_id] = {
                            name: row.team_name,
                            color: row.team_color,
                            paid: 0,
                            total: 0
                          }
                        }
                        // Only count player if row has player data (id is not null)
                        if (row.id !== null) {
                          teamPayments[row.team_id].total++
                          if (row.payment_status === 'paid') {
                            teamPayments[row.team_id].paid++
                          }
                        }
                      })

                      return Object.values(teamPayments).map((team, idx) => {
                        const percentage = team.total > 0 ? (team.paid / team.total) * 100 : 0
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: team.color }}
                                />
                                <span className="font-medium">{team.name}</span>
                              </div>
                              <span className="text-sm text-gray-600">
                                {team.paid} of {team.total} paid{team.total > 0 ? ` (${Math.round(percentage)}%)` : ''}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div
                                className="h-4 rounded-full flex items-center justify-end pr-2 text-white text-xs font-medium transition-all duration-300"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: team.color
                                }}
                              >
                                {percentage >= 20 && `${Math.round(percentage)}%`}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              {/* Payment List - Grouped by Team */}
              {paymentData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No players in this season yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    // Group players by team
                    const teamGroups = {}
                    paymentData.forEach(row => {
                      if (!teamGroups[row.team_id]) {
                        teamGroups[row.team_id] = {
                          name: row.team_name,
                          color: row.team_color,
                          players: []
                        }
                      }
                      // Only add player if row has player data (id is not null)
                      if (row.id !== null) {
                        teamGroups[row.team_id].players.push(row)
                      }
                    })

                    return Object.entries(teamGroups).map(([teamId, team]) => (
                      <div key={teamId} className="card">
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <h3 className="text-lg font-semibold">{team.name}</h3>
                          <span className="text-sm text-gray-600">
                            ({team.players.filter(p => p.payment_status === 'paid').length} of {team.players.length} paid)
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3">Player</th>
                                <th className="text-left py-2 px-3">Email</th>
                                <th className="text-center py-2 px-3">Amount</th>
                                <th className="text-center py-2 px-3">Status</th>
                                <th className="text-center py-2 px-3">Method</th>
                                <th className="text-center py-2 px-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {team.players.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="py-4 px-3 text-center text-gray-500 text-sm">
                                    No players on this team yet
                                  </td>
                                </tr>
                              ) : (
                                team.players.map((player) => (
                                  <tr key={player.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-3 font-medium">{player.name}</td>
                                    <td className="py-2 px-3 text-sm text-gray-600">{player.email || '-'}</td>
                                    <td className="py-2 px-3 text-center">
                                      {editingPaymentId === (player.payment_id || `new-${player.id}`) ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <span className="text-sm">$</span>
                                          <input
                                            type="number"
                                            value={editingPaymentAmount}
                                            onChange={(e) => setEditingPaymentAmount(e.target.value)}
                                            className="w-20 px-1 py-0.5 text-sm border border-gray-300 rounded"
                                            step="0.01"
                                            min="0"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleSavePaymentAmount(player)}
                                            className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingPaymentId(null)
                                              setEditingPaymentAmount('')
                                            }}
                                            className="text-xs px-2 py-0.5 bg-gray-400 text-white rounded hover:bg-gray-500"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          <span>${parseFloat(player.payment_amount || activeSeason.season_dues || 0).toFixed(2)}</span>
                                          {canManage && (
                                            <button
                                              onClick={() => handleEditPaymentAmount(player)}
                                              className="text-xs text-ice-600 hover:text-ice-700"
                                            >
                                              ✎
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      {player.payment_status === 'paid' ? (
                                        <span className="badge badge-success">Paid</span>
                                      ) : (
                                        <span className="badge badge-error">Unpaid</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      {player.payment_status === 'paid' && player.payment_method ? (
                                        <span className="text-xs text-gray-600 capitalize">
                                          {player.payment_method}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      {player.payment_status === 'paid' ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-xs text-gray-500">
                                            {new Date(player.paid_date).toLocaleDateString()}
                                          </span>
                                          {canManage && (
                                            <button
                                              onClick={() => handleMarkUnpaid(player)}
                                              className="text-xs text-red-600 hover:text-red-700 hover:underline"
                                            >
                                              Mark Unpaid
                                            </button>
                                          )}
                                        </div>
                                      ) : canManage ? (
                                        <button
                                          onClick={() => handleMarkPaid(player)}
                                          className="text-xs text-ice-600 hover:text-ice-700 hover:underline"
                                        >
                                          Mark Paid
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-500">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  })()}
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

      {/* Payment Method Selection Modal */}
      {showPaymentMethodModal && playerToMarkPaid && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Payment Method</h2>
                <button
                  onClick={() => {
                    setShowPaymentMethodModal(false)
                    setPlayerToMarkPaid(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                How did <span className="font-semibold">{playerToMarkPaid.name}</span> pay for their season dues?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePaymentMethodSelect('venmo')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-[#008CFF] bg-gradient-to-br from-[#008CFF]/10 to-[#3D95CE]/10 rounded-lg hover:border-[#008CFF] hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-[#008CFF] rounded-xl flex items-center justify-center mb-2">
                    <span className="text-white text-xl font-bold">V</span>
                  </div>
                  <span className="font-semibold text-[#008CFF]">Venmo</span>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('zelle')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-[#6D1ED4] bg-gradient-to-br from-[#6D1ED4]/10 to-[#A24DFF]/10 rounded-lg hover:border-[#6D1ED4] hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-[#6D1ED4] rounded-xl flex items-center justify-center mb-2">
                    <span className="text-white text-xl font-bold">Z</span>
                  </div>
                  <span className="font-semibold text-[#6D1ED4]">Zelle</span>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('cash')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-green-600 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:border-green-600 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-2">
                    <span className="text-white text-2xl font-bold">$</span>
                  </div>
                  <span className="font-semibold text-green-700">Cash</span>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('check')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:border-blue-600 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-2">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-blue-700">Check</span>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('paypal')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-[#0070BA] bg-gradient-to-br from-[#0070BA]/10 to-[#003087]/10 rounded-lg hover:border-[#0070BA] hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-[#0070BA] rounded-xl flex items-center justify-center mb-2">
                    <span className="text-white text-xl font-bold">P</span>
                  </div>
                  <span className="font-semibold text-[#0070BA]">PayPal</span>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('other')}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-gray-500 rounded-xl flex items-center justify-center mb-2">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-700">Other</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowPaymentMethodModal(false)
                  setPlayerToMarkPaid(null)
                }}
                className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Player Modal */}
      {showTransferModal && playerToTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Transfer Player</h3>
            <p className="text-gray-600 mb-4">
              Transfer <strong>{playerToTransfer.name}</strong> to:
            </p>

            <div className="space-y-3">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input w-full"
              >
                <option value="">Select a team...</option>
                {teams
                  .filter(t => t.id !== playerToTransfer.team_id)
                  .map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handlePlayerTransfer}
                  className="btn-primary flex-1"
                  disabled={!selectedTeamId}
                >
                  Transfer
                </button>
                <button
                  onClick={closeTransferModal}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Announcement Modal */}
      <ConfirmModal
        isOpen={deleteAnnouncementModal.isOpen}
        onClose={() => setDeleteAnnouncementModal({ isOpen: false, announcementId: null, title: '' })}
        onConfirm={confirmDeleteAnnouncement}
        title="Delete Announcement"
        message={`Are you sure you want to delete the announcement "${deleteAnnouncementModal.title}"?`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Remove Player Modal */}
      <ConfirmModal
        isOpen={removePlayerModal.isOpen}
        onClose={() => setRemovePlayerModal({ isOpen: false, playerId: null, playerName: '', teamId: null })}
        onConfirm={confirmRemovePlayer}
        title="Remove Player"
        message={`Are you sure you want to remove ${removePlayerModal.playerName} from the roster?`}
        confirmText="Remove"
        variant="danger"
      />

      {/* Archive/Unarchive League Modal */}
      <ConfirmModal
        isOpen={archiveSeasonModal.isOpen}
        onClose={() => setArchiveSeasonModal({ isOpen: false, isArchived: false, leagueName: '' })}
        onConfirm={confirmArchiveLeague}
        title={archiveSeasonModal.isArchived ? 'Unarchive League' : 'Archive League'}
        message={
          archiveSeasonModal.isArchived
            ? `Are you sure you want to unarchive this league?\n\nThis will restore "${archiveSeasonModal.leagueName}" and make all its teams, games, and schedules visible again.`
            : `Are you sure you want to archive this league?\n\nArchiving "${archiveSeasonModal.leagueName}" will:\n• Hide this league and its season data from active views\n• Preserve all teams, games, and player data\n• Allow you to unarchive it later if needed\n\nThis is useful for completed seasons you want to keep but not display.`
        }
        confirmText={archiveSeasonModal.isArchived ? 'Unarchive' : 'Archive'}
        variant="primary"
      />

      {/* Delete League Modal */}
      <ConfirmModal
        isOpen={deleteLeagueModal.isOpen}
        onClose={() => setDeleteLeagueModal({ isOpen: false })}
        onConfirm={confirmDeleteLeague}
        title="Delete League"
        message={`Delete league "${league?.name}"?\n\nThis will permanently delete all associated seasons, teams, games, and players. This cannot be undone.`}
        confirmText="Delete League"
        variant="danger"
      />

      {/* Delete Season Modal */}
      <ConfirmModal
        isOpen={deleteSeasonModal.isOpen}
        onClose={() => setDeleteSeasonModal({ isOpen: false, seasonId: null })}
        onConfirm={confirmDeleteSeason}
        title="Delete Season"
        message="Are you sure you want to delete this season?\n\nThis will also delete all associated teams, games, and payment records."
        confirmText="Delete Season"
        variant="danger"
      />

      {/* Delete Team Modal */}
      <ConfirmModal
        isOpen={deleteTeamModal.isOpen}
        onClose={() => setDeleteTeamModal({ isOpen: false, teamId: null, teamName: '' })}
        onConfirm={confirmDeleteTeam}
        title="Delete Team"
        message={`Delete team "${deleteTeamModal.teamName}"?\n\nThis will also delete all players on this team.`}
        confirmText="Delete Team"
        variant="danger"
      />

      {/* Mark Unpaid Modal */}
      <ConfirmModal
        isOpen={markUnpaidModal.isOpen}
        onClose={() => setMarkUnpaidModal({ isOpen: false, player: null })}
        onConfirm={confirmMarkUnpaid}
        title="Mark Payment as Unpaid"
        message={`Are you sure you want to mark ${markUnpaidModal.player?.name}'s payment as unpaid?`}
        confirmText="Mark Unpaid"
        variant="primary"
      />

      {/* Remove Manager Modal */}
      <ConfirmModal
        isOpen={removeManagerModal.isOpen}
        onClose={() => setRemoveManagerModal({ isOpen: false, manager: null })}
        onConfirm={confirmRemoveManager}
        title="Remove League Manager"
        message={`Are you sure you want to remove ${removeManagerModal.manager?.name || removeManagerModal.manager?.email} as a league manager?`}
        confirmText="Remove Manager"
        variant="danger"
      />
    </div>
  )
}
