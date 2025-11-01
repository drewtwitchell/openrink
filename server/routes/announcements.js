import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get active announcements for a league (public)
router.get('/league/:leagueId', (req, res) => {
  const now = new Date().toISOString()

  db.all(
    `SELECT announcements.*, users.name as author_name,
       games.game_date, games.game_time,
       home_team.name as home_team_name, home_team.color as home_team_color,
       away_team.name as away_team_name, away_team.color as away_team_color,
       games.rink_name, games.location
     FROM announcements
     LEFT JOIN users ON announcements.created_by = users.id
     LEFT JOIN games ON announcements.game_id = games.id
     LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
     LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
     WHERE announcements.league_id = ?
       AND announcements.is_active = 1
       AND (announcements.expires_at IS NULL OR announcements.expires_at > ?)
     ORDER BY
       CASE WHEN announcements.announcement_type = 'sub_request' THEN 0 ELSE 1 END,
       announcements.created_at DESC`,
    [req.params.leagueId, now],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching announcements' })
      }
      res.json(rows)
    }
  )
})

// Get all announcements for a league (admins/league managers only)
router.get('/league/:leagueId/all', authenticateToken, (req, res) => {
  // Check if user is admin or league manager for this league
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const query = `SELECT announcements.*, users.name as author_name,
       games.game_date, games.game_time,
       home_team.name as home_team_name, home_team.color as home_team_color,
       away_team.name as away_team_name, away_team.color as away_team_color,
       games.rink_name, games.location
     FROM announcements
     LEFT JOIN users ON announcements.created_by = users.id
     LEFT JOIN games ON announcements.game_id = games.id
     LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
     LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
     WHERE announcements.league_id = ?
     ORDER BY announcements.created_at DESC`

    // Allow if admin
    if (user.role === 'admin') {
      db.all(query, [req.params.leagueId], (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching announcements' })
        }
        res.json(rows)
      })
      return
    }

    // Check if user is a league manager for this specific league
    db.get(
      'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
      [req.user.id, req.params.leagueId],
      (err, manager) => {
        if (err || !manager) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        db.all(query, [req.params.leagueId], (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching announcements' })
          }
          res.json(rows)
        })
      }
    )
  })
})

// Create announcement (admins/league managers/team captains for sub requests)
router.post('/', authenticateToken, (req, res) => {
  const { league_id, title, message, expires_at, game_id, announcement_type } = req.body

  if (!league_id || !title || !message) {
    return res.status(400).json({ error: 'League ID, title, and message required' })
  }

  // Check if user is admin or league manager for this league
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const createAnnouncement = () => {
      db.run(
        'INSERT INTO announcements (league_id, title, message, created_by, expires_at, game_id, announcement_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [league_id, title, message, req.user.id, expires_at || null, game_id || null, announcement_type || 'general'],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating announcement' })
          }

          const announcementId = this.lastID

          // For sub_request announcements, send email notifications to all players in the league and league managers
          if (announcement_type === 'sub_request') {
            // Get all players in the league (via teams)
            db.all(
              `SELECT DISTINCT p.email, p.name, u.email as user_email, u.name as user_name
               FROM players p
               LEFT JOIN users u ON p.user_id = u.id
               INNER JOIN teams t ON p.team_id = t.id
               WHERE t.league_id = ?
               AND (p.email IS NOT NULL OR u.email IS NOT NULL)`,
              [league_id],
              (err, players) => {
                if (err) {
                  console.error('Error fetching players for email notification:', err)
                }

                // Get league managers
                db.all(
                  `SELECT u.email, u.name
                   FROM users u
                   INNER JOIN league_managers lm ON u.id = lm.user_id
                   WHERE lm.league_id = ?
                   AND u.email IS NOT NULL`,
                  [league_id],
                  (err, managers) => {
                    if (err) {
                      console.error('Error fetching league managers for email notification:', err)
                    }

                    // Get captain info
                    db.get('SELECT name, email FROM users WHERE id = ?', [req.user.id], (err, captain) => {
                      if (err) {
                        console.error('Error fetching captain info:', err)
                      }

                      // Get game info
                      db.get(
                        `SELECT g.game_date, g.game_time, g.rink_name, g.location,
                                ht.name as home_team_name, at.name as away_team_name
                         FROM games g
                         INNER JOIN teams ht ON g.home_team_id = ht.id
                         INNER JOIN teams at ON g.away_team_id = at.id
                         WHERE g.id = ?`,
                        [game_id],
                        (err, game) => {
                          if (err) {
                            console.error('Error fetching game info:', err)
                          }

                          // Prepare email details
                          const allRecipients = [
                            ...(players || []).map(p => ({
                              email: p.user_email || p.email,
                              name: p.user_name || p.name
                            })),
                            ...(managers || [])
                          ]

                          console.log('====================================')
                          console.log('SUB REQUEST EMAIL NOTIFICATION')
                          console.log('====================================')
                          console.log('From:', captain?.email || 'unknown')
                          console.log('Captain Name:', captain?.name || 'unknown')
                          console.log('Subject:', `Sub Needed: ${title}`)
                          console.log('Game:', game ? `${game.home_team_name} vs ${game.away_team_name}` : 'unknown')
                          console.log('Date:', game?.game_date || 'unknown')
                          console.log('Time:', game?.game_time || 'unknown')
                          console.log('Location:', game?.rink_name || game?.location || 'unknown')
                          console.log('Message:', message)
                          console.log('Recipients:', allRecipients.length)
                          allRecipients.forEach(r => console.log(`  - ${r.name} <${r.email}>`))
                          console.log('====================================')
                          console.log('TODO: Implement actual email sending')
                          console.log('====================================')
                        }
                      )
                    })
                  }
                )
              }
            )
          }

          res.json({ id: announcementId, league_id, title, message, expires_at, game_id, announcement_type })
        }
      )
    }

    // Allow if admin
    if (user.role === 'admin') {
      createAnnouncement()
      return
    }

    // Check if user is a league manager for this specific league
    db.get(
      'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
      [req.user.id, league_id],
      (err, manager) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' })
        }

        if (manager) {
          createAnnouncement()
          return
        }

        // For sub_request announcements, check if user is a team captain for a team in the game
        if (announcement_type === 'sub_request' && game_id) {
          db.get(
            `SELECT tc.id FROM team_captains tc
             INNER JOIN games g ON (tc.team_id = g.home_team_id OR tc.team_id = g.away_team_id)
             WHERE tc.user_id = ? AND g.id = ?`,
            [req.user.id, game_id],
            (err, captain) => {
              if (err || !captain) {
                return res.status(403).json({ error: 'Unauthorized - must be admin, league manager, or team captain for this game' })
              }
              createAnnouncement()
            }
          )
          return
        }

        return res.status(403).json({ error: 'Unauthorized' })
      }
    )
  })
})

// Update announcement (admins/league managers only)
router.put('/:id', authenticateToken, (req, res) => {
  const { title, message, expires_at, is_active } = req.body

  // First get the announcement to check its league_id
  db.get('SELECT league_id FROM announcements WHERE id = ?', [req.params.id], (err, announcement) => {
    if (err || !announcement) {
      return res.status(404).json({ error: 'Announcement not found' })
    }

    // Check if user is admin or league manager
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      const updateAnnouncement = () => {
        db.run(
          'UPDATE announcements SET title = ?, message = ?, expires_at = ?, is_active = ? WHERE id = ?',
          [title, message, expires_at || null, is_active !== undefined ? is_active : 1, req.params.id],
          function (err) {
            if (err) {
              return res.status(500).json({ error: 'Error updating announcement' })
            }
            res.json({ message: 'Announcement updated successfully' })
          }
        )
      }

      // Allow if admin
      if (user.role === 'admin') {
        updateAnnouncement()
        return
      }

      // Check if user is a league manager for this announcement's league
      db.get(
        'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
        [req.user.id, announcement.league_id],
        (err, manager) => {
          if (err || !manager) {
            return res.status(403).json({ error: 'Unauthorized' })
          }
          updateAnnouncement()
        }
      )
    })
  })
})

// Delete announcement (admins/league managers only)
router.delete('/:id', authenticateToken, (req, res) => {
  // First get the announcement to check its league_id
  db.get('SELECT league_id FROM announcements WHERE id = ?', [req.params.id], (err, announcement) => {
    if (err || !announcement) {
      return res.status(404).json({ error: 'Announcement not found' })
    }

    // Check if user is admin or league manager
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      const deleteAnnouncement = () => {
        db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error deleting announcement' })
          }
          res.json({ message: 'Announcement deleted successfully' })
        })
      }

      // Allow if admin
      if (user.role === 'admin') {
        deleteAnnouncement()
        return
      }

      // Check if user is a league manager for this announcement's league
      db.get(
        'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
        [req.user.id, announcement.league_id],
        (err, manager) => {
          if (err || !manager) {
            return res.status(403).json({ error: 'Unauthorized' })
          }
          deleteAnnouncement()
        }
      )
    })
  })
})

// Notify captain that player is available to sub
router.post('/:id/notify-available', authenticateToken, (req, res) => {
  const announcementId = req.params.id
  const { message } = req.body

  // Get the announcement with game and league info
  db.get(
    `SELECT a.*, a.created_by as captain_user_id,
            u.email as captain_email, u.name as captain_name,
            g.home_team_id, g.away_team_id, g.game_date, g.game_time,
            ht.name as home_team_name, at.name as away_team_name
     FROM announcements a
     JOIN users u ON a.created_by = u.id
     LEFT JOIN games g ON a.game_id = g.id
     LEFT JOIN teams ht ON g.home_team_id = ht.id
     LEFT JOIN teams at ON g.away_team_id = at.id
     WHERE a.id = ? AND a.announcement_type = 'sub_request'`,
    [announcementId],
    (err, announcement) => {
      if (err || !announcement) {
        return res.status(404).json({ error: 'Announcement not found' })
      }

      // Get player info
      db.get(
        'SELECT id, name, email, phone FROM users WHERE id = ?',
        [req.user.id],
        (err, player) => {
          if (err || !player) {
            return res.status(404).json({ error: 'Player not found' })
          }

          // Check if this player already notified for this announcement
          db.get(
            'SELECT id FROM sub_availability_notifications WHERE announcement_id = ? AND player_user_id = ?',
            [announcementId, req.user.id],
            (err, existing) => {
              if (existing) {
                return res.status(400).json({ error: 'You have already indicated availability for this game' })
              }

              // Get or create player record for the user
              db.get(
                'SELECT id FROM players WHERE user_id = ?',
                [req.user.id],
                (err, playerRecord) => {
                  let playerId = playerRecord?.id

                  const completeSubRequest = () => {
                    // Add player to game attendance with is_sub=1
                    if (announcement.game_id && playerId) {
                      db.run(
                        `INSERT OR REPLACE INTO game_attendance (game_id, player_id, status, is_sub, updated_at)
                         VALUES (?, ?, 'attending', 1, CURRENT_TIMESTAMP)`,
                        [announcement.game_id, playerId],
                        (err) => {
                          if (err) console.error('Error adding game attendance:', err)
                        }
                      )
                    }

                    // Get league managers
                    db.all(
                      `SELECT u.name, u.email
                       FROM league_managers lm
                       JOIN users u ON lm.user_id = u.id
                       WHERE lm.league_id = ?`,
                      [announcement.league_id],
                      (err, managers) => {
                        if (err) console.error('Error fetching league managers:', err)

                        // Get team captains
                        db.all(
                          `SELECT DISTINCT u.name, u.email
                           FROM team_captains tc
                           JOIN users u ON tc.user_id = u.id
                           WHERE tc.team_id IN (?, ?)`,
                          [announcement.home_team_id, announcement.away_team_id],
                          (err, captains) => {
                            if (err) console.error('Error fetching team captains:', err)

                            // Combine all recipients
                            const recipients = [
                              { name: announcement.captain_name, email: announcement.captain_email },
                              ...(managers || []),
                              ...(captains || [])
                            ].filter((r, index, self) =>
                              r.email && index === self.findIndex(t => t.email === r.email)
                            )

                            // Log email details (TODO: Implement actual email sending)
                            console.log('\n')
                            console.log('====================================================')
                            console.log('       SUB REQUEST ACCEPTED - EMAIL NOTIFICATION')
                            console.log('====================================================')
                            console.log('')
                            console.log('FROM (Player confirming):')
                            console.log(`  Name:  ${player.name}`)
                            console.log(`  Email: ${player.email}`)
                            console.log(`  Phone: ${player.phone || 'Not provided'}`)
                            console.log('')
                            console.log('TO (Recipients):')
                            recipients.forEach(r => console.log(`  - ${r.name} <${r.email}>`))
                            console.log('')
                            console.log('SUBJECT:')
                            console.log(`  Sub Available: ${announcement.home_team_name} vs ${announcement.away_team_name}`)
                            console.log('')
                            console.log('GAME DETAILS:')
                            console.log(`  Date: ${announcement.game_date}`)
                            console.log(`  Time: ${announcement.game_time}`)
                            console.log(`  Teams: ${announcement.home_team_name} vs ${announcement.away_team_name}`)
                            console.log('')
                            if (message) {
                              console.log('PLAYER MESSAGE:')
                              console.log(`  "${message}"`)
                              console.log('')
                            }
                            console.log('STATUS: Email notification logged (waiting for email service implementation)')
                            console.log('====================================================')
                            console.log('')

                            // Create notification record
                            db.run(
                              `INSERT INTO sub_availability_notifications
                               (announcement_id, player_user_id, captain_user_id, player_name, player_email, player_phone, message)
                               VALUES (?, ?, ?, ?, ?, ?, ?)`,
                              [announcementId, req.user.id, announcement.captain_user_id, player.name, player.email, player.phone, message || null],
                              function(err) {
                                if (err) {
                                  console.error('Error creating notification:', err)
                                  return res.status(500).json({ error: 'Error creating notification' })
                                }

                                // Deactivate the announcement
                                db.run(
                                  'UPDATE announcements SET is_active = 0 WHERE id = ?',
                                  [announcementId],
                                  (err) => {
                                    if (err) console.error('Error deactivating announcement:', err)

                                    res.json({
                                      message: 'You have been added to the game and captains/managers have been notified!',
                                      notificationId: this.lastID
                                    })
                                  }
                                )
                              }
                            )
                          }
                        )
                      }
                    )
                  }

                  // If player record doesn't exist, create a temporary one
                  if (!playerId) {
                    // Get user's first team to link player record
                    db.get(
                      'SELECT id FROM teams WHERE league_id = ? LIMIT 1',
                      [announcement.league_id],
                      (err, team) => {
                        if (team) {
                          db.run(
                            'INSERT INTO players (user_id, team_id, name, email, phone) VALUES (?, ?, ?, ?, ?)',
                            [req.user.id, team.id, player.name, player.email, player.phone],
                            function(err) {
                              if (!err) {
                                playerId = this.lastID
                              }
                              completeSubRequest()
                            }
                          )
                        } else {
                          completeSubRequest()
                        }
                      }
                    )
                  } else {
                    completeSubRequest()
                  }
                }
              )
            }
          )
        }
      )
    }
  )
})

// Get sub availability notifications for captain
router.get('/notifications/sub-availability', authenticateToken, (req, res) => {
  db.all(
    `SELECT san.*,
       a.title as announcement_title,
       g.game_date, g.game_time,
       home_team.name as home_team_name,
       away_team.name as away_team_name,
       r.name as rink_name
     FROM sub_availability_notifications san
     JOIN announcements a ON san.announcement_id = a.id
     LEFT JOIN games g ON a.game_id = g.id
     LEFT JOIN teams home_team ON g.home_team_id = home_team.id
     LEFT JOIN teams away_team ON g.away_team_id = away_team.id
     LEFT JOIN rinks r ON g.rink_id = r.id
     WHERE san.captain_user_id = ?
     ORDER BY san.is_read ASC, san.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching notifications:', err)
        return res.status(500).json({ error: 'Error fetching notifications' })
      }
      res.json(rows)
    }
  )
})

// Mark notification as read
router.put('/notifications/sub-availability/:id/read', authenticateToken, (req, res) => {
  // Verify this notification belongs to the user
  db.get(
    'SELECT captain_user_id FROM sub_availability_notifications WHERE id = ?',
    [req.params.id],
    (err, notification) => {
      if (err || !notification) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      if (notification.captain_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      db.run(
        'UPDATE sub_availability_notifications SET is_read = 1 WHERE id = ?',
        [req.params.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error updating notification' })
          }
          res.json({ message: 'Notification marked as read' })
        }
      )
    }
  )
})

export default router
