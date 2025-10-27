import { useState, useEffect } from 'react'
import { games, teams, rinks } from '../lib/api'

export default function Games() {
  const [gamesList, setGamesList] = useState([])
  const [teamsList, setTeamsList] = useState([])
  const [rinksList, setRinksList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    home_team_id: '',
    away_team_id: '',
    game_date: '',
    game_time: '',
    rink_id: '',
    surface_name: 'NHL',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [gamesData, teamsData, rinksData] = await Promise.all([
        games.getAll(),
        teams.getAll(),
        rinks.getAll(),
      ])
      setGamesList(gamesData)
      setTeamsList(teamsData)
      setRinksList(rinksData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await games.create(formData)
      setFormData({
        home_team_id: '',
        away_team_id: '',
        game_date: '',
        game_time: '',
        rink_id: '',
        surface_name: 'NHL',
      })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error creating game: ' + error.message)
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return <div>Loading games...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Games</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Schedule Game'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Schedule New Game</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Home Team</label>
                <select
                  value={formData.home_team_id}
                  onChange={(e) =>
                    setFormData({ ...formData, home_team_id: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select home team</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Away Team</label>
                <select
                  value={formData.away_team_id}
                  onChange={(e) =>
                    setFormData({ ...formData, away_team_id: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select away team</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  value={formData.game_date}
                  onChange={(e) =>
                    setFormData({ ...formData, game_date: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Time</label>
                <input
                  type="time"
                  value={formData.game_time}
                  onChange={(e) =>
                    setFormData({ ...formData, game_time: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Rink</label>
              <select
                value={formData.rink_id}
                onChange={(e) =>
                  setFormData({ ...formData, rink_id: e.target.value })
                }
                className="input"
                required
              >
                <option value="">Select rink</option>
                {rinksList.map((rink) => (
                  <option key={rink.id} value={rink.id}>
                    {rink.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Ice Surface</label>
              <select
                value={formData.surface_name}
                onChange={(e) =>
                  setFormData({ ...formData, surface_name: e.target.value })
                }
                className="input"
              >
                <option value="NHL">NHL Rink</option>
                <option value="Olympic">Olympic Rink</option>
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Schedule Game
            </button>
          </form>
        </div>
      )}

      {gamesList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No games scheduled</p>
          {teamsList.length > 0 && rinksList.length > 0 ? (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Schedule Your First Game
            </button>
          ) : (
            <p className="text-gray-400">Create teams and rinks first</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {gamesList.map((game) => (
            <div key={game.id} className="card">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: game.home_team_color || '#0284c7' }}
                      />
                      <span className="font-semibold">{game.home_team_name}</span>
                    </div>
                    <span className="text-2xl font-bold mx-4">
                      {game.home_score ?? '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: game.away_team_color || '#0284c7' }}
                      />
                      <span className="font-semibold">{game.away_team_name}</span>
                    </div>
                    <span className="text-2xl font-bold mx-4">
                      {game.away_score ?? '-'}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-8">
                  <div className="text-sm text-gray-600">
                    {formatDate(game.game_date)}
                  </div>
                  <div className="text-sm text-gray-600">{game.game_time}</div>
                  <div className="text-sm text-gray-500">
                    {game.rink_name} - {game.surface_name}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
