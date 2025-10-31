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
        username TEXT UNIQUE,
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

    // Add league_info column if it doesn't exist (migration)
    db.run(`ALTER TABLE leagues ADD COLUMN league_info TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding league_info column:', err)
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

    // NOTE: Removed position/sub_position/jersey_number from users table
    // These fields should be team/league-specific in the players table, not global to users
    // Migration handled in users table migration below

    // Add position column to players if it doesn't exist (migration)
    db.run(`ALTER TABLE players ADD COLUMN position TEXT DEFAULT 'player'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding position column to players:', err)
      }
    })

    // Add sub_position column to players if it doesn't exist (migration)
    db.run(`ALTER TABLE players ADD COLUMN sub_position TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding sub_position column to players:', err)
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

    // Add location column to games if it doesn't exist (migration)
    db.run(`ALTER TABLE games ADD COLUMN location TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding location column to games:', err)
      }
    })

    // Add rink_name column to games if it doesn't exist (migration)
    db.run(`ALTER TABLE games ADD COLUMN rink_name TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding rink_name column to games:', err)
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

    // Add payment tracking fields (migration)
    db.run(`ALTER TABLE payments ADD COLUMN payment_method TEXT DEFAULT 'venmo'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding payment_method column to payments:', err)
      }
    })

    db.run(`ALTER TABLE payments ADD COLUMN confirmation_number TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding confirmation_number column to payments:', err)
      }
    })

    db.run(`ALTER TABLE payments ADD COLUMN payment_notes TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding payment_notes column to payments:', err)
      }
    })

    db.run(`ALTER TABLE payments ADD COLUMN marked_paid_by INTEGER REFERENCES users(id)`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding marked_paid_by column to payments:', err)
      }
    })

    // Add UNIQUE constraint on (player_id, season_id) to ensure one payment record per player per season
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_player_season ON payments(player_id, season_id)`, (err) => {
      if (err) {
        console.error('Error creating unique index on payments (player_id, season_id):', err)
      } else {
        console.log('✅ Unique constraint added to payments table for (player_id, season_id)')
      }
    })

    // Add standings weight columns to seasons if they don't exist (migration)
    db.run(`ALTER TABLE seasons ADD COLUMN points_win INTEGER DEFAULT 2`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding points_win column to seasons:', err)
      }
    })
    db.run(`ALTER TABLE seasons ADD COLUMN points_loss INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding points_loss column to seasons:', err)
      }
    })
    db.run(`ALTER TABLE seasons ADD COLUMN points_tie INTEGER DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding points_tie column to seasons:', err)
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

    // Create announcements table
    db.run(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    // Create playoff brackets table
    db.run(`
      CREATE TABLE IF NOT EXISTS playoff_brackets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER NOT NULL,
        season_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `)

    // Create playoff matches table
    db.run(`
      CREATE TABLE IF NOT EXISTS playoff_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bracket_id INTEGER NOT NULL,
        round INTEGER NOT NULL,
        match_number INTEGER NOT NULL,
        team1_id INTEGER,
        team2_id INTEGER,
        team1_score INTEGER,
        team2_score INTEGER,
        winner_id INTEGER,
        game_date DATE,
        game_time TIME,
        rink_id INTEGER,
        surface_name TEXT,
        next_match_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bracket_id) REFERENCES playoff_brackets(id) ON DELETE CASCADE,
        FOREIGN KEY (team1_id) REFERENCES teams(id),
        FOREIGN KEY (team2_id) REFERENCES teams(id),
        FOREIGN KEY (winner_id) REFERENCES teams(id),
        FOREIGN KEY (rink_id) REFERENCES rinks(id),
        FOREIGN KEY (next_match_id) REFERENCES playoff_matches(id)
      )
    `)

    // Game attendance tracking table
    db.run(`
      CREATE TABLE IF NOT EXISTS game_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(game_id, player_id)
      )
    `)

    // Create player history table to track team/season history
    db.run(`
      CREATE TABLE IF NOT EXISTS player_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        user_id INTEGER,
        team_id INTEGER NOT NULL,
        season_id INTEGER NOT NULL,
        league_id INTEGER NOT NULL,
        jersey_number INTEGER,
        position TEXT DEFAULT 'player',
        sub_position TEXT,
        joined_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        left_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (season_id) REFERENCES seasons(id),
        FOREIGN KEY (league_id) REFERENCES leagues(id)
      )
    `)

    // Add sub_position column to player_history if it doesn't exist (migration)
    db.run(`ALTER TABLE player_history ADD COLUMN sub_position TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding sub_position column to player_history:', err)
      }
    })

    // Add is_captain column to player_history if it doesn't exist (migration)
    db.run(`ALTER TABLE player_history ADD COLUMN is_captain INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding is_captain column to player_history:', err)
      } else if (!err) {
        console.log('✅ Added is_captain column to player_history table')
      }
    })

    // Add password_reset_required column to users if it doesn't exist (migration)
    db.run(`ALTER TABLE users ADD COLUMN password_reset_required INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding password_reset_required column:', err)
      }
    })

    // Add username column to users if it doesn't exist (migration)
    // Step 1: Add column without UNIQUE constraint
    db.run(`ALTER TABLE users ADD COLUMN username TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding username column:', err)
      } else {
        // Step 2: Update existing admin user to have username "admin"
        db.run(`UPDATE users SET username = 'admin' WHERE email = 'admin@openrink.local' AND username IS NULL`, (updateErr) => {
          if (updateErr) {
            console.error('Error setting admin username:', updateErr)
          } else {
            // Step 3: Create UNIQUE index on username column
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`, (indexErr) => {
              if (indexErr) {
                console.error('Error creating username unique index:', indexErr)
              } else {
                console.log('Username column added successfully with UNIQUE constraint')
              }
            })
          }
        })
      }
    })

    // Migration: Remove position/sub_position/jersey_number from users table (should be team-specific)
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
      if (err) {
        console.error('Error checking users table schema:', err)
        return
      }

      // Check if users table still has position column (which should be removed)
      if (row && row.sql && row.sql.includes('position TEXT')) {
        console.log('Migrating users table to remove team-specific fields (position/sub_position/jersey_number)...')

        db.run(`
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            name TEXT,
            phone TEXT,
            role TEXT DEFAULT 'player',
            password_reset_required INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (createErr) => {
          if (createErr) {
            console.error('Error creating users_new table:', createErr)
            return
          }

          // Copy all data (excluding position/sub_position/jersey_number which should be team-specific)
          db.run(`
            INSERT INTO users_new (id, username, email, password, name, phone, role, password_reset_required, created_at)
            SELECT id, username, email, password, name, phone, role, password_reset_required, created_at FROM users
          `, (copyErr) => {
            if (copyErr) {
              console.error('Error copying data to users_new:', copyErr)
              return
            }

            // Drop old table
            db.run('DROP TABLE users', (dropErr) => {
              if (dropErr) {
                console.error('Error dropping old users table:', dropErr)
                return
              }

              // Rename new table
              db.run('ALTER TABLE users_new RENAME TO users', (renameErr) => {
                if (renameErr) {
                  console.error('Error renaming users_new to users:', renameErr)
                  return
                }

                // Remove email from admin user
                db.run("UPDATE users SET email = NULL WHERE username = 'admin'", (updateErr) => {
                  if (updateErr) {
                    console.error('Error removing admin email:', updateErr)
                  } else {
                    console.log('✅ Users table migrated: removed position/sub_position/jersey_number (now team-specific)')
                  }
                })
              })
            })
          })
        })
      }
    })

    // Create default admin user if it doesn't exist
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
      if (err) {
        console.error('Error checking for default admin:', err)
        return
      }

      if (!row) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10)
          db.run(
            'INSERT INTO users (username, password, name, role, password_reset_required) VALUES (?, ?, ?, ?, ?)',
            ['admin', hashedPassword, 'admin', 'admin', 0],
            (insertErr) => {
              if (insertErr) {
                console.error('Error creating default admin:', insertErr)
              } else {
                console.log('✅ Default admin user created')
                console.log('   Username: admin')
                console.log('   Password: admin123')
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
