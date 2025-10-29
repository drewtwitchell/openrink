import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireTeamLeagueManager } from '../middleware/leagueAuth.js'

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

// Add a captain to a team
router.post('/', authenticateToken, requireTeamLeagueManager, (req, res) => {
  const { user_id, team_id } = req.body

  if (!user_id || !team_id) {
    return res.status(400).json({ error: 'user_id and team_id are required' })
  }

  db.run(
    'INSERT OR IGNORE INTO team_captains (user_id, team_id) VALUES (?, ?)',
    [user_id, team_id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error adding team captain' })
      }
      res.json({ message: 'Team captain added successfully' })
    }
  )
})

// Remove a captain from a team
router.delete('/', authenticateToken, requireTeamLeagueManager, (req, res) => {
  const { user_id, team_id } = req.body

  if (!user_id || !team_id) {
    return res.status(400).json({ error: 'user_id and team_id are required' })
  }

  db.run(
    'DELETE FROM team_captains WHERE user_id = ? AND team_id = ?',
    [user_id, team_id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error removing team captain' })
      }
      res.json({ message: 'Team captain removed successfully' })
    }
  )
})

export default router
