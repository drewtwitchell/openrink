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

// Get all players
router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT players.*,
       users.email as user_email, users.phone as user_phone, users.position as user_position
     FROM players
     LEFT JOIN users ON players.user_id = users.id
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
          res.json({ id: this.lastID, team_id, user_id, name, email, phone, jersey_number, position: playerPosition })
        }
      )
    })
  } else {
    db.run(
      'INSERT INTO players (team_id, user_id, name, email, phone, jersey_number, email_notifications, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [team_id, null, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0, position || 'player'],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating player' })
        }
        res.json({ id: this.lastID, team_id, user_id: null, name, email, phone, jersey_number, position: position || 'player' })
      }
    )
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
})

// Transfer player to another team
router.patch('/:id/transfer', authenticateToken, (req, res) => {
  const { team_id } = req.body

  if (!team_id) {
    return res.status(400).json({ error: 'Destination team ID required' })
  }

  db.run(
    'UPDATE players SET team_id = ? WHERE id = ?',
    [team_id, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error transferring player' })
      }
      res.json({ message: 'Player transferred successfully' })
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

export default router
