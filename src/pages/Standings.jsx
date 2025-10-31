import { useState, useEffect } from 'react'
import { leagues, games, players } from '../lib/api'

export default function Standings() {
  const [leaguesList, setLeaguesList] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [standings, setStandings] = useState([])
  const [playerStats, setPlayerStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeagues()
  }, [])

  useEffect(() => {
    if (selectedLeague) {
      calculateStandings(selectedLeague)
      fetchPlayerStats(selectedLeague)
    }
  }, [selectedLeague])

  const fetchLeagues = async () => {
    try {
      const data = await leagues.getAll(true) // Include archived leagues
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

  const fetchPlayerStats = async (leagueId) => {
    try {
      const stats = await players.getLeagueStats(leagueId)
      setPlayerStats(stats)
    } catch (error) {
      console.error('Error fetching player stats:', error)
      setPlayerStats([])
    }
  }

  if (loading) {
    return <div className="loading">Loading standings...</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Standings</h1>
          <p className="page-subtitle">View league standings and rankings</p>
        </div>
      </div>

      {leaguesList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3 className="empty-state-title">No Leagues Available</h3>
            <p className="empty-state-description">Create a league to start tracking standings</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-6">
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
            <div className="card">
              <div className="empty-state">
                <h3 className="empty-state-title">No Games Played</h3>
                <p className="empty-state-description">Standings will appear once games have been completed</p>
              </div>
            </div>
          ) : (
            <>
              <div className="card overflow-x-auto mb-6">
                <h3 className="section-header mb-4">Team Standings</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th className="text-center">W</th>
                      <th className="text-center">L</th>
                      <th className="text-center">T</th>
                      <th className="text-center">GF</th>
                      <th className="text-center">GA</th>
                      <th className="text-center">DIFF</th>
                      <th className="text-center">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((standing, index) => (
                      <tr key={standing.id}>
                        <td className="font-semibold">{index + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: standing.color }}
                            />
                            <span className="font-medium">{standing.name}</span>
                          </div>
                        </td>
                        <td className="text-center">{standing.wins}</td>
                        <td className="text-center">{standing.losses}</td>
                        <td className="text-center">{standing.ties}</td>
                        <td className="text-center">{standing.gf}</td>
                        <td className="text-center">{standing.ga}</td>
                        <td className="text-center">
                          {standing.gf - standing.ga > 0 ? '+' : ''}
                          {standing.gf - standing.ga}
                        </td>
                        <td className="text-center font-bold">
                          {standing.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {playerStats.length > 0 && (
                <div className="card overflow-x-auto">
                  <h3 className="section-header mb-4">Player Stats</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Team</th>
                        <th className="text-center">#</th>
                        <th className="text-center">GP</th>
                        <th className="text-center">G</th>
                        <th className="text-center">A</th>
                        <th className="text-center">PTS</th>
                        <th className="text-center">PIM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((stat, index) => (
                        <tr key={stat.player_id}>
                          <td className="font-semibold">{index + 1}</td>
                          <td className="font-medium">{stat.player_name}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stat.team_color }}
                              />
                              <span className="text-sm">{stat.team_name}</span>
                            </div>
                          </td>
                          <td className="text-center text-sm">{stat.jersey_number || '-'}</td>
                          <td className="text-center">{stat.games_played}</td>
                          <td className="text-center">{stat.goals}</td>
                          <td className="text-center">{stat.assists}</td>
                          <td className="text-center font-bold">{stat.points}</td>
                          <td className="text-center">{stat.penalty_minutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
