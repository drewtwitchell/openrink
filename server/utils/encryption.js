import CryptoJS from 'crypto-js'

// Get encryption key from environment, use default for development only
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production'

// Validate encryption key in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-encryption-key-change-in-production') {
    console.error('CRITICAL SECURITY WARNING: ENCRYPTION_KEY is not set or using default value in production!')
    console.error('Please set a strong ENCRYPTION_KEY in your .env file immediately.')
    console.error('Application will continue but sensitive data is INSECURE.')
  }

  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    console.warn('SECURITY WARNING: ENCRYPTION_KEY should be at least 32 characters long for production use.')
  }
}

/**
 * Encrypts sensitive data using AES-256 encryption
 * @param {string} text - The plaintext to encrypt
 * @returns {string} The encrypted ciphertext
 */
export function encrypt(text) {
  if (!text) return null

  try {
    const ciphertext = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
    return ciphertext
  } catch (error) {
    console.error('Encryption error:', error.message)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts sensitive data that was encrypted with AES-256
 * @param {string} ciphertext - The encrypted text to decrypt
 * @returns {string} The decrypted plaintext
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return null

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
    const plaintext = bytes.toString(CryptoJS.enc.Utf8)
    return plaintext
  } catch (error) {
    console.error('Decryption error:', error.message)
    // Return null instead of throwing to handle legacy unencrypted data gracefully
    return null
  }
}

/**
 * Check if a string appears to be encrypted (basic heuristic)
 * @param {string} text - The text to check
 * @returns {boolean} True if the text appears to be encrypted
 */
export function isEncrypted(text) {
  if (!text) return false

  // AES encryption from crypto-js produces base64-like output
  // This is a basic check - encrypted data should not contain common email/phone patterns
  const hasEmailPattern = /@/.test(text)
  const hasPhonePattern = /\d{3}[-\s]?\d{3}[-\s]?\d{4}/.test(text)

  // If it looks like plaintext email/phone, it's not encrypted
  if (hasEmailPattern || hasPhonePattern) return false

  // If it's longer than 20 chars and looks base64-ish, probably encrypted
  return text.length > 20
}

/**
 * Encrypts sensitive user fields (email, phone)
 * @param {object} user - User object with potentially sensitive fields
 * @returns {object} User object with encrypted fields
 */
export function encryptUserFields(user) {
  const encrypted = { ...user }

  if (user.email && !isEncrypted(user.email)) {
    encrypted.email = encrypt(user.email)
  }

  if (user.phone && !isEncrypted(user.phone)) {
    encrypted.phone = encrypt(user.phone)
  }

  return encrypted
}

/**
 * Decrypts sensitive user fields (email, phone)
 * @param {object} user - User object with potentially encrypted fields
 * @returns {object} User object with decrypted fields
 */
export function decryptUserFields(user) {
  const decrypted = { ...user }

  if (user.email && isEncrypted(user.email)) {
    decrypted.email = decrypt(user.email) || user.email
  }

  if (user.phone && isEncrypted(user.phone)) {
    decrypted.phone = decrypt(user.phone) || user.phone
  }

  return decrypted
}
