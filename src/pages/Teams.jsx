import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { teams, leagues as leaguesApi, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Teams() {
  const navigate = useNavigate()
  const [teamsList, setTeamsList] = useState([])
  const [leaguesList, setLeaguesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    league_id: '',
    color: '#0284c7',
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [teamsData, leaguesData] = await Promise.all([
        teams.getAll(),
        leaguesApi.getAll(),
      ])
      setTeamsList(teamsData)
      setLeaguesList(leaguesData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await teams.create(formData)
      setFormData({ name: '', league_id: '', color: '#0284c7' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error creating team: ' + error.message)
    }
  }

  const handleDelete = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete ${teamName}? This will also delete all players on this team.`)) {
      return
    }
    try {
      await teams.delete(teamId)
      fetchData()
    } catch (error) {
      alert('Error deleting team: ' + error.message)
    }
  }

  const canManageTeams = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'league_manager'
  }

  if (loading) {
    return <div>Loading teams...</div>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Teams' }
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">{teamsList.length} team{teamsList.length !== 1 ? 's' : ''}</p>
        </div>
        {canManageTeams() && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : 'New Team'}
          </button>
        )}
      </div>


      {!canManageTeams() && teamsList.length === 0 && (
        <div className="alert alert-info">
          Only Admins and League Managers can create teams. Contact your administrator for access.
        </div>
      )}

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="e.g., Ice Hawks"
                required
              />
            </div>

            <div>
              <label className="label">League</label>
              <select
                value={formData.league_id}
                onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Select a league</option>
                {leaguesList.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Team Color</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="input h-12"
              />
            </div>

            <button type="submit" className="btn-primary">
              Create Team
            </button>
          </form>
        </div>
      )}

      {teamsList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3 className="empty-state-title">No Teams</h3>
            <p className="empty-state-description">
              {leaguesList.length > 0 ? 'Create your first team to get started' : 'Create a league before adding teams'}
            </p>
            {leaguesList.length > 0 && (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                Create Team
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>League</th>
                <th>Captain</th>
                <th>Players</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamsList.map((team) => (
                <tr key={team.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-medium">{team.name}</span>
                    </div>
                  </td>
                  <td className="text-gray-600">{team.league_name || '-'}</td>
                  <td className="text-gray-600">
                    {team.captains && team.captains.length > 0
                      ? team.captains.map(c => c.name).join(', ')
                      : '-'}
                  </td>
                  <td className="text-gray-600">{team.player_count || 0}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/teams/${team.id}/roster`)}
                        className="btn-secondary text-xs py-1 px-3"
                      >
                        View Roster
                      </button>
                      {canManageTeams() && (
                        <button
                          onClick={() => handleDelete(team.id, team.name)}
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
