import express from 'express'
import bcrypt from 'bcrypt'
import db from '../database.js'
import { generateToken, authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Sign up
router.post('/signup', async (req, res) => {
  const { email, password, name, phone, position } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

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
        'INSERT INTO users (email, password, name, phone, position, role) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, name, phone, position || 'player', role],
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
            user: { id: this.lastID, email, name, phone, position: position || 'player', role }
          })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Sign in
router.post('/signin', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Username/email and password required' })
  }

  // Support login with username OR email
  db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' })
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
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
          position: user.position,
          role: user.role,
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
  db.get('SELECT id, username, email, name, phone, position, role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ user })
  })
})

// Update user profile
router.put('/profile', authenticateToken, (req, res) => {
  const { name, phone, position, sub_position, jersey_number } = req.body

  // Update user table
  db.run(
    'UPDATE users SET name = ?, phone = ?, position = ? WHERE id = ?',
    [name, phone, position, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' })
      }

      // Also update all player records for this user
      db.run(
        'UPDATE players SET position = ?, sub_position = ?, jersey_number = ? WHERE user_id = ?',
        [position, sub_position, jersey_number || null, req.user.id],
        function (err) {
          if (err) {
            console.error('Error updating player records:', err)
          }

          db.get('SELECT id, username, email, name, phone, position, role, password_reset_required FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err || !user) {
              return res.status(404).json({ error: 'User not found' })
            }
            // Add sub_position and jersey_number to the returned user object
            user.sub_position = sub_position
            user.jersey_number = jersey_number
            res.json({ user })
          })
        }
      )
    }
  )
})

// Search users by name or email (authenticated users)
router.get('/users/search', authenticateToken, (req, res) => {
  const { q } = req.query

  if (!q || q.length < 2) {
    return res.json([])
  }

  const searchPattern = `%${q}%`

  db.all(
    'SELECT id, email, name, phone, position FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 10',
    [searchPattern, searchPattern],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Error searching users' })
      }
      res.json(users)
    }
  )
})

// Get all users (admin only)
router.get('/users', authenticateToken, (req, res) => {
  // Check if user is admin
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    db.all('SELECT id, username, email, name, phone, position, role, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching users' })
      }
      res.json(users)
    })
  })
})

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password required' })
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' })
  }

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
router.put('/users/:id/role', authenticateToken, (req, res) => {
  const { role } = req.body

  if (!['admin', 'league_manager', 'player'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

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
router.put('/users/:id/reset-password', authenticateToken, async (req, res) => {
  const { new_password } = req.body

  if (!new_password) {
    return res.status(400).json({ error: 'New password required' })
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Check if user is admin
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err || !user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 10)

      // Update password
      db.run(
        'UPDATE users SET password = ?, password_reset_required = 0 WHERE id = ?',
        [hashedPassword, req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Error resetting password' })
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' })
          }
          res.json({ message: 'Password reset successfully' })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
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
