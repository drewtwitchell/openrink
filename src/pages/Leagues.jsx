import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leagues, seasons, auth } from '../lib/api'

export default function Leagues() {
  const navigate = useNavigate()
  const [leaguesList, setLeaguesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchLeagues()
  }, [showArchived])

  const fetchLeagues = async () => {
    try {
      const data = await leagues.getAll(showArchived)

      // Fetch active season for each league
      const leaguesWithSeasons = await Promise.all(
        data.map(async (league) => {
          try {
            const activeSeason = await seasons.getActive(league.id)
            return {
              ...league,
              activeSeason: activeSeason
            }
          } catch (error) {
            // No active season found
            return {
              ...league,
              activeSeason: null
            }
          }
        })
      )

      setLeaguesList(leaguesWithSeasons)
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await leagues.create(formData)
      setFormData({ name: '', description: '' })
      setShowForm(false)
      // Redirect to league details to create a season
      navigate(`/leagues/${response.id}?tab=seasons`)
    } catch (error) {
      alert('Error creating league: ' + error.message)
    }
  }

  const canManageLeagues = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'league_manager'
  }

  const handleDelete = async (leagueId, leagueName) => {
    if (!window.confirm(`Delete league "${leagueName}"? This will also delete all associated seasons, teams, games, and players.`)) {
      return
    }
    try {
      await leagues.delete(leagueId)
      fetchLeagues()
    } catch (error) {
      alert('Error deleting league: ' + error.message)
    }
  }

  const handleArchive = async (leagueId, leagueName, currentlyArchived) => {
    const action = currentlyArchived ? 'unarchive' : 'archive'
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} league "${leagueName}"?`)) {
      return
    }
    try {
      await leagues.archive(leagueId, !currentlyArchived)
      fetchLeagues()
    } catch (error) {
      alert(`Error ${action}ing league: ${error.message}`)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Leagues</h1>
          <p className="page-subtitle">{leaguesList.length} {showArchived ? 'archived' : 'active'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="btn-secondary"
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
          </button>
          {canManageLeagues() && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? 'Cancel' : 'New League'}
            </button>
          )}
        </div>
      </div>

      {!canManageLeagues() && leaguesList.length === 0 && (
        <div className="alert alert-info">
          Only Admins and League Managers can create leagues.
        </div>
      )}

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-4">Create New League</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              After creating the league, you'll be taken to add seasons with payment details, teams, and schedules.
            </div>

            <button type="submit" className="btn-primary">
              Create League
            </button>
          </form>
        </div>
      )}

      {leaguesList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No leagues yet</p>
          {canManageLeagues() && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Create Your First League
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>League Name</th>
                <th>Season</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaguesList.map((league) => (
                <tr key={league.id}>
                  <td className="font-medium">{league.name}</td>
                  <td className="text-gray-600">
                    {league.activeSeason ? (
                      <span className="text-green-700 font-medium">{league.activeSeason.name}</span>
                    ) : (
                      <span className="text-gray-400">No active season</span>
                    )}
                  </td>
                  <td className="text-gray-600">{league.description || '-'}</td>
                  <td>
                    {league.archived === 1 ? (
                      <span className="badge badge-neutral">Archived</span>
                    ) : (
                      <span className="badge badge-success">Active</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/leagues/${league.id}`)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        View Details
                      </button>
                      {canManageLeagues() && (
                        <>
                          <button
                            onClick={() => handleArchive(league.id, league.name, league.archived === 1)}
                            className="btn-secondary text-xs py-1 px-3"
                          >
                            {league.archived === 1 ? 'Unarchive' : 'Archive'}
                          </button>
                          <button
                            onClick={() => handleDelete(league.id, league.name)}
                            className="btn-danger text-xs py-1 px-3"
                          >
                            Delete
                          </button>
                        </>
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
