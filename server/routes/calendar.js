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

    // Get regular season games
    db.all(
      `SELECT games.*,
        home_team.name as home_team_name,
        away_team.name as away_team_name,
        rinks.name as rink_name,
        rinks.address as rink_address,
        'regular' as game_type
       FROM games
       LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
       LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
       LEFT JOIN rinks ON games.rink_id = rinks.id
       WHERE games.home_team_id = ? OR games.away_team_id = ?
       ORDER BY games.game_date ASC, games.game_time ASC`,
      [teamId, teamId],
      (err, regularGames) => {
        if (err) {
          return res.status(500).send('Error fetching games')
        }

        // Get playoff games
        db.all(
          `SELECT
            pm.id,
            pm.game_date,
            pm.game_time,
            pm.team1_score as home_score,
            pm.team2_score as away_score,
            t1.name as home_team_name,
            t2.name as away_team_name,
            r.name as rink_name,
            r.address as rink_address,
            pm.surface_name,
            'playoff' as game_type,
            pm.round
           FROM playoff_matches pm
           LEFT JOIN teams t1 ON pm.team1_id = t1.id
           LEFT JOIN teams t2 ON pm.team2_id = t2.id
           LEFT JOIN rinks r ON pm.rink_id = r.id
           WHERE (pm.team1_id = ? OR pm.team2_id = ?) AND pm.game_date IS NOT NULL
           ORDER BY pm.game_date ASC, pm.game_time ASC`,
          [teamId, teamId],
          (err, playoffGames) => {
            if (err) {
              return res.status(500).send('Error fetching playoff games')
            }

            // Combine all games
            const allGames = [...regularGames, ...playoffGames].sort((a, b) => {
              const dateA = new Date(`${a.game_date}T${a.game_time}`)
              const dateB = new Date(`${b.game_date}T${b.game_time}`)
              return dateA - dateB
            })

            // Generate iCal content
            const ical = generateICalendar(team, allGames)

            res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
            res.setHeader('Content-Disposition', `inline; filename="${team.name.replace(/\s+/g, '_')}_games.ics"`)
            res.send(ical)
          }
        )
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

      // Get regular season games
      db.all(
        `SELECT games.*,
          home_team.name as home_team_name,
          away_team.name as away_team_name,
          rinks.name as rink_name,
          rinks.address as rink_address,
          'regular' as game_type
         FROM games
         LEFT JOIN teams as home_team ON games.home_team_id = home_team.id
         LEFT JOIN teams as away_team ON games.away_team_id = away_team.id
         LEFT JOIN rinks ON games.rink_id = rinks.id
         WHERE games.home_team_id IN (${placeholders}) OR games.away_team_id IN (${placeholders})
         ORDER BY games.game_date ASC, games.game_time ASC`,
        [...teamIds, ...teamIds],
        (err, regularGames) => {
          if (err) {
            return res.status(500).send('Error fetching games')
          }

          // Get playoff games
          db.all(
            `SELECT
              pm.id,
              pm.game_date,
              pm.game_time,
              pm.team1_score as home_score,
              pm.team2_score as away_score,
              t1.name as home_team_name,
              t2.name as away_team_name,
              r.name as rink_name,
              r.address as rink_address,
              pm.surface_name,
              'playoff' as game_type,
              pm.round
             FROM playoff_matches pm
             INNER JOIN playoff_brackets pb ON pm.bracket_id = pb.id
             LEFT JOIN teams t1 ON pm.team1_id = t1.id
             LEFT JOIN teams t2 ON pm.team2_id = t2.id
             LEFT JOIN rinks r ON pm.rink_id = r.id
             WHERE pb.league_id = ? AND pm.game_date IS NOT NULL
             ORDER BY pm.game_date ASC, pm.game_time ASC`,
            [leagueId],
            (err, playoffGames) => {
              if (err) {
                return res.status(500).send('Error fetching playoff games')
              }

              // Combine all games
              const allGames = [...regularGames, ...playoffGames].sort((a, b) => {
                const dateA = new Date(`${a.game_date}T${a.game_time}`)
                const dateB = new Date(`${b.game_date}T${b.game_time}`)
                return dateA - dateB
              })

              // Generate iCal content
              const ical = generateICalendar({ name: league.name }, allGames)

              res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
              res.setHeader('Content-Disposition', `inline; filename="${league.name.replace(/\s+/g, '_')}_games.ics"`)
              res.send(ical)
            }
          )
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
    'X-WR-CALDESC:Hockey game schedule',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H'
  ].join('\r\n')

  games.forEach((game) => {
    const gameDateTime = new Date(`${game.game_date}T${game.game_time}`)
    const gameEndDateTime = new Date(gameDateTime.getTime() + 90 * 60000) // 90 min duration

    const dtstart = gameDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dtend = gameEndDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const uid = `${game.game_type || 'regular'}-${game.id}@openrink.app`

    const location = game.rink_name ?
      `${game.rink_name}${game.surface_name ? ` - ${game.surface_name}` : ''}${game.rink_address ? `, ${game.rink_address}` : ''}` :
      'TBD'

    const isPlayoff = game.game_type === 'playoff'
    const playoffPrefix = isPlayoff ? `[PLAYOFF${game.round ? ` - Round ${game.round}` : ''}] ` : ''
    const summary = `${playoffPrefix}${game.home_team_name} vs ${game.away_team_name}`
    const description = `${isPlayoff ? 'Playoff ' : ''}Hockey Game\\n${game.home_team_name} vs ${game.away_team_name}${game.home_score != null ? `\\nScore: ${game.home_score} - ${game.away_score}` : ''}`

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
