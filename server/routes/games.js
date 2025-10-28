import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all games (public - no auth required)
router.get('/', (req, res) => {
  db.all(
    `SELECT games.*,
       home_team.name as home_team_name, home_team.color as home_team_color,
       away_team.name as away_team_name, away_team.color as away_team_color,
       rinks.name as rink_name
     FROM games
     LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
     LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
     LEFT JOIN rinks ON games.rink_id = rinks.id
     ORDER BY games.game_date, games.game_time`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching games' })
      }
      res.json(rows)
    }
  )
})

// Create game
router.post('/', authenticateToken, (req, res) => {
  const {
    home_team_id,
    away_team_id,
    game_date,
    game_time,
    rink_id,
    surface_name,
    season_id,
  } = req.body

  if (!home_team_id || !away_team_id || !game_date || !game_time) {
    return res.status(400).json({ error: 'Required fields missing' })
  }

  db.run(
    'INSERT INTO games (home_team_id, away_team_id, game_date, game_time, rink_id, surface_name, season_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [home_team_id, away_team_id, game_date, game_time, rink_id, surface_name || 'NHL', season_id || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating game' })
      }
      res.json({ id: this.lastID })
    }
  )
})

// Update game score
router.put('/:id/score', authenticateToken, (req, res) => {
  const { home_score, away_score } = req.body

  db.run(
    'UPDATE games SET home_score = ?, away_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [home_score, away_score, 'completed', req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating game' })
      }
      res.json({ message: 'Game score updated successfully' })
    }
  )
})

// Delete game
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting game' })
    }
    res.json({ message: 'Game deleted successfully' })
  })
})

export default router
