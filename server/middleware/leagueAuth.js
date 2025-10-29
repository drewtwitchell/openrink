import db from '../database.js'

/**
 * Middleware to check if user is admin or manages a specific league
 * Requires league_id to be in req.params.id or req.params.leagueId or req.body.league_id
 */
export function requireLeagueManager(req, res, next) {
  const leagueId = req.params.id || req.params.leagueId || req.body.league_id

  if (!leagueId) {
    return res.status(400).json({ error: 'League ID required' })
  }

  // Check if user is admin or manages this league
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (user.role === 'admin') {
      return next() // Admins can access any league
    }

    // Check if user is a league manager for this specific league
    db.get(
      'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
      [req.user.id, leagueId],
      (err, manager) => {
        if (err || !manager) {
          return res.status(403).json({ error: 'Not authorized to manage this league' })
        }
        next()
      }
    )
  })
}

/**
 * Middleware to check if user manages the league that owns a team
 * Requires team_id to be in req.params.id or req.params.teamId or req.body.team_id
 */
export function requireTeamLeagueManager(req, res, next) {
  const teamId = req.params.id || req.params.teamId || req.body.team_id

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID required' })
  }

  // First get the team to find its league_id
  db.get('SELECT league_id FROM teams WHERE id = ?', [teamId], (err, team) => {
    if (err || !team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    req.teamLeagueId = team.league_id

    // Check if user is admin or manages this league
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      if (user.role === 'admin') {
        return next() // Admins can access any league
      }

      // Check if user is a league manager for this team's league
      db.get(
        'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
        [req.user.id, team.league_id],
        (err, manager) => {
          if (err || !manager) {
            return res.status(403).json({ error: 'Not authorized to manage this team\'s league' })
          }
          next()
        }
      )
    })
  })
}

/**
 * Middleware to check if user manages the league that owns a season
 * Requires season_id to be in req.params.id or req.params.seasonId or req.body.season_id
 */
export function requireSeasonLeagueManager(req, res, next) {
  const seasonId = req.params.id || req.params.seasonId || req.body.season_id

  if (!seasonId) {
    return res.status(400).json({ error: 'Season ID required' })
  }

  // First get the season to find its league_id
  db.get('SELECT league_id FROM seasons WHERE id = ?', [seasonId], (err, season) => {
    if (err || !season) {
      return res.status(404).json({ error: 'Season not found' })
    }

    req.seasonLeagueId = season.league_id

    // Check if user is admin or manages this league
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      if (user.role === 'admin') {
        return next() // Admins can access any league
      }

      // Check if user is a league manager for this season's league
      db.get(
        'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
        [req.user.id, season.league_id],
        (err, manager) => {
          if (err || !manager) {
            return res.status(403).json({ error: 'Not authorized to manage this season\'s league' })
          }
          next()
        }
      )
    })
  })
}

/**
 * Middleware to check if user manages the league that owns a player
 * Requires player_id to be in req.params.id or req.params.playerId or req.body.player_id
 */
export function requirePlayerLeagueManager(req, res, next) {
  const playerId = req.params.id || req.params.playerId || req.body.player_id

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID required' })
  }

  // Get the player's team and league
  db.get(
    `SELECT teams.league_id
     FROM players
     INNER JOIN teams ON players.team_id = teams.id
     WHERE players.id = ?`,
    [playerId],
    (err, result) => {
      if (err || !result) {
        return res.status(404).json({ error: 'Player not found' })
      }

      req.playerLeagueId = result.league_id

      // Check if user is admin or manages this league
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role === 'admin') {
          return next() // Admins can access any league
        }

        // Check if user is a league manager for this player's league
        db.get(
          'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
          [req.user.id, result.league_id],
          (err, manager) => {
            if (err || !manager) {
              return res.status(403).json({ error: 'Not authorized to manage this player\'s league' })
            }
            next()
          }
        )
      })
    }
  )
}

/**
 * Middleware to check if user manages the league that owns a game
 * Requires game_id to be in req.params.id or req.params.gameId or req.body.game_id
 */
export function requireGameLeagueManager(req, res, next) {
  const gameId = req.params.id || req.params.gameId || req.body.game_id

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID required' })
  }

  // Get the game's league via home team
  db.get(
    `SELECT teams.league_id
     FROM games
     INNER JOIN teams ON games.home_team_id = teams.id
     WHERE games.id = ?`,
    [gameId],
    (err, result) => {
      if (err || !result) {
        return res.status(404).json({ error: 'Game not found' })
      }

      req.gameLeagueId = result.league_id

      // Check if user is admin or manages this league
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role === 'admin') {
          return next() // Admins can access any league
        }

        // Check if user is a league manager for this game's league
        db.get(
          'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
          [req.user.id, result.league_id],
          (err, manager) => {
            if (err || !manager) {
              return res.status(403).json({ error: 'Not authorized to manage this game\'s league' })
            }
            next()
          }
        )
      })
    }
  )
}

/**
 * Middleware to check if user manages the league that owns a payment
 * Requires payment_id to be in req.params.id
 */
export function requirePaymentLeagueManager(req, res, next) {
  const paymentId = req.params.id

  if (!paymentId) {
    return res.status(400).json({ error: 'Payment ID required' })
  }

  // Get the payment's league via team
  db.get(
    `SELECT teams.league_id
     FROM payments
     INNER JOIN teams ON payments.team_id = teams.id
     WHERE payments.id = ?`,
    [paymentId],
    (err, result) => {
      if (err || !result) {
        return res.status(404).json({ error: 'Payment not found' })
      }

      req.paymentLeagueId = result.league_id

      // Check if user is admin or manages this league
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role === 'admin') {
          return next() // Admins can access any league
        }

        // Check if user is a league manager for this payment's league
        db.get(
          'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
          [req.user.id, result.league_id],
          (err, manager) => {
            if (err || !manager) {
              return res.status(403).json({ error: 'Not authorized to manage this payment\'s league' })
            }
            next()
          }
        )
      })
    }
  )
}

/**
 * Middleware to check if user manages the league that owns a sub-request
 * Requires sub_request_id to be in req.params.id
 */
export function requireSubRequestLeagueManager(req, res, next) {
  const subRequestId = req.params.id

  if (!subRequestId) {
    return res.status(400).json({ error: 'Sub request ID required' })
  }

  // Get the sub-request's league via game → team
  db.get(
    `SELECT teams.league_id
     FROM sub_requests
     INNER JOIN games ON sub_requests.game_id = games.id
     INNER JOIN teams ON games.home_team_id = teams.id
     WHERE sub_requests.id = ?`,
    [subRequestId],
    (err, result) => {
      if (err || !result) {
        return res.status(404).json({ error: 'Sub request not found' })
      }

      req.subRequestLeagueId = result.league_id

      // Check if user is admin or manages this league
      db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        if (user.role === 'admin') {
          return next() // Admins can access any league
        }

        // Check if user is a league manager for this sub-request's league
        db.get(
          'SELECT id FROM league_managers WHERE user_id = ? AND league_id = ?',
          [req.user.id, result.league_id],
          (err, manager) => {
            if (err || !manager) {
              return res.status(403).json({ error: 'Not authorized to manage this sub-request\'s league' })
            }
            next()
          }
        )
      })
    }
  )
}
