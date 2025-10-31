import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Helper middleware to check admin/league_manager
function requireAdmin(req, res, next) {
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }
    next()
  })
}

// Helper function to generate round robin schedule
function generateRoundRobinSchedule(team_ids, start_date, game_times) {
  const teams = [...team_ids]
  const numTeams = teams.length
  const schedule = []

  // If odd number of teams, add a "bye" (null)
  if (numTeams % 2 !== 0) {
    teams.push(null)
  }

  const totalTeams = teams.length
  const numRounds = totalTeams - 1
  const matchesPerRound = totalTeams / 2

  let gameTimeIndex = 0
  let matchNumber = 1
  const startDateObj = new Date(start_date)

  for (let round = 0; round < numRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = teams[match]
      const away = teams[totalTeams - 1 - match]

      // Skip if either team is a bye
      if (home !== null && away !== null) {
        const gameTime = game_times[gameTimeIndex % game_times.length]
        const gameDate = new Date(startDateObj)
        gameDate.setDate(gameDate.getDate() + Math.floor(gameTimeIndex / game_times.length))

        schedule.push({
          round: round + 1,
          match_number: matchNumber++,
          team1_id: home,
          team2_id: away,
          game_date: gameDate.toISOString().split('T')[0],
          game_time: gameTime.time,
          day_of_week: gameTime.day_of_week
        })

        gameTimeIndex++
      }
    }

    // Rotate teams (keep first team fixed, rotate others)
    teams.splice(1, 0, teams.pop())
  }

  return schedule
}

// Helper function to calculate round robin standings
function calculateRoundRobinStandings(bracketId, callback) {
  // Get all round robin games for this bracket
  db.all(
    `SELECT g.*, pm.team1_id, pm.team2_id
     FROM games g
     JOIN playoff_matches pm ON g.id = pm.game_id
     WHERE g.bracket_id = ? AND pm.match_type = 'round_robin' AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL`,
    [bracketId],
    (err, games) => {
      if (err) {
        return callback(err)
      }

      // Get all teams in the bracket
      db.all(
        `SELECT DISTINCT team_id FROM (
          SELECT team1_id as team_id FROM playoff_matches WHERE bracket_id = ? AND match_type = 'round_robin'
          UNION
          SELECT team2_id as team_id FROM playoff_matches WHERE bracket_id = ? AND match_type = 'round_robin'
        )`,
        [bracketId, bracketId],
        (err, teamRows) => {
          if (err) {
            return callback(err)
          }

          // Initialize standings for each team
          const standings = {}
          teamRows.forEach(row => {
            standings[row.team_id] = {
              team_id: row.team_id,
              games_played: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              goals_for: 0,
              goals_against: 0,
              differential: 0,
              points: 0
            }
          })

          // Calculate stats from games
          games.forEach(game => {
            const homeId = game.home_team_id
            const awayId = game.away_team_id
            const homeScore = game.home_score
            const awayScore = game.away_score

            if (standings[homeId]) {
              standings[homeId].games_played++
              standings[homeId].goals_for += homeScore
              standings[homeId].goals_against += awayScore

              if (homeScore > awayScore) {
                standings[homeId].wins++
                standings[homeId].points += 2
              } else if (homeScore < awayScore) {
                standings[homeId].losses++
              } else {
                standings[homeId].ties++
                standings[homeId].points += 1
              }
            }

            if (standings[awayId]) {
              standings[awayId].games_played++
              standings[awayId].goals_for += awayScore
              standings[awayId].goals_against += homeScore

              if (awayScore > homeScore) {
                standings[awayId].wins++
                standings[awayId].points += 2
              } else if (awayScore < homeScore) {
                standings[awayId].losses++
              } else {
                standings[awayId].ties++
                standings[awayId].points += 1
              }
            }
          })

          // Calculate differentials
          Object.values(standings).forEach(team => {
            team.differential = team.goals_for - team.goals_against
          })

          // Convert to array and get team names
          const standingsArray = Object.values(standings)
          const teamIds = standingsArray.map(s => s.team_id)

          if (teamIds.length === 0) {
            return callback(null, [])
          }

          db.all(
            `SELECT id, name, color FROM teams WHERE id IN (${teamIds.map(() => '?').join(',')})`,
            teamIds,
            (err, teams) => {
              if (err) {
                return callback(err)
              }

              // Add team names to standings
              standingsArray.forEach(standing => {
                const team = teams.find(t => t.id === standing.team_id)
                if (team) {
                  standing.team_name = team.name
                  standing.team_color = team.color
                }
              })

              // Sort by points desc, then differential desc
              standingsArray.sort((a, b) => {
                if (b.points !== a.points) {
                  return b.points - a.points
                }
                return b.differential - a.differential
              })

              callback(null, standingsArray)
            }
          )
        }
      )
    }
  )
}

// Helper function to create elimination game
function createEliminationGame(matchData, seasonId, callback) {
  // Create game first
  db.run(
    `INSERT INTO games (home_team_id, away_team_id, game_date, game_time, bracket_id, season_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
    [matchData.team1_id, matchData.team2_id, matchData.game_date, matchData.game_time, matchData.bracket_id, seasonId],
    function(err) {
      if (err) {
        return callback(err)
      }

      const gameId = this.lastID

      // Create playoff_match
      db.run(
        `INSERT INTO playoff_matches (bracket_id, round, match_number, team1_id, team2_id, match_type, game_id, game_date, game_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          matchData.bracket_id,
          matchData.round,
          matchData.match_number,
          matchData.team1_id,
          matchData.team2_id,
          matchData.match_type,
          gameId,
          matchData.game_date,
          matchData.game_time
        ],
        function(err) {
          if (err) {
            return callback(err)
          }

          callback(null, {
            matchId: this.lastID,
            gameId: gameId
          })
        }
      )
    }
  )
}

// Get all brackets for a league/season
router.get('/league/:leagueId/season/:seasonId', (req, res) => {
  db.all(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.league_id = ? AND playoff_brackets.season_id = ?
     ORDER BY playoff_brackets.created_at DESC`,
    [req.params.leagueId, req.params.seasonId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching playoff brackets' })
      }
      res.json(rows)
    }
  )
})

// Get active bracket for a league/season (public)
router.get('/league/:leagueId/season/:seasonId/active', (req, res) => {
  db.get(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.league_id = ?
       AND playoff_brackets.season_id = ?
       AND playoff_brackets.is_active = 1
     ORDER BY playoff_brackets.created_at DESC
     LIMIT 1`,
    [req.params.leagueId, req.params.seasonId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching active bracket' })
      }
      res.json(row || null)
    }
  )
})

// Get bracket details with all matches
router.get('/:bracketId', (req, res) => {
  db.get(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.id = ?`,
    [req.params.bracketId],
    (err, bracket) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching bracket' })
      }
      if (!bracket) {
        return res.status(404).json({ error: 'Bracket not found' })
      }

      // Get all matches for this bracket
      db.all(
        `SELECT
           playoff_matches.*,
           t1.name as team1_name,
           t1.color as team1_color,
           t2.name as team2_name,
           t2.color as team2_color,
           winner.name as winner_name,
           rinks.name as rink_name,
           games.id as game_id,
           games.game_date,
           games.game_time,
           games.home_score,
           games.away_score
         FROM playoff_matches
         LEFT JOIN teams t1 ON playoff_matches.team1_id = t1.id
         LEFT JOIN teams t2 ON playoff_matches.team2_id = t2.id
         LEFT JOIN teams winner ON playoff_matches.winner_id = winner.id
         LEFT JOIN rinks ON playoff_matches.rink_id = rinks.id
         LEFT JOIN games ON playoff_matches.game_id = games.id
         WHERE playoff_matches.bracket_id = ?
         ORDER BY playoff_matches.round, playoff_matches.match_number`,
        [req.params.bracketId],
        (err, matches) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching matches' })
          }

          // If this is a round robin bracket, also get standings
          if (bracket.format === 'round_robin') {
            calculateRoundRobinStandings(req.params.bracketId, (err, standings) => {
              if (err) {
                return res.status(500).json({ error: 'Error calculating standings' })
              }

              // Group matches by match_type
              const matchesByType = {
                round_robin: matches.filter(m => m.match_type === 'round_robin'),
                semifinal: matches.filter(m => m.match_type === 'semifinal'),
                final: matches.filter(m => m.match_type === 'final'),
                consolation: matches.filter(m => m.match_type === 'consolation')
              }

              res.json({
                bracket,
                matches,
                matchesByType,
                standings
              })
            })
          } else {
            res.json({
              bracket,
              matches
            })
          }
        }
      )
    }
  )
})

// Create new bracket
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { league_id, season_id, name, format, team_ids } = req.body

  if (!league_id || !season_id || !name || !format || !team_ids || !Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const numTeams = team_ids.length

  // For round robin, accept any number of teams
  if (format === 'round_robin') {
    if (numTeams < 2) {
      return res.status(400).json({ error: 'Round robin requires at least 2 teams' })
    }

    db.run(
      `INSERT INTO playoff_brackets (league_id, season_id, name, format, created_by, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [league_id, season_id, name, format, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating bracket' })
        }

        res.status(201).json({
          message: 'Round robin bracket created successfully',
          bracketId: this.lastID
        })
      }
    )
    return
  }

  // Validate format for elimination brackets (must be power of 2)
  if (![4, 8, 16].includes(numTeams)) {
    return res.status(400).json({ error: 'Number of teams must be 4, 8, or 16 for elimination brackets' })
  }

  db.run(
    `INSERT INTO playoff_brackets (league_id, season_id, name, format, created_by, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [league_id, season_id, name, format, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating bracket' })
      }

      const bracketId = this.lastID

      // Generate bracket structure
      const numRounds = Math.log2(numTeams)
      const matches = []

      // Create first round matches
      for (let i = 0; i < numTeams / 2; i++) {
        matches.push({
          bracket_id: bracketId,
          round: 1,
          match_number: i + 1,
          team1_id: team_ids[i * 2],
          team2_id: team_ids[i * 2 + 1],
          match_type: 'elimination'
        })
      }

      // Create subsequent round placeholders
      let matchNumber = 1
      for (let round = 2; round <= numRounds; round++) {
        const matchesInRound = Math.pow(2, numRounds - round)
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            bracket_id: bracketId,
            round: round,
            match_number: matchNumber++,
            team1_id: null,
            team2_id: null,
            match_type: 'elimination'
          })
        }
      }

      // Insert all matches
      const insertMatch = db.prepare(
        `INSERT INTO playoff_matches (bracket_id, round, match_number, team1_id, team2_id, match_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      matches.forEach(match => {
        insertMatch.run(
          match.bracket_id,
          match.round,
          match.match_number,
          match.team1_id,
          match.team2_id,
          match.match_type
        )
      })

      insertMatch.finalize((err) => {
        if (err) {
          return res.status(500).json({ error: 'Error creating matches' })
        }

        // Now link matches together (set next_match_id)
        db.all(
          `SELECT id, round, match_number FROM playoff_matches
           WHERE bracket_id = ? ORDER BY round, match_number`,
          [bracketId],
          (err, allMatches) => {
            if (err) {
              return res.status(500).json({ error: 'Error linking matches' })
            }

            const updateStmt = db.prepare(
              'UPDATE playoff_matches SET next_match_id = ? WHERE id = ?'
            )

            // Group matches by round
            const matchesByRound = {}
            allMatches.forEach(m => {
              if (!matchesByRound[m.round]) {
                matchesByRound[m.round] = []
              }
              matchesByRound[m.round].push(m)
            })

            // Link each match to the next round
            for (let round = 1; round < numRounds; round++) {
              const currentRoundMatches = matchesByRound[round]
              const nextRoundMatches = matchesByRound[round + 1]

              currentRoundMatches.forEach((match, idx) => {
                const nextMatchIdx = Math.floor(idx / 2)
                const nextMatch = nextRoundMatches[nextMatchIdx]
                updateStmt.run(nextMatch.id, match.id)
              })
            }

            updateStmt.finalize()

            res.status(201).json({
              message: 'Bracket created successfully',
              bracketId: bracketId
            })
          }
        )
      })
    }
  )
})

// Update match result
router.put('/matches/:matchId', authenticateToken, requireAdmin, (req, res) => {
  const { team1_score, team2_score, winner_id, game_date, game_time, rink_id, surface_name } = req.body

  // Get the match details first
  db.get(
    'SELECT * FROM playoff_matches WHERE id = ?',
    [req.params.matchId],
    (err, match) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching match' })
      }
      if (!match) {
        return res.status(404).json({ error: 'Match not found' })
      }

      // Update the match
      db.run(
        `UPDATE playoff_matches
         SET team1_score = ?, team2_score = ?, winner_id = ?,
             game_date = ?, game_time = ?, rink_id = ?, surface_name = ?
         WHERE id = ?`,
        [team1_score, team2_score, winner_id, game_date, game_time, rink_id, surface_name, req.params.matchId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating match' })
          }

          // If this match is linked to a game, also update the game
          if (match.game_id) {
            db.run(
              `UPDATE games SET home_score = ?, away_score = ?, status = 'completed' WHERE id = ?`,
              [team1_score, team2_score, match.game_id],
              (err) => {
                if (err) {
                  console.error('Error updating linked game:', err)
                }
              }
            )
          }

          // For elimination matches: if there's a winner and a next match, advance the winner
          if (winner_id && match.next_match_id && match.match_type !== 'round_robin') {
            db.get(
              'SELECT team1_id, team2_id FROM playoff_matches WHERE id = ?',
              [match.next_match_id],
              (err, nextMatch) => {
                if (err) {
                  return res.status(500).json({ error: 'Error fetching next match' })
                }

                // Determine if winner goes to team1 or team2 slot in next match
                // Even match numbers go to team1, odd to team2
                const field = match.match_number % 2 === 1 ? 'team1_id' : 'team2_id'

                db.run(
                  `UPDATE playoff_matches SET ${field} = ? WHERE id = ?`,
                  [winner_id, match.next_match_id],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ error: 'Error advancing winner' })
                    }

                    // Also update the linked game with the advanced team
                    db.get('SELECT game_id FROM playoff_matches WHERE id = ?', [match.next_match_id], (err, nextMatchData) => {
                      if (err || !nextMatchData || !nextMatchData.game_id) {
                        return res.json({ message: 'Match updated and winner advanced' })
                      }

                      const gameField = match.match_number % 2 === 1 ? 'home_team_id' : 'away_team_id'
                      db.run(
                        `UPDATE games SET ${gameField} = ? WHERE id = ?`,
                        [winner_id, nextMatchData.game_id],
                        (err) => {
                          if (err) {
                            console.error('Error updating next game with winner:', err)
                          }
                          res.json({ message: 'Match updated and winner advanced' })
                        }
                      )
                    })
                  }
                )
              }
            )
          } else {
            res.json({ message: 'Match updated successfully' })
          }
        }
      )
    }
  )
})

// Create round robin schedule
router.post('/round-robin/schedule', authenticateToken, requireAdmin, (req, res) => {
  const { bracket_id, team_ids, start_date, game_times } = req.body

  if (!bracket_id || !team_ids || !Array.isArray(team_ids) || !start_date || !game_times || !Array.isArray(game_times)) {
    return res.status(400).json({ error: 'Missing required fields: bracket_id, team_ids, start_date, game_times' })
  }

  if (team_ids.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 teams for round robin' })
  }

  if (game_times.length === 0) {
    return res.status(400).json({ error: 'Need at least one game time' })
  }

  // Verify the bracket exists and is round robin format
  db.get('SELECT * FROM playoff_brackets WHERE id = ?', [bracket_id], (err, bracket) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching bracket' })
    }
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket not found' })
    }
    if (bracket.format !== 'round_robin') {
      return res.status(400).json({ error: 'Bracket is not round robin format' })
    }

    // Generate round robin schedule
    const schedule = generateRoundRobinSchedule(team_ids, start_date, game_times)

    // Create games and playoff_matches
    let completed = 0
    const errors = []

    schedule.forEach((match, index) => {
      // Create game first
      db.run(
        `INSERT INTO games (home_team_id, away_team_id, game_date, game_time, bracket_id, season_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
        [match.team1_id, match.team2_id, match.game_date, match.game_time, bracket_id, bracket.season_id],
        function(err) {
          if (err) {
            errors.push(`Error creating game ${index + 1}: ${err.message}`)
            completed++
            checkComplete()
            return
          }

          const gameId = this.lastID

          // Create playoff_match
          db.run(
            `INSERT INTO playoff_matches (bracket_id, round, match_number, team1_id, team2_id, match_type, game_id, game_date, game_time)
             VALUES (?, ?, ?, ?, ?, 'round_robin', ?, ?, ?)`,
            [bracket_id, match.round, match.match_number, match.team1_id, match.team2_id, gameId, match.game_date, match.game_time],
            function(err) {
              if (err) {
                errors.push(`Error creating playoff_match ${index + 1}: ${err.message}`)
              }
              completed++
              checkComplete()
            }
          )
        }
      )
    })

    function checkComplete() {
      if (completed === schedule.length) {
        if (errors.length > 0) {
          res.status(500).json({
            message: 'Schedule created with errors',
            errors,
            created: schedule.length - errors.length
          })
        } else {
          res.status(201).json({
            message: 'Round robin schedule created successfully',
            games_created: schedule.length,
            schedule
          })
        }
      }
    }
  })
})

// Get round robin standings
router.get('/:bracketId/round-robin/standings', (req, res) => {
  calculateRoundRobinStandings(req.params.bracketId, (err, standings) => {
    if (err) {
      return res.status(500).json({ error: 'Error calculating standings' })
    }
    res.json(standings)
  })
})

// Generate elimination bracket from round robin standings
router.post('/:bracketId/generate-elimination', authenticateToken, requireAdmin, (req, res) => {
  const { semifinal_date, semifinal_times, final_date, final_times } = req.body

  if (!semifinal_date || !semifinal_times || !Array.isArray(semifinal_times) || semifinal_times.length !== 2) {
    return res.status(400).json({ error: 'Missing semifinal_date or semifinal_times (need 2 times)' })
  }

  if (!final_date || !final_times || !Array.isArray(final_times) || final_times.length !== 2) {
    return res.status(400).json({ error: 'Missing final_date or final_times (need 2 times for championship and consolation)' })
  }

  // Get bracket
  db.get('SELECT * FROM playoff_brackets WHERE id = ?', [req.params.bracketId], (err, bracket) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching bracket' })
    }
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket not found' })
    }
    if (bracket.format !== 'round_robin') {
      return res.status(400).json({ error: 'Bracket is not round robin format' })
    }

    // Get top 4 teams from standings
    calculateRoundRobinStandings(req.params.bracketId, (err, standings) => {
      if (err) {
        return res.status(500).json({ error: 'Error calculating standings' })
      }

      if (standings.length < 4) {
        return res.status(400).json({ error: 'Need at least 4 teams to generate elimination bracket' })
      }

      const top4 = standings.slice(0, 4)

      // Create semifinals: #1 vs #4, #2 vs #3
      const semifinal1 = {
        bracket_id: req.params.bracketId,
        round: 1,
        match_number: 1,
        team1_id: top4[0].team_id,
        team2_id: top4[3].team_id,
        match_type: 'semifinal',
        game_date: semifinal_date,
        game_time: semifinal_times[0]
      }

      const semifinal2 = {
        bracket_id: req.params.bracketId,
        round: 1,
        match_number: 2,
        team1_id: top4[1].team_id,
        team2_id: top4[2].team_id,
        match_type: 'semifinal',
        game_date: semifinal_date,
        game_time: semifinal_times[1]
      }

      // Create games and playoff_matches for semifinals
      createEliminationGame(semifinal1, bracket.season_id, (err, sf1Result) => {
        if (err) {
          return res.status(500).json({ error: 'Error creating semifinal 1' })
        }

        createEliminationGame(semifinal2, bracket.season_id, (err, sf2Result) => {
          if (err) {
            return res.status(500).json({ error: 'Error creating semifinal 2' })
          }

          // Create final (championship)
          const championship = {
            bracket_id: req.params.bracketId,
            round: 2,
            match_number: 1,
            team1_id: null, // TBD from semifinals
            team2_id: null,
            match_type: 'final',
            game_date: final_date,
            game_time: final_times[0]
          }

          // Create consolation game
          const consolation = {
            bracket_id: req.params.bracketId,
            round: 2,
            match_number: 2,
            team1_id: null, // TBD from semifinals
            team2_id: null,
            match_type: 'consolation',
            game_date: final_date,
            game_time: final_times[1]
          }

          createEliminationGame(championship, bracket.season_id, (err, champResult) => {
            if (err) {
              return res.status(500).json({ error: 'Error creating championship game' })
            }

            createEliminationGame(consolation, bracket.season_id, (err, consResult) => {
              if (err) {
                return res.status(500).json({ error: 'Error creating consolation game' })
              }

              // Link semifinals to finals
              db.run(
                'UPDATE playoff_matches SET next_match_id = ? WHERE id = ?',
                [champResult.matchId, sf1Result.matchId],
                (err) => {
                  if (err) {
                    console.error('Error linking semifinal 1 to championship:', err)
                  }

                  db.run(
                    'UPDATE playoff_matches SET next_match_id = ? WHERE id = ?',
                    [champResult.matchId, sf2Result.matchId],
                    (err) => {
                      if (err) {
                        console.error('Error linking semifinal 2 to championship:', err)
                      }

                      res.status(201).json({
                        message: 'Elimination bracket generated successfully',
                        semifinals: [sf1Result, sf2Result],
                        championship: champResult,
                        consolation: consResult,
                        top4: top4
                      })
                    }
                  )
                }
              )
            })
          })
        })
      })
    })
  })
})

// Toggle bracket active status
router.put('/:bracketId/toggle', authenticateToken, requireAdmin, (req, res) => {
  db.get(
    'SELECT is_active FROM playoff_brackets WHERE id = ?',
    [req.params.bracketId],
    (err, bracket) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching bracket' })
      }
      if (!bracket) {
        return res.status(404).json({ error: 'Bracket not found' })
      }

      const newStatus = bracket.is_active === 1 ? 0 : 1

      db.run(
        'UPDATE playoff_brackets SET is_active = ? WHERE id = ?',
        [newStatus, req.params.bracketId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating bracket' })
          }
          res.json({ message: 'Bracket status updated', is_active: newStatus })
        }
      )
    }
  )
})

// Delete bracket
router.delete('/:bracketId', authenticateToken, requireAdmin, (req, res) => {
  db.run(
    'DELETE FROM playoff_brackets WHERE id = ?',
    [req.params.bracketId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting bracket' })
      }
      res.json({ message: 'Bracket deleted successfully' })
    }
  )
})

export default router
