import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { teams, players, csv, auth, leagues } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function TeamRoster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const leagueId = searchParams.get('league')
  const [team, setTeam] = useState(null)
  const [league, setLeague] = useState(null)
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [playerToTransfer, setPlayerToTransfer] = useState(null)
  const [allTeams, setAllTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const fileInputRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    jersey_number: '',
    position: 'player',
    email_notifications: true,
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const promises = [
        teams.getAll(),
        players.getByTeam(id),
      ]

      // Fetch league data if coming from a league
      if (leagueId) {
        promises.push(leagues.getAll(true)) // Include archived leagues
      }

      const results = await Promise.all(promises)
      const [teamsData, playersData, leaguesData] = results

      const teamData = teamsData.find(t => t.id === parseInt(id))
      setTeam(teamData)
      setRoster(playersData)
      setAllTeams(teamsData.filter(t => t.id !== parseInt(id))) // Exclude current team

      // Set league data if available
      if (leaguesData && leagueId) {
        const leagueData = leaguesData.find(l => l.id === parseInt(leagueId))
        setLeague(leagueData)
      }
    } catch (error) {
      console.error('Error fetching roster:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const playerData = {
        ...formData,
        team_id: id,
        user_id: selectedUser?.id || null
      }
      await players.create(playerData)
      setFormData({ name: '', email: '', phone: '', jersey_number: '', position: 'player', email_notifications: true })
      setSelectedUser(null)
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error adding player: ' + error.message)
    }
  }

  const handleNameChange = async (e) => {
    const value = e.target.value
    setFormData({ ...formData, name: value })

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if less than 2 characters
    if (value.length < 2) {
      setUserSearchResults([])
      setShowUserSearch(false)
      return
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await auth.searchUsers(value)
        setUserSearchResults(results)
        setShowUserSearch(results.length > 0)
      } catch (error) {
        console.error('Error searching users:', error)
      }
    }, 300)
  }

  const selectUser = (user) => {
    setSelectedUser(user)
    setFormData({
      ...formData,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      position: user.position || 'player'
    })
    setShowUserSearch(false)
    setUserSearchResults([])
  }

  const clearUserSelection = () => {
    setSelectedUser(null)
  }

  const handleDelete = async (playerId) => {
    if (!confirm('Remove this player from the roster?')) return

    try {
      await players.delete(playerId)
      fetchData()
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

  const handleTransfer = async () => {
    if (!selectedTeamId) {
      alert('Please select a destination team')
      return
    }

    try {
      await players.transfer(playerToTransfer.id, selectedTeamId)
      closeTransferModal()
      fetchData()
    } catch (error) {
      alert('Error transferring player: ' + error.message)
    }
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setUploadMessage('')

    try {
      const result = await csv.uploadRoster(id, file)
      setUploadMessage(result.message)
      fetchData()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setUploadMessage('Error: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div>Loading roster...</div>
  }

  if (!team) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">Team not found</p>
        <button onClick={() => navigate('/teams')} className="btn-primary">
          Back to Teams
        </button>
      </div>
    )
  }

  const breadcrumbItems = leagueId
    ? [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Leagues', href: '/leagues' },
        { label: league?.name || 'League', href: `/leagues/${leagueId}` },
        { label: team?.name || 'Team Roster' }
      ]
    : [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Teams', href: '/teams' },
        { label: team?.name || 'Team Roster' }
      ]

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div
              className="w-12 h-12 rounded-full mr-4"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <h1 className="text-3xl font-bold mb-1">{team.name}</h1>
              <p className="text-gray-600">Team Roster</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? 'Cancel' : '+ Add Player'}
            </button>
            <button
              onClick={() => csv.downloadRosterTemplate()}
              className="btn-secondary"
              title="Download CSV Template"
            >
              Template
            </button>
            <label className="btn-secondary cursor-pointer" title="Upload Roster CSV">
              Upload CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {uploadMessage && (
        <div className={`mb-6 p-4 rounded ${uploadMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {uploadMessage}
        </div>
      )}

      {uploading && (
        <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded">
          Uploading and processing CSV... This may take a moment.
        </div>
      )}

      {/* Team Captain Section */}
      {roster.filter(p => p.is_captain === 1).length > 0 && (
        <div className="card mb-6 bg-ice-50 border-ice-200">
          <h3 className="text-lg font-semibold mb-3">
            Team Captain{roster.filter(p => p.is_captain === 1).length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {roster.filter(p => p.is_captain === 1).map((captain) => (
              <div key={captain.id} className="flex items-center justify-between p-3 bg-white rounded">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ice-600 text-white flex items-center justify-center font-bold">
                    {captain.jersey_number || '?'}
                  </div>
                  <div>
                    <div className="font-medium">{captain.name}</div>
                    <div className="text-sm text-gray-600">
                      {captain.email || captain.user_email || 'No email'}
                      {(captain.phone || captain.user_phone) && (
                        <span className="ml-2">• {captain.phone || captain.user_phone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Player to Roster</h2>
          {selectedUser && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-green-800">
                  ✓ Linked to existing user: {selectedUser.email}
                </div>
                <div className="text-xs text-green-600">
                  This player will be automatically linked to their account
                </div>
              </div>
              <button
                type="button"
                onClick={clearUserSelection}
                className="text-sm text-green-700 hover:text-green-900 underline"
              >
                Unlink
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="label">Player Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  onFocus={(e) => {
                    if (e.target.value.length >= 2 && userSearchResults.length > 0) {
                      setShowUserSearch(true)
                    }
                  }}
                  className="input"
                  placeholder="Start typing to search existing users..."
                  required
                  autoComplete="off"
                />
                {showUserSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
                      Found {userSearchResults.length} existing user(s)
                    </div>
                    {userSearchResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => selectUser(user)}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-gray-600">{user.email}</div>
                        {user.phone && (
                          <div className="text-xs text-gray-500">{user.phone}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Jersey Number</label>
                <input
                  type="number"
                  value={formData.jersey_number}
                  onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                  className="input"
                  placeholder="99"
                  min="0"
                  max="99"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Position</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="input"
                  disabled={!!selectedUser}
                >
                  <option value="player">Player</option>
                  <option value="goalie">Goalie</option>
                </select>
                {selectedUser && (
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from user account</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="player@example.com"
                  disabled={!!selectedUser}
                />
                {selectedUser && (
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from user account</p>
                )}
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="(555) 123-4567"
                  disabled={!!selectedUser}
                />
                {selectedUser && (
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from user account</p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="notifications"
                checked={formData.email_notifications}
                onChange={(e) => setFormData({ ...formData, email_notifications: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                Send email notifications for games and updates
              </label>
            </div>

            <button type="submit" className="btn-primary">
              Add Player
            </button>
          </form>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p>No players on this roster yet. Use the form above to add your first player.</p>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Roster ({roster.length} players)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Position</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((player) => (
                  <tr key={player.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">
                      {player.jersey_number || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        {player.name}
                        {player.is_captain === 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                            Captain
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        (player.position || player.user_position) === 'goalie'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {(player.position || player.user_position || 'player').charAt(0).toUpperCase() + (player.position || player.user_position || 'player').slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {player.email || player.user_email || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {player.phone || player.user_phone || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => openTransferModal(player)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-3 rounded"
                        >
                          Transfer
                        </button>
                        <button
                          onClick={() => handleDelete(player.id)}
                          className="btn-danger text-xs py-1 px-3"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Transfer Player</h3>
            <p className="text-gray-600 mb-4">
              Transfer <strong>{playerToTransfer?.name}</strong> to another team
            </p>
            <div className="mb-6">
              <label className="label">Select Destination Team</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input"
              >
                <option value="">-- Select a team --</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeTransferModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Transfer Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
