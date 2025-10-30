import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireTeamLeagueManager, requirePlayerLeagueManager } from '../middleware/leagueAuth.js'

const router = express.Router()

// Get all players for a team
router.get('/team/:teamId', authenticateToken, (req, res) => {
  db.all(
    `SELECT players.*,
       users.email as user_email, users.phone as user_phone,
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
       teams.season_id as team_season_id,
       leagues.name as league_name,
       seasons.name as season_name,
       CASE WHEN team_captains.user_id IS NOT NULL THEN 1 ELSE 0 END as is_captain,
       CASE WHEN team_captains.user_id IS NOT NULL THEN 'captain' ELSE players.position END as position,
       payments.id as payment_id,
       payments.status as payment_status,
       payments.amount as payment_amount,
       payments.paid_date as payment_paid_date,
       payments.payment_method as payment_method
     FROM players
     LEFT JOIN teams ON teams.id = players.team_id
     LEFT JOIN leagues ON teams.league_id = leagues.id
     LEFT JOIN seasons ON teams.season_id = seasons.id
     LEFT JOIN team_captains ON team_captains.user_id = players.user_id AND team_captains.team_id = players.team_id
     LEFT JOIN (
       SELECT p.*, s.is_active
       FROM payments p
       INNER JOIN seasons s ON p.season_id = s.id
       WHERE s.is_active = 1 AND s.archived = 0
     ) as payments ON payments.player_id = players.id
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
function createPlayerHistory(playerId, userId, teamId, jerseyNumber, playerPosition, playerSubPosition, callback) {
  // First check if this player is/was a captain
  const checkCaptainQuery = userId ?
    'SELECT COUNT(*) as is_captain FROM team_captains WHERE user_id = ? AND team_id = ?' :
    'SELECT 0 as is_captain'

  const captainParams = userId ? [userId, teamId] : []

  db.get(checkCaptainQuery, captainParams, (err, captainResult) => {
    if (err) {
      console.error('Error checking captain status:', err)
    }

    const isCaptain = captainResult?.is_captain ? 1 : 0

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
                `INSERT INTO player_history (player_id, user_id, team_id, season_id, league_id, jersey_number, position, sub_position, is_captain)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [playerId, userId, teamId, seasonId, teamInfo.league_id, jerseyNumber, playerPosition, playerSubPosition, isCaptain],
                callback
              )
            }
          )
        } else {
          db.run(
            `INSERT INTO player_history (player_id, user_id, team_id, season_id, league_id, jersey_number, position, sub_position, is_captain)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [playerId, userId, teamId, teamInfo.season_id, teamInfo.league_id, jerseyNumber, playerPosition, playerSubPosition, isCaptain],
            callback
          )
        }
      }
    )
  })
}

// Create player
router.post('/', authenticateToken, requireTeamLeagueManager, (req, res) => {
  const { team_id, user_id, name, email, phone, jersey_number, email_notifications, position, sub_position } = req.body

  if (!team_id || !name) {
    return res.status(400).json({ error: 'Team ID and name required' })
  }

  // If user_id is provided, create player with provided position/sub_position (team-specific)
  if (user_id) {
    const playerPosition = position || 'player'
    const playerSubPosition = sub_position || null

    db.run(
      'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position, sub_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [team_id, user_id, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, playerPosition, playerSubPosition],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating player' })
        }

        const playerId = this.lastID

        // Create player history entry
        createPlayerHistory(playerId, user_id, team_id, jersey_number, playerPosition, playerSubPosition, (histErr) => {
          if (histErr) {
            console.error('Error creating player history:', histErr)
          }
        })

        res.json({ id: playerId, team_id, user_id, name, email, phone, jersey_number, position: playerPosition, sub_position: playerSubPosition })
      }
    )
  } else {
    // If no user_id provided but email is provided, check if a user exists with that email
    if (email) {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Error checking for existing user' })
        }

        const linkedUserId = existingUser ? existingUser.id : null
        const playerPosition = position || 'player'
        const playerSubPosition = sub_position || null

        db.run(
          'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position, sub_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [team_id, linkedUserId, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, playerPosition, playerSubPosition],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating player' })
            }

            const playerId = this.lastID

            // Create player history entry
            createPlayerHistory(playerId, linkedUserId, team_id, jersey_number, playerPosition, playerSubPosition, (histErr) => {
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
              sub_position: playerSubPosition,
              auto_linked: !!existingUser
            })
          }
        )
      })
    } else {
      // No email provided, create player without user link
      const playerPosition = position || 'player'
      const playerSubPosition = sub_position || null

      db.run(
        'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position, sub_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [team_id, null, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, playerPosition, playerSubPosition],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating player' })
          }

          const playerId = this.lastID

          // Create player history entry
          createPlayerHistory(playerId, null, team_id, jersey_number, playerPosition, playerSubPosition, (histErr) => {
            if (histErr) {
              console.error('Error creating player history:', histErr)
            }
          })

          res.json({ id: playerId, team_id, user_id: null, name, email, phone, jersey_number, position: playerPosition, sub_position: playerSubPosition })
        }
      )
    }
  }
})

// Update player
router.put('/:id', authenticateToken, requirePlayerLeagueManager, (req, res) => {
  const { user_id, name, email, phone, jersey_number, email_notifications, position, sub_position } = req.body

  // Helper function to update player (position/sub_position are team-specific, not synced to users)
  const updatePlayer = (linkedUserId, playerPosition, playerSubPosition) => {
    // Update the player record (position/sub_position are team/league-specific)
    db.run(
      'UPDATE players SET user_id = ?, name = ?, email = ?, phone = ?, jersey_number = ?, email_notifications = ?, position = ?, sub_position = ? WHERE id = ?',
      [linkedUserId, name, email, phone, jersey_number, email_notifications ? 1 : 0, playerPosition, playerSubPosition || null, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating player' })
        }
        res.json({ message: 'Player updated successfully' })
      }
    )
  }

  // If user_id is provided, use the provided position/sub_position
  if (user_id) {
    updatePlayer(user_id, position || 'player', sub_position)
  } else {
    // If no user_id provided but email is provided, check if a user exists with that email
    if (email) {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Error checking for existing user' })
        }

        const linkedUserId = existingUser ? existingUser.id : null
        updatePlayer(linkedUserId, position || 'player', sub_position)
      })
    } else {
      // No email provided, update without user link
      updatePlayer(null, position || 'player', sub_position)
    }
  }
})

// Transfer player to another team
router.patch('/:id/transfer', authenticateToken, (req, res) => {
  const { team_id } = req.body

  if (!team_id) {
    return res.status(400).json({ error: 'Destination team ID required' })
  }

  // Get current player info and source team's league
  db.get(
    `SELECT players.*, teams.league_id as source_league_id
     FROM players
     INNER JOIN teams ON players.team_id = teams.id
     WHERE players.id = ?`,
    [req.params.id],
    (err, player) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player' })
      }

      if (!player) {
        return res.status(404).json({ error: 'Player not found' })
      }

      // Get destination team's league
      db.get(
        'SELECT league_id FROM teams WHERE id = ?',
        [team_id],
        (err, destTeam) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching destination team' })
          }

          if (!destTeam) {
            return res.status(404).json({ error: 'Destination team not found' })
          }

          // CRITICAL: Prevent cross-league transfers
          if (player.source_league_id !== destTeam.league_id) {
            return res.status(400).json({
              error: 'Cannot transfer players between different leagues'
            })
          }

          // Verify user manages this league
          db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err || !user) {
              return res.status(403).json({ error: 'Unauthorized' })
            }

            if (user.role === 'admin') {
              // Admin can proceed
              performTransfer()
            } else {
              // Check if user is a league manager
              db.get(
                'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
                [req.user.id, player.source_league_id],
                (err, manager) => {
                  if (err || !manager) {
                    return res.status(403).json({
                      error: 'Not authorized to transfer players in this league'
                    })
                  }
                  performTransfer()
                }
              )
            }
          })

          function performTransfer() {
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

                // Remove captain status from old team if this player was a captain
                if (player.user_id) {
                  db.run(
                    'DELETE FROM team_captains WHERE user_id = ? AND team_id = ?',
                    [player.user_id, player.team_id],
                    (captainErr) => {
                      if (captainErr) {
                        console.error('Error removing captain status:', captainErr)
                      }
                    }
                  )
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
                      player.sub_position,
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
        }
      )
    }
  )
})

// Delete player
router.delete('/:id', authenticateToken, requirePlayerLeagueManager, (req, res) => {
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
// Supports filtering for league managers - they can only see history from their managed leagues
router.get('/user/:userId/history', authenticateToken, (req, res) => {
  const targetUserId = parseInt(req.params.userId)
  const requestingUserId = req.user.id

  // Check if the requesting user is viewing their own history (always allowed)
  const isOwnHistory = targetUserId === requestingUserId

  // Get requesting user's role
  db.get('SELECT role FROM users WHERE id = ?', [requestingUserId], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // If viewing own history, or if admin, show all history
    if (isOwnHistory || user.role === 'admin') {
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
        [targetUserId],
        (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching user player history' })
          }
          res.json(rows)
        }
      )
      return
    }

    // For league managers viewing other users, filter to only show history from their managed leagues
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
       AND player_history.league_id IN (
         SELECT league_id FROM league_managers WHERE user_id = ?
       )
       ORDER BY player_history.joined_date DESC`,
      [targetUserId, requestingUserId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching user player history' })
        }
        res.json(rows)
      }
    )
  })
})

// Player self-reports payment (marks own payment as paid)
router.post('/:id/self-report-payment', authenticateToken, (req, res) => {
  const { season_id, payment_method, confirmation_number, payment_notes } = req.body
  const player_id = req.params.id

  if (!season_id) {
    return res.status(400).json({ error: 'Season ID is required' })
  }

  if (!payment_method) {
    return res.status(400).json({ error: 'Payment method is required' })
  }

  // Get player and verify ownership or admin
  db.get(
    'SELECT user_id, team_id FROM players WHERE id = ?',
    [player_id],
    (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found' })
      }

      // Verify user owns this player profile or is admin
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role !== 'admin' && player.user_id !== req.user.id) {
          return res.status(403).json({ error: 'You can only report payment for your own profile' })
        }

        // Get season dues amount
        db.get('SELECT season_dues FROM seasons WHERE id = ?', [season_id], (err, season) => {
          if (err || !season) {
            return res.status(404).json({ error: 'Season not found' })
          }

          const amount = season.season_dues || 0

          // Insert or update payment record with self-report
          db.run(
            `INSERT INTO payments (player_id, team_id, season_id, amount, status, payment_method,
                                   confirmation_number, payment_notes, paid_date, marked_paid_by)
             VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, CURRENT_TIMESTAMP, ?)
             ON CONFLICT(player_id, season_id)
             DO UPDATE SET
               status = 'paid',
               payment_method = ?,
               confirmation_number = ?,
               payment_notes = ?,
               paid_date = CURRENT_TIMESTAMP,
               marked_paid_by = ?`,
            [
              player_id, player.team_id, season_id, amount, payment_method,
              confirmation_number, payment_notes, req.user.id,
              payment_method, confirmation_number, payment_notes, req.user.id
            ],
            function (err) {
              if (err) {
                console.error('Error self-reporting payment:', err)
                return res.status(500).json({ error: 'Error reporting payment' })
              }

              res.json({
                message: 'Payment reported successfully',
                id: this.lastID,
                player_id,
                season_id,
                payment_method,
                paid_date: new Date().toISOString(),
                marked_by: req.user.id
              })
            }
          )
        })
      })
    }
  )
})

export default router
