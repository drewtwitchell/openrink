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
          <h1 className="text-4xl font-black gradient-text">Teams</h1>
          {canManageTeams() && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? '✕ Cancel' : '+ New Team'}
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
        <div className="empty-state hero-section">
          <div className="empty-state-icon animate-float">👥</div>
          <h2 className="text-4xl font-black text-white mb-4">No Teams Yet</h2>
          {leaguesList.length > 0 ? (
            <>
              <p className="text-xl text-blue-100 mb-8">
                Assemble your squad and hit the ice!
              </p>
              <button onClick={() => setShowForm(true)} className="btn-primary bg-white text-ice-600 hover:bg-gray-100">
                🎯 Create First Team
              </button>
            </>
          ) : (
            <>
              <p className="text-xl text-blue-100 mb-8">
                You'll need a league before creating teams
              </p>
              <button onClick={() => window.location.href = '/dashboard'} className="btn-primary bg-white text-ice-600 hover:bg-gray-100">
                🏒 Create League
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {teamsList.map((team) => (
            <div
              key={team.id}
              className="card hover:scale-105 transition-all cursor-pointer group"
              onClick={() => navigate(`/teams/${team.id}/roster`)}
            >
              <div className="flex items-center mb-4">
                <div
                  className="w-12 h-12 rounded-full mr-4 shadow-lg group-hover:shadow-xl transition-shadow"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="text-xl font-black gradient-text">{team.name}</h3>
              </div>
              {team.league_name && (
                <div className="mb-3 flex items-center text-sm text-gray-600">
                  <span className="mr-2">🏆</span>
                  <span className="font-semibold">{team.league_name}</span>
                </div>
              )}
              {team.captains && team.captains.length > 0 && (
                <div className="mb-4 p-3 bg-gradient-to-br from-ice-50 to-blue-50 rounded-xl border border-ice-100">
                  <div className="text-xs text-gray-600 font-bold mb-2 uppercase tracking-wide">
                    Captain{team.captains.length > 1 ? 's' : ''}
                  </div>
                  {team.captains.map((captain, idx) => (
                    <div key={idx} className="text-sm font-bold text-ice-700 flex items-center">
                      <span className="mr-2">⭐</span> {captain.name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/teams/${team.id}/roster`)
                }}
                className="btn-primary text-sm w-full"
              >
                👥 View Roster
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
