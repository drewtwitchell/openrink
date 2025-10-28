import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Import routes
import authRoutes from './routes/auth.js'
import leagueRoutes from './routes/leagues.js'
import seasonRoutes from './routes/seasons.js'
import teamRoutes from './routes/teams.js'
import gameRoutes from './routes/games.js'
import rinkRoutes from './routes/rinks.js'
import playerRoutes from './routes/players.js'
import csvUploadRoutes from './routes/csv-upload.js'
import paymentRoutes from './routes/payments.js'
import subRequestRoutes from './routes/sub-requests.js'
import calendarRoutes from './routes/calendar.js'
import announcementRoutes from './routes/announcements.js'
import playoffRoutes from './routes/playoffs.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/seasons', seasonRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/rinks', rinkRoutes)
app.use('/api/players', playerRoutes)
app.use('/api/csv', csvUploadRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/sub-requests', subRequestRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/playoffs', playoffRoutes)

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
