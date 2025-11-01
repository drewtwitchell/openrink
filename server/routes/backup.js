import express from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { createBackup, listBackups, restoreBackup } from '../utils/backup.js'

const router = express.Router()

// All backup routes require admin authentication
router.use(authenticateToken, requireAdmin)

// Get list of all backups
router.get('/', (req, res) => {
  try {
    const backups = listBackups()
    res.json({
      backups,
      count: backups.length
    })
  } catch (error) {
    console.error('Error listing backups:', error)
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

// Create a new backup
router.post('/create', (req, res) => {
  try {
    const backupPath = createBackup()
    const backups = listBackups()
    const newBackup = backups.find(b => b.path === backupPath)

    res.json({
      message: 'Backup created successfully',
      backup: newBackup
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// Restore from a backup
router.post('/restore', (req, res) => {
  const { filename } = req.body

  if (!filename) {
    return res.status(400).json({ error: 'Backup filename is required' })
  }

  try {
    restoreBackup(filename)
    res.json({
      message: 'Database restored successfully. Server will restart to apply changes.',
      filename
    })

    // Restart the server after a short delay
    setTimeout(() => {
      console.log('🔄 Restarting server after database restore...')
      process.exit(0) // Let nodemon restart the server
    }, 1000)
  } catch (error) {
    console.error('Error restoring backup:', error)
    res.status(500).json({ error: error.message || 'Failed to restore backup' })
  }
})

// Download a backup file
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const backups = listBackups()
    const backup = backups.find(b => b.filename === filename)

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' })
    }

    res.download(backup.path, filename)
  } catch (error) {
    console.error('Error downloading backup:', error)
    res.status(500).json({ error: 'Failed to download backup' })
  }
})

export default router
