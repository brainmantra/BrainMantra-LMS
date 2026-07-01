import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// Attach student id to every request so the backend can identify the caller
api.interceptors.request.use(config => {
  const stored = localStorage.getItem('abacus_student')
  if (stored) {
    try {
      const { id } = JSON.parse(stored)
      if (id) config.headers['x-student-id'] = id
    } catch {}
  }
  return config
})

export default api
