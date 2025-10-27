import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    league_id: '',
    color: '#0284c7',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [teamsRes, leaguesRes] = await Promise.all([
        supabase.from('teams').select('*, leagues(name)').order('name'),
        supabase.from('leagues').select('id, name').order('name'),
      ])

      if (teamsRes.error) throw teamsRes.error
      if (leaguesRes.error) throw leaguesRes.error

      setTeams(teamsRes.data || [])
      setLeagues(leaguesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('teams')
        .insert([formData])

      if (error) throw error

      setFormData({ name: '', league_id: '', color: '#0284c7' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error creating team: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading teams...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Teams</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ New Team'}
        </button>
      </div>

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
                {leagues.map((league) => (
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

      {teams.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No teams yet</p>
          {leagues.length > 0 ? (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Create Your First Team
            </button>
          ) : (
            <p className="text-gray-400">Create a league first</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-center mb-3">
                <div
                  className="w-8 h-8 rounded-full mr-3"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="text-xl font-semibold">{team.name}</h3>
              </div>
              {team.leagues && (
                <p className="text-sm text-gray-500 mb-2">
                  League: {team.leagues.name}
                </p>
              )}
              <button className="btn-primary text-sm w-full">
                View Roster
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
