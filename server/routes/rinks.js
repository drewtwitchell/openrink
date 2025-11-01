import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all rinks
router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM rinks ORDER BY name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching rinks' })
    }
    res.json(rows)
  })
})

// Create rink
router.post('/', authenticateToken, (req, res) => {
  const { name, address, phone, latitude, longitude } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Rink name required' })
  }

  db.run(
    'INSERT INTO rinks (name, address, phone, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
    [name, address, phone, latitude || null, longitude || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating rink' })
      }
      res.json({ id: this.lastID, name, address, phone, latitude, longitude })
    }
  )
})

export default router
