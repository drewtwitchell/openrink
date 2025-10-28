import express from 'express'
import db from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Helper middleware to check admin/league_manager
function requireAdmin(req, res, next) {
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || (user.role !== 'admin' && user.role !== 'league_manager')) {
      return res.status(403).json({ error: 'Unauthorized' })
    }
    next()
  })
}

// Get all brackets for a league/season
router.get('/league/:leagueId/season/:seasonId', (req, res) => {
  db.all(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.league_id = ? AND playoff_brackets.season_id = ?
     ORDER BY playoff_brackets.created_at DESC`,
    [req.params.leagueId, req.params.seasonId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching playoff brackets' })
      }
      res.json(rows)
    }
  )
})

// Get active bracket for a league/season (public)
router.get('/league/:leagueId/season/:seasonId/active', (req, res) => {
  db.get(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.league_id = ?
       AND playoff_brackets.season_id = ?
       AND playoff_brackets.is_active = 1
     ORDER BY playoff_brackets.created_at DESC
     LIMIT 1`,
    [req.params.leagueId, req.params.seasonId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching active bracket' })
      }
      res.json(row || null)
    }
  )
})

// Get bracket details with all matches
router.get('/:bracketId', (req, res) => {
  db.get(
    `SELECT playoff_brackets.*, users.name as creator_name
     FROM playoff_brackets
     LEFT JOIN users ON playoff_brackets.created_by = users.id
     WHERE playoff_brackets.id = ?`,
    [req.params.bracketId],
    (err, bracket) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching bracket' })
      }
      if (!bracket) {
        return res.status(404).json({ error: 'Bracket not found' })
      }

      // Get all matches for this bracket
      db.all(
        `SELECT
           playoff_matches.*,
           t1.name as team1_name,
           t1.color as team1_color,
           t2.name as team2_name,
           t2.color as team2_color,
           winner.name as winner_name,
           rinks.name as rink_name
         FROM playoff_matches
         LEFT JOIN teams t1 ON playoff_matches.team1_id = t1.id
         LEFT JOIN teams t2 ON playoff_matches.team2_id = t2.id
         LEFT JOIN teams winner ON playoff_matches.winner_id = winner.id
         LEFT JOIN rinks ON playoff_matches.rink_id = rinks.id
         WHERE playoff_matches.bracket_id = ?
         ORDER BY playoff_matches.round, playoff_matches.match_number`,
        [req.params.bracketId],
        (err, matches) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching matches' })
          }
          res.json({
            bracket,
            matches
          })
        }
      )
    }
  )
})

// Create new bracket
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { league_id, season_id, name, format, team_ids } = req.body

  if (!league_id || !season_id || !name || !format || !team_ids || !Array.isArray(team_ids)) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Validate format (must be power of 2)
  const numTeams = team_ids.length
  if (![4, 8, 16].includes(numTeams)) {
    return res.status(400).json({ error: 'Number of teams must be 4, 8, or 16' })
  }

  db.run(
    `INSERT INTO playoff_brackets (league_id, season_id, name, format, created_by, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [league_id, season_id, name, format, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating bracket' })
      }

      const bracketId = this.lastID

      // Generate bracket structure
      const numRounds = Math.log2(numTeams)
      const matches = []

      // Create first round matches
      for (let i = 0; i < numTeams / 2; i++) {
        matches.push({
          bracket_id: bracketId,
          round: 1,
          match_number: i + 1,
          team1_id: team_ids[i * 2],
          team2_id: team_ids[i * 2 + 1]
        })
      }

      // Create subsequent round placeholders
      let matchNumber = 1
      for (let round = 2; round <= numRounds; round++) {
        const matchesInRound = Math.pow(2, numRounds - round)
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            bracket_id: bracketId,
            round: round,
            match_number: matchNumber++,
            team1_id: null,
            team2_id: null
          })
        }
      }

      // Insert all matches
      const insertMatch = db.prepare(
        `INSERT INTO playoff_matches (bracket_id, round, match_number, team1_id, team2_id)
         VALUES (?, ?, ?, ?, ?)`
      )

      matches.forEach(match => {
        insertMatch.run(
          match.bracket_id,
          match.round,
          match.match_number,
          match.team1_id,
          match.team2_id
        )
      })

      insertMatch.finalize((err) => {
        if (err) {
          return res.status(500).json({ error: 'Error creating matches' })
        }

        // Now link matches together (set next_match_id)
        db.all(
          `SELECT id, round, match_number FROM playoff_matches
           WHERE bracket_id = ? ORDER BY round, match_number`,
          [bracketId],
          (err, allMatches) => {
            if (err) {
              return res.status(500).json({ error: 'Error linking matches' })
            }

            const updateStmt = db.prepare(
              'UPDATE playoff_matches SET next_match_id = ? WHERE id = ?'
            )

            // Group matches by round
            const matchesByRound = {}
            allMatches.forEach(m => {
              if (!matchesByRound[m.round]) {
                matchesByRound[m.round] = []
              }
              matchesByRound[m.round].push(m)
            })

            // Link each match to the next round
            for (let round = 1; round < numRounds; round++) {
              const currentRoundMatches = matchesByRound[round]
              const nextRoundMatches = matchesByRound[round + 1]

              currentRoundMatches.forEach((match, idx) => {
                const nextMatchIdx = Math.floor(idx / 2)
                const nextMatch = nextRoundMatches[nextMatchIdx]
                updateStmt.run(nextMatch.id, match.id)
              })
            }

            updateStmt.finalize()

            res.status(201).json({
              message: 'Bracket created successfully',
              bracketId: bracketId
            })
          }
        )
      })
    }
  )
})

// Update match result
router.put('/matches/:matchId', authenticateToken, requireAdmin, (req, res) => {
  const { team1_score, team2_score, winner_id, game_date, game_time, rink_id, surface_name } = req.body

  // Get the match details first
  db.get(
    'SELECT * FROM playoff_matches WHERE id = ?',
    [req.params.matchId],
    (err, match) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching match' })
      }
      if (!match) {
        return res.status(404).json({ error: 'Match not found' })
      }

      // Update the match
      db.run(
        `UPDATE playoff_matches
         SET team1_score = ?, team2_score = ?, winner_id = ?,
             game_date = ?, game_time = ?, rink_id = ?, surface_name = ?
         WHERE id = ?`,
        [team1_score, team2_score, winner_id, game_date, game_time, rink_id, surface_name, req.params.matchId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating match' })
          }

          // If there's a winner and a next match, advance the winner
          if (winner_id && match.next_match_id) {
            db.get(
              'SELECT team1_id, team2_id FROM playoff_matches WHERE id = ?',
              [match.next_match_id],
              (err, nextMatch) => {
                if (err) {
                  return res.status(500).json({ error: 'Error fetching next match' })
                }

                // Determine if winner goes to team1 or team2 slot in next match
                // Even match numbers go to team1, odd to team2
                const field = match.match_number % 2 === 1 ? 'team1_id' : 'team2_id'

                db.run(
                  `UPDATE playoff_matches SET ${field} = ? WHERE id = ?`,
                  [winner_id, match.next_match_id],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ error: 'Error advancing winner' })
                    }
                    res.json({ message: 'Match updated and winner advanced' })
                  }
                )
              }
            )
          } else {
            res.json({ message: 'Match updated successfully' })
          }
        }
      )
    }
  )
})

// Toggle bracket active status
router.put('/:bracketId/toggle', authenticateToken, requireAdmin, (req, res) => {
  db.get(
    'SELECT is_active FROM playoff_brackets WHERE id = ?',
    [req.params.bracketId],
    (err, bracket) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching bracket' })
      }
      if (!bracket) {
        return res.status(404).json({ error: 'Bracket not found' })
      }

      const newStatus = bracket.is_active === 1 ? 0 : 1

      db.run(
        'UPDATE playoff_brackets SET is_active = ? WHERE id = ?',
        [newStatus, req.params.bracketId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating bracket' })
          }
          res.json({ message: 'Bracket status updated', is_active: newStatus })
        }
      )
    }
  )
})

// Delete bracket
router.delete('/:bracketId', authenticateToken, requireAdmin, (req, res) => {
  db.run(
    'DELETE FROM playoff_brackets WHERE id = ?',
    [req.params.bracketId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting bracket' })
      }
      res.json({ message: 'Bracket deleted successfully' })
    }
  )
})

export default router
