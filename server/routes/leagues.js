import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireLeagueManager } from '../middleware/leagueAuth.js'

const router = express.Router()

// Get all leagues (public - no auth required)
router.get('/', (req, res) => {
  const showArchived = req.query.showArchived === 'true'
  const query = showArchived
    ? 'SELECT * FROM leagues ORDER BY created_at DESC'
    : 'SELECT * FROM leagues WHERE archived = 0 ORDER BY created_at DESC'

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching leagues' })
    }
    res.json(rows)
  })
})

// Get league managers/owners (public - no auth required)
// Note: Admins are excluded from this list because they have access to all leagues by default
router.get('/:id/managers', (req, res) => {
  db.all(
    `SELECT users.id, users.name, users.email, users.phone, users.role,
       leagues.created_by,
       league_managers.id as manager_id,
       CASE WHEN leagues.created_by = users.id THEN 1 ELSE 0 END as is_owner
     FROM leagues
     LEFT JOIN league_managers ON leagues.id = league_managers.league_id
     LEFT JOIN users ON (league_managers.user_id = users.id OR leagues.created_by = users.id)
     WHERE leagues.id = ? AND users.id IS NOT NULL AND users.role != 'admin'
     GROUP BY users.id
     ORDER BY
       CASE WHEN leagues.created_by = users.id THEN 1
            ELSE 2 END,
       users.name`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching league managers' })
      }
      res.json(rows)
    }
  )
})

// Add league manager
router.post('/:id/managers', authenticateToken, requireLeagueManager, (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email required' })
  }

  // Find user by email
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' })
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found with this email' })
    }

    // Add as league manager
    db.run(
      'INSERT INTO league_managers (user_id, league_id) VALUES (?, ?)',
      [user.id, req.params.id],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'User is already a manager of this league' })
          }
          return res.status(500).json({ error: 'Error adding manager' })
        }
        res.json({ message: 'Manager added successfully', id: this.lastID })
      }
    )
  })
})

// Remove league manager
router.delete('/:id/managers/:userId', authenticateToken, requireLeagueManager, (req, res) => {
  db.run(
    'DELETE FROM league_managers WHERE league_id = ? AND user_id = ?',
    [req.params.id, req.params.userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error removing manager' })
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Manager assignment not found' })
      }
      res.json({ message: 'Manager removed successfully' })
    }
  )
})

// Create league
router.post('/', authenticateToken, (req, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ error: 'League name required' })
  }

  db.run(
    'INSERT INTO leagues (name, description, created_by) VALUES (?, ?, ?)',
    [name, description, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating league' })
      }
      res.json({ id: this.lastID, name, description })
    }
  )
})

// Update league
router.put('/:id', authenticateToken, requireLeagueManager, (req, res) => {
  const { name, description } = req.body

  db.run(
    'UPDATE leagues SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating league' })
      }
      res.json({ message: 'League updated successfully' })
    }
  )
})

// Archive/Unarchive league
router.patch('/:id/archive', authenticateToken, requireLeagueManager, (req, res) => {
  const { archived } = req.body // archived should be 1 (archive) or 0 (unarchive)

  db.run(
    'UPDATE leagues SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [archived ? 1 : 0, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating league archive status' })
      }
      res.json({ message: archived ? 'League archived successfully' : 'League unarchived successfully' })
    }
  )
})

// Delete league
router.delete('/:id', authenticateToken, requireLeagueManager, (req, res) => {
  db.run('DELETE FROM leagues WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting league' })
    }
    res.json({ message: 'League deleted successfully' })
  })
})

export default router
