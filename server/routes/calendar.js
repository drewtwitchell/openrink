import express from 'express'
import db from '../database.js'

const router = express.Router()

// Generate iCal format for team games
router.get('/team/:teamId', (req, res) => {
  const { teamId } = req.params

  // Get team info and games
  db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, team) => {
    if (err || !team) {
      return res.status(404).send('Team not found')
    }

    db.all(
      `SELECT games.*,
        home_team.name as home_team_name,
        away_team.name as away_team_name,
        rinks.name as rink_name,
        rinks.address as rink_address
       FROM games
       LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
       LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
       LEFT JOIN rinks ON games.rink_id = rinks.id
       WHERE games.home_team_id = ? OR games.away_team_id = ?
       ORDER BY games.game_date ASC, games.game_time ASC`,
      [teamId, teamId],
      (err, games) => {
        if (err) {
          return res.status(500).send('Error fetching games')
        }

        // Generate iCal content
        const ical = generateICalendar(team, games)

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${team.name.replace(/\s+/g, '_')}_games.ics"`)
        res.send(ical)
      }
    )
  })
})

// Generate iCal format for league games
router.get('/league/:leagueId', (req, res) => {
  const { leagueId } = req.params

  // Get league info
  db.get('SELECT * FROM leagues WHERE id = ?', [leagueId], (err, league) => {
    if (err || !league) {
      return res.status(404).send('League not found')
    }

    // Get all teams in league
    db.all('SELECT id FROM teams WHERE league_id = ?', [leagueId], (err, teams) => {
      if (err) {
        return res.status(500).send('Error fetching teams')
      }

      const teamIds = teams.map(t => t.id)
      if (teamIds.length === 0) {
        return res.status(404).send('No teams found in league')
      }

      const placeholders = teamIds.map(() => '?').join(',')

      db.all(
        `SELECT games.*,
          home_team.name as home_team_name,
          away_team.name as away_team_name,
          rinks.name as rink_name,
          rinks.address as rink_address
         FROM games
         LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
         LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
         LEFT JOIN rinks ON games.rink_id = rinks.id
         WHERE games.home_team_id IN (${placeholders}) OR games.away_team_id IN (${placeholders})
         ORDER BY games.game_date ASC, games.game_time ASC`,
        [...teamIds, ...teamIds],
        (err, games) => {
          if (err) {
            return res.status(500).send('Error fetching games')
          }

          // Generate iCal content
          const ical = generateICalendar({ name: league.name }, games)

          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Content-Disposition', `attachment; filename="${league.name.replace(/\s+/g, '_')}_games.ics"`)
          res.send(ical)
        }
      )
    })
  })
})

function generateICalendar(entity, games) {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenRink//Hockey League Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${entity.name} Games`,
    'X-WR-TIMEZONE:America/New_York',
    'X-WR-CALDESC:Hockey game schedule'
  ].join('\r\n')

  games.forEach((game) => {
    const gameDateTime = new Date(`${game.game_date}T${game.game_time}`)
    const gameEndDateTime = new Date(gameDateTime.getTime() + 90 * 60000) // 90 min duration

    const dtstart = gameDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dtend = gameEndDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const uid = `game-${game.id}@openrink.app`

    const location = game.rink_name ?
      `${game.rink_name}${game.surface_name ? ` - ${game.surface_name}` : ''}${game.rink_address ? `, ${game.rink_address}` : ''}` :
      'TBD'

    const summary = `${game.home_team_name} vs ${game.away_team_name}`
    const description = `Hockey Game\\n${game.home_team_name} vs ${game.away_team_name}${game.home_score != null ? `\\nScore: ${game.home_score} - ${game.away_score}` : ''}`

    ical += '\r\n' + [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    ].join('\r\n')
  })

  ical += '\r\nEND:VCALENDAR'

  return ical
}

export default router
