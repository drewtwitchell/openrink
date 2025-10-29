import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireGameLeagueManager, requireSubRequestLeagueManager } from '../middleware/leagueAuth.js'

const router = express.Router()

// Get all sub requests
router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT sub_requests.*,
       games.game_date, games.game_time,
       home_team.name as home_team_name,
       away_team.name as away_team_name,
       req_player.name as requesting_player_name,
       sub_player.name as substitute_player_name
     FROM sub_requests
     LEFT JOIN games ON sub_requests.game_id = games.id
     LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
     LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
     LEFT JOIN players as req_player ON sub_requests.requesting_player_id = req_player.id
     LEFT JOIN players as sub_player ON sub_requests.substitute_player_id = sub_player.id
     ORDER BY games.game_date DESC, games.game_time DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching sub requests' })
      }
      res.json(rows)
    }
  )
})

// Get sub requests for a specific game
router.get('/game/:gameId', (req, res) => {
  db.all(
    `SELECT sub_requests.*,
       req_player.name as requesting_player_name,
       req_player.email as requesting_player_email,
       sub_player.name as substitute_player_name
     FROM sub_requests
     LEFT JOIN players as req_player ON sub_requests.requesting_player_id = req_player.id
     LEFT JOIN players as sub_player ON sub_requests.substitute_player_id = sub_player.id
     WHERE sub_requests.game_id = ?
     ORDER BY sub_requests.created_at DESC`,
    [req.params.gameId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching sub requests' })
      }
      res.json(rows)
    }
  )
})

// Create sub request
router.post('/', authenticateToken, requireGameLeagueManager, (req, res) => {
  const {
    game_id,
    requesting_player_id,
    payment_required,
    payment_amount,
    venmo_link,
    notes
  } = req.body

  if (!game_id || !requesting_player_id) {
    return res.status(400).json({ error: 'Game ID and requesting player ID are required' })
  }

  // Note: game_id will be in req.body, so requireGameLeagueManager won't work directly
  // We need to set it in req.params for the middleware
  req.params.id = game_id
  req.params.gameId = game_id

  db.run(
    `INSERT INTO sub_requests (game_id, requesting_player_id, payment_required, payment_amount, venmo_link, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [game_id, requesting_player_id, payment_required || 0, payment_amount, venmo_link, notes],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating sub request' })
      }

      // TODO: Send email notification to team members
      // This would require email service integration

      res.json({
        id: this.lastID,
        message: 'Sub request created successfully'
      })
    }
  )
})

// Accept sub request (assign substitute)
router.put('/:id/accept', authenticateToken, requireSubRequestLeagueManager, (req, res) => {
  const { substitute_player_id } = req.body

  if (!substitute_player_id) {
    return res.status(400).json({ error: 'Substitute player ID is required' })
  }

  db.run(
    'UPDATE sub_requests SET substitute_player_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [substitute_player_id, 'filled', req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error accepting sub request' })
      }

      // TODO: Send email notification to requesting player and substitute

      res.json({ message: 'Sub request accepted' })
    }
  )
})

// Delete sub request
router.delete('/:id', authenticateToken, requireSubRequestLeagueManager, (req, res) => {
  db.run('DELETE FROM sub_requests WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting sub request' })
    }
    res.json({ message: 'Sub request deleted successfully' })
  })
})

export default router
