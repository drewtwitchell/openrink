import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireGameLeagueManager } from '../middleware/leagueAuth.js'

const router = express.Router()

// Get all games (public - no auth required)
router.get('/', (req, res) => {
  db.all(
    `SELECT games.*,
       home_team.name as home_team_name, home_team.color as home_team_color,
       away_team.name as away_team_name, away_team.color as away_team_color
     FROM games
     LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
     LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
     ORDER BY games.game_date, games.game_time`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching games' })
      }
      res.json(rows)
    }
  )
})

// Create game
router.post('/', authenticateToken, (req, res) => {
  const {
    home_team_id,
    away_team_id,
    game_date,
    game_time,
    rink_id,
    surface_name,
    season_id,
    location,
    rink_name,
  } = req.body

  if (!home_team_id || !away_team_id || !game_date || !game_time) {
    return res.status(400).json({ error: 'Required fields missing' })
  }

  // Get both teams' leagues
  db.get('SELECT league_id FROM teams WHERE id = ?', [home_team_id], (err, homeTeam) => {
    if (err || !homeTeam) {
      return res.status(404).json({ error: 'Home team not found' })
    }

    db.get('SELECT league_id FROM teams WHERE id = ?', [away_team_id], (err, awayTeam) => {
      if (err || !awayTeam) {
        return res.status(404).json({ error: 'Away team not found' })
      }

      // Verify both teams are in same league
      if (homeTeam.league_id !== awayTeam.league_id) {
        return res.status(400).json({ error: 'Cannot create games between teams from different leagues' })
      }

      // Verify user manages this league
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role === 'admin') {
          createGame()
        } else {
          db.get(
            'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
            [req.user.id, homeTeam.league_id],
            (err, manager) => {
              if (err || !manager) {
                return res.status(403).json({ error: 'Not authorized to manage this league' })
              }
              createGame()
            }
          )
        }
      })

      function createGame() {
        db.run(
          'INSERT INTO games (home_team_id, away_team_id, game_date, game_time, rink_id, surface_name, season_id, location, rink_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [home_team_id, away_team_id, game_date, game_time, rink_id, surface_name || 'NHL', season_id || null, location || null, rink_name || null],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating game' })
            }
            res.json({ id: this.lastID })
          }
        )
      }
    })
  })
})

// Update game
router.put('/:id', authenticateToken, requireGameLeagueManager, (req, res) => {
  const {
    home_team_id,
    away_team_id,
    game_date,
    game_time,
    rink_id,
    surface_name,
    location,
    rink_name,
    home_score,
    away_score,
    player_stats,
  } = req.body

  if (!home_team_id || !away_team_id || !game_date || !game_time) {
    return res.status(400).json({ error: 'Required fields missing' })
  }

  // If player_stats is provided, validate and process with transaction
  if (player_stats && Array.isArray(player_stats) && player_stats.length > 0) {
    // First, get the game to validate player teams
    db.get('SELECT home_team_id, away_team_id FROM games WHERE id = ?', [req.params.id], (err, game) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching game' })
      }
      if (!game) {
        return res.status(404).json({ error: 'Game not found' })
      }

      // Validate all players belong to one of the teams
      const playerIds = player_stats.map(stat => stat.player_id)
      const placeholders = playerIds.map(() => '?').join(',')

      db.all(
        `SELECT id, team_id FROM players WHERE id IN (${placeholders})`,
        playerIds,
        (err, players) => {
          if (err) {
            return res.status(500).json({ error: 'Error validating players' })
          }

          // Check that all players exist and belong to one of the game teams
          for (const stat of player_stats) {
            const player = players.find(p => p.id === stat.player_id)
            if (!player) {
              return res.status(400).json({
                error: `Player ${stat.player_id} not found`
              })
            }
            if (player.team_id !== home_team_id && player.team_id !== away_team_id) {
              return res.status(400).json({
                error: `Player ${stat.player_id} does not belong to either team in this game`
              })
            }

            // Validate stat values
            if (stat.goals < 0 || stat.assists < 0 || stat.penalty_minutes < 0) {
              return res.status(400).json({
                error: 'Stats values cannot be negative'
              })
            }
          }

          // All validations passed, proceed with transaction
          db.serialize(() => {
            db.run('BEGIN TRANSACTION')

            // Update game
            db.run(
              'UPDATE games SET home_team_id = ?, away_team_id = ?, game_date = ?, game_time = ?, rink_id = ?, surface_name = ?, location = ?, rink_name = ?, home_score = ?, away_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [home_team_id, away_team_id, game_date, game_time, rink_id, surface_name || 'NHL', location || null, rink_name || null, home_score !== '' && home_score !== null && home_score !== undefined ? home_score : null, away_score !== '' && away_score !== null && away_score !== undefined ? away_score : null, req.params.id],
              function (err) {
                if (err) {
                  db.run('ROLLBACK')
                  return res.status(500).json({ error: 'Error updating game' })
                }

                // Process player stats
                let statsProcessed = 0
                let statsError = null

                player_stats.forEach((stat) => {
                  db.run(
                    `INSERT INTO game_stats (game_id, player_id, goals, assists, penalty_minutes, updated_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(game_id, player_id)
                     DO UPDATE SET goals = ?, assists = ?, penalty_minutes = ?, updated_at = CURRENT_TIMESTAMP`,
                    [
                      req.params.id,
                      stat.player_id,
                      stat.goals || 0,
                      stat.assists || 0,
                      stat.penalty_minutes || 0,
                      stat.goals || 0,
                      stat.assists || 0,
                      stat.penalty_minutes || 0
                    ],
                    function (err) {
                      if (err && !statsError) {
                        statsError = err
                      }

                      statsProcessed++
                      if (statsProcessed === player_stats.length) {
                        if (statsError) {
                          db.run('ROLLBACK')
                          return res.status(500).json({ error: 'Error saving player stats' })
                        } else {
                          db.run('COMMIT')
                          return res.json({
                            message: 'Game and player stats updated successfully',
                            stats_updated: player_stats.length
                          })
                        }
                      }
                    }
                  )
                })
              }
            )
          })
        }
      )
    })
  } else {
    // No player stats, just update the game
    db.run(
      'UPDATE games SET home_team_id = ?, away_team_id = ?, game_date = ?, game_time = ?, rink_id = ?, surface_name = ?, location = ?, rink_name = ?, home_score = ?, away_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [home_team_id, away_team_id, game_date, game_time, rink_id, surface_name || 'NHL', location || null, rink_name || null, home_score !== '' && home_score !== null && home_score !== undefined ? home_score : null, away_score !== '' && away_score !== null && away_score !== undefined ? away_score : null, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating game' })
        }
        res.json({ message: 'Game updated successfully' })
      }
    )
  }
})

// Update game score
router.put('/:id/score', authenticateToken, requireGameLeagueManager, (req, res) => {
  const { home_score, away_score } = req.body

  db.run(
    'UPDATE games SET home_score = ?, away_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [home_score, away_score, 'completed', req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating game' })
      }
      res.json({ message: 'Game score updated successfully' })
    }
  )
})

// Delete game
router.delete('/:id', authenticateToken, requireGameLeagueManager, (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting game' })
    }
    res.json({ message: 'Game deleted successfully' })
  })
})

// Get player stats for a specific game
router.get('/:id/stats', (req, res) => {
  db.all(
    `SELECT
      gs.id,
      gs.game_id,
      gs.player_id,
      gs.goals,
      gs.assists,
      gs.penalty_minutes,
      gs.created_at,
      gs.updated_at,
      p.name as player_name,
      p.jersey_number,
      p.team_id,
      t.name as team_name,
      t.color as team_color,
      (gs.goals + gs.assists) as total_points
     FROM game_stats gs
     JOIN players p ON gs.player_id = p.id
     JOIN teams t ON p.team_id = t.id
     WHERE gs.game_id = ?
     ORDER BY total_points DESC, gs.goals DESC, p.name ASC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching game stats' })
      }
      res.json(rows)
    }
  )
})

// Get attendance for a game
router.get('/:id/attendance', authenticateToken, (req, res) => {
  db.all(
    `SELECT ga.*, p.name as player_name, p.jersey_number, p.team_id, p.position, p.sub_position
     FROM game_attendance ga
     JOIN players p ON ga.player_id = p.id
     WHERE ga.game_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching attendance' })
      }
      res.json(rows)
    }
  )
})

// Update player attendance for a game
router.post('/:id/attendance', authenticateToken, (req, res) => {
  const { player_id, status } = req.body
  const game_id = req.params.id

  if (!player_id || !status) {
    return res.status(400).json({ error: 'Player ID and status are required' })
  }

  if (!['attending', 'not_attending', 'maybe'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: attending, not_attending, or maybe' })
  }

  // Insert or update attendance record
  db.run(
    `INSERT INTO game_attendance (game_id, player_id, status, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(game_id, player_id)
     DO UPDATE SET status = ?, updated_at = CURRENT_TIMESTAMP`,
    [game_id, player_id, status, status],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating attendance' })
      }
      res.json({
        message: 'Attendance updated successfully',
        id: this.lastID,
        game_id,
        player_id,
        status
      })
    }
  )
})

export default router
