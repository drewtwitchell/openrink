import { useState, useEffect } from 'react'
import { auth, players as playersApi, teams as teamsApi, leagues } from '../lib/api'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('player')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('intent')

  const openSubRequestEmail = async () => {
    try {
      const user = auth.getUser()

      // Fetch all players to find which teams this user is on
      const allPlayers = await playersApi.getAll()
      const userPlayers = allPlayers.filter(p => p.user_id === user.id)

      if (userPlayers.length === 0) {
        setMessage('You are not assigned to any team yet. Please contact your league administrator.')
        return
      }

      // Get all teams
      const allTeams = await teamsApi.getAll()
      const userTeams = allTeams.filter(t => userPlayers.some(p => p.team_id === t.id))

      if (userTeams.length === 0) {
        setMessage('No team found. Please contact your league administrator.')
        return
      }

      // For now, use the first team
      const team = userTeams[0]

      // Get team captains
      const captainsResponse = await fetch(`${API_URL}/api/team-captains/team/${team.id}`)
      const captains = await captainsResponse.json()

      // Get league managers/owners
      const managersResponse = await fetch(`${API_URL}/api/leagues/${team.league_id}/managers`)
      const managers = await managersResponse.json()

      // Collect all email addresses
      const emails = []
      captains.forEach(captain => {
        if (captain.email) emails.push(captain.email)
      })
      managers.forEach(manager => {
        if (manager.email) emails.push(manager.email)
      })

      // Remove duplicates
      const uniqueEmails = [...new Set(emails)]

      if (uniqueEmails.length === 0) {
        setMessage('No captain or league manager emails found. Please contact your team directly.')
        return
      }

      // Create mailto link
      const subject = encodeURIComponent(`Sub Request - ${team.name}`)
      const body = encodeURIComponent(`Hi,\n\nI need to request a substitute for an upcoming game.\n\nTeam: ${team.name}\n\nPlease let me know which game you'd like me to find a sub for.\n\nThanks,\n${user.name}`)
      const mailtoLink = `mailto:${uniqueEmails.join(',')}?subject=${subject}&body=${body}`

      window.location.href = mailtoLink

      // Navigate to home after opening email
      setTimeout(() => {
        navigate('/')
      }, 500)

    } catch (error) {
      console.error('Error opening sub request email:', error)
      setMessage('Error preparing email. Please contact your team captain directly.')
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        await auth.signUp(email, password, name, phone, position)
        setMessage('Account created successfully!')
      } else {
        await auth.signIn(email, password)
      }
      onLogin()

      // If intent is request-sub, open email
      if (intent === 'request-sub') {
        await openSubRequestEmail()
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      setMessage(error.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h2>

        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.includes('success')
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="label">Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="input"
                  required
                >
                  <option value="player">Player</option>
                  <option value="goalie">Goalie</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label">{isSignUp ? 'Email' : 'Username or Email'}</label>
            <input
              type={isSignUp ? "email" : "text"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder={isSignUp ? "you@example.com" : "Enter username or email"}
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-ice-600 hover:underline"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}
