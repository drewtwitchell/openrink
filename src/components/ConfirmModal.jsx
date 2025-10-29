import { useEffect } from 'react'

/**
 * Modern confirmation modal component
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Called when modal is closed without confirming
 * @param {function} onConfirm - Called when user confirms the action
 * @param {string} title - Modal title
 * @param {string} message - Modal message/description
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Button variant: "danger" or "primary" (default: "danger")
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const confirmButtonClass = variant === 'danger' ? 'btn-danger' : 'btn-primary'

  return (
    <div
      className="modal-overlay animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="modal-container animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="modal-header mb-0">{title}</h3>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="modal-actions">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={confirmButtonClass}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
