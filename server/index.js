import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Import routes
import authRoutes from './routes/auth.js'
import leagueRoutes from './routes/leagues.js'
import teamRoutes from './routes/teams.js'
import gameRoutes from './routes/games.js'
import rinkRoutes from './routes/rinks.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/rinks', rinkRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OpenRink API is running' })
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

app.listen(PORT, () => {
  console.log(`🏒 OpenRink API server running on port ${PORT}`)
})
