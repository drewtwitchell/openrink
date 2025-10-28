import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leagues, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Leagues() {
  const navigate = useNavigate()
  const [leaguesList, setLeaguesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
  }, [])

  const fetchLeagues = async () => {
    try {
      const data = await leagues.getAll()
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

  if (loading) {
    return <div>Loading leagues...</div>
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leagues' }
        ]}
      />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Leagues</h1>
        {canManageLeagues() && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : '+ New League'}
          </button>
        )}
      </div>

      {!canManageLeagues() && leaguesList.length === 0 && (
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <p className="text-sm text-gray-700">
            Only Admins and League Managers can create leagues. Contact your administrator to get league manager access.
          </p>
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
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Create Your First League
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {leaguesList.map((league) => (
            <div key={league.id} className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">{league.name}</h3>
              {league.season && (
                <p className="text-sm text-gray-500 mb-2">Season: {league.season}</p>
              )}
              {league.description && (
                <p className="text-gray-600 mb-4">{league.description}</p>
              )}
              <div className="flex space-x-2">
                <button onClick={() => navigate(`/leagues/${league.id}`)} className="btn-primary text-sm">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
