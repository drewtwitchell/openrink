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

// Get all announcements for a league (admins/league managers only)
router.get('/league/:leagueId/all', authenticateToken, (req, res) => {
  // Check if user is admin or league manager for this league
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Allow if admin
    if (user.role === 'admin') {
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

  // Check if user is admin or league manager for this league
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const createAnnouncement = () => {
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
        if (err || !manager) {
          return res.status(403).json({ error: 'Unauthorized' })
        }
        createAnnouncement()
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

export default router
