import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get active announcements for a league (public)
router.get('/league/:leagueId', (req, res) => {
  const now = new Date().toISOString()

  db.all(
    `SELECT announcements.*, users.name as author_name
     FROM announcements
     LEFT JOIN users ON announcements.created_by = users.id
     WHERE announcements.league_id = ?
       AND announcements.is_active = 1
       AND (announcements.expires_at IS NULL OR announcements.expires_at > ?)
     ORDER BY announcements.created_at DESC`,
    [req.params.leagueId, now],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching announcements' })
      }
      res.json(rows)
    }
  )
})

// Get all announcements for a league (admins only)
router.get('/league/:leagueId/all', authenticateToken, (req, res) => {
  // Check if user is admin or league manager
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    db.all(
      `SELECT announcements.*, users.name as author_name
       FROM announcements
       LEFT JOIN users ON announcements.created_by = users.id
       WHERE announcements.league_id = ?
       ORDER BY announcements.created_at DESC`,
      [req.params.leagueId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching announcements' })
        }
        res.json(rows)
      }
    )
  })
})

// Create announcement (admins/league managers only)
router.post('/', authenticateToken, (req, res) => {
  const { league_id, title, message, expires_at } = req.body

  if (!league_id || !title || !message) {
    return res.status(400).json({ error: 'League ID, title, and message required' })
  }

  // Check if user is admin or league manager
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    db.run(
      'INSERT INTO announcements (league_id, title, message, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
      [league_id, title, message, req.user.id, expires_at || null],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating announcement' })
        }
        res.json({ id: this.lastID, league_id, title, message, expires_at })
      }
    )
  })
})

// Update announcement (admins/league managers only)
router.put('/:id', authenticateToken, (req, res) => {
  const { title, message, expires_at, is_active } = req.body

  // Check if user is admin or league manager
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

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
  })
})

// Delete announcement (admins/league managers only)
router.delete('/:id', authenticateToken, (req, res) => {
  // Check if user is admin or league manager
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting announcement' })
      }
      res.json({ message: 'Announcement deleted successfully' })
    })
  })
})

export default router
