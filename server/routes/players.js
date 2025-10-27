import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all players for a team
router.get('/team/:teamId', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM players WHERE team_id = ? ORDER BY jersey_number, name',
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
  db.all('SELECT * FROM players ORDER BY name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching players' })
    }
    res.json(rows)
  })
})

// Create player
router.post('/', authenticateToken, (req, res) => {
  const { team_id, name, email, phone, jersey_number, email_notifications } = req.body

  if (!team_id || !name) {
    return res.status(400).json({ error: 'Team ID and name required' })
  }

  db.run(
    'INSERT INTO players (team_id, name, email, phone, jersey_number, email_notifications) VALUES (?, ?, ?, ?, ?, ?)',
    [team_id, name, email, phone, jersey_number, email_notifications !== false ? 1 : 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating player' })
      }
      res.json({ id: this.lastID, team_id, name, email, phone, jersey_number })
    }
  )
})

// Update player
router.put('/:id', authenticateToken, (req, res) => {
  const { name, email, phone, jersey_number, email_notifications } = req.body

  db.run(
    'UPDATE players SET name = ?, email = ?, phone = ?, jersey_number = ?, email_notifications = ? WHERE id = ?',
    [name, email, phone, jersey_number, email_notifications ? 1 : 0, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating player' })
      }
      res.json({ message: 'Player updated successfully' })
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
