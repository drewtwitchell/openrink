import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Leagues() {
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    season: '',
  })

  useEffect(() => {
    fetchLeagues()
  }, [])

  const fetchLeagues = async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeagues(data || [])
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('leagues')
        .insert([{ ...formData, created_by: user.id }])

      if (error) throw error

      setFormData({ name: '', description: '', season: '' })
      setShowForm(false)
      fetchLeagues()
    } catch (error) {
      alert('Error creating league: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading leagues...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Leagues</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ New League'}
        </button>
      </div>

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

            <button type="submit" className="btn-primary">
              Create League
            </button>
          </form>
        </div>
      )}

      {leagues.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No leagues yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Create Your First League
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {leagues.map((league) => (
            <div key={league.id} className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">{league.name}</h3>
              {league.season && (
                <p className="text-sm text-gray-500 mb-2">Season: {league.season}</p>
              )}
              {league.description && (
                <p className="text-gray-600 mb-4">{league.description}</p>
              )}
              <div className="flex space-x-2">
                <button className="btn-primary text-sm">View Details</button>
                <button className="btn-secondary text-sm">Manage</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
