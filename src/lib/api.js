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
  signUp: async (email, password, name) => {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
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

  updateProfile: async (name) => {
    const data = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  getAllUsers: () => apiRequest('/api/auth/users'),

  updateUserRole: (userId, role) => apiRequest(`/api/auth/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  }),

  isAuthenticated: () => {
    return !!getToken()
  },
}

// Leagues API
export const leagues = {
  getAll: () => apiRequest('/api/leagues'),
  getById: (id) => apiRequest(`/api/leagues/${id}`),
  create: (data) => apiRequest('/api/leagues', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/api/leagues/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/api/leagues/${id}`, {
    method: 'DELETE',
  }),
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
  delete: (id) => apiRequest(`/api/players/${id}`, {
    method: 'DELETE',
  }),
}
