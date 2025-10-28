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
            <h3 className="empty-state-title">No Teams Yet</h3>
            {leaguesList.length > 0 ? (
              <>
                <p className="empty-state-description">
                  Create your first team to get started
                </p>
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  Create Team
                </button>
              </>
            ) : (
              <>
                <p className="empty-state-description">
                  You'll need a league before creating teams
                </p>
                <button onClick={() => window.location.href = '/dashboard'} className="btn-primary">
                  Go to Dashboard
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {teamsList.map((team) => (
            <div
              key={team.id}
              className="card cursor-pointer group"
              onClick={() => navigate(`/teams/${team.id}/roster`)}
            >
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <div
                  className="w-10 h-10 rounded-lg shadow-sm"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
              </div>
              {team.league_name && (
                <div className="mb-3 text-sm text-gray-600">
                  <span className="font-medium">{team.league_name}</span>
                </div>
              )}
              {team.captains && team.captains.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-2">
                    Captain{team.captains.length > 1 ? 's' : ''}
                  </div>
                  {team.captains.map((captain, idx) => (
                    <div key={idx} className="text-sm font-medium text-gray-900">
                      {captain.name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/teams/${team.id}/roster`)
                }}
                className="btn-secondary text-sm w-full"
              >
                View Roster
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
