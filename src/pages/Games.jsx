import { useState, useEffect, useRef } from 'react'
import { games, teams, rinks, leagues, csv, players, subRequests, auth, seasons } from '../lib/api'

export default function Games() {
  const [gamesList, setGamesList] = useState([])
  const [teamsList, setTeamsList] = useState([])
  const [rinksList, setRinksList] = useState([])
  const [leaguesList, setLeaguesList] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [activeSeason, setActiveSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showSubRequestForm, setShowSubRequestForm] = useState(false)
  const [selectedGameForSub, setSelectedGameForSub] = useState(null)
  const [playersList, setPlayersList] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const fileInputRef = useRef(null)
  const [formData, setFormData] = useState({
    home_team_id: '',
    away_team_id: '',
    game_date: '',
    game_time: '',
    rink_id: '',
    surface_name: 'NHL',
  })
  const [subRequestData, setSubRequestData] = useState({
    requesting_player_id: '',
    payment_required: false,
    payment_amount: '',
    venmo_link: '',
    notes: '',
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [gamesData, teamsData, rinksData, leaguesData, playersData] = await Promise.all([
        games.getAll(),
        teams.getAll(),
        rinks.getAll(),
        leagues.getAll(true), // Include archived leagues
        players.getAll(),
      ])
      setGamesList(gamesData)
      setTeamsList(teamsData)
      setRinksList(rinksData)
      setLeaguesList(leaguesData)
      setPlayersList(playersData)
      if (leaguesData.length > 0 && !selectedLeague) {
        setSelectedLeague(leaguesData[0].id.toString())
        // Fetch active season for the first league
        const activeSeasonData = await seasons.getActive(leaguesData[0].id)
        setActiveSeason(activeSeasonData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedLeague) {
      seasons.getActive(selectedLeague).then(setActiveSeason).catch(() => setActiveSeason(null))
    }
  }, [selectedLeague])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await games.create({
        ...formData,
        season_id: activeSeason?.id || null,
      })
      setFormData({
        home_team_id: '',
        away_team_id: '',
        game_date: '',
        game_time: '',
        rink_id: '',
        surface_name: 'NHL',
      })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error creating game: ' + error.message)
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!selectedLeague) {
      setUploadMessage('Error: Please select a league first')
      return
    }

    setUploading(true)
    setUploadMessage('')

    try {
      const result = await csv.uploadSchedule(selectedLeague, file)
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

  const openSubRequestForm = (game) => {
    setSelectedGameForSub(game)
    setShowSubRequestForm(true)
    setSubRequestData({
      requesting_player_id: '',
      payment_required: false,
      payment_amount: '',
      venmo_link: '',
      notes: '',
    })
  }

  const handleSubRequestSubmit = async (e) => {
    e.preventDefault()
    try {
      await subRequests.create({
        game_id: selectedGameForSub.id,
        ...subRequestData,
        payment_required: subRequestData.payment_required ? 1 : 0,
      })
      setShowSubRequestForm(false)
      setSelectedGameForSub(null)
      alert('Sub request created successfully! Team members will be notified.')
    } catch (error) {
      alert('Error creating sub request: ' + error.message)
    }
  }

  const getPlayersForGame = (game) => {
    if (!game) return []
    return playersList.filter(p =>
      p.team_id === game.home_team_id || p.team_id === game.away_team_id
    )
  }

  const canScheduleGames = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'league_manager'
  }

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game?')) {
      return
    }
    try {
      await gamesApi.delete(gameId)
      fetchData()
    } catch (error) {
      alert('Error deleting game: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading games...</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Games</h1>
          <p className="page-subtitle">{gamesList.length} scheduled game{gamesList.length !== 1 ? 's' : ''}</p>
        </div>
        {canScheduleGames() && (
          <div className="flex gap-2">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              {showForm ? 'Cancel' : 'Schedule Game'}
            </button>
            <button
              onClick={() => csv.downloadScheduleTemplate()}
              className="btn-secondary"
            >
              Download Template
            </button>
            <label className="btn-secondary cursor-pointer">
              Upload CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                disabled={uploading || !selectedLeague}
              />
            </label>
          </div>
        )}
      </div>

      {leaguesList.length > 0 && canScheduleGames() && (
        <div className="mb-6">
          <label className="label">League for CSV Upload</label>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="input max-w-xs"
          >
            {leaguesList.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!canScheduleGames() && gamesList.length === 0 && (
        <div className="alert alert-info">
          Only Admins and League Managers can schedule games. You can still request substitutes for games once they're scheduled.
        </div>
      )}

      {uploadMessage && (
        <div className={uploadMessage.includes('Error') ? 'alert alert-error' : 'alert alert-success'}>
          {uploadMessage}
        </div>
      )}

      {uploading && (
        <div className="alert alert-info">
          Uploading and processing CSV... This may take a moment.
        </div>
      )}

      {showSubRequestForm && selectedGameForSub && (
        <div className="card mb-8 border-2 border-ice-600">
          <h2 className="text-2xl font-bold mb-4">Request a Substitute</h2>
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="font-semibold">
              {selectedGameForSub.home_team_name} vs {selectedGameForSub.away_team_name}
            </div>
            <div className="text-sm text-gray-600">
              {formatDate(selectedGameForSub.game_date)} at {selectedGameForSub.game_time}
            </div>
          </div>
          <form onSubmit={handleSubRequestSubmit} className="space-y-4">
            <div>
              <label className="label">Who needs a sub? *</label>
              <select
                value={subRequestData.requesting_player_id}
                onChange={(e) => setSubRequestData({ ...subRequestData, requesting_player_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Select player</option>
                {getPlayersForGame(selectedGameForSub).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.team_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={subRequestData.notes}
                onChange={(e) => setSubRequestData({ ...subRequestData, notes: e.target.value })}
                className="input"
                placeholder="Add any additional details..."
                rows="3"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="payment_required"
                  checked={subRequestData.payment_required}
                  onChange={(e) => setSubRequestData({ ...subRequestData, payment_required: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="payment_required" className="text-sm font-medium">
                  Payment required from substitute
                </label>
              </div>

              {subRequestData.payment_required && (
                <div className="grid md:grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="label">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={subRequestData.payment_amount}
                      onChange={(e) => setSubRequestData({ ...subRequestData, payment_amount: e.target.value })}
                      className="input"
                      placeholder="25.00"
                    />
                  </div>
                  <div>
                    <label className="label">Venmo Link</label>
                    <input
                      type="url"
                      value={subRequestData.venmo_link}
                      onChange={(e) => setSubRequestData({ ...subRequestData, venmo_link: e.target.value })}
                      className="input"
                      placeholder="https://venmo.com/u/yourhandle"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Request Substitute
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubRequestForm(false)
                  setSelectedGameForSub(null)
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-4">Schedule New Game</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Home Team</label>
                <select
                  value={formData.home_team_id}
                  onChange={(e) =>
                    setFormData({ ...formData, home_team_id: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select home team</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Away Team</label>
                <select
                  value={formData.away_team_id}
                  onChange={(e) =>
                    setFormData({ ...formData, away_team_id: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select away team</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  value={formData.game_date}
                  onChange={(e) =>
                    setFormData({ ...formData, game_date: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Time</label>
                <input
                  type="time"
                  value={formData.game_time}
                  onChange={(e) =>
                    setFormData({ ...formData, game_time: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Rink</label>
              <select
                value={formData.rink_id}
                onChange={(e) =>
                  setFormData({ ...formData, rink_id: e.target.value })
                }
                className="input"
                required
              >
                <option value="">Select rink</option>
                {rinksList.map((rink) => (
                  <option key={rink.id} value={rink.id}>
                    {rink.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Ice Surface</label>
              <select
                value={formData.surface_name}
                onChange={(e) =>
                  setFormData({ ...formData, surface_name: e.target.value })
                }
                className="input"
              >
                <option value="NHL">NHL Rink</option>
                <option value="Olympic">Olympic Rink</option>
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Schedule Game
            </button>
          </form>
        </div>
      )}

      {gamesList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3 className="empty-state-title">No Games Scheduled</h3>
            {teamsList.length > 0 && rinksList.length > 0 ? (
              <>
                <p className="empty-state-description">
                  Schedule your first game to get started
                </p>
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  Schedule Game
                </button>
              </>
            ) : (
              <>
                <p className="empty-state-description">
                  You'll need teams and rinks before scheduling games
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => window.location.href = '/teams'} className="btn-primary">
                    Create Teams
                  </button>
                  <button onClick={() => window.location.href = '/rinks'} className="btn-primary">
                    Add Rinks
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Home Team</th>
                <th>Away Team</th>
                <th>Score</th>
                <th>Rink</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gamesList.map((game) => (
                <tr key={game.id}>
                  <td className="font-medium">{formatDate(game.game_date)}</td>
                  <td className="text-gray-600">{game.game_time}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: game.home_team_color || '#0284c7' }}
                      />
                      <span>{game.home_team_name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: game.away_team_color || '#0284c7' }}
                      />
                      <span>{game.away_team_name}</span>
                    </div>
                  </td>
                  <td className="font-medium">
                    {game.home_score !== null && game.away_score !== null
                      ? `${game.home_score} - ${game.away_score}`
                      : '-'}
                  </td>
                  <td className="text-gray-600 text-sm">
                    {game.rink_name} ({game.surface_name})
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {canScheduleGames() && (
                        <button
                          onClick={() => handleDeleteGame(game.id)}
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
      )}
    </div>
  )
}
