import sqlite3 from 'sqlite3'
import bcrypt from 'bcrypt'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const db = new sqlite3.Database(join(__dirname, 'openrink.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err)
  } else {
    console.log('Connected to SQLite database')
    initDatabase()
  }
})

function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        role TEXT DEFAULT 'player',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add phone column if it doesn't exist (migration)
    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding phone column:', err)
      }
    })

    // Add role column if it doesn't exist (migration)
    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player'`, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding role column:', err)
      }

      // Set default role for any existing users with NULL role
      db.run(`UPDATE users SET role = 'player' WHERE role IS NULL`, (updateErr) => {
        if (updateErr) {
          console.error('Error setting default roles:', updateErr)
        } else {
          console.log('Updated NULL roles to player')
        }
      })
    })

    // League managers table
    db.run(`
      CREATE TABLE IF NOT EXISTS league_managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, league_id)
      )
    `)

    // Team captains table
    db.run(`
      CREATE TABLE IF NOT EXISTS team_captains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, team_id)
      )
    `)

    // Leagues table
    db.run(`
      CREATE TABLE IF NOT EXISTS leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        season TEXT,
        season_dues DECIMAL(10,2),
        venmo_link TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add season_dues column if it doesn't exist (migration)
    db.run(`ALTER TABLE leagues ADD COLUMN season_dues DECIMAL(10,2)`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding season_dues column:', err)
      }
    })

    // Add venmo_link column if it doesn't exist (migration)
    db.run(`ALTER TABLE leagues ADD COLUMN venmo_link TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding venmo_link column:', err)
      }
    })

    // Add archived column if it doesn't exist (migration)
    db.run(`ALTER TABLE leagues ADD COLUMN archived INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding archived column:', err)
      }
    })

    // Seasons table (multiple seasons per league)
    db.run(`
      CREATE TABLE IF NOT EXISTS seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        season_dues DECIMAL(10,2),
        venmo_link TEXT,
        start_date DATE,
        end_date DATE,
        is_active INTEGER DEFAULT 1,
        archived INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating seasons table:', err)
      } else {
        // Migrate existing leagues to have a default season
        db.all('SELECT * FROM leagues', [], (err, leagues) => {
          if (err) {
            console.error('Error fetching leagues for migration:', err)
            return
          }

          leagues.forEach((league) => {
            // Check if this league already has a season
            db.get('SELECT id FROM seasons WHERE league_id = ?', [league.id], (err, existingSeason) => {
              if (err || existingSeason) return

              // Create default season for this league
              db.run(
                `INSERT INTO seasons (league_id, name, description, season_dues, venmo_link, is_active, archived)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  league.id,
                  league.season || 'Default Season',
                  league.description || '',
                  league.season_dues || null,
                  league.venmo_link || null,
                  1,
                  league.archived || 0
                ],
                function(err) {
                  if (err) {
                    console.error('Error creating default season for league:', err)
                  } else {
                    const seasonId = this.lastID
                    // Update teams to reference this season
                    db.run('UPDATE teams SET season_id = ? WHERE league_id = ? AND season_id IS NULL',
                      [seasonId, league.id]
                    )
                    // Update games to reference this season
                    db.run(`UPDATE games SET season_id = ?
                            WHERE season_id IS NULL AND home_team_id IN
                            (SELECT id FROM teams WHERE league_id = ?)`,
                      [seasonId, league.id]
                    )
                  }
                }
              )
            })
          })
        })
      }
    })

    // Rinks table
    db.run(`
      CREATE TABLE IF NOT EXISTS rinks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Teams table
    db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#0284c7',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add season_id column to teams if it doesn't exist (migration)
    db.run(`ALTER TABLE teams ADD COLUMN season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding season_id column to teams:', err)
      }
    })

    // Players table
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        jersey_number INTEGER,
        email_notifications INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add user_id column to players if it doesn't exist (migration)
    db.run(`ALTER TABLE players ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding user_id column to players:', err)
      }
    })

    // Games table
    db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        home_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        away_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        game_date DATE NOT NULL,
        game_time TIME NOT NULL,
        rink_id INTEGER REFERENCES rinks(id),
        surface_name TEXT DEFAULT 'NHL',
        home_score INTEGER,
        away_score INTEGER,
        status TEXT DEFAULT 'scheduled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add season_id column to games if it doesn't exist (migration)
    db.run(`ALTER TABLE games ADD COLUMN season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding season_id column to games:', err)
      }
    })

    // Payments table
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        venmo_link TEXT,
        status TEXT DEFAULT 'pending',
        due_date DATE,
        paid_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add season_id column to payments if it doesn't exist (migration)
    db.run(`ALTER TABLE payments ADD COLUMN season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding season_id column to payments:', err)
      }
    })

    // Sub requests table
    db.run(`
      CREATE TABLE IF NOT EXISTS sub_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        requesting_player_id INTEGER REFERENCES players(id),
        substitute_player_id INTEGER REFERENCES players(id),
        status TEXT DEFAULT 'open',
        payment_required INTEGER DEFAULT 0,
        payment_amount DECIMAL(10,2),
        venmo_link TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Insert sample rinks
    db.run(`
      INSERT OR IGNORE INTO rinks (id, name, address) VALUES
      (1, 'IceCenter', '123 Hockey Lane, Ice Town, USA'),
      (2, 'Twin Rinks Arena', '456 Skate Street, Puck City, USA')
    `)

    // Create default admin user if it doesn't exist
    db.get('SELECT id FROM users WHERE email = ?', ['admin@openrink.local'], async (err, row) => {
      if (err) {
        console.error('Error checking for default admin:', err)
        return
      }

      if (!row) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10)
          db.run(
            'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
            ['admin@openrink.local', hashedPassword, 'Default Admin', 'admin'],
            (insertErr) => {
              if (insertErr) {
                console.error('Error creating default admin:', insertErr)
              } else {
                console.log('✅ Default admin user created')
                console.log('   Email: admin@openrink.local')
                console.log('   Password: admin123')
                console.log('   ⚠️  Please change this password in production!')
              }
            }
          )
        } catch (hashErr) {
          console.error('Error hashing default admin password:', hashErr)
        }
      } else {
        console.log('Default admin user already exists')
      }
    })

    console.log('Database initialized successfully')
  })
}

export default db
