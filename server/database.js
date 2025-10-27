import sqlite3 from 'sqlite3'
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
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

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

    // Players table
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        jersey_number INTEGER,
        email_notifications INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

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

    console.log('Database initialized successfully')
  })
}

export default db
