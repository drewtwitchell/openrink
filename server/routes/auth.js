import express from 'express'
import bcrypt from 'bcrypt'
import db from '../database.js'
import { generateToken } from '../middleware/auth.js'

const router = express.Router()

// Sign up
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    db.run(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name],
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
          user: { id: this.lastID, email, name }
        })
      }
    )
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Sign in
router.post('/signin', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
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
        user: { id: user.id, email: user.email, name: user.name }
      })
    } catch (error) {
      res.status(500).json({ error: 'Server error' })
    }
  })
})

// Get current user
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const jwt = require('jsonwebtoken')
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const decoded = jwt.verify(token, JWT_SECRET)

    db.get('SELECT id, email, name FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' })
      }
      res.json({ user })
    })
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
