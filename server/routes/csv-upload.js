import express from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import db from '../database.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ storage })

// CSV Templates
const ROSTER_TEMPLATE = `Name,Email,Phone,Jersey Number
John Doe,john@example.com,(555) 123-4567,10
Jane Smith,jane@example.com,(555) 987-6543,15`

const SCHEDULE_TEMPLATE = `Home Team,Away Team,Date,Time,Rink,Surface
Team A,Team B,2025-01-15,7:00 PM,IceCenter,NHL
Team C,Team D,2025-01-17,8:30 PM,Twin Rinks Arena,Olympic`

const STANDINGS_TEMPLATE = `Team,Wins,Losses,Ties,Points,Goals For,Goals Against
Team A,10,5,2,22,45,30
Team B,8,7,2,18,40,35`

// Download CSV templates
router.get('/templates/roster', (req, res) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=roster_template.csv')
  res.send(ROSTER_TEMPLATE)
})

router.get('/templates/schedule', (req, res) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=schedule_template.csv')
  res.send(SCHEDULE_TEMPLATE)
})

router.get('/templates/standings', (req, res) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=standings_template.csv')
  res.send(STANDINGS_TEMPLATE)
})

// Helper function to normalize column names
function normalizeColumnName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

// Helper function to find column by variations
function findColumn(headers, variations) {
  const normalizedHeaders = headers.map(h => normalizeColumnName(h))
  for (const variation of variations) {
    const normalized = normalizeColumnName(variation)
    const index = normalizedHeaders.indexOf(normalized)
    if (index !== -1) return headers[index]
  }
  return null
}

// Helper to parse time to 24-hour format
function parseTime(timeStr) {
  if (!timeStr) return null

  timeStr = timeStr.trim()

  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':')
    const h = parseInt(hours)
    const m = parseInt(minutes)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // Parse 12-hour format with AM/PM
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
  if (match) {
    let hours = parseInt(match[1])
    const minutes = match[2] || '00'
    const period = match[3].toLowerCase()

    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0

    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }

  return timeStr
}

// Helper to parse date to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null

  dateStr = dateStr.trim()

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Try to parse as Date and format
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return dateStr
}

// Upload roster CSV
router.post('/upload/roster/:teamId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const csvText = req.file.buffer.toString('utf-8')
    const teamId = req.params.teamId

    // Verify team exists
    db.get('SELECT id FROM teams WHERE id = ?', [teamId], async (err, team) => {
      if (err || !team) {
        return res.status(404).json({ error: 'Team not found' })
      }

      try {
        // Parse CSV
        const records = parse(csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        })

        if (records.length === 0) {
          return res.status(400).json({ error: 'CSV file is empty' })
        }

        const headers = Object.keys(records[0])

        // Find column names (flexible matching)
        const nameCol = findColumn(headers, ['name', 'player name', 'playername', 'player'])
        const emailCol = findColumn(headers, ['email', 'e-mail', 'emailaddress'])
        const phoneCol = findColumn(headers, ['phone', 'phone number', 'phonenumber', 'cell', 'mobile'])
        const jerseyCol = findColumn(headers, ['jersey', 'jersey number', 'jerseynumber', 'number', '#'])

        if (!nameCol) {
          return res.status(400).json({ error: 'Could not find "Name" column in CSV' })
        }

        let insertedCount = 0
        let errors = []

        for (const record of records) {
          const name = record[nameCol]
          if (!name || name.trim() === '') {
            errors.push('Skipping row with empty name')
            continue
          }

          const email = emailCol ? record[emailCol] : null
          const phone = phoneCol ? record[phoneCol] : null
          const jerseyNumber = jerseyCol ? parseInt(record[jerseyCol]) || null : null

          db.run(
            'INSERT INTO players (team_id, name, email, phone, jersey_number) VALUES (?, ?, ?, ?, ?)',
            [teamId, name.trim(), email, phone, jerseyNumber],
            (err) => {
              if (err) {
                errors.push(`Error adding ${name}: ${err.message}`)
              } else {
                insertedCount++
              }
            }
          )
        }

        // Wait for all inserts to complete
        setTimeout(() => {
          res.json({
            success: true,
            message: `Successfully added ${insertedCount} players`,
            inserted: insertedCount,
            errors: errors.length > 0 ? errors : undefined
          })
        }, 500)

      } catch (error) {
        res.status(500).json({ error: 'Failed to parse CSV: ' + error.message })
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Error processing roster upload: ' + error.message })
  }
})

// Upload schedule CSV
router.post('/upload/schedule/:leagueId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const csvText = req.file.buffer.toString('utf-8')
    const leagueId = req.params.leagueId

    // Verify league exists and get teams
    db.get('SELECT id FROM leagues WHERE id = ?', [leagueId], async (err, league) => {
      if (err || !league) {
        return res.status(404).json({ error: 'League not found' })
      }

      db.all('SELECT id, name FROM teams WHERE league_id = ?', [leagueId], async (teamsErr, teams) => {
        if (teamsErr) {
          return res.status(500).json({ error: 'Error fetching teams' })
        }

        db.all('SELECT id, name FROM rinks', [], async (rinksErr, rinks) => {
          if (rinksErr) {
            return res.status(500).json({ error: 'Error fetching rinks' })
          }

          try {
            // Parse CSV
            const records = parse(csvText, {
              columns: true,
              skip_empty_lines: true,
              trim: true
            })

            if (records.length === 0) {
              return res.status(400).json({ error: 'CSV file is empty' })
            }

            const headers = Object.keys(records[0])

            // Find column names (flexible matching)
            const homeTeamCol = findColumn(headers, ['home team', 'hometeam', 'home'])
            const awayTeamCol = findColumn(headers, ['away team', 'awayteam', 'away', 'visitor'])
            const dateCol = findColumn(headers, ['date', 'game date', 'gamedate'])
            const timeCol = findColumn(headers, ['time', 'game time', 'gametime'])
            const rinkCol = findColumn(headers, ['rink', 'arena', 'venue', 'location'])
            const surfaceCol = findColumn(headers, ['surface', 'ice surface', 'rink type'])

            if (!homeTeamCol || !awayTeamCol || !dateCol || !timeCol) {
              return res.status(400).json({
                error: 'Missing required columns. Need: Home Team, Away Team, Date, Time'
              })
            }

            let insertedCount = 0
            let errors = []

            for (const record of records) {
              const homeTeamName = record[homeTeamCol]
              const awayTeamName = record[awayTeamCol]
              const dateStr = record[dateCol]
              const timeStr = record[timeCol]
              const rinkName = rinkCol ? record[rinkCol] : null
              const surface = surfaceCol ? record[surfaceCol] : 'NHL'

              // Find teams by name (case-insensitive)
              const homeTeam = teams.find(t => t.name.toLowerCase() === homeTeamName.toLowerCase())
              const awayTeam = teams.find(t => t.name.toLowerCase() === awayTeamName.toLowerCase())
              const rink = rinkName ? rinks.find(r => r.name.toLowerCase() === rinkName.toLowerCase()) : rinks[0]

              if (!homeTeam) {
                errors.push(`Home team "${homeTeamName}" not found in league`)
                continue
              }
              if (!awayTeam) {
                errors.push(`Away team "${awayTeamName}" not found in league`)
                continue
              }

              const gameDate = parseDate(dateStr)
              const gameTime = parseTime(timeStr)

              db.run(
                'INSERT INTO games (home_team_id, away_team_id, game_date, game_time, rink_id, surface_name) VALUES (?, ?, ?, ?, ?, ?)',
                [homeTeam.id, awayTeam.id, gameDate, gameTime, rink?.id, surface || 'NHL'],
                (err) => {
                  if (err) {
                    errors.push(`Error adding game ${homeTeamName} vs ${awayTeamName}: ${err.message}`)
                  } else {
                    insertedCount++
                  }
                }
              )
            }

            setTimeout(() => {
              res.json({
                success: true,
                message: `Successfully added ${insertedCount} games`,
                inserted: insertedCount,
                errors: errors.length > 0 ? errors : undefined
              })
            }, 500)

          } catch (error) {
            res.status(500).json({ error: 'Failed to parse CSV: ' + error.message })
          }
        })
      })
    })
  } catch (error) {
    res.status(500).json({ error: 'Error processing schedule upload: ' + error.message })
  }
})

// Upload standings CSV (creates games to match the standings)
router.post('/upload/standings/:leagueId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // This endpoint is more complex - it would need to create game results that match the standings
    // For now, we'll return a not implemented message
    res.status(501).json({
      error: 'Standings import not yet implemented. Please enter game scores manually to generate standings.'
    })

  } catch (error) {
    res.status(500).json({ error: 'Error processing standings upload: ' + error.message })
  }
})

export default router
