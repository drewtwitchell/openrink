import express from 'express'
import db from '../database.js'

const router = express.Router()

// Get captains for a team
router.get('/team/:teamId', (req, res) => {
  db.all(
    `SELECT users.id, users.name, users.email, users.phone
     FROM team_captains
     JOIN users ON team_captains.user_id = users.id
     WHERE team_captains.team_id = ?`,
    [req.params.teamId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching team captains' })
      }
      res.json(rows)
    }
  )
})

export default router
