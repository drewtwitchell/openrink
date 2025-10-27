import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all payments for a team
router.get('/team/:teamId', authenticateToken, (req, res) => {
  db.all(
    `SELECT payments.*, players.name as player_name, players.email as player_email
     FROM payments
     LEFT JOIN players ON payments.player_id = players.id
     WHERE payments.team_id = ?
     ORDER BY payments.created_at DESC`,
    [req.params.teamId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching payments' })
      }
      res.json(rows)
    }
  )
})

// Get payment status for a player
router.get('/player/:playerId', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM payments WHERE player_id = ? ORDER BY created_at DESC`,
    [req.params.playerId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching payments' })
      }
      res.json(rows)
    }
  )
})

// Create payment record
router.post('/', authenticateToken, (req, res) => {
  const {
    player_id,
    team_id,
    amount,
    description,
    venmo_link,
    due_date
  } = req.body

  if (!player_id || !team_id || !amount) {
    return res.status(400).json({ error: 'Player ID, team ID, and amount are required' })
  }

  db.run(
    'INSERT INTO payments (player_id, team_id, amount, description, venmo_link, due_date) VALUES (?, ?, ?, ?, ?, ?)',
    [player_id, team_id, amount, description, venmo_link, due_date],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating payment record' })
      }
      res.json({ id: this.lastID })
    }
  )
})

// Mark payment as paid
router.put('/:id/paid', authenticateToken, (req, res) => {
  db.run(
    'UPDATE payments SET status = ?, paid_date = CURRENT_TIMESTAMP WHERE id = ?',
    ['paid', req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating payment' })
      }

      // Get payment details to send notification
      db.get(
        `SELECT payments.*, players.name as player_name, players.email as player_email,
         teams.name as team_name, teams.id as team_id
         FROM payments
         JOIN players ON payments.player_id = players.id
         JOIN teams ON payments.team_id = teams.id
         WHERE payments.id = ?`,
        [req.params.id],
        (err, payment) => {
          if (err || !payment) {
            return res.json({ message: 'Payment marked as paid' })
          }

          // TODO: Send email notification to team captain and league owners
          // This would require email service integration (e.g., Resend, SendGrid)
          // For now, just return success

          res.json({
            message: 'Payment marked as paid',
            payment: payment
          })
        }
      )
    }
  )
})

// Delete payment record
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM payments WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting payment' })
    }
    res.json({ message: 'Payment deleted successfully' })
  })
})

export default router
