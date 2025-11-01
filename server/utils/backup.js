import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '..', 'openrink.db')
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

/**
 * Create a backup of the database
 * @returns {string} Path to the backup file
 */
export function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `database-backup-${timestamp}.sqlite`
    const backupPath = path.join(BACKUP_DIR, backupFileName)

    // Copy the database file
    fs.copyFileSync(DB_PATH, backupPath)

    console.log(`✅ Database backup created: ${backupFileName}`)

    // Clean up old backups (keep last 10)
    cleanupOldBackups()

    return backupPath
  } catch (error) {
    console.error('❌ Error creating backup:', error)
    throw error
  }
}

/**
 * Get list of all backups
 * @returns {Array} List of backup files with metadata
 */
export function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
    const backups = files
      .filter(file => file.startsWith('database-backup-') && file.endsWith('.sqlite'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file)
        const stats = fs.statSync(filePath)
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.mtime,
          createdISO: stats.mtime.toISOString()
        }
      })
      .sort((a, b) => b.created - a.created) // Sort by newest first

    return backups
  } catch (error) {
    console.error('❌ Error listing backups:', error)
    return []
  }
}

/**
 * Restore database from a backup
 * @param {string} backupFileName - Name of the backup file to restore
 */
export function restoreBackup(backupFileName) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFileName)

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFileName}`)
    }

    // Create a backup of current database before restoring
    const currentBackupName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`
    const currentBackupPath = path.join(BACKUP_DIR, currentBackupName)
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, currentBackupPath)
      console.log(`📦 Current database backed up as: ${currentBackupName}`)
    }

    // Restore the backup
    fs.copyFileSync(backupPath, DB_PATH)
    console.log(`✅ Database restored from: ${backupFileName}`)

    return true
  } catch (error) {
    console.error('❌ Error restoring backup:', error)
    throw error
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 * @param {number} keepCount - Number of backups to keep (default: 10)
 */
export function cleanupOldBackups(keepCount = 10) {
  try {
    const backups = listBackups()

    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount)

      toDelete.forEach(backup => {
        fs.unlinkSync(backup.path)
        console.log(`🗑️  Deleted old backup: ${backup.filename}`)
      })

      console.log(`✅ Cleaned up ${toDelete.length} old backup(s)`)
    }
  } catch (error) {
    console.error('❌ Error cleaning up old backups:', error)
  }
}

/**
 * Schedule weekly backups
 * Runs every Sunday at 2:00 AM
 */
export function scheduleWeeklyBackup() {
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

  // Calculate time until next Sunday 2:00 AM
  const now = new Date()
  const nextSunday = new Date(now)
  nextSunday.setDate(now.getDate() + (7 - now.getDay())) // Next Sunday
  nextSunday.setHours(2, 0, 0, 0) // 2:00 AM

  // If next Sunday is in the past, add a week
  if (nextSunday <= now) {
    nextSunday.setDate(nextSunday.getDate() + 7)
  }

  const timeUntilNextBackup = nextSunday - now

  console.log(`📅 Next weekly backup scheduled for: ${nextSunday.toLocaleString()}`)

  // Schedule the first backup
  setTimeout(() => {
    createBackup()
    // Then schedule recurring weekly backups
    setInterval(createBackup, ONE_WEEK)
  }, timeUntilNextBackup)

  // Also set up recurring weekly backups starting from the first one
}

/**
 * Initialize backup system
 * Creates initial backup and schedules weekly backups
 */
export function initBackupSystem() {
  console.log('🔄 Initializing backup system...')

  // Create initial backup if database exists
  if (fs.existsSync(DB_PATH)) {
    try {
      createBackup()
    } catch (error) {
      console.error('Failed to create initial backup:', error)
    }
  }

  // Schedule weekly backups
  scheduleWeeklyBackup()

  console.log('✅ Backup system initialized')
}
