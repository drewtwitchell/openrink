import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { announcements, auth } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Announcements() {
  const { leagueId } = useParams()
  const [announcementsList, setAnnouncementsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    expires_at: '',
  })
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    setCurrentUser(auth.getUser())
    fetchAnnouncements()
  }, [leagueId])

  const fetchAnnouncements = async () => {
    try {
      const data = await announcements.getAll(leagueId)
      setAnnouncementsList(data)
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await announcements.update(editingId, formData)
      } else {
        await announcements.create({
          ...formData,
          league_id: leagueId,
        })
      }
      setFormData({ title: '', message: '', expires_at: '' })
      setShowForm(false)
      setEditingId(null)
      fetchAnnouncements()
    } catch (error) {
      alert('Error saving announcement: ' + error.message)
    }
  }

  const handleEdit = (announcement) => {
    setEditingId(announcement.id)
    setFormData({
      title: announcement.title,
      message: announcement.message,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete announcement "${title}"?`)) return

    try {
      await announcements.delete(id)
      fetchAnnouncements()
    } catch (error) {
      alert('Error deleting announcement: ' + error.message)
    }
  }

  const handleToggleActive = async (announcement) => {
    try {
      await announcements.update(announcement.id, {
        ...announcement,
        is_active: announcement.is_active === 1 ? 0 : 1,
      })
      fetchAnnouncements()
    } catch (error) {
      alert('Error updating announcement: ' + error.message)
    }
  }

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'league_manager'

  if (loading) {
    return <div>Loading...</div>
  }

  if (!canManage) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">
          You don't have permission to manage announcements.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Announcements' }
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">League Announcements</h1>
          <p className="page-subtitle">{announcementsList.length} total</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingId(null)
            setFormData({ title: '', message: '', expires_at: '' })
          }}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Announcement' : 'Create New Announcement'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder="Important Update"
                required
              />
            </div>

            <div>
              <label className="label">Message *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="input"
                rows="4"
                placeholder="Enter your announcement message..."
                required
              />
            </div>

            <div>
              <label className="label">Expiration Date (optional)</label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank for no expiration
              </p>
            </div>

            <button type="submit" className="btn-primary">
              {editingId ? 'Update Announcement' : 'Create Announcement'}
            </button>
          </form>
        </div>
      )}

      {announcementsList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No announcements yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Create Your First Announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcementsList.map((announcement) => (
            <div
              key={announcement.id}
              className={`card ${announcement.is_active === 1 ? 'bg-white' : 'bg-gray-50'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    <span
                      className={`badge ${
                        announcement.is_active === 1 ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {announcement.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{announcement.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Posted {new Date(announcement.created_at).toLocaleDateString()}</span>
                    {announcement.expires_at && (
                      <span>
                        Expires {new Date(announcement.expires_at).toLocaleDateString()}
                      </span>
                    )}
                    <span>By {announcement.author_name}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(announcement)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    {announcement.is_active === 1 ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(announcement)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id, announcement.title)}
                    className="btn-danger text-xs py-1 px-3"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
