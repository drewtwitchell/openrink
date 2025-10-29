import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { playoffs, auth, rinks, leagues } from '../lib/api'

export default function PlayoffBracketView() {
  const { bracketId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bracket, setBracket] = useState(null)
  const [matches, setMatches] = useState([])
  const [matchesByRound, setMatchesByRound] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)
  const [allRinks, setAllRinks] = useState([])
  const [canManage, setCanManage] = useState(false)
  const [matchForm, setMatchForm] = useState({
    team1_score: '',
    team2_score: '',
    winner_id: '',
    game_date: '',
    game_time: '',
    rink_id: '',
    surface_name: 'NHL',
  })

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchBracketData()
    fetchRinks()
  }, [bracketId])

  const fetchBracketData = async () => {
    try {
      const data = await playoffs.getById(bracketId)
      setBracket(data.bracket)
      setMatches(data.matches)

      // Group matches by round
      const grouped = {}
      data.matches.forEach(match => {
        if (!grouped[match.round]) {
          grouped[match.round] = []
        }
        grouped[match.round].push(match)
      })
      setMatchesByRound(grouped)

      // Check if current user can manage this bracket's league
      const user = auth.getUser()
      const isAdmin = user?.role === 'admin'
      let isLeagueManager = false

      if (data.bracket?.league_id) {
        try {
          const managersData = await leagues.getManagers(data.bracket.league_id)
          isLeagueManager = managersData.some(m => m.user_id === user?.id)
        } catch (error) {
          console.error('Error fetching league managers:', error)
        }
      }

      setCanManage(isAdmin || isLeagueManager)
    } catch (error) {
      console.error('Error fetching bracket:', error)
      alert('Error loading bracket')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const fetchRinks = async () => {
    try {
      const rinksData = await rinks.getAll()
      setAllRinks(rinksData)
    } catch (error) {
      console.error('Error fetching rinks:', error)
    }
  }

  const handleEditMatch = (match) => {
    setEditingMatch(match.id)
    setMatchForm({
      team1_score: match.team1_score || '',
      team2_score: match.team2_score || '',
      winner_id: match.winner_id || '',
      game_date: match.game_date || '',
      game_time: match.game_time || '',
      rink_id: match.rink_id || '',
      surface_name: match.surface_name || 'NHL',
    })
  }

  const handleSubmitMatch = async (e) => {
    e.preventDefault()

    try {
      await playoffs.updateMatch(editingMatch, matchForm)
      setEditingMatch(null)
      setMatchForm({
        team1_score: '',
        team2_score: '',
        winner_id: '',
        game_date: '',
        game_time: '',
        rink_id: '',
        surface_name: 'NHL',
      })
      fetchBracketData()
    } catch (error) {
      alert('Error updating match: ' + error.message)
    }
  }

  const numRounds = Object.keys(matchesByRound).length

  if (loading) {
    return <div>Loading...</div>
  }

  if (!bracket) {
    return <div>Bracket not found</div>
  }

  return (
    <div>
      {/* Back Navigation */}
      <button
        onClick={() => navigate(`/leagues/${bracket.league_id}`)}
        className="mb-4 text-ice-600 hover:text-ice-700 flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to League
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{bracket.name}</h1>
          <p className="page-subtitle">{bracket.format}</p>
        </div>
      </div>

      {/* Bracket Visualization */}
      <div className="card overflow-x-auto">
        <div className="inline-flex gap-8 min-w-full pb-4">
          {Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).map(round => (
            <div key={round} className="flex-1 min-w-[280px]">
              <h3 className="text-lg font-semibold mb-4 text-center">
                {round === '1' ? 'Round 1' :
                 round === '2' && numRounds === 2 ? 'Finals' :
                 round === '2' && numRounds === 3 ? 'Semifinals' :
                 round === '2' && numRounds === 4 ? 'Quarterfinals' :
                 round === '3' && numRounds === 3 ? 'Finals' :
                 round === '3' && numRounds === 4 ? 'Semifinals' :
                 round === '4' ? 'Finals' :
                 `Round ${round}`}
              </h3>
              <div className="space-y-8">
                {matchesByRound[round].map((match, idx) => (
                  <div key={match.id} className="relative">
                    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      {/* Team 1 */}
                      <div
                        className={`p-3 border-b ${
                          match.winner_id === match.team1_id
                            ? 'bg-green-50 border-green-200'
                            : match.winner_id
                            ? 'bg-gray-50'
                            : 'bg-white'
                        }`}
                      >
                        {match.team1_id ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: match.team1_color || '#ccc' }}
                              />
                              <span className="font-medium">{match.team1_name}</span>
                              {match.winner_id === match.team1_id && (
                                <span className="text-green-600 text-sm">✓</span>
                              )}
                            </div>
                            {match.team1_score !== null && (
                              <span className="font-bold text-lg">{match.team1_score}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">TBD</span>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div
                        className={`p-3 ${
                          match.winner_id === match.team2_id
                            ? 'bg-green-50'
                            : match.winner_id
                            ? 'bg-gray-50'
                            : 'bg-white'
                        }`}
                      >
                        {match.team2_id ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: match.team2_color || '#ccc' }}
                              />
                              <span className="font-medium">{match.team2_name}</span>
                              {match.winner_id === match.team2_id && (
                                <span className="text-green-600 text-sm">✓</span>
                              )}
                            </div>
                            {match.team2_score !== null && (
                              <span className="font-bold text-lg">{match.team2_score}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">TBD</span>
                        )}
                      </div>

                      {/* Match Details */}
                      {(match.game_date || match.rink_name) && (
                        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600">
                          {match.game_date && (
                            <div>
                              {new Date(match.game_date).toLocaleDateString()}
                              {match.game_time && ` at ${match.game_time}`}
                            </div>
                          )}
                          {match.rink_name && <div>{match.rink_name}</div>}
                        </div>
                      )}

                      {/* Edit Button */}
                      {canManage && match.team1_id && match.team2_id && (
                        <div className="px-3 py-2 bg-gray-50 border-t">
                          <button
                            onClick={() => handleEditMatch(match)}
                            className="text-xs text-ice-600 hover:text-ice-700 font-medium"
                          >
                            {match.winner_id ? 'Edit Result' : 'Enter Result'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Connector line to next round */}
                    {round < numRounds && (
                      <div className="absolute top-1/2 -right-8 w-8 h-0.5 bg-gray-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Match Modal */}
      {editingMatch && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setEditingMatch(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Update Match</h2>
              <form onSubmit={handleSubmitMatch} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Team 1 Score</label>
                    <input
                      type="number"
                      value={matchForm.team1_score}
                      onChange={(e) => setMatchForm({ ...matchForm, team1_score: e.target.value })}
                      className="input"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="label">Team 2 Score</label>
                    <input
                      type="number"
                      value={matchForm.team2_score}
                      onChange={(e) => setMatchForm({ ...matchForm, team2_score: e.target.value })}
                      className="input"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Winner</label>
                  <select
                    value={matchForm.winner_id}
                    onChange={(e) => setMatchForm({ ...matchForm, winner_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select Winner</option>
                    {matches.find(m => m.id === editingMatch)?.team1_id && (
                      <option value={matches.find(m => m.id === editingMatch).team1_id}>
                        {matches.find(m => m.id === editingMatch).team1_name}
                      </option>
                    )}
                    {matches.find(m => m.id === editingMatch)?.team2_id && (
                      <option value={matches.find(m => m.id === editingMatch).team2_id}>
                        {matches.find(m => m.id === editingMatch).team2_name}
                      </option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      value={matchForm.game_date}
                      onChange={(e) => setMatchForm({ ...matchForm, game_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Time</label>
                    <input
                      type="time"
                      value={matchForm.game_time}
                      onChange={(e) => setMatchForm({ ...matchForm, game_time: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Rink</label>
                  <select
                    value={matchForm.rink_id}
                    onChange={(e) => setMatchForm({ ...matchForm, rink_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select Rink</option>
                    {allRinks.map(rink => (
                      <option key={rink.id} value={rink.id}>{rink.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Surface</label>
                  <input
                    type="text"
                    value={matchForm.surface_name}
                    onChange={(e) => setMatchForm({ ...matchForm, surface_name: e.target.value })}
                    className="input"
                    placeholder="NHL, Olympic, etc."
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    Save Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMatch(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
