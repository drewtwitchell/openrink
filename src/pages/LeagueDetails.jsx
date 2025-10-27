import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { leagues, teams as teamsApi, games as gamesApi } from '../lib/api'

export default function LeagueDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchLeagueData()
  }, [id])

  const fetchLeagueData = async () => {
    try {
      const [leaguesData, teamsData, gamesData] = await Promise.all([
        leagues.getAll(),
        teamsApi.getAll(),
        gamesApi.getAll(),
      ])

      const leagueData = leaguesData.find(l => l.id === parseInt(id))
      setLeague(leagueData)

      // Filter teams for this league
      setTeams(teamsData.filter(t => t.league_id === parseInt(id)))

      // Filter games for teams in this league
      const leagueTeamIds = teamsData.filter(t => t.league_id === parseInt(id)).map(t => t.id)
      setGames(gamesData.filter(g => leagueTeamIds.includes(g.home_team_id)))
    } catch (error) {
      console.error('Error fetching league data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this league? This will also delete all teams and games.')) {
      return
    }

    try {
      await leagues.delete(id)
      navigate('/leagues')
    } catch (error) {
      alert('Error deleting league: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading league details...</div>
  }

  if (!league) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">League not found</p>
        <button onClick={() => navigate('/leagues')} className="btn-primary">
          Back to Leagues
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/leagues')} className="text-ice-600 hover:underline mb-4">
          ← Back to Leagues
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
            {league.season && <p className="text-gray-600">Season: {league.season}</p>}
            {league.description && <p className="text-gray-600 mt-2">{league.description}</p>}
          </div>
          <button onClick={handleDelete} className="btn-secondary text-red-600">
            Delete League
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teams'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'schedule'
                ? 'border-ice-600 text-ice-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Schedule ({games.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-3xl font-bold text-ice-600">{teams.length}</div>
            <div className="text-gray-600">Teams</div>
          </div>
          <div className="card">
            <div className="text-3xl mb-2">🏒</div>
            <div className="text-3xl font-bold text-ice-600">{games.length}</div>
            <div className="text-gray-600">Games Scheduled</div>
          </div>
          <div className="card">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-3xl font-bold text-ice-600">
              {games.filter(g => g.home_score != null).length}
            </div>
            <div className="text-gray-600">Games Completed</div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div>
          {teams.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No teams in this league yet</p>
              <button onClick={() => navigate('/teams')} className="btn-primary">
                Add Teams
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex justify-end">
                <button onClick={() => navigate('/teams')} className="btn-primary">
                  Add Team
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {teams.map((team) => (
                  <div key={team.id} className="card">
                    <div className="flex items-center mb-3">
                      <div
                        className="w-8 h-8 rounded-full mr-3"
                        style={{ backgroundColor: team.color }}
                      />
                      <h3 className="text-xl font-semibold">{team.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          {games.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No games scheduled yet</p>
              <button onClick={() => navigate('/games')} className="btn-primary">
                Schedule Games
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => (
                <div key={game.id} className="card">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{game.home_team_name} vs {game.away_team_name}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(game.game_date).toLocaleDateString()} at {game.game_time}
                      </div>
                    </div>
                    <div className="text-right">
                      {game.home_score != null ? (
                        <div className="font-bold text-lg">
                          {game.home_score} - {game.away_score}
                        </div>
                      ) : (
                        <div className="text-gray-500">Scheduled</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
