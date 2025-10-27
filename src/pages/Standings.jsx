import { useState, useEffect } from 'react'
import { leagues, games } from '../lib/api'

export default function Standings() {
  const [leaguesList, setLeaguesList] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeagues()
  }, [])

  useEffect(() => {
    if (selectedLeague) {
      calculateStandings(selectedLeague)
    }
  }, [selectedLeague])

  const fetchLeagues = async () => {
    try {
      const data = await leagues.getAll()
      setLeaguesList(data)
      if (data && data.length > 0) {
        setSelectedLeague(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching leagues:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStandings = async (leagueId) => {
    try {
      const gamesData = await games.getAll()

      // Filter games with scores for the selected league's teams
      const completedGames = gamesData.filter(
        g => g.home_score != null && g.away_score != null
      )

      // Group by team and calculate stats
      const teamStats = {}
      completedGames.forEach((game) => {
        // Initialize home team stats
        if (!teamStats[game.home_team_id]) {
          teamStats[game.home_team_id] = {
            id: game.home_team_id,
            name: game.home_team_name,
            color: game.home_team_color,
            wins: 0,
            losses: 0,
            ties: 0,
            gf: 0,
            ga: 0,
            points: 0,
          }
        }

        // Initialize away team stats
        if (!teamStats[game.away_team_id]) {
          teamStats[game.away_team_id] = {
            id: game.away_team_id,
            name: game.away_team_name,
            color: game.away_team_color,
            wins: 0,
            losses: 0,
            ties: 0,
            gf: 0,
            ga: 0,
            points: 0,
          }
        }

        // Update stats
        const homeTeam = teamStats[game.home_team_id]
        const awayTeam = teamStats[game.away_team_id]

        homeTeam.gf += game.home_score
        homeTeam.ga += game.away_score
        awayTeam.gf += game.away_score
        awayTeam.ga += game.home_score

        if (game.home_score > game.away_score) {
          homeTeam.wins++
          homeTeam.points += 2
          awayTeam.losses++
        } else if (game.away_score > game.home_score) {
          awayTeam.wins++
          awayTeam.points += 2
          homeTeam.losses++
        } else {
          homeTeam.ties++
          awayTeam.ties++
          homeTeam.points += 1
          awayTeam.points += 1
        }
      })

      // Sort by points, then by goal differential
      const sortedStandings = Object.values(teamStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.gf - b.ga - (a.gf - a.ga)
      })

      setStandings(sortedStandings)
    } catch (error) {
      console.error('Error calculating standings:', error)
    }
  }

  if (loading) {
    return <div>Loading standings...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Standings</h1>

      {leaguesList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No leagues available</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="label">Select League</label>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="input max-w-md"
            >
              {leaguesList.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>

          {standings.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No games played yet</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Rank</th>
                    <th className="text-left py-3 px-4">Team</th>
                    <th className="text-center py-3 px-4">W</th>
                    <th className="text-center py-3 px-4">L</th>
                    <th className="text-center py-3 px-4">T</th>
                    <th className="text-center py-3 px-4">GF</th>
                    <th className="text-center py-3 px-4">GA</th>
                    <th className="text-center py-3 px-4">DIFF</th>
                    <th className="text-center py-3 px-4 font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing, index) => (
                    <tr
                      key={standing.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-semibold">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: standing.color }}
                          />
                          <span className="font-medium">{standing.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">{standing.wins}</td>
                      <td className="text-center py-3 px-4">{standing.losses}</td>
                      <td className="text-center py-3 px-4">{standing.ties}</td>
                      <td className="text-center py-3 px-4">{standing.gf}</td>
                      <td className="text-center py-3 px-4">{standing.ga}</td>
                      <td className="text-center py-3 px-4">
                        {standing.gf - standing.ga > 0 ? '+' : ''}
                        {standing.gf - standing.ga}
                      </td>
                      <td className="text-center py-3 px-4 font-bold">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
