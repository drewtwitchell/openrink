import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { playoffs, auth, seasons, teams } from '../lib/api'

export default function Playoffs() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [brackets, setBrackets] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeSeason, setActiveSeason] = useState(null)
  const [availableTeams, setAvailableTeams] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    format: '4',
    selectedTeams: [],
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchData()
  }, [leagueId])

  const fetchData = async () => {
    try {
      // Get active season
      const season = await seasons.getActive(leagueId)
      setActiveSeason(season)

      if (season) {
        // Get brackets for this season
        const bracketsData = await playoffs.getByLeagueSeason(leagueId, season.id)
        setBrackets(bracketsData)

        // Get teams for bracket creation
        const allTeams = await teams.getAll()
        const seasonTeams = allTeams.filter(t => t.season_id === season.id)
        setAvailableTeams(seasonTeams)
      }
    } catch (error) {
      console.error('Error fetching playoff data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const numTeams = parseInt(formData.format)
    if (formData.selectedTeams.length !== numTeams) {
      alert(`Please select exactly ${numTeams} teams for this bracket format`)
      return
    }

    try {
      await playoffs.create({
        league_id: leagueId,
        season_id: activeSeason.id,
        name: formData.name,
        format: `${numTeams}-team`,
        team_ids: formData.selectedTeams,
      })

      setFormData({ name: '', format: '4', selectedTeams: [] })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error creating bracket: ' + error.message)
    }
  }

  const handleToggleActive = async (bracketId) => {
    try {
      await playoffs.toggleActive(bracketId)
      fetchData()
    } catch (error) {
      alert('Error updating bracket: ' + error.message)
    }
  }

  const handleDelete = async (bracketId, name) => {
    if (!confirm(`Delete bracket "${name}"?`)) return

    try {
      await playoffs.delete(bracketId)
      fetchData()
    } catch (error) {
      alert('Error deleting bracket: ' + error.message)
    }
  }

  const handleToggleTeam = (teamId) => {
    const numTeams = parseInt(formData.format)
    const isSelected = formData.selectedTeams.includes(teamId)

    if (isSelected) {
      setFormData({
        ...formData,
        selectedTeams: formData.selectedTeams.filter(id => id !== teamId)
      })
    } else {
      if (formData.selectedTeams.length < numTeams) {
        setFormData({
          ...formData,
          selectedTeams: [...formData.selectedTeams, teamId]
        })
      }
    }
  }

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'league_manager'

  if (loading) {
    return <div>Loading...</div>
  }

  if (!canManage) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">
          You don't have permission to manage playoff brackets.
        </p>
      </div>
    )
  }

  if (!activeSeason) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">
          No active season found. Please create and activate a season first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/leagues/${leagueId}`)}
          className="text-sm text-ice-600 hover:text-ice-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to League
        </button>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Playoff Brackets</h1>
          <p className="page-subtitle">
            {activeSeason.name} - {brackets.length} bracket{brackets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setFormData({ name: '', format: '4', selectedTeams: [] })
          }}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'Create Bracket'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Create Playoff Bracket</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Bracket Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Spring 2024 Playoffs"
                required
              />
            </div>

            <div>
              <label className="label">Format *</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value, selectedTeams: [] })}
                className="input"
                required
              >
                <option value="4">4 Teams (2 rounds)</option>
                <option value="8">8 Teams (3 rounds)</option>
                <option value="16">16 Teams (4 rounds)</option>
              </select>
            </div>

            <div>
              <label className="label">
                Select Teams ({formData.selectedTeams.length}/{formData.format} selected) *
              </label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableTeams.map((team, idx) => {
                  const isSelected = formData.selectedTeams.includes(team.id)
                  const canSelect = formData.selectedTeams.length < parseInt(formData.format)

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => handleToggleTeam(team.id)}
                      disabled={!isSelected && !canSelect}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-ice-500 bg-ice-50 text-ice-700'
                          : !canSelect
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:border-ice-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-medium">{team.name}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs bg-ice-200 text-ice-700 px-2 py-0.5 rounded">
                            #{formData.selectedTeams.indexOf(team.id) + 1}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Teams will be seeded in the order selected
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={formData.selectedTeams.length !== parseInt(formData.format)}
            >
              Create Bracket
            </button>
          </form>
        </div>
      )}

      {brackets.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No playoff brackets yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Create Your First Bracket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {brackets.map((bracket) => (
            <div key={bracket.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{bracket.name}</h3>
                    <span className="badge badge-neutral">{bracket.format}</span>
                    <span
                      className={`badge ${
                        bracket.is_active === 1 ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {bracket.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created {new Date(bracket.created_at).toLocaleDateString()}</span>
                    <span>By {bracket.creator_name}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/playoffs/${bracket.id}/view`)}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    View Bracket
                  </button>
                  <button
                    onClick={() => handleToggleActive(bracket.id)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    {bracket.is_active === 1 ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(bracket.id, bracket.name)}
                    className="btn-danger text-xs py-1 px-3"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
