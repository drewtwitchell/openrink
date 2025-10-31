import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

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
import teamCaptainsRoutes from './routes/team-captains.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security Middleware
// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// Rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

// CORS configuration with whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001']
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true)

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' })) // Add size limit to prevent large payload attacks

// Routes
app.use('/api/auth', authLimiter, authRoutes)
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
app.use('/api/team-captains', teamCaptainsRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OpenRink API is running' })
})

// Error handling
app.use((err, req, res, next) => {
  // Log error details for debugging (only visible in server logs)
  console.error('Error:', err.message)
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack)
  }

  // Send generic error message to client (don't leak stack traces or internal details)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An error occurred. Please try again later.'
      : err.message || 'Something went wrong!'
  })
})

app.listen(PORT, () => {
  console.log(`🏒 OpenRink API server running on port ${PORT}`)
})
