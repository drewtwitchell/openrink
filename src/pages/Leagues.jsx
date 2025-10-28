import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leagues, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

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
    season: '',
    season_dues: '',
    venmo_link: '',
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchLeagues()
  }, [showArchived])

  const fetchLeagues = async () => {
    try {
      const data = await leagues.getAll(showArchived)
      setLeaguesList(data)
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await leagues.create(formData)
      setFormData({ name: '', description: '', season: '', season_dues: '', venmo_link: '' })
      setShowForm(false)
      fetchLeagues()
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

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leagues' }
        ]}
      />

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
          <h2 className="text-xl font-semibold mb-4">Create New League</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">League Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="e.g., Winter 2024"
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
                placeholder="League details..."
              />
            </div>

            <div>
              <label className="label">Season</label>
              <input
                type="text"
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                className="input"
                placeholder="e.g., 2024 Winter"
              />
            </div>

            <div>
              <label className="label">Season Dues (per player)</label>
              <input
                type="number"
                step="0.01"
                value={formData.season_dues}
                onChange={(e) => setFormData({ ...formData, season_dues: e.target.value })}
                className="input"
                placeholder="e.g., 150.00"
              />
              <p className="text-xs text-gray-500 mt-1">Optional: Amount each player pays for the season</p>
            </div>

            <div>
              <label className="label">Venmo Link for Dues</label>
              <input
                type="url"
                value={formData.venmo_link}
                onChange={(e) => setFormData({ ...formData, venmo_link: e.target.value })}
                className="input"
                placeholder="e.g., https://venmo.com/u/leaguename"
              />
              <p className="text-xs text-gray-500 mt-1">Optional: Venmo link for players to pay dues</p>
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
                  <td className="text-gray-600">{league.season || '-'}</td>
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
                        <button
                          onClick={() => handleDelete(league.id, league.name)}
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
