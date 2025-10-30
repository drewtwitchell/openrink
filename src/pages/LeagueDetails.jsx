import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [seasonSubTab, setSeasonSubTab] = useState(null) // null shows seasons, or 'teams', 'schedule', 'playoffs'
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [showLeagueMenu, setShowLeagueMenu] = useState(false)
  const [editingSeasonId, setEditingSeasonId] = useState(null)
  const leagueMenuRef = useRef(null)
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
  const [copyFromPreviousSeason, setCopyFromPreviousSeason] = useState(false)
  const [paymentData, setPaymentData] = useState([])
  const [paymentStats, setPaymentStats] = useState(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactSubject, setContactSubject] = useState('')
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
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editingPlayerData, setEditingPlayerData] = useState({
    position: '',
    sub_position: '',
    jersey_number: '',
    _fullPlayer: null
  })
  const [showManagerForm, setShowManagerForm] = useState(false)
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)
  const [playerToMarkPaid, setPlayerToMarkPaid] = useState(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [paymentConfirmation, setPaymentConfirmation] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [gameScores, setGameScores] = useState({}) // Track scores for each game: { gameId: { home_score: '', away_score: '', saving: false, saved: false } }
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editingPaymentAmount, setEditingPaymentAmount] = useState('')
  const [editingSeasonDues, setEditingSeasonDues] = useState(false)
  const [tempSeasonDues, setTempSeasonDues] = useState('')
  const [editingPaymentLink, setEditingPaymentLink] = useState(false)
  const [tempPaymentLink, setTempPaymentLink] = useState('')
  const [editingLeagueName, setEditingLeagueName] = useState(false)
  const [tempLeagueName, setTempLeagueName] = useState('')
  const [editingSeasonName, setEditingSeasonName] = useState(null) // Track which season name is being edited
  const [tempSeasonName, setTempSeasonName] = useState('')
  const [editingLeagueInfo, setEditingLeagueInfo] = useState(false)
  const [tempLeagueInfo, setTempLeagueInfo] = useState('')

  // User search state for adding players
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  // ConfirmModal states
  const [deleteAnnouncementModal, setDeleteAnnouncementModal] = useState({ isOpen: false, announcementId: null, title: '' })
  const [removePlayerModal, setRemovePlayerModal] = useState({ isOpen: false, playerId: null, playerName: '', teamId: null })
  const [archiveSeasonModal, setArchiveSeasonModal] = useState({ isOpen: false, isArchived: false, leagueName: '' })
  const [deleteLeagueModal, setDeleteLeagueModal] = useState({ isOpen: false })
  const [deleteSeasonModal, setDeleteSeasonModal] = useState({ isOpen: false, seasonId: null })
  const [deleteTeamModal, setDeleteTeamModal] = useState({ isOpen: false, teamId: null, teamName: '' })
  const [markUnpaidModal, setMarkUnpaidModal] = useState({ isOpen: false, player: null })
  const [removeManagerModal, setRemoveManagerModal] = useState({ isOpen: false, manager: null })

  // Ref for scrolling to specific team
  const teamRefs = useRef({})

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

  // Filter teams based on user role
  // Admins and league managers see all teams
  // Captains only see teams they captain
  const visibleTeams = useMemo(() => {
    if (canManage) {
      // Admins and league managers see all teams
      return teams
    }
    // Captains only see their own teams
    return teams.filter(team => isTeamCaptain(team.id))
  }, [teams, canManage, currentUser])

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
        // Fetch roster for this team and scroll to it (will be called after fetchLeagueData completes)
        setTimeout(() => {
          fetchTeamPlayers(teamId)
          // Scroll to the team card
          if (teamRefs.current[teamId]) {
            teamRefs.current[teamId].scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 700)
      }
    }
  }, [id])

  // Auto-select first season when seasons load
  useEffect(() => {
    if (!selectedSeasonId && leagueSeasons.length > 0) {
      // Select the active season if exists, otherwise select the first season
      const activeSeasonInList = leagueSeasons.find(s => s.is_active === 1)
      const seasonToSelect = activeSeasonInList || leagueSeasons[0]
      setSelectedSeasonId(seasonToSelect.id)
    }
  }, [leagueSeasons, selectedSeasonId])

  // Set default season sub tab when season is selected
  useEffect(() => {
    // Auto-navigate to teams tab when season is selected, but NOT when we're showing the season form
    if (selectedSeasonId && !seasonSubTab && !showSeasonForm) {
      setSeasonSubTab('teams')
    }
  }, [selectedSeasonId, seasonSubTab, showSeasonForm])

  // Close league menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (leagueMenuRef.current && !leagueMenuRef.current.contains(event.target)) {
        setShowLeagueMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchLeagueData = async (preserveSelectedSeason = false) => {
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

      // Set selected season to active season by default (unless preserving current selection)
      if (!preserveSelectedSeason) {
        if (active) {
          setSelectedSeasonId(active.id)
          fetchPaymentData(active.id)
        } else if (seasonsData.length > 0) {
          // If no active season, select the most recent one
          setSelectedSeasonId(seasonsData[0].id)
        }
      } else if (active) {
        // Still fetch payment data for the active season even when preserving selection
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

  // Fetch announcements when General tab is selected
  useEffect(() => {
    if (mainTab === 'overview') {
      fetchAnnouncements()
    }
  }, [mainTab, id])

  // Fetch payment data when on General tab with active season
  useEffect(() => {
    if (mainTab === 'overview' && activeSeason) {
      fetchPaymentData(activeSeason.id)
    }
  }, [mainTab, activeSeason])

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

  const handleEditLeagueName = () => {
    setEditingLeagueName(true)
    setTempLeagueName(league.name)
  }

  const handleSaveLeagueName = async () => {
    if (!tempLeagueName.trim()) {
      alert('League name cannot be empty')
      return
    }
    try {
      await leagues.update(id, { ...league, name: tempLeagueName })
      setEditingLeagueName(false)
      fetchLeagueData()
    } catch (error) {
      alert('Error updating league name: ' + error.message)
    }
  }

  const handleCancelLeagueName = () => {
    setEditingLeagueName(false)
    setTempLeagueName('')
  }

  const handleEditLeagueInfo = () => {
    setEditingLeagueInfo(true)
    setTempLeagueInfo(league.league_info || '')
  }

  const handleSaveLeagueInfo = async () => {
    try {
      await leagues.update(id, { ...league, league_info: tempLeagueInfo })
      setLeague({ ...league, league_info: tempLeagueInfo })
      setEditingLeagueInfo(false)
    } catch (error) {
      console.error('Error updating league info:', error)
      alert('Failed to update league information')
    }
  }

  const handleCancelLeagueInfo = () => {
    setEditingLeagueInfo(false)
    setTempLeagueInfo('')
  }

  const handleEditSeasonName = (seasonId, currentName) => {
    setEditingSeasonName(seasonId)
    setTempSeasonName(currentName)
  }

  const handleSaveSeasonName = async (seasonId) => {
    if (!tempSeasonName.trim()) {
      alert('Season name cannot be empty')
      return
    }
    try {
      const season = leagueSeasons.find(s => s.id === seasonId)
      await seasons.update(seasonId, { ...season, name: tempSeasonName })
      setEditingSeasonName(null)
      setTempSeasonName('')
      fetchLeagueData()
    } catch (error) {
      alert('Error updating season name: ' + error.message)
    }
  }

  const handleCancelSeasonName = () => {
    setEditingSeasonName(null)
    setTempSeasonName('')
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
        // Create the new season
        const result = await seasons.create(data)
        const newSeasonId = result.id

        // If copying from previous season, copy teams and players
        if (copyFromPreviousSeason && leagueSeasons.length > 0) {
          // Find the most recent season (first in the list after sorting by created_at DESC)
          const previousSeason = leagueSeasons[0]

          // Get all teams from the previous season
          const previousTeams = teams.filter(t =>
            t.season_id === previousSeason.id ||
            (t.league_id === parseInt(id) && !t.season_id)
          )

          // Copy each team and its players
          for (const team of previousTeams) {
            // Create new team for the new season
            const newTeam = await teamsApi.create({
              name: team.name,
              color: team.color,
              league_id: parseInt(id),
              season_id: newSeasonId
            })

            // Get players from the old team
            const oldTeamPlayers = await teamsApi.getRoster(team.id)

            // Copy each player to the new team
            for (const player of oldTeamPlayers) {
              await players.create({
                team_id: newTeam.id,
                name: player.name,
                email: player.email,
                jersey_number: player.jersey_number,
                position: player.position,
                sub_position: player.sub_position,
                user_id: player.user_id
              })
            }
          }
        }
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
      setCopyFromPreviousSeason(false)
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
      const playerData = {
        team_id: teamId,
        name: selectedUser ? selectedUser.name : formData.get('name'),
        jersey_number: formData.get('jersey_number'),
        position: formData.get('position'),
        email: selectedUser ? selectedUser.email : formData.get('email'),
      }

      // If a user was selected, link the player to that user
      if (selectedUser) {
        playerData.user_id = selectedUser.id
      }

      await players.create(playerData)
      setShowPlayerForm(null)
      setSelectedUser(null)
      setUserSearchQuery('')
      setUserSearchResults([])
      await fetchTeamPlayers(teamId)
    } catch (error) {
      alert('Error adding player: ' + error.message)
    }
  }

  // Search for existing users
  const handleUserSearch = async (query) => {
    setUserSearchQuery(query)
    if (query.length < 2) {
      setUserSearchResults([])
      return
    }

    try {
      setIsSearching(true)
      const results = await auth.searchUsers(query)
      setUserSearchResults(results)
    } catch (error) {
      console.error('Error searching users:', error)
      setUserSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle selecting a user from search results
  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setUserSearchQuery('')
    setUserSearchResults([])
  }

  // Handle clearing selected user
  const handleClearSelectedUser = () => {
    setSelectedUser(null)
    setUserSearchQuery('')
    setUserSearchResults([])
  }

  // Reset user search when closing form
  const handleClosePlayerForm = () => {
    setShowPlayerForm(null)
    setSelectedUser(null)
    setUserSearchQuery('')
    setUserSearchResults([])
  }

  const handleMarkPaid = (player) => {
    setPlayerToMarkPaid(player)
    setSelectedPaymentMethod('')
    setPaymentConfirmation('')
    setPaymentNotes('')
    setShowPaymentMethodModal(true)
  }

  const handlePaymentFormSubmit = async (e) => {
    e.preventDefault()
    if (!playerToMarkPaid || !selectedPaymentMethod) return

    try {
      // If no payment record exists, create one first
      if (!playerToMarkPaid.payment_id) {
        const paymentRecord = await payments.create({
          player_id: playerToMarkPaid.id,
          team_id: playerToMarkPaid.team_id,
          amount: activeSeason.season_dues || 0,
          season_id: activeSeason.id,
          payment_method: selectedPaymentMethod,
          confirmation_number: paymentConfirmation || null,
          payment_notes: paymentNotes || null
        })
        // Mark the newly created payment as paid
        await payments.markPaid(paymentRecord.id, paymentConfirmation || null, paymentNotes || null, selectedPaymentMethod)
      } else {
        // Mark existing payment as paid
        await payments.markPaid(playerToMarkPaid.payment_id, paymentConfirmation || null, paymentNotes || null, selectedPaymentMethod)
      }
      // Refresh payment data
      await fetchPaymentData(activeSeason.id)
      // Close modal
      setShowPaymentMethodModal(false)
      setPlayerToMarkPaid(null)
      setSelectedPaymentMethod('')
      setPaymentConfirmation('')
      setPaymentNotes('')
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
      await fetchLeagueData(true) // Preserve selected season
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
      await fetchLeagueData(true) // Preserve selected season
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

  const handleEditPlayer = (player) => {
    setEditingPlayerId(player.id)
    setEditingPlayerData({
      position: player.position || 'player',
      sub_position: player.sub_position || '',
      jersey_number: player.jersey_number || '',
      // Store full player data to preserve on update
      _fullPlayer: player
    })
  }

  const handleSavePlayerEdit = async (teamId) => {
    try {
      const fullPlayer = editingPlayerData._fullPlayer
      // Send complete player data with updated fields
      await players.update(editingPlayerId, {
        user_id: fullPlayer.user_id,
        name: fullPlayer.name,
        email: fullPlayer.email || fullPlayer.user_email,
        phone: fullPlayer.phone || fullPlayer.user_phone,
        jersey_number: editingPlayerData.jersey_number,
        position: editingPlayerData.position,
        sub_position: editingPlayerData.sub_position,
        email_notifications: fullPlayer.email_notifications
      })
      setEditingPlayerId(null)
      // Refresh team roster
      await fetchTeamPlayers(teamId)
    } catch (error) {
      alert('Error updating player: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingPlayerId(null)
    setEditingPlayerData({ position: '', sub_position: '', jersey_number: '', _fullPlayer: null })
  }

  const handleAddManager = async (e) => {
    e.preventDefault()
    if (!selectedUser) {
      alert('Please select a user from the search results')
      return
    }

    try {
      await leagues.addManager(id, selectedUser.email)
      setSelectedUser(null)
      setUserSearchQuery('')
      setUserSearchResults([])
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
    return <div className="loading">Loading league details...</div>
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
        <div className="flex items-start justify-between gap-4">
          {/* Left: League name + Season selector */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {editingLeagueName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempLeagueName}
                    onChange={(e) => setTempLeagueName(e.target.value)}
                    className="text-2xl font-bold px-2 py-1 border rounded"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveLeagueName()
                      if (e.key === 'Escape') handleCancelLeagueName()
                    }}
                  />
                  <button
                    onClick={handleSaveLeagueName}
                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelLeagueName}
                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="page-title mb-0">{league.name}</h1>
                  {canManage && (
                    <button
                      onClick={handleEditLeagueName}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                      title="Edit league name"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
              {league.archived === 1 && <span className="badge badge-warning">Archived</span>}
              {canManage && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleArchive}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {league.archived === 1 ? 'Unarchive' : 'Archive'} League
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleDeleteLeague}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Delete League
                  </button>
                </div>
              )}
            </div>

            {/* Season Management - only show when seasons exist */}
            {leagueSeasons.length > 0 && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {editingSeasonName === selectedSeasonId && selectedSeasonId ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempSeasonName}
                      onChange={(e) => setTempSeasonName(e.target.value)}
                      className="text-lg font-medium px-2 py-1 border rounded"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveSeasonName(selectedSeasonId)
                        if (e.key === 'Escape') handleCancelSeasonName()
                      }}
                    />
                    <button onClick={() => handleSaveSeasonName(selectedSeasonId)} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                      Save
                    </button>
                    <button onClick={handleCancelSeasonName} className="px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedSeasonId || ''}
                      onChange={(e) => {
                        const seasonId = e.target.value ? parseInt(e.target.value) : null
                        setSelectedSeasonId(seasonId)
                        if (seasonId && !seasonSubTab) {
                          setMainTab('season')
                          setSeasonSubTab('teams')
                        }
                      }}
                      className="text-lg font-medium text-gray-700 border-0 bg-transparent focus:outline-none focus:ring-0 pr-8 -ml-1 cursor-pointer hover:text-gray-900"
                    >
                      {leagueSeasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                          {season.is_active === 1 ? ' ★' : ''}
                        </option>
                      ))}
                    </select>

                    {canManage && selectedSeasonId && (
                      <button
                        onClick={() => {
                          const season = leagueSeasons.find(s => s.id === selectedSeasonId)
                          if (season) {
                            handleEditSeasonName(season.id, season.name)
                          }
                        }}
                        className="text-gray-400 hover:text-gray-600 ml-1"
                        title="Edit season name"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}

                {canManage && (
                  <button
                    onClick={() => {
                      setShowSeasonForm(true)
                      setEditingSeasonId(null)
                      setCopyFromPreviousSeason(false)
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
                    className="btn-secondary btn-sm"
                    title="Create a new season"
                  >
                    + New Season
                  </button>
                )}
              </div>
            )}

            {/* Season quick info inline */}
            {selectedSeasonId && (() => {
              const season = leagueSeasons.find(s => s.id === selectedSeasonId)
              if (!season || (!season.start_date && !season.end_date)) return null

              const formatDate = (dateStr) => {
                const date = new Date(dateStr)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              }

              return (
                <div className="text-sm text-gray-600 mt-1">
                  {season.start_date && season.end_date ? (
                    <span>{formatDate(season.start_date)} - {formatDate(season.end_date)}</span>
                  ) : season.start_date ? (
                    <span>Starting {formatDate(season.start_date)}</span>
                  ) : (
                    <span>Ending {formatDate(season.end_date)}</span>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Right: Empty for now, actions moved to General tab */}
          <div className="flex items-center gap-2">
          </div>
        </div>
      </div>

      {/* Show setup screen when no seasons exist */}
      {leagueSeasons.length === 0 && canManage ? (
        <div className="card py-12 bg-gradient-to-br from-ice-50 to-blue-50">
          <div className="max-w-3xl mx-auto">
            {!showSeasonForm ? (
              <div className="text-center">
                <div className="text-6xl mb-6">🏒</div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to {league.name}!</h2>
                <p className="text-lg text-gray-700 mb-3">
                  Let's get your league set up. Everything starts with creating your first season.
                </p>
                <p className="text-gray-600 mb-8">
                  A season contains your teams, games, schedule, and standings. You can create multiple seasons to organize different periods of play.
                </p>
                <button
                  onClick={() => {
                    setShowSeasonForm(true)
                    setEditingSeasonId(null)
                    setSeasonFormData({
                      name: '',
                      description: '',
                      season_dues: '',
                      venmo_link: '',
                      start_date: '',
                      end_date: '',
                      is_active: true,
                    })
                  }}
                  className="btn-primary btn-lg text-lg px-8 py-3"
                >
                  Create Your First Season
                </button>
              </div>
            ) : (
              <form onSubmit={handleSeasonSubmit} className="p-8 bg-white rounded-xl shadow-lg">
                <h3 className="text-2xl font-bold mb-6 text-ice-700">✨ Create Your First Season</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Season Name *</label>
                    <input
                      type="text"
                      value={seasonFormData.name}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
                      className="input"
                      placeholder="e.g., Winter 2024"
                      required
                      autoFocus
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
                    <label className="label">Payments Link</label>
                    <input
                      type="url"
                      value={seasonFormData.venmo_link}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, venmo_link: e.target.value })}
                      className="input"
                      placeholder="venmo.com, paypal.com, cashapp, etc."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      value={seasonFormData.description}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, description: e.target.value })}
                      className="input"
                      rows="3"
                      placeholder="Optional details about this season..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="submit" className="btn-primary flex-1">
                    Create Season
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSeasonForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Main Navigation Tabs */}
          <div className="border-b-2 border-gray-200 mb-6">
            <nav className="flex gap-1">
              {/* General Tab - always visible for managers */}
              {canManage && (
                <button
                  onClick={() => setMainTab('overview')}
                  className={`px-6 py-3 font-semibold transition-colors relative ${
                    mainTab === 'overview'
                      ? 'text-ice-700 bg-white'
                      : 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  General
                  {mainTab === 'overview' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
                  )}
                </button>
              )}

              {/* Season Tabs - only show when a season is selected */}
              <button
            onClick={() => {
              if (selectedSeasonId) {
                setMainTab('season')
                setSeasonSubTab('teams')
              }
            }}
            disabled={!selectedSeasonId}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              mainTab === 'season' && seasonSubTab === 'teams'
                ? 'text-ice-700 bg-white'
                : selectedSeasonId
                ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
            }`}
          >
            Teams
            {mainTab === 'season' && seasonSubTab === 'teams' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
            )}
          </button>

          <button
            onClick={() => {
              if (selectedSeasonId) {
                setMainTab('season')
                setSeasonSubTab('schedule')
              }
            }}
            disabled={!selectedSeasonId}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              mainTab === 'season' && seasonSubTab === 'schedule'
                ? 'text-ice-700 bg-white'
                : selectedSeasonId
                ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
            }`}
          >
            Schedule
            {mainTab === 'season' && seasonSubTab === 'schedule' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
            )}
          </button>

          {canManage && (
            <button
              onClick={() => {
                if (selectedSeasonId) {
                  setMainTab('season')
                  setSeasonSubTab('scores')
                }
              }}
              disabled={!selectedSeasonId}
              className={`px-6 py-3 font-semibold transition-colors relative ${
                mainTab === 'season' && seasonSubTab === 'scores'
                  ? 'text-ice-700 bg-white'
                  : selectedSeasonId
                  ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              Scores
              {mainTab === 'season' && seasonSubTab === 'scores' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
              )}
            </button>
          )}

          <button
            onClick={() => {
              if (selectedSeasonId) {
                setMainTab('season')
                setSeasonSubTab('standings')
              }
            }}
            disabled={!selectedSeasonId}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              mainTab === 'season' && seasonSubTab === 'standings'
                ? 'text-ice-700 bg-white'
                : selectedSeasonId
                ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
            }`}
          >
            Standings
            {mainTab === 'season' && seasonSubTab === 'standings' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
            )}
          </button>

          {canManage && (
            <button
              onClick={() => {
                if (selectedSeasonId) {
                  setMainTab('season')
                  setSeasonSubTab('playoffs')
                }
              }}
              disabled={!selectedSeasonId}
              className={`px-6 py-3 font-semibold transition-colors relative ${
                mainTab === 'season' && seasonSubTab === 'playoffs'
                  ? 'text-ice-700 bg-white'
                  : selectedSeasonId
                  ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              Playoffs
              {mainTab === 'season' && seasonSubTab === 'playoffs' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-ice-600"></div>
              )}
            </button>
          )}
            </nav>
          </div>

          {/* No season selected state */}
      {!selectedSeasonId && mainTab === 'season' && seasonSubTab !== null && (
        <div className="card text-center py-16 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-md mx-auto">
            <div className="text-4xl mb-4">🏒</div>
            {!leagueSeasons.some(s => s.archived !== 1) ? (
              <>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">Create Your First Season</h3>
                <p className="text-gray-600 mb-2">
                  Everything in your league is organized by season - teams, games, standings, and payments all belong to a specific season.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  Start by creating your first season to begin managing teams and scheduling games.
                </p>
                {canManage && (
                  <button
                    onClick={() => {
                      setMainTab('season')
                      setSeasonSubTab(null)
                      setShowSeasonForm(true)
                    }}
                    className="btn-primary btn-lg"
                  >
                    Create Your First Season
                  </button>
                )}
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">Select a Season</h3>
                <p className="text-gray-600 mb-2">
                  Everything in your league is organized by season - teams, games, standings, and payments all belong to a specific season.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  Choose a season from the dropdown above to view and manage its teams, schedule, and standings.
                </p>
                <div className="text-sm text-ice-600 font-medium">
                  ↑ Select a season from the dropdown above
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {mainTab === 'overview' && (
        <div>
          {/* League Information Section - Consolidated */}
          <div className="card mb-6">
            <h3 className="section-header mb-6">League Information</h3>

            {/* League Info Text */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-900">General Information</h4>
              {canManage && !editingLeagueInfo && (
                <button
                  onClick={handleEditLeagueInfo}
                  className="btn-primary"
                >
                  {league.league_info ? 'Edit Information' : 'Add Information'}
                </button>
              )}
            </div>

            {editingLeagueInfo ? (
              <div>
                <div className="mb-3">
                  <label className="label">
                    League Information
                    <span className="text-xs text-gray-500 ml-2">(Game locations, typical times, general information)</span>
                  </label>
                  <textarea
                    value={tempLeagueInfo}
                    onChange={(e) => setTempLeagueInfo(e.target.value)}
                    className="input w-full"
                    rows="6"
                    placeholder="Example: Games are typically played at Main Ice Arena on Tuesday and Thursday evenings from 8:00-10:00 PM. Check the schedule for specific times and locations."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveLeagueInfo}
                    className="btn-primary"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelLeagueInfo}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {league.league_info ? (
                  <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">
                    {league.league_info}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No league information set</p>
                    <p className="text-sm text-gray-400">
                      Add information about game locations, typical times, and other general details for players and visitors.
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* League Managers Subsection */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-900">
                  League Manager{managers.length !== 1 ? 's' : ''}
                </h4>
              {canManage && (
                <button
                  onClick={() => setShowManagerForm(!showManagerForm)}
                  className="btn-primary"
                >
                  {showManagerForm ? 'Cancel' : '+ Add Manager'}
                </button>
              )}
            </div>

            {showManagerForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-3">Add Manager</h4>
                <form onSubmit={handleAddManager} className="space-y-4">
                  {/* User Search */}
                  <div>
                    <label className="label">Search for User *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        className="input"
                        placeholder="Type name or email (min 2 characters)..."
                        disabled={selectedUser !== null}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-3 text-gray-400">
                          Searching...
                        </div>
                      )}
                    </div>

                    {/* Search Results */}
                    {userSearchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user)
                              setUserSearchQuery(user.name || user.email)
                              setUserSearchResults([])
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <div className="font-medium">{user.name || 'No name'}</div>
                            <div className="text-sm text-gray-600">{user.email}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {!selectedUser && userSearchQuery.length >= 2 && userSearchResults.length === 0 && !isSearching && (
                      <div className="mt-2 text-sm text-gray-500">
                        No users found. User must have an account to be added as a manager.
                      </div>
                    )}

                    {selectedUser && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-green-900">Selected User:</div>
                            <div className="text-sm text-green-700">{selectedUser.name || 'No name'} ({selectedUser.email})</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(null)
                              setUserSearchQuery('')
                            }}
                            className="text-green-700 hover:text-green-900 font-semibold"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary" disabled={!selectedUser}>
                      Add Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManagerForm(false)
                        setSelectedUser(null)
                        setUserSearchQuery('')
                        setUserSearchResults([])
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
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

            {/* Communication Subsection */}
            <div>
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900">Communication</h4>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="btn-primary"
                >
                  Contact All Players
                </button>
              </div>
            </div>
          </div>

          {/* Announcements Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="section-header">League Announcements</h3>
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
                            className="btn-secondary btn-sm"
                          >
                            {announcement.is_active === 1 ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleEditAnnouncement(announcement)}
                            className="btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
                            className="btn-danger btn-sm"
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

          {/* Payments Section - only show when viewing the active season */}
          {activeSeason && selectedSeasonId === activeSeason.id && (
            <div className="card mb-6" key={`payment-${selectedSeasonId}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-header">Payment Tracking - {activeSeason.name}</h3>
              </div>

              {/* Season Dues and Payment Link */}
              {canManage && (
                <div className="mb-6 grid grid-cols-2 gap-4">
                  {/* Season Dues */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Season Dues</div>
                      {!editingSeasonDues && (
                        <button onClick={handleEditSeasonDues} className="text-xs text-ice-600 hover:text-ice-700 underline">
                          Edit
                        </button>
                      )}
                    </div>
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
                        <button onClick={handleSaveSeasonDues} className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                          Save
                        </button>
                        <button onClick={() => setEditingSeasonDues(false)} className="text-sm px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-ice-600">
                        ${parseFloat(activeSeason.season_dues || 0).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Payment Link */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Payment Link</div>
                      {!editingPaymentLink && (
                        <button onClick={handleEditPaymentLink} className="text-xs text-ice-600 hover:text-ice-700 underline">
                          {activeSeason.venmo_link ? 'Edit' : 'Add'}
                        </button>
                      )}
                    </div>
                    {editingPaymentLink ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempPaymentLink}
                          onChange={(e) => setTempPaymentLink(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="https://venmo.com/..."
                          autoFocus
                        />
                        <button onClick={handleSavePaymentLink} className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                          Save
                        </button>
                        <button onClick={() => setEditingPaymentLink(false)} className="text-sm px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        {activeSeason.venmo_link ? (
                          <a href={activeSeason.venmo_link} target="_blank" rel="noopener noreferrer" className="text-ice-600 hover:text-ice-700 underline text-sm truncate block">
                            {activeSeason.venmo_link}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">No link set</span>
                        )}
                      </div>
                    )}
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
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-4xl mb-3">👥</div>
                  <h4 className="font-semibold text-gray-900 mb-2">No Players Yet</h4>
                  <p className="text-gray-600 mb-4">Add teams and players to start tracking payments</p>
                  <button
                    onClick={() => {
                      setMainTab('season')
                      setSeasonSubTab('teams')
                    }}
                    className="btn-primary"
                  >
                    Go to Teams
                  </button>
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
                                          className="btn-primary btn-sm text-xs px-3 py-1"
                                        >
                                          Mark Paid
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-400">-</span>
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
            </div>
          )}

          {/* Settings - ultra minimal */}
          {canManage && selectedSeasonId && (
            <div className="border-t border-gray-200 pt-4 pb-2" key={`settings-${selectedSeasonId}`}>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  {(() => {
                    const currentSeason = leagueSeasons.find(s => s.id === selectedSeasonId)
                    const isActive = currentSeason?.is_active === 1
                    return isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        <span className="text-green-600">★</span>
                        Active Season
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Mark as Active:</span>
                    )
                  })()}
                  {(() => {
                    const currentSeason = leagueSeasons.find(s => s.id === selectedSeasonId)
                    const isActive = currentSeason?.is_active === 1

                    if (isActive) {
                      return (
                        <button
                          onClick={async () => {
                            try {
                              await seasons.update(selectedSeasonId, {
                                ...currentSeason,
                                is_active: 0
                              })
                              await fetchLeagueData(true)
                            } catch (err) {
                              console.error('Error unsetting active season:', err)
                              alert('Failed to unset active season. Please try again.')
                            }
                          }}
                          className="text-xs hover:text-gray-700 underline"
                        >
                          Unset
                        </button>
                      )
                    } else {
                      return (
                        <button
                          onClick={async () => {
                            try {
                              await seasons.setActive(selectedSeasonId)
                              await fetchLeagueData()
                            } catch (err) {
                              console.error('Error setting active season:', err)
                              alert('Failed to set active season. Please try again.')
                            }
                          }}
                          className="text-xs hover:text-gray-700 underline"
                        >
                          Set as Active
                        </button>
                      )
                    }
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  {selectedSeasonId && (() => {
                    const season = leagueSeasons.find(s => s.id === selectedSeasonId)
                    if (!season) return null
                    return (
                      <button
                        onClick={() => setDeleteSeasonModal({ isOpen: true, seasonId: season.id })}
                        className="text-red-500 hover:text-red-700 underline"
                      >
                        Delete Season
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

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
              <h2 className="section-header mb-4">Add Team to {league.name}</h2>
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

          {visibleTeams.length === 0 && !showTeamForm ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">{canManage ? 'No teams in this league yet' : 'You are not a captain of any teams in this league'}</p>
              {canManage && <p className="text-sm text-gray-400">Click "Add Team" to create your first team</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleTeams.map((team) => (
                <div
                  key={team.id}
                  className="card"
                  ref={el => teamRefs.current[team.id] = el}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center flex-1">
                      <div
                        className="w-8 h-8 rounded-full mr-3"
                        style={{ backgroundColor: team.color }}
                      />
                      <h3 className="section-header">{team.name}</h3>
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
                            onClick={() => showPlayerForm === team.id ? handleClosePlayerForm() : setShowPlayerForm(team.id)}
                            className="btn-primary text-sm"
                          >
                            {showPlayerForm === team.id ? 'Cancel' : '+ Add Player'}
                          </button>
                        </div>
                      )}

                      {showPlayerForm === team.id && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold mb-3">Add Player to {team.name}</h4>

                          {/* User Search Section */}
                          {!selectedUser && (
                            <div className="mb-4">
                              <label className="label">Search Existing Users</label>
                              <p className="text-xs text-gray-600 mb-2">
                                Search by name or email to link this player to an existing user account
                              </p>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={userSearchQuery}
                                  onChange={(e) => handleUserSearch(e.target.value)}
                                  className="input"
                                  placeholder="Type name or email (min 2 characters)..."
                                />
                                {isSearching && (
                                  <div className="absolute right-3 top-3 text-gray-400 text-sm">
                                    Searching...
                                  </div>
                                )}
                              </div>

                              {/* Search Results */}
                              {userSearchResults.length > 0 && (
                                <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                                  {userSearchResults.map((user) => (
                                    <button
                                      key={user.id}
                                      type="button"
                                      onClick={() => handleSelectUser(user)}
                                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900">{user.name}</div>
                                      <div className="text-xs text-gray-500">{user.email}</div>
                                      {user.position && (
                                        <div className="text-xs text-gray-400 capitalize">
                                          Position: {user.position}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {userSearchQuery.length >= 2 && userSearchResults.length === 0 && !isSearching && (
                                <div className="mt-2 text-sm text-gray-500">
                                  No users found. Fill out the form below to create a new player.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Selected User Display */}
                          {selectedUser && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm text-green-800 font-medium mb-1">
                                    Selected User
                                  </div>
                                  <div className="font-semibold text-gray-900">{selectedUser.name}</div>
                                  <div className="text-sm text-gray-600">{selectedUser.email}</div>
                                  {selectedUser.position && (
                                    <div className="text-xs text-gray-500 capitalize mt-1">
                                      Position: {selectedUser.position}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleClearSelectedUser}
                                  className="btn-secondary text-xs"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Player Form */}
                          <form onSubmit={(e) => handlePlayerSubmit(e, team.id)} className="space-y-3">
                            <div className="grid md:grid-cols-2 gap-3">
                              <div>
                                <label className="label">
                                  Player Name *
                                  {selectedUser && <span className="text-xs text-gray-500 ml-2">(from selected user)</span>}
                                </label>
                                <input
                                  type="text"
                                  name="name"
                                  className="input"
                                  placeholder="John Doe"
                                  value={selectedUser ? selectedUser.name : undefined}
                                  disabled={!!selectedUser}
                                  required={!selectedUser}
                                />
                              </div>
                              <div>
                                <label className="label">
                                  Email
                                  {selectedUser && <span className="text-xs text-gray-500 ml-2">(from selected user)</span>}
                                </label>
                                <input
                                  type="email"
                                  name="email"
                                  className="input"
                                  placeholder="player@example.com"
                                  value={selectedUser ? selectedUser.email : undefined}
                                  disabled={!!selectedUser}
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
                                <select
                                  name="position"
                                  className="input"
                                  defaultValue={selectedUser?.position || 'player'}
                                >
                                  <option value="player">Player</option>
                                  <option value="forward">Forward</option>
                                  <option value="defense">Defense</option>
                                  <option value="goalie">Goalie</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" className="btn-primary text-sm">
                                {selectedUser ? 'Add Linked Player' : 'Add New Player'}
                              </button>
                              <button
                                type="button"
                                onClick={handleClosePlayerForm}
                                className="btn-secondary text-sm"
                              >
                                Cancel
                              </button>
                            </div>
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
                              onClick={() => {
                                handleClosePlayerForm() // Reset any previous state
                                setShowPlayerForm(team.id)
                              }}
                              className="btn-primary text-sm"
                            >
                              Add First Player
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {teamPlayers[team.id].map((player) => (
                            <div key={player.id} className="p-3 bg-gray-50 rounded-lg">
                              {editingPlayerId === player.id ? (
                                // Editing mode
                                <div className="space-y-3">
                                  <div className="font-medium text-gray-900 mb-2">{player.name}</div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Position</label>
                                      <select
                                        value={editingPlayerData.position}
                                        onChange={(e) => setEditingPlayerData({...editingPlayerData, position: e.target.value, sub_position: e.target.value === 'goalie' ? '' : editingPlayerData.sub_position})}
                                        className="input text-sm py-1"
                                      >
                                        <option value="player">Player</option>
                                        <option value="goalie">Goalie</option>
                                      </select>
                                    </div>
                                    {editingPlayerData.position === 'player' && (
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Player Position</label>
                                        <select
                                          value={editingPlayerData.sub_position}
                                          onChange={(e) => setEditingPlayerData({...editingPlayerData, sub_position: e.target.value})}
                                          className="input text-sm py-1"
                                        >
                                          <option value="">Select...</option>
                                          <option value="forward">Forward</option>
                                          <option value="defense">Defense</option>
                                        </select>
                                      </div>
                                    )}
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Jersey #</label>
                                      <input
                                        type="number"
                                        value={editingPlayerData.jersey_number}
                                        onChange={(e) => setEditingPlayerData({...editingPlayerData, jersey_number: e.target.value})}
                                        className="input text-sm py-1"
                                        min="0"
                                        max="99"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="btn-secondary btn-sm"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSavePlayerEdit(team.id)}
                                      className="btn-primary btn-sm"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Display mode
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="font-medium">{player.name}</div>
                                    {player.jersey_number && (
                                      <span className="badge badge-neutral text-xs">#{player.jersey_number}</span>
                                    )}
                                    {player.position === 'goalie' ? (
                                      <span className="badge badge-info text-xs">Goalie</span>
                                    ) : player.sub_position ? (
                                      <span className="badge badge-info text-xs capitalize">{player.sub_position}</span>
                                    ) : player.position && player.position !== 'player' && (
                                      <span className="badge badge-info text-xs capitalize">{player.position}</span>
                                    )}
                                    {player.is_captain === 1 && (
                                      <span className="badge badge-warning text-xs">Captain</span>
                                    )}
                                  </div>
                                  {canManageTeam(team.id) && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditPlayer(player)}
                                        className="btn-secondary btn-sm"
                                      >
                                        Edit
                                      </button>
                                      {player.user_id && (
                                        <button
                                          onClick={() => handleToggleCaptain(player, team.id)}
                                          className={player.is_captain === 1 ? "btn-warning btn-sm" : "btn-secondary btn-sm"}
                                        >
                                          {player.is_captain === 1 ? 'Remove Captain' : 'Make Captain'}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => openTransferModal(player)}
                                        className="btn-secondary btn-sm"
                                      >
                                        Transfer
                                      </button>
                                      <button
                                        onClick={() => handlePlayerDelete(player.id, player.name, team.id)}
                                        className="btn-danger btn-sm"
                                      >
                                        Remove
                                      </button>
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mainTab === 'season' && seasonSubTab === 'schedule' && (
        <div>
          {teams.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-2">No teams created yet</p>
              <p className="text-sm text-gray-400 mb-6">You need to add teams before you can schedule games</p>
              {canManage && (
                <button
                  onClick={() => {
                    setMainTab('season')
                    setSeasonSubTab('teams')
                  }}
                  className="btn-primary"
                >
                  Go to Teams
                </button>
              )}
            </div>
          ) : (
            <>
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
              <h2 className="section-header mb-4">Schedule New Game</h2>
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
          </>
        )}
        </div>
      )}

      {mainTab === 'season' && seasonSubTab === 'scores' && (
        <div>
          <div className="card">
            <h3 className="section-header mb-4">Enter Game Scores</h3>
            {(() => {
              // Filter games that need scores or are recent
              const now = new Date()
              const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
              const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

              const gamesNeedingScores = games.filter(game => {
                const gameDate = new Date(game.game_date)
                // Show games that either don't have scores, or are within the time window
                const needsScore = game.home_score === null || game.away_score === null
                const isInTimeWindow = gameDate >= twoWeeksAgo && gameDate <= oneWeekFromNow
                return needsScore && isInTimeWindow
              }).sort((a, b) => new Date(b.game_date) - new Date(a.game_date))

              if (gamesNeedingScores.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-500">
                    <p>No games need scores at this time.</p>
                    <p className="text-sm mt-2">Games from the past 2 weeks and next week will appear here.</p>
                  </div>
                )
              }

              const handleSaveScore = async (gameId) => {
                const scores = gameScores[gameId] || {}
                const homeScore = scores.home_score
                const awayScore = scores.away_score

                if (homeScore === '' || awayScore === '' || homeScore === undefined || awayScore === undefined) {
                  alert('Please enter both scores')
                  return
                }

                setGameScores(prev => ({
                  ...prev,
                  [gameId]: { ...prev[gameId], saving: true }
                }))

                try {
                  await gamesApi.updateScore(gameId, parseInt(homeScore), parseInt(awayScore))
                  setGameScores(prev => ({
                    ...prev,
                    [gameId]: { ...prev[gameId], saving: false, saved: true }
                  }))
                  setTimeout(() => {
                    setGameScores(prev => ({
                      ...prev,
                      [gameId]: { ...prev[gameId], saved: false }
                    }))
                  }, 2000)
                  fetchLeagueData() // Refresh to update standings
                } catch (error) {
                  alert('Error saving score: ' + error.message)
                  setGameScores(prev => ({
                    ...prev,
                    [gameId]: { ...prev[gameId], saving: false }
                  }))
                }
              }

              const updateGameScore = (gameId, field, value) => {
                setGameScores(prev => ({
                  ...prev,
                  [gameId]: {
                    ...prev[gameId],
                    [field]: value
                  }
                }))
              }

              return (
                <div className="space-y-4">
                  {gamesNeedingScores.map(game => {
                    const scores = gameScores[game.id] || {}
                    const homeScore = scores.home_score !== undefined ? scores.home_score : (game.home_score ?? '')
                    const awayScore = scores.away_score !== undefined ? scores.away_score : (game.away_score ?? '')
                    const saving = scores.saving || false
                    const saved = scores.saved || false

                    const gameDate = new Date(game.game_date)
                    const formattedDate = gameDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                    const isPast = gameDate < now

                    return (
                      <div key={game.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-sm text-gray-500 mb-2">
                              {formattedDate} at {game.game_time}
                              {!isPast && <span className="ml-2 text-yellow-600 font-medium">(Upcoming)</span>}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: game.home_team_color || '#94a3b8' }}
                                  ></div>
                                  <span className="font-medium">{game.home_team_name}</span>
                                  <span className="text-gray-400 text-sm">(Home)</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  value={homeScore}
                                  onChange={(e) => updateGameScore(game.id, 'home_score', e.target.value)}
                                  className="w-20 px-3 py-1 border rounded text-center"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: game.away_team_color || '#94a3b8' }}
                                  ></div>
                                  <span className="font-medium">{game.away_team_name}</span>
                                  <span className="text-gray-400 text-sm">(Away)</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  value={awayScore}
                                  onChange={(e) => updateGameScore(game.id, 'away_score', e.target.value)}
                                  className="w-20 px-3 py-1 border rounded text-center"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveScore(game.id)}
                              disabled={saving || saved}
                              className={`px-4 py-2 rounded font-medium transition-colors ${
                                saved
                                  ? 'bg-green-500 text-white'
                                  : saving
                                  ? 'bg-gray-300 text-gray-600 cursor-wait'
                                  : 'bg-ice-600 text-white hover:bg-ice-700'
                              }`}
                            >
                              {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Score'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {mainTab === 'season' && seasonSubTab === 'standings' && (
        <div>
          <div className="card">
            <h3 className="section-header mb-4">Standings</h3>
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

      {mainTab === 'season' && seasonSubTab === 'playoffs' && (
        <div>
          <div className="card text-center py-12">
            <h3 className="section-header mb-4">Playoffs Management</h3>
            <p className="text-gray-500 mb-4">Playoff bracket and management features coming soon</p>
            <button onClick={() => setSeasonSubTab('schedule')} className="btn-secondary">
              Back to Schedule
            </button>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
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
                    setContactSubject('')
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
                <label className="label">Subject Line</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="input"
                  placeholder={`${league.name} - League Update`}
                />
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

                    const subject = contactSubject || `${league.name} - League Update`
                    const body = contactMessage || ''

                    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

                    setShowContactModal(false)
                    setContactSubject('')
                    setContactMessage('')
                  }}
                  className="btn-primary flex-1"
                >
                  Open Email Client
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setContactSubject('')
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
            <form onSubmit={handlePaymentFormSubmit} className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Mark Payment</h2>
                <button
                  type="button"
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
                Recording payment for <span className="font-semibold">{playerToMarkPaid.name}</span>
                <br />
                <span className="text-sm">League: <span className="font-semibold">{league?.name}</span></span>
                {activeSeason && (
                  <>
                    {' • '}
                    <span className="text-sm">Season: <span className="font-semibold">{activeSeason.name}</span></span>
                  </>
                )}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="label mb-3">Payment Method *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('venmo')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'venmo'
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
                      onClick={() => setSelectedPaymentMethod('zelle')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'zelle'
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
                      onClick={() => setSelectedPaymentMethod('cash')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'cash'
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
                      onClick={() => setSelectedPaymentMethod('check')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'check'
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
                      onClick={() => setSelectedPaymentMethod('paypal')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'paypal'
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
                      onClick={() => setSelectedPaymentMethod('other')}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                        selectedPaymentMethod === 'other'
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
                    value={paymentConfirmation}
                    onChange={(e) => setPaymentConfirmation(e.target.value)}
                    className="input w-full"
                    placeholder="Transaction ID or confirmation number"
                  />
                </div>

                <div>
                  <label className="label">Notes (Optional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="input w-full"
                    rows="3"
                    placeholder="Additional notes about the payment..."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentMethodModal(false)
                    setPlayerToMarkPaid(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={!selectedPaymentMethod}
                >
                  Mark as Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Player Modal */}
      {showTransferModal && playerToTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="section-header mb-4">Transfer Player</h3>
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
        message={`Are you sure you want to delete this season?

This will also delete all associated teams, games, and payment records.`}
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

      {/* New Season Form Modal (when seasons already exist) */}
      {showSeasonForm && leagueSeasons.length > 0 && !editingSeasonId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSeasonSubmit} className="p-8">
              <h3 className="text-2xl font-bold mb-6 text-ice-700">Create New Season</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Season Name *</label>
                  <input
                    type="text"
                    value={seasonFormData.name}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Winter 2024"
                    required
                    autoFocus
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
                  <label className="label">Payments Link</label>
                  <input
                    type="url"
                    value={seasonFormData.venmo_link}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, venmo_link: e.target.value })}
                    className="input"
                    placeholder="venmo.com, paypal.com, cashapp, etc."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    value={seasonFormData.description}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, description: e.target.value })}
                    className="input"
                    rows="3"
                    placeholder="Optional details about this season..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={seasonFormData.is_active}
                      onChange={(e) => setSeasonFormData({ ...seasonFormData, is_active: e.target.checked })}
                      className="checkbox"
                    />
                    <span className="label mb-0">Set as active season</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn-primary flex-1">
                  Create Season
                </button>
                <button
                  type="button"
                  onClick={() => setShowSeasonForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
