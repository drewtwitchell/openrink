import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Validate JWT_SECRET in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    console.error('CRITICAL SECURITY WARNING: JWT_SECRET is not set or using default value in production!')
    console.error('Please set a strong JWT_SECRET in your .env file immediately.')
    console.error('Application will continue but is INSECURE.')
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('SECURITY WARNING: JWT_SECRET should be at least 32 characters long for production use.')
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Middleware to require admin role
export function requireAdmin(req, res, next) {
  // User should be already authenticated via authenticateToken
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Get user's role from database
  import('../database.js').then(({ default: db }) => {
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        console.error('Error checking user role:', err)
        return res.status(500).json({ error: 'Error verifying permissions' })
      }

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      next()
    })
  })
}
