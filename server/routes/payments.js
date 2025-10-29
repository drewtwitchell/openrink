import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all payments for a team
router.get('/team/:teamId', authenticateToken, (req, res) => {
  db.all(
    `SELECT payments.*,
       players.name as player_name,
       players.email as player_email,
       users.name as marked_by_name
     FROM payments
     LEFT JOIN players ON payments.player_id = players.id
     LEFT JOIN users ON payments.marked_paid_by = users.id
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
    due_date,
    payment_method,
    season_id
  } = req.body

  if (!player_id || !team_id || !amount) {
    return res.status(400).json({ error: 'Player ID, team ID, and amount are required' })
  }

  db.run(
    `INSERT INTO payments (player_id, team_id, amount, description, venmo_link, due_date, payment_method, season_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [player_id, team_id, amount, description, venmo_link, due_date, payment_method || 'venmo', season_id],
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
  const {
    confirmation_number,
    payment_notes,
    payment_method
  } = req.body

  db.run(
    `UPDATE payments
     SET status = ?,
         paid_date = CURRENT_TIMESTAMP,
         confirmation_number = ?,
         payment_notes = ?,
         payment_method = COALESCE(?, payment_method),
         marked_paid_by = ?
     WHERE id = ?`,
    ['paid', confirmation_number, payment_notes, payment_method, req.user.id, req.params.id],
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

// Mark payment as unpaid
router.put('/:id/unpaid', authenticateToken, (req, res) => {
  db.run(
    `UPDATE payments
     SET status = ?,
         paid_date = NULL,
         confirmation_number = NULL,
         payment_notes = NULL,
         marked_paid_by = NULL
     WHERE id = ?`,
    ['pending', req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating payment' })
      }
      res.json({ message: 'Payment marked as unpaid' })
    }
  )
})

// Update payment amount
router.put('/:id/amount', authenticateToken, (req, res) => {
  const { amount } = req.body

  if (amount === undefined || amount === null || amount < 0) {
    return res.status(400).json({ error: 'Valid amount is required' })
  }

  db.run(
    'UPDATE payments SET amount = ? WHERE id = ?',
    [amount, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating payment amount' })
      }
      res.json({ message: 'Payment amount updated successfully' })
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
