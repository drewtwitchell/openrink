const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Helper function to get auth token
const getToken = () => {
  return localStorage.getItem('token')
}

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

// Auth API
export const auth = {
  signUp: async (email, password, name, phone, position) => {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, phone, position }),
    })
    if (data.token) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  signIn: async (email, password) => {
    const data = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (data.token) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  signOut: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },

  getUser: () => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  },

  updateProfile: async (name, phone, position) => {
    const data = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, phone, position }),
    })
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  searchUsers: (query) => apiRequest(`/api/auth/users/search?q=${encodeURIComponent(query)}`),

  getAllUsers: () => apiRequest('/api/auth/users'),

  updateUserRole: (userId, role) => apiRequest(`/api/auth/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  }),

  resetUserPassword: (userId, newPassword) => apiRequest(`/api/auth/users/${userId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ new_password: newPassword }),
  }),

  changePassword: async (currentPassword, newPassword) => {
    return apiRequest('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      }),
    })
  },

  deleteUser: (userId) => apiRequest(`/api/auth/users/${userId}`, {
    method: 'DELETE',
  }),

  isAuthenticated: () => {
    return !!getToken()
  },
}

// Leagues API
export const leagues = {
  getAll: (showArchived = false) => apiRequest(`/api/leagues${showArchived ? '?showArchived=true' : ''}`),
  getById: (id) => apiRequest(`/api/leagues/${id}`),
  getManagers: (id) => apiRequest(`/api/leagues/${id}/managers`),
  addManager: (id, email) => apiRequest(`/api/leagues/${id}/managers`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  removeManager: (id, userId) => apiRequest(`/api/leagues/${id}/managers/${userId}`, {
    method: 'DELETE',
  }),
  create: (data) => apiRequest('/api/leagues', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/api/leagues/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  archive: (id, archived) => apiRequest(`/api/leagues/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  }),
  delete: (id) => apiRequest(`/api/leagues/${id}`, {
    method: 'DELETE',
  }),
}

// Seasons API
export const seasons = {
  getByLeague: (leagueId) => apiRequest(`/api/seasons/league/${leagueId}`),
  getActive: (leagueId) => apiRequest(`/api/seasons/league/${leagueId}/active`),
  getById: (id) => apiRequest(`/api/seasons/${id}`),
  create: (data) => apiRequest('/api/seasons', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/api/seasons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  archive: (id, archived) => apiRequest(`/api/seasons/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  }),
  setActive: (id) => apiRequest(`/api/seasons/${id}/set-active`, {
    method: 'PATCH',
  }),
  delete: (id) => apiRequest(`/api/seasons/${id}`, {
    method: 'DELETE',
  }),
  getPaymentStats: (id) => apiRequest(`/api/seasons/${id}/payment-stats`),
  getPlayersPayments: (id) => apiRequest(`/api/seasons/${id}/players-payments`),
}

// Teams API
export const teams = {
  getAll: () => apiRequest('/api/teams'),
  create: (data) => apiRequest('/api/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/api/teams/${id}`, {
    method: 'DELETE',
  }),
}

// Games API
export const games = {
  getAll: () => apiRequest('/api/games'),
  create: (data) => apiRequest('/api/games', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateScore: (id, homeScore, awayScore) => apiRequest(`/api/games/${id}/score`, {
    method: 'PUT',
    body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
  }),
  delete: (id) => apiRequest(`/api/games/${id}`, {
    method: 'DELETE',
  }),
}

// Rinks API
export const rinks = {
  getAll: () => apiRequest('/api/rinks'),
  create: (data) => apiRequest('/api/rinks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}

// Players API
export const players = {
  getAll: () => apiRequest('/api/players'),
  getByTeam: (teamId) => apiRequest(`/api/players/team/${teamId}`),
  create: (data) => apiRequest('/api/players', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/api/players/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  transfer: (id, teamId) => apiRequest(`/api/players/${id}/transfer`, {
    method: 'PATCH',
    body: JSON.stringify({ team_id: teamId }),
  }),
  delete: (id) => apiRequest(`/api/players/${id}`, {
    method: 'DELETE',
  }),
  getHistory: (id) => apiRequest(`/api/players/${id}/history`),
  getHistoryByUser: (userId) => apiRequest(`/api/players/user/${userId}/history`),
}

// Announcements API
export const announcements = {
  getActive: (leagueId) => apiRequest(`/api/announcements/league/${leagueId}`),
  getAll: (leagueId) => apiRequest(`/api/announcements/league/${leagueId}/all`),
  create: (data) => apiRequest('/api/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/api/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/api/announcements/${id}`, {
    method: 'DELETE',
  }),
}

// Playoffs API
export const playoffs = {
  getByLeagueSeason: (leagueId, seasonId) => apiRequest(`/api/playoffs/league/${leagueId}/season/${seasonId}`),
  getActive: (leagueId, seasonId) => apiRequest(`/api/playoffs/league/${leagueId}/season/${seasonId}/active`),
  getById: (bracketId) => apiRequest(`/api/playoffs/${bracketId}`),
  create: (data) => apiRequest('/api/playoffs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateMatch: (matchId, data) => apiRequest(`/api/playoffs/matches/${matchId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  toggleActive: (bracketId) => apiRequest(`/api/playoffs/${bracketId}/toggle`, {
    method: 'PUT',
  }),
  delete: (bracketId) => apiRequest(`/api/playoffs/${bracketId}`, {
    method: 'DELETE',
  }),
}

// CSV API
export const csv = {
  downloadRosterTemplate: () => {
    window.open(`${API_URL}/api/csv/templates/roster`, '_blank')
  },
  downloadScheduleTemplate: () => {
    window.open(`${API_URL}/api/csv/templates/schedule`, '_blank')
  },
  downloadStandingsTemplate: () => {
    window.open(`${API_URL}/api/csv/templates/standings`, '_blank')
  },
  uploadRoster: async (teamId, file) => {
    const formData = new FormData()
    formData.append('file', file)

    const token = getToken()
    const response = await fetch(`${API_URL}/api/csv/upload/roster/${teamId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },
  uploadSchedule: async (leagueId, file) => {
    const formData = new FormData()
    formData.append('file', file)

    const token = getToken()
    const response = await fetch(`${API_URL}/api/csv/upload/schedule/${leagueId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },
}

// Payments API
export const payments = {
  getByTeam: (teamId) => apiRequest(`/api/payments/team/${teamId}`),
  getByPlayer: (playerId) => apiRequest(`/api/payments/player/${playerId}`),
  create: (data) => apiRequest('/api/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  markPaid: (id, confirmationNumber = null, paymentNotes = null, paymentMethod = null) => apiRequest(`/api/payments/${id}/paid`, {
    method: 'PUT',
    body: JSON.stringify({
      confirmation_number: confirmationNumber,
      payment_notes: paymentNotes,
      payment_method: paymentMethod,
    }),
  }),
  markUnpaid: (id) => apiRequest(`/api/payments/${id}/unpaid`, {
    method: 'PUT',
  }),
  updateAmount: (id, amount) => apiRequest(`/api/payments/${id}/amount`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  }),
  delete: (id) => apiRequest(`/api/payments/${id}`, {
    method: 'DELETE',
  }),
}

// Sub Requests API
export const subRequests = {
  getAll: () => apiRequest('/api/sub-requests'),
  getByGame: (gameId) => apiRequest(`/api/sub-requests/game/${gameId}`),
  create: (data) => apiRequest('/api/sub-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  accept: (id, substitutePlayerId) => apiRequest(`/api/sub-requests/${id}/accept`, {
    method: 'PUT',
    body: JSON.stringify({ substitute_player_id: substitutePlayerId }),
  }),
  delete: (id) => apiRequest(`/api/sub-requests/${id}`, {
    method: 'DELETE',
  }),
}

// Team Captains API
export const teamCaptains = {
  getByTeam: (teamId) => apiRequest(`/api/team-captains/team/${teamId}`),
  add: (userId, teamId) => apiRequest('/api/team-captains', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, team_id: teamId }),
  }),
  remove: (userId, teamId) => apiRequest('/api/team-captains', {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId, team_id: teamId }),
  }),
}
