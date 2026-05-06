import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000, // 2 min — LLM calls are slow
  headers: import.meta.env.VITE_APP_SECRET
    ? { 'X-App-Secret': import.meta.env.VITE_APP_SECRET }
    : {},
})

export default api


