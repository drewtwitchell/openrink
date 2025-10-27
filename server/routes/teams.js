import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all teams
router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT teams.*, leagues.name as league_name
     FROM teams
     LEFT JOIN leagues ON teams.league_id = leagues.id
     ORDER BY teams.name`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching teams' })
      }
      res.json(rows)
    }
  )
})

// Create team
router.post('/', authenticateToken, (req, res) => {
  const { name, league_id, color } = req.body

  if (!name || !league_id) {
    return res.status(400).json({ error: 'Team name and league required' })
  }

  db.run(
    'INSERT INTO teams (name, league_id, color) VALUES (?, ?, ?)',
    [name, league_id, color || '#0284c7'],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating team' })
      }
      res.json({ id: this.lastID, name, league_id, color })
    }
  )
})

// Delete team
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM teams WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting team' })
    }
    res.json({ message: 'Team deleted successfully' })
  })
})

export default router
