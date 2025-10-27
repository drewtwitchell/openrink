import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { teams, players } from '../lib/api'

export default function TeamRoster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    jersey_number: '',
    email_notifications: true,
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [teamsData, playersData] = await Promise.all([
        teams.getAll(),
        players.getByTeam(id),
      ])

      const teamData = teamsData.find(t => t.id === parseInt(id))
      setTeam(teamData)
      setRoster(playersData)
    } catch (error) {
      console.error('Error fetching roster:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await players.create({ ...formData, team_id: id })
      setFormData({ name: '', email: '', phone: '', jersey_number: '', email_notifications: true })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error adding player: ' + error.message)
    }
  }

  const handleDelete = async (playerId) => {
    if (!confirm('Remove this player from the roster?')) return

    try {
      await players.delete(playerId)
      fetchData()
    } catch (error) {
      alert('Error removing player: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading roster...</div>
  }

  if (!team) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">Team not found</p>
        <button onClick={() => navigate('/teams')} className="btn-primary">
          Back to Teams
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/teams')} className="text-ice-600 hover:underline mb-4">
          ← Back to Teams
        </button>
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div
              className="w-12 h-12 rounded-full mr-4"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <h1 className="text-3xl font-bold mb-1">{team.name}</h1>
              <p className="text-gray-600">Team Roster</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Player to Roster</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Player Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="label">Jersey Number</label>
                <input
                  type="number"
                  value={formData.jersey_number}
                  onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                  className="input"
                  placeholder="99"
                  min="0"
                  max="99"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="player@example.com"
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="notifications"
                checked={formData.email_notifications}
                onChange={(e) => setFormData({ ...formData, email_notifications: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                Send email notifications for games and updates
              </label>
            </div>

            <button type="submit" className="btn-primary">
              Add Player
            </button>
          </form>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-500 mb-4">No players on this roster yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Add Your First Player
          </button>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Roster ({roster.length} players)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  <th className="text-center py-3 px-4">Notifications</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((player) => (
                  <tr key={player.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold">
                      {player.jersey_number || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium">{player.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {player.email || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {player.phone || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {player.email_notifications ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-400">✗</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDelete(player.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
