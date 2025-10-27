import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { teams, players, csv, payments } from '../lib/api'

export default function TeamRoster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [roster, setRoster] = useState([])
  const [teamPayments, setTeamPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPaymentSetup, setShowPaymentSetup] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    jersey_number: '',
    email_notifications: true,
  })
  const [paymentSetupData, setPaymentSetupData] = useState({
    amount: '',
    description: 'Season Dues',
    venmo_link: '',
    due_date: '',
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [teamsData, playersData, paymentsData] = await Promise.all([
        teams.getAll(),
        players.getByTeam(id),
        payments.getByTeam(id).catch(() => []),
      ])

      const teamData = teamsData.find(t => t.id === parseInt(id))
      setTeam(teamData)
      setRoster(playersData)
      setTeamPayments(paymentsData)
    } catch (error) {
      console.error('Error fetching roster:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await players.create({ ...formData, team_id: id })
      setFormData({ name: '', email: '', phone: '', jersey_number: '', email_notifications: true })
      setShowForm(false)
      fetchData()
    } catch (error) {
      alert('Error adding player: ' + error.message)
    }
  }

  const handleDelete = async (playerId) => {
    if (!confirm('Remove this player from the roster?')) return

    try {
      await players.delete(playerId)
      fetchData()
    } catch (error) {
      alert('Error removing player: ' + error.message)
    }
  }

  const handlePaymentSetup = async (e) => {
    e.preventDefault()
    try {
      // Create payment records for all players
      const promises = roster.map(player =>
        payments.create({
          player_id: player.id,
          team_id: id,
          amount: paymentSetupData.amount,
          description: paymentSetupData.description,
          venmo_link: paymentSetupData.venmo_link,
          due_date: paymentSetupData.due_date,
        })
      )

      await Promise.all(promises)
      setPaymentSetupData({ amount: '', description: 'Season Dues', venmo_link: '', due_date: '' })
      setShowPaymentSetup(false)
      fetchData()
      alert(`Payment records created for ${roster.length} players!`)
    } catch (error) {
      alert('Error setting up payments: ' + error.message)
    }
  }

  const handleMarkPaid = async (paymentId) => {
    try {
      await payments.markPaid(paymentId)
      fetchData()
    } catch (error) {
      alert('Error marking payment as paid: ' + error.message)
    }
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setUploadMessage('')

    try {
      const result = await csv.uploadRoster(id, file)
      setUploadMessage(result.message)
      fetchData()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setUploadMessage('Error: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const getPlayerPayment = (playerId) => {
    return teamPayments.find(p => p.player_id === playerId)
  }

  if (loading) {
    return <div>Loading roster...</div>
  }

  if (!team) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">Team not found</p>
        <button onClick={() => navigate('/teams')} className="btn-primary">
          Back to Teams
        </button>
      </div>
    )
  }

  const paidCount = teamPayments.filter(p => p.status === 'paid').length
  const pendingCount = teamPayments.filter(p => p.status === 'pending').length

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/teams')} className="text-ice-600 hover:underline mb-4">
          ← Back to Teams
        </button>
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div
              className="w-12 h-12 rounded-full mr-4"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <h1 className="text-3xl font-bold mb-1">{team.name}</h1>
              <p className="text-gray-600">Team Roster</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
            >
              {showForm ? 'Cancel' : '+ Add Player'}
            </button>
            <button
              onClick={() => csv.downloadRosterTemplate()}
              className="btn-secondary"
              title="Download CSV Template"
            >
              📄 Template
            </button>
            <label className="btn-secondary cursor-pointer" title="Upload Roster CSV">
              📤 Upload CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {uploadMessage && (
        <div className={`mb-6 p-4 rounded ${uploadMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {uploadMessage}
        </div>
      )}

      {uploading && (
        <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded">
          Uploading and processing CSV... This may take a moment.
        </div>
      )}

      {/* Payment Status Summary */}
      {teamPayments.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-3">Payment Status</h3>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-green-600">{paidCount}</div>
              <div className="text-sm text-gray-600">Paid</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-ice-600">{roster.length}</div>
              <div className="text-sm text-gray-600">Total Players</div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Player to Roster</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Player Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="label">Jersey Number</label>
                <input
                  type="number"
                  value={formData.jersey_number}
                  onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                  className="input"
                  placeholder="99"
                  min="0"
                  max="99"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="player@example.com"
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="notifications"
                checked={formData.email_notifications}
                onChange={(e) => setFormData({ ...formData, email_notifications: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                Send email notifications for games and updates
              </label>
            </div>

            <button type="submit" className="btn-primary">
              Add Player
            </button>
          </form>
        </div>
      )}

      {/* Payment Setup Form */}
      {showPaymentSetup && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Set Up Season Dues</h2>
          <p className="text-gray-600 mb-4">
            This will create payment records for all {roster.length} players on the roster.
          </p>
          <form onSubmit={handlePaymentSetup} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentSetupData.amount}
                  onChange={(e) => setPaymentSetupData({ ...paymentSetupData, amount: e.target.value })}
                  className="input"
                  placeholder="150.00"
                  required
                />
              </div>

              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  value={paymentSetupData.due_date}
                  onChange={(e) => setPaymentSetupData({ ...paymentSetupData, due_date: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <input
                type="text"
                value={paymentSetupData.description}
                onChange={(e) => setPaymentSetupData({ ...paymentSetupData, description: e.target.value })}
                className="input"
                placeholder="Season Dues"
              />
            </div>

            <div>
              <label className="label">Venmo Link (optional)</label>
              <input
                type="url"
                value={paymentSetupData.venmo_link}
                onChange={(e) => setPaymentSetupData({ ...paymentSetupData, venmo_link: e.target.value })}
                className="input"
                placeholder="https://venmo.com/u/yourhandle"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: https://venmo.com/u/yourhandle or https://account.venmo.com/u/yourhandle
              </p>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Create Payment Records
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentSetup(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-500 mb-4">No players on this roster yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Add Your First Player
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Roster ({roster.length} players)</h2>
            {!showPaymentSetup && teamPayments.length === 0 && (
              <button
                onClick={() => setShowPaymentSetup(true)}
                className="btn-primary text-sm"
              >
                💰 Set Up Season Dues
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  {teamPayments.length > 0 && (
                    <>
                      <th className="text-center py-3 px-4">Payment Status</th>
                      <th className="text-center py-3 px-4">Payment</th>
                    </>
                  )}
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((player) => {
                  const payment = getPlayerPayment(player.id)
                  return (
                    <tr key={player.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold">
                        {player.jersey_number || '-'}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          {player.name}
                          {player.is_captain === 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ice-100 text-ice-800">
                              Captain
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {player.email || player.user_email || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {player.phone || player.user_phone || '-'}
                      </td>
                      {teamPayments.length > 0 && (
                        <>
                          <td className="py-3 px-4 text-center">
                            {payment ? (
                              payment.status === 'paid' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✓ Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  ⚠ Pending
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400 text-xs">No record</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {payment && payment.status === 'pending' && (
                              <div className="flex flex-col gap-1 items-center">
                                {payment.venmo_link && (
                                  <a
                                    href={payment.venmo_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ice-600 hover:text-ice-700 text-xs underline"
                                  >
                                    Pay via Venmo
                                  </a>
                                )}
                                <button
                                  onClick={() => handleMarkPaid(payment.id)}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Mark as Paid
                                </button>
                              </div>
                            )}
                            {payment && payment.status === 'paid' && payment.paid_date && (
                              <span className="text-xs text-gray-500">
                                {new Date(payment.paid_date).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDelete(player.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
