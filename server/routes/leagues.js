import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all leagues
router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM leagues ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching leagues' })
    }
    res.json(rows)
  })
})

// Create league
router.post('/', authenticateToken, (req, res) => {
  const { name, description, season } = req.body

  if (!name) {
    return res.status(400).json({ error: 'League name required' })
  }

  db.run(
    'INSERT INTO leagues (name, description, season, created_by) VALUES (?, ?, ?, ?)',
    [name, description, season, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating league' })
      }
      res.json({ id: this.lastID, name, description, season })
    }
  )
})

// Update league
router.put('/:id', authenticateToken, (req, res) => {
  const { name, description, season } = req.body

  db.run(
    'UPDATE leagues SET name = ?, description = ?, season = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description, season, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating league' })
      }
      res.json({ message: 'League updated successfully' })
    }
  )
})

// Delete league
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM leagues WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting league' })
    }
    res.json({ message: 'League deleted successfully' })
  })
})

export default router
