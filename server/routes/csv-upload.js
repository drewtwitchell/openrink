import express from 'express'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import { parse } from 'csv-parse/sync'
import db from '../database.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ storage })

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

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

// AI-powered CSV interpretation helper
async function interpretCSVWithAI(csvText, dataType, context) {
  try {
    const prompt = `You are a data interpretation assistant for a hockey league management system.

I have a CSV file for ${dataType} that needs to be converted to JSON format.

${context}

CSV Data:
${csvText}

Please analyze this CSV and convert it to the required JSON format. Be flexible with column names and formats - interpret common variations intelligently. For example:
- Phone numbers in any format should be standardized
- Dates in various formats (MM/DD/YYYY, YYYY-MM-DD, etc.) should be converted to YYYY-MM-DD
- Times like "7pm", "7:00 PM", "19:00" should all be converted to 24-hour format HH:MM
- Team names should be trimmed and standardized

Return ONLY valid JSON array with no markdown formatting or code blocks. Do not include any explanatory text.`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const jsonText = response.content[0].text.trim()
    // Remove markdown code blocks if present
    const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch (error) {
    console.error('AI interpretation error:', error)
    throw new Error('Failed to interpret CSV format: ' + error.message)
  }
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
        const context = `Expected format for roster:
{
  "name": "Player Name",
  "email": "player@email.com",
  "phone": "(123) 456-7890",
  "jersey_number": 10
}

All fields except jersey_number are required. jersey_number should be a number if provided.`

        const players = await interpretCSVWithAI(csvText, 'roster', context)

        // Insert players into database
        let insertedCount = 0
        let errors = []

        for (const player of players) {
          if (!player.name) {
            errors.push(`Skipping player - missing name`)
            continue
          }

          db.run(
            'INSERT INTO players (team_id, name, email, phone, jersey_number) VALUES (?, ?, ?, ?, ?)',
            [teamId, player.name, player.email, player.phone, player.jersey_number],
            (err) => {
              if (err) {
                errors.push(`Error adding ${player.name}: ${err.message}`)
              } else {
                insertedCount++
              }
            }
          )
        }

        // Wait a bit for all inserts to complete
        setTimeout(() => {
          res.json({
            success: true,
            message: `Successfully added ${insertedCount} players`,
            inserted: insertedCount,
            errors: errors.length > 0 ? errors : undefined
          })
        }, 500)

      } catch (error) {
        res.status(500).json({ error: error.message })
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
            const teamNames = teams.map(t => t.name).join(', ')
            const rinkNames = rinks.map(r => r.name).join(', ')

            const context = `Expected format for schedule:
{
  "home_team": "Team Name",
  "away_team": "Team Name",
  "date": "2025-01-15",
  "time": "19:00",
  "rink": "Rink Name",
  "surface": "NHL"
}

Available teams in this league: ${teamNames}
Available rinks: ${rinkNames}

Date should be in YYYY-MM-DD format.
Time should be in 24-hour HH:MM format.
Surface defaults to "NHL" if not specified or can be "Olympic".`

            const games = await interpretCSVWithAI(csvText, 'schedule', context)

            let insertedCount = 0
            let errors = []

            for (const game of games) {
              // Find team IDs by name (case-insensitive)
              const homeTeam = teams.find(t => t.name.toLowerCase() === game.home_team.toLowerCase())
              const awayTeam = teams.find(t => t.name.toLowerCase() === game.away_team.toLowerCase())
              const rink = rinks.find(r => r.name.toLowerCase() === game.rink.toLowerCase())

              if (!homeTeam) {
                errors.push(`Home team "${game.home_team}" not found`)
                continue
              }
              if (!awayTeam) {
                errors.push(`Away team "${game.away_team}" not found`)
                continue
              }
              if (!rink && game.rink) {
                errors.push(`Rink "${game.rink}" not found`)
                continue
              }

              db.run(
                'INSERT INTO games (home_team_id, away_team_id, game_date, game_time, rink_id, surface_name) VALUES (?, ?, ?, ?, ?, ?)',
                [homeTeam.id, awayTeam.id, game.date, game.time, rink?.id, game.surface || 'NHL'],
                (err) => {
                  if (err) {
                    errors.push(`Error adding game ${game.home_team} vs ${game.away_team}: ${err.message}`)
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
            res.status(500).json({ error: error.message })
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

    const csvText = req.file.buffer.toString('utf-8')
    const leagueId = req.params.leagueId

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
