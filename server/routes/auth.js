import express from 'express'
import bcrypt from 'bcrypt'
import { body, query, validationResult } from 'express-validator'
import db from '../database.js'
import { generateToken, authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Password validation rules - require 6+ chars for backward compatibility
const passwordValidation = body('password')
  .trim()
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters')

const newPasswordValidation = body('new_password')
  .trim()
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters')

// Sign up
router.post('/signup', [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('name').optional().trim().escape().isLength({ max: 100 }).withMessage('Name too long'),
  body('phone').optional().trim().matches(/^[\d\s\-\+\(\)]*$/).withMessage('Invalid phone number format'),
  passwordValidation,
  validate
], async (req, res) => {
  const { email, password, name, phone } = req.body

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    // Check if this is the first user
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' })
      }

      const isFirstUser = result.count === 0
      const role = isFirstUser ? 'admin' : 'player'

      db.run(
        'INSERT INTO users (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
        [email, hashedPassword, name, phone, role],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(400).json({ error: 'Email already exists' })
            }
            return res.status(500).json({ error: 'Error creating user' })
          }

          const token = generateToken({ id: this.lastID, email })
          res.json({
            token,
            user: { id: this.lastID, email, name, phone, role }
          })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Sign in
router.post('/signin', [
  body('email').trim().notEmpty().withMessage('Email/username required'),
  body('password').notEmpty().withMessage('Password required'),
  validate
], (req, res) => {
  const { email, password } = req.body

  // Support login with username OR email
  db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' })
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check if user is deactivated
    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Account deactivated. Please contact an administrator.' })
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const token = generateToken({ id: user.id, email: user.email })
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          must_change_password: user.must_change_password || 0,
          password_reset_required: user.password_reset_required || 0
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Server error' })
    }
  })
})

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, name, phone, role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ user })
  })
})

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('name').optional().trim().escape().isLength({ max: 100 }).withMessage('Name too long'),
  body('phone').optional().trim().matches(/^[\d\s\-\+\(\)]*$/).withMessage('Invalid phone number format'),
  body('position').optional().trim().isIn(['goalie', 'defense', 'forward', 'player']).withMessage('Invalid position'),
  body('sub_position').optional().trim(),
  body('jersey_number').optional().isInt({ min: 0, max: 999 }).withMessage('Invalid jersey number'),
  validate
], (req, res) => {
  const { name, phone, position, sub_position, jersey_number } = req.body

  // Update user table (position/sub_position/jersey_number are team-specific, not on users table)
  db.run(
    'UPDATE users SET name = ?, phone = ? WHERE id = ?',
    [name, phone, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' })
      }

      // Update all player records for this user if position/sub_position/jersey_number provided
      if (position !== undefined || sub_position !== undefined || jersey_number !== undefined) {
        db.run(
          'UPDATE players SET position = ?, sub_position = ?, jersey_number = ? WHERE user_id = ?',
          [position || 'player', sub_position || null, jersey_number || null, req.user.id],
          function (err) {
            if (err) {
              console.error('Error updating player records:', err)
            }

            db.get('SELECT id, username, email, name, phone, role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
              if (err || !user) {
                return res.status(404).json({ error: 'User not found' })
              }
              res.json({ user })
            })
          }
        )
      } else {
        db.get('SELECT id, username, email, name, phone, role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
          if (err || !user) {
            return res.status(404).json({ error: 'User not found' })
          }
          res.json({ user })
        })
      }
    }
  )
})

// Search users by name or email (authenticated users)
router.get('/users/search', [
  authenticateToken,
  query('q').optional().trim().escape().isLength({ min: 2, max: 100 }).withMessage('Search query must be 2-100 characters')
], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.json([])
  }

  const { q } = req.query

  if (!q || q.length < 2) {
    return res.json([])
  }

  const searchPattern = `%${q}%`

  db.all(
    'SELECT id, email, name, phone FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 10',
    [searchPattern, searchPattern],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Error searching users' })
      }
      res.json(users)
    }
  )
})

// Get all users (admin and league managers)
router.get('/users', authenticateToken, (req, res) => {
  // Check if user is admin or league manager
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Admins can see all users
    if (user.role === 'admin') {
      db.all('SELECT id, username, email, name, phone, role, is_active, must_change_password, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching users' })
        }
        res.json(users)
      })
      return
    }

    // League managers can only see users who are players in their managed leagues
    db.all(
      `SELECT DISTINCT id FROM league_managers WHERE user_id = ?`,
      [req.user.id],
      (err, managed) => {
        if (err || !managed || managed.length === 0) {
          return res.status(403).json({ error: 'Not authorized - you are not managing any leagues' })
        }

        // Get all unique user IDs who have played in any of the manager's leagues
        const leagueIds = managed.map(m => m.id).join(',')
        db.all(
          `SELECT DISTINCT users.id, users.username, users.email, users.name, users.phone, users.role, users.created_at
           FROM users
           INNER JOIN players ON users.id = players.user_id
           INNER JOIN teams ON players.team_id = teams.id
           WHERE teams.league_id IN (
             SELECT league_id FROM league_managers WHERE user_id = ?
           )
           ORDER BY users.created_at DESC`,
          [req.user.id],
          (err, users) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching users' })
            }
            res.json(users)
          }
        )
      }
    )
  })
})

// Change password
router.put('/change-password', [
  authenticateToken,
  body('current_password').notEmpty().withMessage('Current password required'),
  newPasswordValidation,
  validate
], async (req, res) => {
  const { current_password, new_password } = req.body

  try {
    // Get current user
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Verify current password
      const validPassword = await bcrypt.compare(current_password, user.password)
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 10)

      // Update password and clear reset flag
      db.run(
        'UPDATE users SET password = ?, password_reset_required = 0 WHERE id = ?',
        [hashedPassword, req.user.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating password' })
          }
          res.json({ message: 'Password updated successfully' })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Update user role (admin only)
router.put('/users/:id/role', [
  authenticateToken,
  body('role').isIn(['admin', 'league_manager', 'player']).withMessage('Invalid role'),
  validate
], (req, res) => {
  const { role } = req.body

  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    db.run(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating role' })
        }
        res.json({ message: 'Role updated successfully' })
      }
    )
  })
})

// Reset user password (admin only)
router.put('/users/:id/reset-password', [
  authenticateToken,
  newPasswordValidation,
  validate
], async (req, res) => {
  const { new_password } = req.body

  try {
    // Check if user is admin
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err || !user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 10)

      // Update password and force user to change it on next login
      db.run(
        'UPDATE users SET password = ?, must_change_password = 1, password_reset_required = 0 WHERE id = ?',
        [hashedPassword, req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error resetting password' })
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' })
          }
          res.json({ message: 'Password reset successfully. User will be required to change it on next login.' })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Deactivate user (admin only)
router.put('/users/:id/deactivate', authenticateToken, (req, res) => {
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Prevent deactivating yourself
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' })
    }

    db.run(
      'UPDATE users SET is_active = 0 WHERE id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error deactivating user' })
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' })
        }
        res.json({ message: 'User deactivated successfully' })
      }
    )
  })
})

// Reactivate user (admin only)
router.put('/users/:id/reactivate', authenticateToken, (req, res) => {
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    db.run(
      'UPDATE users SET is_active = 1 WHERE id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Error reactivating user' })
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' })
        }
        res.json({ message: 'User reactivated successfully' })
      }
    )
  })
})

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, (req, res) => {
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Prevent deleting yourself
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }

    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting user' })
      }
      res.json({ message: 'User deleted successfully' })
    })
  })
})

export default router
