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

      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Teams</h1>
          {canManageTeams() && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? 'Cancel' : '+ New Team'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <div className="py-4 px-1 border-b-2 border-ice-600 font-medium text-sm text-ice-600">
              All Teams
            </div>
          </nav>
        </div>
      </div>

      {!canManageTeams() && teamsList.length === 0 && (
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <p className="text-sm text-gray-700">
            Only Admins and League Managers can create teams. Contact your administrator for access.
          </p>
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
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No teams yet</p>
          {leaguesList.length > 0 ? (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Create Your First Team
            </button>
          ) : (
            <p className="text-gray-400">Create a league first</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {teamsList.map((team) => (
            <div
              key={team.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center mb-3">
                <div
                  className="w-8 h-8 rounded-full mr-3"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="text-xl font-semibold">{team.name}</h3>
              </div>
              {team.league_name && (
                <p className="text-sm text-gray-500 mb-2">
                  League: {team.league_name}
                </p>
              )}
              {team.captains && team.captains.length > 0 && (
                <div className="mb-3 p-2 bg-ice-50 rounded">
                  <div className="text-xs text-gray-600 font-medium mb-1">
                    Captain{team.captains.length > 1 ? 's' : ''}:
                  </div>
                  {team.captains.map((captain, idx) => (
                    <div key={idx} className="text-sm font-medium text-ice-700">
                      ⭐ {captain.name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigate(`/teams/${team.id}/roster`)}
                className="btn-primary text-sm w-full"
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
