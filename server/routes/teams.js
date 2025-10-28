import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get all teams (public - no auth required)
router.get('/', (req, res) => {
  db.all(
    `SELECT teams.*,
       leagues.name as league_name,
       GROUP_CONCAT(
         CASE
           WHEN team_captains.user_id IS NOT NULL
           THEN players.name || '||' || COALESCE(players.email, users.email) || '||' || COALESCE(players.phone, users.phone)
         END, ';;;'
       ) as captains_info
     FROM teams
     LEFT JOIN leagues ON teams.league_id = leagues.id
     LEFT JOIN team_captains ON team_captains.team_id = teams.id
     LEFT JOIN players ON players.user_id = team_captains.user_id AND players.team_id = teams.id
     LEFT JOIN users ON users.id = team_captains.user_id
     GROUP BY teams.id
     ORDER BY teams.name`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching teams' })
      }
      // Parse captains info
      const teamsWithCaptains = rows.map(team => {
        const captains = []
        if (team.captains_info) {
          const captainEntries = team.captains_info.split(';;;').filter(Boolean)
          captainEntries.forEach(entry => {
            const [name, email, phone] = entry.split('||')
            if (name) {
              captains.push({ name, email: email !== 'null' ? email : null, phone: phone !== 'null' ? phone : null })
            }
          })
        }
        return {
          ...team,
          captains,
          captains_info: undefined
        }
      })
      res.json(teamsWithCaptains)
    }
  )
})

// Create team
router.post('/', authenticateToken, (req, res) => {
  const { name, league_id, color } = req.body

  if (!name || !league_id) {
    return res.status(400).json({ error: 'Team name and league required' })
  }

  db.run(
    'INSERT INTO teams (name, league_id, color) VALUES (?, ?, ?)',
    [name, league_id, color || '#0284c7'],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating team' })
      }
      res.json({ id: this.lastID, name, league_id, color })
    }
  )
})

// Delete team
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM teams WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error deleting team' })
    }
    res.json({ message: 'Team deleted successfully' })
  })
})

export default router
