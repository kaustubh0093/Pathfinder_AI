import axios from 'axios'

const api = axios.create({
  baseURL: '/api', // proxied to http://localhost:8000 by Vite
  timeout: 120000, // 2 min — LLM calls are slow
})

export default api


