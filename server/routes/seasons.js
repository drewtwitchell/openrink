import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all seasons for a league
router.get('/league/:leagueId', (req, res) => {
  const query = `
    SELECT * FROM seasons
    WHERE league_id = ?
    ORDER BY is_active DESC, created_at DESC
  `

  db.all(query, [req.params.leagueId], (err, rows) => {
    if (err) {
      console.error('Error fetching seasons:', err)
      return res.status(500).json({ error: 'Error fetching seasons' })
    }
    res.json(rows)
  })
})

// Get active season for a league
router.get('/league/:leagueId/active', (req, res) => {
  const query = `
    SELECT * FROM seasons
    WHERE league_id = ? AND is_active = 1 AND archived = 0
    LIMIT 1
  `

  db.get(query, [req.params.leagueId], (err, row) => {
    if (err) {
      console.error('Error fetching active season:', err)
      return res.status(500).json({ error: 'Error fetching active season' })
    }
    res.json(row || null)
  })
})

// Get season by ID
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM seasons WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching season:', err)
      return res.status(500).json({ error: 'Error fetching season' })
    }
    res.json(row)
  })
})

// Create new season
router.post('/', authenticateToken, (req, res) => {
  const {
    league_id,
    name,
    description,
    season_dues,
    venmo_link,
    start_date,
    end_date,
    is_active
  } = req.body

  db.run(
    `INSERT INTO seasons (league_id, name, description, season_dues, venmo_link, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [league_id, name, description, season_dues, venmo_link, start_date, end_date, is_active ? 1 : 0],
    function (err) {
      if (err) {
        console.error('Error creating season:', err)
        return res.status(500).json({ error: 'Error creating season' })
      }
      res.json({ id: this.lastID, message: 'Season created successfully' })
    }
  )
})

// Update season
router.put('/:id', authenticateToken, (req, res) => {
  const {
    name,
    description,
    season_dues,
    venmo_link,
    start_date,
    end_date,
    is_active
  } = req.body

  db.run(
    `UPDATE seasons
     SET name = ?, description = ?, season_dues = ?, venmo_link = ?,
         start_date = ?, end_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, description, season_dues, venmo_link, start_date, end_date, is_active ? 1 : 0, req.params.id],
    function (err) {
      if (err) {
        console.error('Error updating season:', err)
        return res.status(500).json({ error: 'Error updating season' })
      }
      res.json({ message: 'Season updated successfully' })
    }
  )
})

// Archive/Unarchive season
router.patch('/:id/archive', authenticateToken, (req, res) => {
  const { archived } = req.body

  db.run(
    'UPDATE seasons SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [archived ? 1 : 0, req.params.id],
    function (err) {
      if (err) {
        console.error('Error updating season archive status:', err)
        return res.status(500).json({ error: 'Error updating season archive status' })
      }
      res.json({ message: archived ? 'Season archived successfully' : 'Season unarchived successfully' })
    }
  )
})

// Set active season for a league (deactivates others)
router.patch('/:id/set-active', authenticateToken, (req, res) => {
  const seasonId = req.params.id

  // First get the league_id for this season
  db.get('SELECT league_id FROM seasons WHERE id = ?', [seasonId], (err, season) => {
    if (err || !season) {
      return res.status(500).json({ error: 'Error finding season' })
    }

    // Deactivate all seasons in this league
    db.run(
      'UPDATE seasons SET is_active = 0 WHERE league_id = ?',
      [season.league_id],
      (err) => {
        if (err) {
          console.error('Error deactivating seasons:', err)
          return res.status(500).json({ error: 'Error deactivating seasons' })
        }

        // Activate the selected season
        db.run(
          'UPDATE seasons SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [seasonId],
          function (err) {
            if (err) {
              console.error('Error activating season:', err)
              return res.status(500).json({ error: 'Error activating season' })
            }
            res.json({ message: 'Season set as active successfully' })
          }
        )
      }
    )
  })
})

// Delete season
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM seasons WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      console.error('Error deleting season:', err)
      return res.status(500).json({ error: 'Error deleting season' })
    }
    res.json({ message: 'Season deleted successfully' })
  })
})

// Get payment stats for a season
router.get('/:id/payment-stats', (req, res) => {
  const query = `
    SELECT
      COUNT(DISTINCT p.id) as total_players,
      COUNT(DISTINCT pay.player_id) as players_paid,
      COUNT(DISTINCT p.id) - COUNT(DISTINCT pay.player_id) as players_unpaid,
      COALESCE(SUM(CASE WHEN pay.status = 'paid' THEN pay.amount ELSE 0 END), 0) as total_collected
    FROM players p
    INNER JOIN teams t ON p.team_id = t.id
    LEFT JOIN payments pay ON p.id = pay.player_id AND pay.season_id = ? AND pay.status = 'paid'
    WHERE t.season_id = ?
  `

  db.get(query, [req.params.id, req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching payment stats:', err)
      return res.status(500).json({ error: 'Error fetching payment stats' })
    }
    res.json(row)
  })
})

// Get all players in a season with payment status
router.get('/:id/players-payments', (req, res) => {
  const query = `
    SELECT
      p.id,
      p.name,
      p.email,
      p.jersey_number,
      p.team_id,
      t.name as team_name,
      t.color as team_color,
      t.id as team_id,
      pay.id as payment_id,
      pay.status as payment_status,
      pay.amount as payment_amount,
      pay.paid_date,
      pay.payment_method
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id
    LEFT JOIN payments pay ON p.id = pay.player_id AND pay.season_id = ?
    WHERE t.season_id = ? OR (t.league_id = (SELECT league_id FROM seasons WHERE id = ?) AND t.season_id IS NULL)
    ORDER BY t.name, p.name
  `

  db.all(query, [req.params.id, req.params.id, req.params.id], (err, rows) => {
    if (err) {
      console.error('Error fetching players and payments:', err)
      return res.status(500).json({ error: 'Error fetching players and payments' })
    }
    // Filter out teams with no players
    const rowsWithPlayers = rows.filter(row => row.id != null)
    res.json(rowsWithPlayers)
  })
})

export default router
