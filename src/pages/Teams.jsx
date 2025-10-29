import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { teams, leagues as leaguesApi, auth, players } from '../lib/api'
import ConfirmModal from '../components/ConfirmModal'

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
  const [expandedTeams, setExpandedTeams] = useState({})
  const [teamRosters, setTeamRosters] = useState({})
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, teamId: null, teamName: '' })

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

  const handleDelete = (teamId, teamName) => {
    setDeleteModal({ isOpen: true, teamId, teamName })
  }

  const confirmDelete = async () => {
    const { teamId } = deleteModal
    if (!teamId) return

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

  const toggleTeamRoster = async (teamId) => {
    // Toggle expanded state
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }))

    // Fetch roster if not already loaded
    if (!teamRosters[teamId]) {
      try {
        const roster = await players.getByTeam(teamId)
        setTeamRosters(prev => ({
          ...prev,
          [teamId]: roster
        }))
      } catch (error) {
        console.error('Error fetching roster:', error)
      }
    }
  }

  if (loading) {
    return <div className="loading">Loading teams...</div>
  }

  return (
    <div>
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
          <h2 className="section-header mb-4">Create New Team</h2>
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
        <div className="space-y-4">
          {teamsList.map((team) => (
            <div key={team.id} className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className="w-12 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{team.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{team.league_name || 'No League'}</span>
                      <span>•</span>
                      <span>{team.player_count || 0} players</span>
                      {team.captains && team.captains.length > 0 && (
                        <>
                          <span>•</span>
                          <span>Captain: {team.captains.map(c => c.name).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTeamRoster(team.id)}
                    className="btn-secondary text-sm"
                  >
                    {expandedTeams[team.id] ? 'Hide Roster' : 'View Roster'}
                  </button>
                  {canManageTeams() && (
                    <button
                      onClick={() => handleDelete(team.id, team.name)}
                      className="btn-danger text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Roster Display */}
              {expandedTeams[team.id] && (
                <div className="p-4 bg-gray-50">
                  {canManageTeams() && (
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={() => navigate(`/teams/${team.id}/roster`)}
                        className="btn-primary text-xs"
                      >
                        Manage Roster
                      </button>
                    </div>
                  )}
                  {teamRosters[team.id] ? (
                    teamRosters[team.id].length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2">#</th>
                              <th className="text-left py-2 px-2">Name</th>
                              <th className="text-left py-2 px-2">Position</th>
                              <th className="text-left py-2 px-2">Email</th>
                              <th className="text-left py-2 px-2">Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamRosters[team.id].map((player) => (
                              <tr key={player.id} className="border-b hover:bg-white">
                                <td className="py-2 px-2">
                                  {player.jersey_number ? (
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                      style={{ backgroundColor: team.color }}
                                    >
                                      {player.jersey_number}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    {player.name}
                                    {player.is_captain === 1 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                                        ⭐ C
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2 capitalize">{player.position || 'player'}</td>
                                <td className="py-2 px-2">
                                  {player.email ? (
                                    <a href={`mailto:${player.email}`} className="text-ice-600 hover:underline">
                                      {player.email}
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-2">
                                  {player.phone ? (
                                    <a href={`tel:${player.phone}`} className="text-ice-600 hover:underline">
                                      {player.phone}
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No players on this team yet.</p>
                        {canManageTeams() && (
                          <button
                            onClick={() => navigate(`/teams/${team.id}/roster`)}
                            className="btn-primary mt-4"
                          >
                            Add Players
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-gray-500 text-center py-4">Loading roster...</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, teamId: null, teamName: '' })}
        onConfirm={confirmDelete}
        title="Delete Team"
        message={`Are you sure you want to delete "${deleteModal.teamName}"?\n\nThis will also delete all players on this team. This action cannot be undone.`}
        confirmText="Delete Team"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
