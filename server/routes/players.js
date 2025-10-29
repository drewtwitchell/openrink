import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all players for a team
router.get('/team/:teamId', authenticateToken, (req, res) => {
  db.all(
    `SELECT players.*,
       users.email as user_email, users.phone as user_phone, users.position as user_position,
       CASE WHEN team_captains.user_id IS NOT NULL THEN 1 ELSE 0 END as is_captain
     FROM players
     LEFT JOIN users ON players.user_id = users.id
     LEFT JOIN team_captains ON team_captains.user_id = players.user_id AND team_captains.team_id = players.team_id
     WHERE players.team_id = ?
     ORDER BY jersey_number, name`,
    [req.params.teamId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching players' })
      }
      res.json(rows)
    }
  )
})

// Get all players (public - no auth required)
router.get('/', (req, res) => {
  db.all(
    `SELECT players.*,
       teams.name as team_name,
       teams.color as team_color,
       teams.league_id as team_league_id,
       CASE WHEN team_captains.user_id IS NOT NULL THEN 1 ELSE 0 END as is_captain,
       CASE WHEN team_captains.user_id IS NOT NULL THEN 'captain' ELSE players.position END as position
     FROM players
     LEFT JOIN teams ON teams.id = players.team_id
     LEFT JOIN team_captains ON team_captains.user_id = players.user_id AND team_captains.team_id = players.team_id
     ORDER BY name`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching players' })
      }
      res.json(rows)
    }
  )
})

// Helper function to create player history entry
function createPlayerHistory(playerId, userId, teamId, jerseyNumber, playerPosition, callback) {
  // Get team's league_id and season_id
  db.get(
    `SELECT teams.league_id, teams.season_id
     FROM teams
     WHERE teams.id = ?`,
    [teamId],
    (err, teamInfo) => {
      if (err) {
        return callback(err)
      }

      if (!teamInfo) {
        return callback(new Error('Team not found'))
      }

      // If no season_id on team, try to get active season for the league
      if (!teamInfo.season_id) {
        db.get(
          'SELECT id FROM seasons WHERE league_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
          [teamInfo.league_id],
          (err, season) => {
            if (err) {
              return callback(err)
            }

            const seasonId = season?.id || null

            db.run(
              `INSERT INTO player_history (player_id, user_id, team_id, season_id, league_id, jersey_number, position)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [playerId, userId, teamId, seasonId, teamInfo.league_id, jerseyNumber, playerPosition],
              callback
            )
          }
        )
      } else {
        db.run(
          `INSERT INTO player_history (player_id, user_id, team_id, season_id, league_id, jersey_number, position)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [playerId, userId, teamId, teamInfo.season_id, teamInfo.league_id, jerseyNumber, playerPosition],
          callback
        )
      }
    }
  )
}

// Create player
router.post('/', authenticateToken, (req, res) => {
  const { team_id, user_id, name, email, phone, jersey_number, email_notifications, position } = req.body

  if (!team_id || !name) {
    return res.status(400).json({ error: 'Team ID and name required' })
  }

  // If user_id is provided, get position from user, otherwise use provided position
  if (user_id) {
    db.get('SELECT position FROM users WHERE id = ?', [user_id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching user' })
      }

      const playerPosition = user?.position || position || 'player'

      db.run(
        'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [team_id, user_id, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, playerPosition],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating player' })
          }

          const playerId = this.lastID

          // Create player history entry
          createPlayerHistory(playerId, user_id, team_id, jersey_number, playerPosition, (histErr) => {
            if (histErr) {
              console.error('Error creating player history:', histErr)
            }
          })

          res.json({ id: playerId, team_id, user_id, name, email, phone, jersey_number, position: playerPosition })
        }
      )
    })
  } else {
    // If no user_id provided but email is provided, check if a user exists with that email
    if (email) {
      db.get('SELECT id, position FROM users WHERE email = ?', [email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Error checking for existing user' })
        }

        const linkedUserId = existingUser ? existingUser.id : null
        const playerPosition = existingUser ? existingUser.position : (position || 'player')

        db.run(
          'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [team_id, linkedUserId, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, playerPosition],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating player' })
            }

            const playerId = this.lastID

            // Create player history entry
            createPlayerHistory(playerId, linkedUserId, team_id, jersey_number, playerPosition, (histErr) => {
              if (histErr) {
                console.error('Error creating player history:', histErr)
              }
            })

            res.json({
              id: playerId,
              team_id,
              user_id: linkedUserId,
              name,
              email,
              phone,
              jersey_number,
              position: playerPosition,
              auto_linked: !!existingUser
            })
          }
        )
      })
    } else {
      // No email provided, create player without user link
      db.run(
        'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [team_id, null, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, position || 'player'],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating player' })
          }

          const playerId = this.lastID

          // Create player history entry
          createPlayerHistory(playerId, null, team_id, jersey_number, position || 'player', (histErr) => {
            if (histErr) {
              console.error('Error creating player history:', histErr)
            }
          })

          res.json({ id: playerId, team_id, user_id: null, name, email, phone, jersey_number, position: position || 'player' })
        }
      )
    }
  }
})

// Update player
router.put('/:id', authenticateToken, (req, res) => {
  const { user_id, name, email, phone, jersey_number, email_notifications, position } = req.body

  // If user_id is provided, get position from user, otherwise use provided position
  if (user_id) {
    db.get('SELECT position FROM users WHERE id = ?', [user_id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching user' })
      }

      const playerPosition = user?.position || position || 'player'

      db.run(
        'UPDATE players SET user_id = ?, name = ?, email = ?, phone = ?, jersey_number = ?, email_notifications = ?, position = ? WHERE id = ?',
        [user_id, name, email, phone, jersey_number, email_notifications ? 1 : 0, playerPosition, req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating player' })
          }
          res.json({ message: 'Player updated successfully' })
        }
      )
    })
  } else {
    // If no user_id provided but email is provided, check if a user exists with that email
    if (email) {
      db.get('SELECT id, position FROM users WHERE email = ?', [email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Error checking for existing user' })
        }

        const linkedUserId = existingUser ? existingUser.id : null
        const playerPosition = existingUser ? existingUser.position : (position || 'player')

        db.run(
          'UPDATE players SET user_id = ?, name = ?, email = ?, phone = ?, jersey_number = ?, email_notifications = ?, position = ? WHERE id = ?',
          [linkedUserId, name, email, phone, jersey_number, email_notifications ? 1 : 0, playerPosition, req.params.id],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Error updating player' })
            }
            res.json({ message: 'Player updated successfully', auto_linked: !!existingUser })
          }
        )
      })
    } else {
      // No email provided, update without user link
      db.run(
        'UPDATE players SET user_id = ?, name = ?, email = ?, phone = ?, jersey_number = ?, email_notifications = ?, position = ? WHERE id = ?',
        [null, name, email, phone, jersey_number, email_notifications ? 1 : 0, position || 'player', req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating player' })
          }
          res.json({ message: 'Player updated successfully' })
        }
      )
    }
  }
})

// Transfer player to another team
router.patch('/:id/transfer', authenticateToken, (req, res) => {
  const { team_id } = req.body

  if (!team_id) {
    return res.status(400).json({ error: 'Destination team ID required' })
  }

  // Get current player info before transfer
  db.get(
    'SELECT * FROM players WHERE id = ?',
    [req.params.id],
    (err, player) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player' })
      }

      if (!player) {
        return res.status(404).json({ error: 'Player not found' })
      }

      // Close out old team history entry (set left_date to now)
      db.run(
        `UPDATE player_history
         SET left_date = CURRENT_TIMESTAMP
         WHERE player_id = ? AND team_id = ? AND left_date IS NULL`,
        [req.params.id, player.team_id],
        (histErr) => {
          if (histErr) {
            console.error('Error closing player history:', histErr)
          }

          // Update player's team
          db.run(
            'UPDATE players SET team_id = ? WHERE id = ?',
            [team_id, req.params.id],
            function (err) {
              if (err) {
                return res.status(500).json({ error: 'Error transferring player' })
              }

              // Create new history entry for new team
              createPlayerHistory(
                player.id,
                player.user_id,
                team_id,
                player.jersey_number,
                player.position,
                (newHistErr) => {
                  if (newHistErr) {
                    console.error('Error creating new player history:', newHistErr)
                  }
                }
              )

              res.json({ message: 'Player transferred successfully' })
            }
          )
        }
      )
    }
  )
})

// Delete player
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM players WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting player' })
    }
    res.json({ message: 'Player deleted successfully' })
  })
})

// Get player history by player ID
router.get('/:id/history', authenticateToken, (req, res) => {
  db.all(
    `SELECT
       player_history.*,
       teams.name as team_name,
       teams.color as team_color,
       leagues.name as league_name,
       seasons.name as season_name
     FROM player_history
     LEFT JOIN teams ON player_history.team_id = teams.id
     LEFT JOIN leagues ON player_history.league_id = leagues.id
     LEFT JOIN seasons ON player_history.season_id = seasons.id
     WHERE player_history.player_id = ?
     ORDER BY player_history.joined_date DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player history' })
      }
      res.json(rows)
    }
  )
})

// Get player history by user ID (across all player records)
router.get('/user/:userId/history', authenticateToken, (req, res) => {
  db.all(
    `SELECT
       player_history.*,
       teams.name as team_name,
       teams.color as team_color,
       leagues.name as league_name,
       seasons.name as season_name,
       players.name as player_name,
       players.jersey_number as current_jersey_number
     FROM player_history
     LEFT JOIN teams ON player_history.team_id = teams.id
     LEFT JOIN leagues ON player_history.league_id = leagues.id
     LEFT JOIN seasons ON player_history.season_id = seasons.id
     LEFT JOIN players ON player_history.player_id = players.id
     WHERE player_history.user_id = ?
     ORDER BY player_history.joined_date DESC`,
    [req.params.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching user player history' })
      }
      res.json(rows)
    }
  )
})

export default router
