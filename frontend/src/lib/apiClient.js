import axios from 'axios'

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

api.interceptors.request.use(config => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let isRefreshing = false
let waitQueue = []

function drainQueue(token, error) {
  waitQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  waitQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }
    original._retry = true
    isRefreshing = true
    try {
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
      accessToken = data.accessToken
      drainQueue(data.accessToken, null)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (refreshErr) {
      accessToken = null
      drainQueue(null, refreshErr)
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
